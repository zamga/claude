import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  FloatType,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  Points,
  RedFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  MeshBasicMaterial,
  BoxGeometry,
  RingGeometry,
  DoubleSide,
  Vector3,
  WebGLRenderer,
  SRGBColorSpace,
  MathUtils,
  Raycaster,
  Vector2,
  Vector4,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Sounding, ValueGrid } from '../../engine/types';
import { ELEVATION_LIMIT, elevation } from '../../engine/grid';
import type { ChartPalette } from '../palette';
import {
  soundingFragment,
  soundingVertex,
  terrainFragment,
  terrainVertex,
  wallFragment,
  wallVertex,
  waterFragment,
  waterVertex,
} from './shaders';

/** World size of the chart block: growth along x, margin along −z. */
const SIZE_X = 4;
const SIZE_Z = 3.4;
const HEIGHT = 0.62;
const FLOOR = -HEIGHT * 1.02;
const DEFAULT_POLAR = 0.98;
const DEFAULT_AZIMUTH = -0.5;

export interface StagePoint {
  growth: number;
  margin: number;
  /** Elevation relative to sea level at this point. */
  elevation: number;
  screen: { x: number; y: number };
}

export interface ProjectedLabel {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface TerrainStageOptions {
  canvas: HTMLCanvasElement;
  palette: ChartPalette;
  reducedMotion: boolean;
  /** Hero mode: gentle sway, no bearing editing, no draft marks. */
  ambient?: boolean;
  /** Camera distance relative to a snug fit; above 1 leaves more room around the block. */
  fit?: number;
  /** Shift the picture within the canvas, as fractions of its size (positive = up and left). */
  shift?: { x: number; y: number };
  touch?: boolean;
  onHover?: (point: StagePoint | null) => void;
  onBearing?: (growth: number, margin: number, phase: 'start' | 'move' | 'end') => void;
  /** Called after each rendered frame with projected overlay anchors. */
  onProject?: (labels: ProjectedLabel[]) => void;
  onContextLost?: () => void;
}

const easeBuoy = (t: number) => 1 - Math.pow(1 - t, 4);
const easeTide = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const heightOf = (e: number, scale: number) => scale * HEIGHT * 0.95 * Math.tanh(e / 0.95);

function rgb(c: string): Color {
  return new Color().setStyle(c, SRGBColorSpace);
}

/**
 * The 3D chart: a block diagram of value. Land is every story worth more
 * than the price; the translucent sea fills to the price; the coastline is
 * the market's expectation. Renders on demand; idles at zero GPU cost.
 */
export class TerrainStage {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(26, 1, 0.1, 100);
  private controls: OrbitControls;
  private terrain: Mesh<BufferGeometry, ShaderMaterial>;
  private walls: Mesh<BufferGeometry, ShaderMaterial>;
  private water: Mesh<BoxGeometry, ShaderMaterial>;
  private waterEdge: Line<BufferGeometry, LineBasicMaterial>;
  private bearing = new Group();
  private bearingHead: Mesh<SphereGeometry, MeshBasicMaterial>;
  private bearingStem: Line<BufferGeometry, LineBasicMaterial>;
  private bearingRing: Mesh<RingGeometry, MeshBasicMaterial>;
  private today = new Group();
  private soundings: Points<BufferGeometry, ShaderMaterial> | null = null;
  private texA: DataTexture | null = null;
  private texB: DataTexture | null = null;
  private nx = 0;
  private ny = 0;
  private grid: ValueGrid | null = null;
  private elev: Float32Array | null = null;
  private refPrice = 1;
  private seaLevel = 0;
  private heightScale = 1;
  private morph = 1;
  private frame = 0;
  private animations = new Set<(now: number) => boolean>();
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private visible = true;
  private intersection: IntersectionObserver;
  private bearingPoint: { growth: number; margin: number } | null = null;
  private todayPoint: { growth: number; margin: number } | null = null;
  private dragging = false;
  private down: { x: number; y: number; t: number } | null = null;
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private swayStart = performance.now();
  private lastSwayFrame = 0;
  private interacted = false;
  /** A rise requested while the chart was off screen waits until it is seen. */
  private pendingRise: number | null = null;

  constructor(private opts: TerrainStageOptions) {
    const { canvas } = opts;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.6;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = 1.22;
    this.controls.minAzimuthAngle = -1.45;
    this.controls.maxAzimuthAngle = 1.45;
    this.controls.target.set(0, -0.05, 0);
    if (opts.touch) {
      // One finger scrolls the page; two fingers turn and zoom the chart.
      this.controls.touches.ONE = -1 as never;
      canvas.style.touchAction = 'pan-y';
    }
    this.controls.addEventListener('change', () => this.invalidate());
    this.controls.addEventListener('start', () => {
      this.interacted = true;
    });

    // Terrain surface.
    this.terrain = new Mesh(new BufferGeometry(), this.makeTerrainMaterial());
    this.terrain.frustumCulled = false;
    this.scene.add(this.terrain);

    // Block walls.
    this.walls = new Mesh(new BufferGeometry(), this.makeWallMaterial());
    this.walls.frustumCulled = false;
    this.scene.add(this.walls);

    // Water column up to the price.
    this.water = new Mesh(new BoxGeometry(SIZE_X - 0.004, 1, SIZE_Z - 0.004), this.makeWaterMaterial());
    this.water.renderOrder = 2;
    this.scene.add(this.water);
    this.waterEdge = new Line(new BufferGeometry(), new LineBasicMaterial({ transparent: true, opacity: 0.9 }));
    this.waterEdge.renderOrder = 3;
    this.scene.add(this.waterEdge);

    // Bearing: a magenta staff planted on the chart.
    const signal = new MeshBasicMaterial({ depthTest: false, transparent: true });
    this.bearingHead = new Mesh(new SphereGeometry(0.045, 20, 12), signal);
    this.bearingHead.renderOrder = 5;
    this.bearingStem = new Line(new BufferGeometry(), new LineBasicMaterial({ depthTest: false, transparent: true }));
    this.bearingStem.renderOrder = 5;
    this.bearingRing = new Mesh(
      new RingGeometry(0.07, 0.095, 40),
      new MeshBasicMaterial({ side: DoubleSide, depthTest: false, transparent: true }),
    );
    this.bearingRing.rotation.x = -Math.PI / 2;
    this.bearingRing.renderOrder = 5;
    this.bearing.add(this.bearingStem, this.bearingHead, this.bearingRing);
    this.bearing.visible = false;
    this.scene.add(this.bearing);

    const todayMark = new Mesh(
      new RingGeometry(0.035, 0.055, 4),
      new MeshBasicMaterial({ side: DoubleSide, depthTest: false, transparent: true }),
    );
    todayMark.rotation.x = -Math.PI / 2;
    todayMark.renderOrder = 4;
    this.today.add(todayMark);
    this.today.visible = false;
    this.scene.add(this.today);

    this.setPalette(opts.palette);
    this.resetCamera(opts.reducedMotion ? DEFAULT_POLAR : 0.02);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('webglcontextlost', this.onContextLost);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry?.isIntersecting ?? true;
      if (this.visible && this.pendingRise !== null) {
        const delay = this.pendingRise;
        this.pendingRise = null;
        this.rise(delay);
      }
      if (this.visible) this.invalidate();
    });
    this.intersection.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  /* ------------------------------------------------------------------ data */

  /**
   * Show a new value grid. `morph` cross-fades from the previous terrain
   * (company changes); otherwise heights update in place (assumption drags).
   */
  setTerrain(grid: ValueGrid, price: number, options: { morph?: boolean; rebase?: boolean } = {}) {
    const sameShape = this.grid && this.nx === grid.nx && this.ny === grid.ny;
    if (options.rebase || !this.grid) this.refPrice = price;
    this.grid = grid;
    const elev = new Float32Array(grid.values.length);
    for (let k = 0; k < elev.length; k++) elev[k] = elevation(grid.values[k]!, this.refPrice);

    if (!sameShape) {
      this.nx = grid.nx;
      this.ny = grid.ny;
      this.buildGeometry();
      this.texA?.dispose();
      this.texB?.dispose();
      this.texA = this.makeTexture(elev);
      this.texB = this.makeTexture(elev);
      this.morph = 1;
    } else if (options.morph && !this.opts.reducedMotion) {
      // Freeze whatever is on screen into A, then tween to the new field in B.
      const current = this.currentElevation();
      (this.texA!.image.data as Float32Array).set(current);
      this.texA!.needsUpdate = true;
      (this.texB!.image.data as Float32Array).set(elev);
      this.texB!.needsUpdate = true;
      this.morph = 0;
      const start = performance.now();
      this.animate((now) => {
        this.morph = easeTide(Math.min(1, (now - start) / 1100));
        return this.morph < 1;
      });
    } else {
      (this.texB!.image.data as Float32Array).set(elev);
      this.texB!.needsUpdate = true;
      this.morph = 1;
    }
    this.elev = elev;
    const u = this.terrain.material.uniforms;
    u.uElevA!.value = this.texA;
    u.uElevB!.value = this.texB;
    this.walls.material.uniforms.uElevA!.value = this.texA;
    this.walls.material.uniforms.uElevB!.value = this.texB;
    u.uTexSize!.value.set(this.nx, this.ny);
    this.walls.material.uniforms.uTexSize!.value.set(this.nx, this.ny);
    const e = grid.extent;
    u.uExtent!.value.set(e.growthMin, e.growthMax, e.marginMin, e.marginMax);
    this.setPrice(price, false);
    this.placeBearing();
    this.placeToday();
    this.invalidate();
  }

  /** Move the sea to a new price. */
  setPrice(price: number, animate = true) {
    const target = Math.log(price / this.refPrice);
    const from = this.seaLevel;
    if (!animate || this.opts.reducedMotion || Math.abs(target - from) < 1e-4) {
      this.applySeaLevel(target);
      return;
    }
    const start = performance.now();
    this.animate((now) => {
      const t = Math.min(1, (now - start) / 700);
      this.applySeaLevel(from + (target - from) * easeTide(t));
      return t < 1;
    });
  }

  setMarginOfSafety(mos: number) {
    this.terrain.material.uniforms.uLoadLine!.value = -Math.log(1 - Math.min(0.9, Math.max(0, mos)));
    this.invalidate();
  }

  setBearing(point: { growth: number; margin: number } | null) {
    this.bearingPoint = point;
    this.placeBearing();
    this.invalidate();
  }

  setToday(point: { growth: number; margin: number } | null) {
    this.todayPoint = point;
    this.placeToday();
    this.invalidate();
  }

  setSoundings(list: Sounding[] | null, price: number) {
    if (this.soundings) {
      this.scene.remove(this.soundings);
      this.soundings.geometry.dispose();
      this.soundings.material.dispose();
      this.soundings = null;
    }
    if (!list?.length || !this.grid) {
      this.invalidate();
      return;
    }
    const pos = new Float32Array(list.length * 3);
    const col = new Float32Array(list.length * 3);
    const land = rgb(this.opts.palette.markLand);
    const water = rgb(this.opts.palette.markWater);
    list.forEach((s, k) => {
      const [x, z] = this.toWorldXZ(s.growth, s.targetMargin);
      pos[k * 3] = x;
      pos[k * 3 + 1] = this.surfaceY(s.growth, s.targetMargin) + 0.012;
      pos[k * 3 + 2] = z;
      const c = s.value >= price ? land : water;
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new BufferAttribute(col, 3));
    const mat = new ShaderMaterial({
      vertexShader: soundingVertex,
      fragmentShader: soundingFragment,
      uniforms: { uSize: { value: 3.2 * this.renderer.getPixelRatio() } },
      transparent: true,
      depthWrite: false,
    });
    this.soundings = new Points(geo, mat);
    this.soundings.renderOrder = 4;
    this.soundings.visible = this.heightScale > 0.98;
    this.scene.add(this.soundings);
    this.invalidate();
  }

  setPalette(p: ChartPalette) {
    this.opts.palette = p;
    const u = this.terrain.material.uniforms;
    u.uLand1!.value = rgb(p.land1);
    u.uLand2!.value = rgb(p.land2);
    u.uLand3!.value = rgb(p.land3);
    u.uLandLine!.value = rgb(p.landLine);
    u.uIntertidal!.value = rgb(p.intertidal);
    u.uIntertidalInk!.value = rgb(p.intertidalInk);
    u.uWater1!.value = rgb(p.water1);
    u.uWater2!.value = rgb(p.water2);
    u.uWaterLine!.value = rgb(p.waterLine);
    u.uPaper!.value = rgb(p.paper);
    u.uInk!.value = rgb(p.ink);
    u.uRule!.value = rgb(p.rule);
    u.uDark!.value = p.dark ? 1 : 0;
    const w = this.walls.material.uniforms;
    w.uFace!.value = rgb(p.paperRaised).lerp(rgb(p.land1), p.dark ? 0.25 : 0.35);
    w.uLine!.value = rgb(p.landLine);
    const wa = this.water.material.uniforms;
    wa.uWater!.value = rgb(p.water1);
    wa.uEdge!.value = rgb(p.paperRaised);
    wa.uSideAlpha!.value = p.dark ? 0.62 : 0.55;
    this.waterEdge.material.color = rgb(p.waterInk);
    this.bearingHead.material.color = rgb(p.signal);
    this.bearingStem.material.color = rgb(p.signal);
    this.bearingRing.material.color = rgb(p.signal);
    (this.today.children[0] as Mesh<RingGeometry, MeshBasicMaterial>).material.color = rgb(p.ink);
    this.invalidate();
  }

  /** The chart rises off the page: flat top-down view lifts into relief. */
  rise(delay = 120) {
    if (this.opts.reducedMotion) {
      this.heightScale = 1;
      this.applyHeight();
      return;
    }
    this.heightScale = 0;
    this.applyHeight();
    if (!this.visible || !this.isOnScreen()) {
      // Hold the flat chart until someone can watch it rise.
      this.pendingRise = delay;
      return;
    }
    const start = performance.now() + delay;
    const polarFrom = 0.02;
    this.animate((now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1900));
      const k = easeBuoy(t);
      this.heightScale = k;
      this.applyHeight();
      if (!this.interacted) this.orbitTo(MathUtils.lerp(polarFrom, DEFAULT_POLAR, k), DEFAULT_AZIMUTH * k);
      return t < 1;
    });
  }

  private isOnScreen() {
    const r = this.opts.canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  }

  resetCamera(polar = DEFAULT_POLAR, azimuth = polar < 0.1 ? 0 : DEFAULT_AZIMUTH) {
    this.orbitTo(polar, azimuth);
    this.invalidate();
  }

  /** Fly back to the default oblique view. */
  home() {
    const from = this.sphericalNow();
    const start = performance.now();
    this.animate((now) => {
      const t = Math.min(1, (now - start) / (this.opts.reducedMotion ? 1 : 900));
      const k = easeTide(t);
      this.orbitTo(
        MathUtils.lerp(from.polar, DEFAULT_POLAR, k),
        MathUtils.lerp(from.azimuth, DEFAULT_AZIMUTH, k),
        MathUtils.lerp(from.radius, this.fitRadius(), k),
      );
      return t < 1;
    });
  }

  /** Look straight down: the flat chart. */
  topDown() {
    const from = this.sphericalNow();
    const start = performance.now();
    this.animate((now) => {
      const t = Math.min(1, (now - start) / (this.opts.reducedMotion ? 1 : 900));
      const k = easeTide(t);
      this.orbitTo(MathUtils.lerp(from.polar, 0.001, k), MathUtils.lerp(from.azimuth, 0, k));
      return t < 1;
    });
  }

  /** PNG of the current view, for sharing. */
  snapshot(): string {
    this.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    const c = this.opts.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerUp);
    c.removeEventListener('pointerleave', this.onPointerLeave);
    c.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver.disconnect();
    this.intersection.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as { dispose?: () => void } | undefined;
      mat?.dispose?.();
    });
    this.texA?.dispose();
    this.texB?.dispose();
    this.renderer.dispose();
  }

  /* ------------------------------------------------------------ rendering */

  invalidate() {
    if (this.disposed || this.frame) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frame = 0;
    if (this.disposed) return;
    let again = false;
    for (const step of [...this.animations]) {
      if (!step(now)) this.animations.delete(step);
      else again = true;
    }
    const swaying =
      this.opts.ambient &&
      !this.opts.reducedMotion &&
      !this.interacted &&
      this.visible &&
      this.heightScale >= 1 &&
      now - this.swayStart < 60_000; // The ship settles after a minute.
    if (swaying) {
      // A slow sway, like a chart table on a moored ship, at no more than 30 fps.
      again = true;
      if (now - this.lastSwayFrame >= 33) {
        this.lastSwayFrame = now;
        const t = (now - this.swayStart) / 1000;
        this.orbitTo(DEFAULT_POLAR + Math.sin(t * 0.21) * 0.035, DEFAULT_AZIMUTH + Math.sin(t * 0.13) * 0.16);
      } else if (this.animations.size === 0 && !this.controls.update()) {
        this.invalidate();
        return;
      }
    }
    const moving = this.controls.update();
    if (this.visible) this.render();
    if ((again || moving) && this.visible && document.visibilityState === 'visible') this.invalidate();
  };

  private render() {
    this.renderer.render(this.scene, this.camera);
    this.project();
  }

  private animate(step: (now: number) => boolean) {
    this.animations.add(step);
    this.invalidate();
  }

  private resize() {
    const host = this.opts.canvas.parentElement ?? this.opts.canvas;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const shift = this.opts.shift;
    if (shift) this.camera.setViewOffset(w, h, shift.x * w, shift.y * h, w, h);
    this.camera.updateProjectionMatrix();
    const s = this.sphericalNow();
    this.orbitTo(s.polar, s.azimuth, this.fitRadius());
    this.invalidate();
  }

  /** Camera distance that fits the block for the current aspect ratio. */
  private fitRadius() {
    const radius = Math.hypot(SIZE_X, SIZE_Z) / 2 + 0.2;
    const vFov = MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fov = Math.min(vFov, hFov);
    return (radius / Math.sin(fov / 2)) * (this.opts.fit ?? 0.84);
  }

  private sphericalNow() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const radius = offset.length() || this.fitRadius();
    return {
      radius,
      polar: Math.acos(MathUtils.clamp(offset.y / radius, -1, 1)),
      azimuth: Math.atan2(offset.x, offset.z),
    };
  }

  private orbitTo(polar: number, azimuth: number, radius = this.sphericalNow().radius) {
    const t = this.controls.target;
    this.camera.position.set(
      t.x + radius * Math.sin(polar) * Math.sin(azimuth),
      t.y + radius * Math.cos(polar),
      t.z + radius * Math.sin(polar) * Math.cos(azimuth),
    );
    this.camera.lookAt(t);
    this.invalidate();
  }

  private applySeaLevel(level: number) {
    this.seaLevel = level;
    this.terrain.material.uniforms.uSeaLevel!.value = level;
    this.applyHeight();
  }

  private applyHeight() {
    const s = this.heightScale;
    this.terrain.material.uniforms.uHeight!.value = s;
    this.walls.material.uniforms.uHeight!.value = s;
    this.walls.material.uniforms.uFloor!.value = FLOOR * Math.max(s, 0.002);
    const seaY = heightOf(this.seaLevel, s);
    this.walls.material.uniforms.uSeaY!.value = seaY;
    const bottom = FLOOR * Math.max(s, 0.002);
    const depth = Math.max(0.0005, seaY - bottom);
    this.water.scale.set(1, depth, 1);
    this.water.position.y = bottom + depth / 2;
    this.water.visible = s > 0.02;
    const hx = SIZE_X / 2;
    const hz = SIZE_Z / 2;
    this.waterEdge.geometry.setFromPoints([
      new Vector3(-hx, seaY, hz),
      new Vector3(hx, seaY, hz),
      new Vector3(hx, seaY, -hz),
      new Vector3(-hx, seaY, -hz),
      new Vector3(-hx, seaY, hz),
    ]);
    this.waterEdge.visible = s > 0.02;
    if (this.soundings) this.soundings.visible = s > 0.98;
    this.placeBearing();
    this.placeToday();
    this.invalidate();
  }

  /* -------------------------------------------------------------- geometry */

  private buildGeometry() {
    const { nx, ny } = this;
    const pos = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = -SIZE_X / 2 + (SIZE_X * i) / (nx - 1);
        pos[k * 3 + 2] = SIZE_Z / 2 - (SIZE_Z * j) / (ny - 1);
        uv[k * 2] = i / (nx - 1);
        uv[k * 2 + 1] = j / (ny - 1);
      }
    }
    const index: number[] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        index.push(a, b, d, a, d, c);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
    geo.setIndex(index);
    this.terrain.geometry.dispose();
    this.terrain.geometry = geo;

    // Walls: the four edges of the grid, each vertex doubled (top and floor).
    const edge: Array<[number, number]> = [];
    for (let i = 0; i < nx; i++) edge.push([i, 0]);
    for (let j = 1; j < ny; j++) edge.push([nx - 1, j]);
    for (let i = nx - 2; i >= 0; i--) edge.push([i, ny - 1]);
    for (let j = ny - 2; j >= 0; j--) edge.push([0, j]);
    const wpos = new Float32Array(edge.length * 2 * 3);
    const wuv = new Float32Array(edge.length * 2 * 2);
    const top = new Float32Array(edge.length * 2);
    edge.forEach(([i, j], k) => {
      const x = -SIZE_X / 2 + (SIZE_X * i) / (nx - 1);
      const z = SIZE_Z / 2 - (SIZE_Z * j) / (ny - 1);
      for (let s = 0; s < 2; s++) {
        const v = k * 2 + s;
        wpos[v * 3] = x;
        wpos[v * 3 + 2] = z;
        wuv[v * 2] = i / (nx - 1);
        wuv[v * 2 + 1] = j / (ny - 1);
        top[v] = s === 0 ? 1 : 0;
      }
    });
    const windex: number[] = [];
    for (let k = 0; k < edge.length - 1; k++) {
      const a = k * 2;
      windex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const wgeo = new BufferGeometry();
    wgeo.setAttribute('position', new BufferAttribute(wpos, 3));
    wgeo.setAttribute('uv', new BufferAttribute(wuv, 2));
    wgeo.setAttribute('aTop', new BufferAttribute(top, 1));
    wgeo.setIndex(windex);
    this.walls.geometry.dispose();
    this.walls.geometry = wgeo;
  }

  private makeTexture(data: Float32Array) {
    const tex = new DataTexture(new Float32Array(data), this.nx, this.ny, RedFormat, FloatType);
    tex.minFilter = NearestFilter;
    tex.magFilter = NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private makeTerrainMaterial() {
    return new ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        uElevA: { value: null },
        uElevB: { value: null },
        uMorph: { value: 1 },
        uHeight: { value: 1 },
        uTexSize: { value: new Vector2(2, 2) },
        uSize: { value: new Vector2(SIZE_X, SIZE_Z) },
        uSeaLevel: { value: 0 },
        uLoadLine: { value: 0.223 },
        uExtent: { value: new Vector4() },
        uLand1: { value: new Color() },
        uLand2: { value: new Color() },
        uLand3: { value: new Color() },
        uLandLine: { value: new Color() },
        uIntertidal: { value: new Color() },
        uIntertidalInk: { value: new Color() },
        uWater1: { value: new Color() },
        uWater2: { value: new Color() },
        uWaterLine: { value: new Color() },
        uPaper: { value: new Color() },
        uInk: { value: new Color() },
        uRule: { value: new Color() },
        uDark: { value: 0 },
      },
    });
  }

  private makeWallMaterial() {
    return new ShaderMaterial({
      vertexShader: wallVertex,
      fragmentShader: wallFragment,
      uniforms: {
        uElevA: { value: null },
        uElevB: { value: null },
        uMorph: { value: 1 },
        uHeight: { value: 1 },
        uTexSize: { value: new Vector2(2, 2) },
        uFloor: { value: FLOOR },
        uFace: { value: new Color() },
        uLine: { value: new Color() },
        uSeaY: { value: 0 },
      },
      side: DoubleSide,
    });
  }

  private makeWaterMaterial() {
    return new ShaderMaterial({
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      uniforms: {
        uWater: { value: new Color() },
        uEdge: { value: new Color() },
        uSideAlpha: { value: 0.55 },
        uTopAlpha: { value: 0.06 },
      },
      transparent: true,
      depthWrite: false,
    });
  }

  /* ------------------------------------------------------------- geography */

  private toWorldXZ(growth: number, margin: number): [number, number] {
    const e = this.grid!.extent;
    const u = (growth - e.growthMin) / (e.growthMax - e.growthMin);
    const v = (margin - e.marginMin) / (e.marginMax - e.marginMin);
    return [-SIZE_X / 2 + u * SIZE_X, SIZE_Z / 2 - v * SIZE_Z];
  }

  private fromWorldXZ(x: number, z: number) {
    const e = this.grid!.extent;
    const u = (x + SIZE_X / 2) / SIZE_X;
    const v = (SIZE_Z / 2 - z) / SIZE_Z;
    return {
      growth: e.growthMin + u * (e.growthMax - e.growthMin),
      margin: e.marginMin + v * (e.marginMax - e.marginMin),
      inside: u >= 0 && u <= 1 && v >= 0 && v <= 1,
    };
  }

  /** Elevation currently shown (mid-morph aware), bilinear in grid space. */
  private elevationAt(growth: number, margin: number) {
    if (!this.grid || !this.elev) return 0;
    const { nx, ny, extent: e } = this.grid;
    const fx = MathUtils.clamp(((growth - e.growthMin) / (e.growthMax - e.growthMin)) * (nx - 1), 0, nx - 1);
    const fy = MathUtils.clamp(((margin - e.marginMin) / (e.marginMax - e.marginMin)) * (ny - 1), 0, ny - 1);
    const x0 = Math.min(nx - 2, Math.floor(fx));
    const y0 = Math.min(ny - 2, Math.floor(fy));
    const tx = fx - x0;
    const ty = fy - y0;
    const field = this.morph >= 1 ? this.elev : this.currentElevation();
    const a = field[y0 * nx + x0]!;
    const b = field[y0 * nx + x0 + 1]!;
    const c = field[(y0 + 1) * nx + x0]!;
    const d = field[(y0 + 1) * nx + x0 + 1]!;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  private surfaceY(growth: number, margin: number) {
    return heightOf(this.elevationAt(growth, margin), this.heightScale);
  }

  private currentElevation(): Float32Array {
    const a = this.texA?.image.data as Float32Array | undefined;
    const b = this.texB?.image.data as Float32Array | undefined;
    if (!a || !b) return this.elev ?? new Float32Array();
    const out = new Float32Array(b.length);
    for (let k = 0; k < out.length; k++) out[k] = a[k]! + (b[k]! - a[k]!) * this.morph;
    return out;
  }

  private placeBearing() {
    const p = this.bearingPoint;
    if (!p || !this.grid) {
      this.bearing.visible = false;
      return;
    }
    const [x, z] = this.toWorldXZ(p.growth, p.margin);
    const y = this.surfaceY(p.growth, p.margin);
    const tip = Math.max(y, heightOf(this.seaLevel, this.heightScale)) + 0.42;
    this.bearingStem.geometry.setFromPoints([new Vector3(x, y, z), new Vector3(x, tip, z)]);
    this.bearingHead.position.set(x, tip, z);
    this.bearingRing.position.set(x, y + 0.004, z);
    this.bearing.visible = true;
  }

  private placeToday() {
    const p = this.todayPoint;
    if (!p || !this.grid) {
      this.today.visible = false;
      return;
    }
    const [x, z] = this.toWorldXZ(p.growth, p.margin);
    this.today.position.set(x, this.surfaceY(p.growth, p.margin) + 0.006, z);
    this.today.visible = true;
  }

  /* ------------------------------------------------------------ projection */

  private project() {
    if (!this.opts.onProject || !this.grid) return;
    const canvas = this.opts.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const e = this.grid.extent;
    const labels: ProjectedLabel[] = [];
    const v = new Vector3();
    const push = (id: string, x: number, y: number, z: number) => {
      v.set(x, y, z).project(this.camera);
      labels.push({ id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 });
    };
    const floor = FLOOR * Math.max(this.heightScale, 0.002);
    const sparse = w < 520 ? 2 : 1;
    const stepG = (e.growthMax - e.growthMin > 0.6 ? 0.1 : 0.05) * sparse;
    for (let g = Math.ceil(e.growthMin / stepG - 1e-9) * stepG; g <= e.growthMax + 1e-9; g += stepG) {
      const [x] = this.toWorldXZ(g, e.marginMin);
      push(`g:${g.toFixed(2)}`, x, floor, SIZE_Z / 2 + 0.16);
    }
    const stepM = (e.marginMax - e.marginMin > 0.6 ? 0.1 : 0.05) * sparse;
    for (let m = Math.ceil(e.marginMin / stepM - 1e-9) * stepM; m <= e.marginMax + 1e-9; m += stepM) {
      const [, z] = this.toWorldXZ(e.growthMin, m);
      push(`m:${m.toFixed(2)}`, -SIZE_X / 2 - 0.16, floor, z);
    }
    // Draft marks on the front-right corner of the block, clear of the axis labels.
    for (const level of this.opts.ambient ? [] : [-0.5, 0, 0.5, 1]) {
      const y = heightOf(level + this.seaLevel, this.heightScale);
      if (y < floor - 1e-3) continue;
      push(`d:${level}`, SIZE_X / 2 + 0.03, y, SIZE_Z / 2 + 0.03);
    }
    if (this.bearing.visible) {
      const head = this.bearingHead.position;
      push('bearing', head.x, head.y + 0.03, head.z);
    }
    this.opts.onProject(labels);
  }

  /* ----------------------------------------------------------------- input */

  /** Ray-march the height field for an exact pick under the pointer. */
  private pick(clientX: number, clientY: number): StagePoint | null {
    if (!this.grid) return null;
    const rect = this.opts.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    const maxT = 40;
    let prevT = 0;
    let prevAbove = true;
    const p = new Vector3();
    const steps = 220;
    for (let k = 1; k <= steps; k++) {
      const t = (maxT * k) / steps;
      p.copy(direction).multiplyScalar(t).add(origin);
      const g = this.fromWorldXZ(p.x, p.z);
      if (!g.inside) {
        prevT = t;
        prevAbove = true;
        continue;
      }
      const above = p.y > this.surfaceY(g.growth, g.margin);
      if (prevAbove && !above) {
        // Refine between prevT and t.
        let lo = prevT;
        let hi = t;
        for (let r = 0; r < 18; r++) {
          const mid = (lo + hi) / 2;
          p.copy(direction).multiplyScalar(mid).add(origin);
          const gm = this.fromWorldXZ(p.x, p.z);
          if (p.y > this.surfaceY(gm.growth, gm.margin)) lo = mid;
          else hi = mid;
        }
        const hit = this.fromWorldXZ(p.x, p.z);
        return {
          growth: hit.growth,
          margin: hit.margin,
          elevation: this.elevationAt(hit.growth, hit.margin) - this.seaLevel,
          screen: { x: clientX - rect.left, y: clientY - rect.top },
        };
      }
      prevT = t;
      prevAbove = above;
    }
    return null;
  }

  private nearBearing(clientX: number, clientY: number) {
    if (!this.bearing.visible) return false;
    const rect = this.opts.canvas.getBoundingClientRect();
    const v = this.bearingHead.position.clone().project(this.camera);
    const x = (v.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
    const ring = this.bearingRing.position.clone().project(this.camera);
    const rx = (ring.x * 0.5 + 0.5) * rect.width + rect.left;
    const ry = (-ring.y * 0.5 + 0.5) * rect.height + rect.top;
    // Anywhere along the staff counts.
    const dx = rx - x;
    const dy = ry - y;
    const len2 = dx * dx + dy * dy || 1;
    const t = MathUtils.clamp(((clientX - x) * dx + (clientY - y) * dy) / len2, 0, 1);
    return Math.hypot(clientX - (x + t * dx), clientY - (y + t * dy)) < 16;
  }

  private onPointerDown = (ev: PointerEvent) => {
    this.interacted = true;
    this.down = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    if (this.opts.onBearing && !this.opts.ambient && this.nearBearing(ev.clientX, ev.clientY)) {
      this.dragging = true;
      this.controls.enabled = false;
      this.opts.canvas.setPointerCapture(ev.pointerId);
      this.opts.onBearing(this.bearingPoint!.growth, this.bearingPoint!.margin, 'start');
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (this.dragging) {
      const hit = this.pick(ev.clientX, ev.clientY);
      if (hit) this.opts.onBearing?.(hit.growth, hit.margin, 'move');
      return;
    }
    if (ev.pointerType === 'touch') return;
    this.opts.canvas.style.cursor =
      this.opts.onBearing && !this.opts.ambient && this.nearBearing(ev.clientX, ev.clientY) ? 'grab' : '';
    this.opts.onHover?.(this.pick(ev.clientX, ev.clientY));
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (this.dragging) {
      this.dragging = false;
      this.controls.enabled = true;
      if (this.opts.canvas.hasPointerCapture(ev.pointerId)) this.opts.canvas.releasePointerCapture(ev.pointerId);
      const hit = this.pick(ev.clientX, ev.clientY);
      if (hit) this.opts.onBearing?.(hit.growth, hit.margin, 'end');
      return;
    }
    const d = this.down;
    this.down = null;
    if (!d || ev.type === 'pointercancel') return;
    const tap = Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 6 && performance.now() - d.t < 450;
    if (tap && this.opts.onBearing && !this.opts.ambient) {
      const hit = this.pick(ev.clientX, ev.clientY);
      if (hit) this.opts.onBearing(hit.growth, hit.margin, 'end');
    }
  };

  private onPointerLeave = () => {
    if (!this.dragging) this.opts.onHover?.(null);
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.invalidate();
  };

  private onContextLost = (ev: Event) => {
    ev.preventDefault();
    this.opts.onContextLost?.();
  };
}

export { ELEVATION_LIMIT };
