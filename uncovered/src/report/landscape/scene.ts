import { Camera, Geometry, Mesh, Program, Renderer, Transform, Vec3 } from 'ogl';
import { claimGpu } from '../../lib/gpu';

/*
 * The value landscape: the DCF's value across the cost of capital (left to
 * right) and terminal growth (front to back), carved as a block and engraved
 * the way a banknote's vignette is: contour lines at fixed steps of value,
 * hatching whose weight follows the light, strata down the walls. Where the
 * surface meets the market price, a violet line: every pair of assumptions
 * the price implies. The text that reads it (axes, the pin's value) is HTML
 * placed by project().
 */

export interface LandscapeData {
  /** Ascending, across. */
  waccs: number[];
  /** Ascending, front to back. */
  growths: number[];
  /** values[growth][wacc], the DCF value for each pair. */
  values: number[][];
  /** The market price, when there is one. */
  price?: number;
  /** The value range the block's height spans. */
  low: number;
  high: number;
}

export interface LandscapeColors {
  paper: string;
  ink: string;
  price: string;
}

const HEIGHT = 0.95;

const VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute float value;
attribute float wall;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uRise;
varying vec3 vNormal;
varying vec2 vUv;
varying float vValue;
varying float vWall;
varying float vHeight;
void main() {
  vec3 p = position;
  p.y *= uRise;
  vNormal = normal;
  vUv = uv;
  vValue = value;
  vWall = wall;
  vHeight = p.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec2 vUv;
varying float vValue;
varying float vWall;
varying float vHeight;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uPrice;
uniform float uPriceValue;
uniform float uHasPrice;
uniform float uStep;
uniform vec2 uPin;
uniform float uRise;

// Distance to the nearest line of a family, in pixels, and coverage of a line of half-width w pixels.
float lineDist(float q) {
  return abs(fract(q - 0.5) - 0.5) / max(fwidth(q), 1e-5);
}
float line(float q, float w) {
  return 1.0 - smoothstep(w - 0.5, w + 0.5, lineDist(q));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(vec3(-0.55, 0.85, 0.45));
  float shade = clamp(0.35 + 0.65 * dot(n, L), 0.0, 1.0);
  float dark = 1.0 - shade;
  float ink = 0.0;

  if (vWall < 0.5) {
    // The surface: hatching across (lines of constant growth), heavier where the slope turns from the light,
    // and contour lines of constant value, every step and heavier every fifth.
    ink = max(ink, line(vUv.y * 46.0, mix(0.15, 1.35, dark)));
    ink = max(ink, line(vUv.x * 46.0, 1.1) * smoothstep(0.55, 0.85, dark));
    ink = max(ink, line(vValue / uStep, 0.55) * 0.9);
    ink = max(ink, line(vValue / (uStep * 5.0), 1.05));
  } else {
    // The walls: vertical hatching weighted by the light, and a stratum at every fifth level.
    ink = max(ink, line((vUv.x + vUv.y) * 60.0, mix(0.25, 1.3, dark)) * 0.85);
    ink = max(ink, line(vValue / (uStep * 5.0), 0.45) * 0.6);
  }

  vec3 col = mix(uPaper, uInk, ink * 0.92);

  if (vWall < 0.5) {
    // Where the model meets the price: every pair of assumptions the price implies.
    float p = uHasPrice * (1.0 - smoothstep(1.0, 2.4, abs(vValue - uPriceValue) / max(fwidth(vValue), 1e-5)));
    col = mix(col, uPrice, p * smoothstep(0.85, 1.0, uRise));
    // The pin and its two slices across the land.
    vec2 d = vUv - uPin;
    float slice = max(
      1.0 - smoothstep(0.6, 1.6, abs(d.x) / max(fwidth(vUv.x), 1e-5)),
      1.0 - smoothstep(0.6, 1.6, abs(d.y) / max(fwidth(vUv.y), 1e-5))
    );
    col = mix(col, uInk, slice * 0.55);
    float pinDot = 1.0 - smoothstep(0.016, 0.02, length(d));
    col = mix(col, uPrice, pinDot);
  }

  gl_FragColor = vec4(col, 1.0);
}`;

const PLANE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uPrice;
uniform float uRise;
float lineDist(float q) {
  return abs(fract(q - 0.5) - 0.5) / max(fwidth(q), 1e-5);
}
void main() {
  float hatch = 1.0 - smoothstep(0.2, 1.2, lineDist((vUv.x - vUv.y) * 70.0));
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 1.5, min(e.x / max(fwidth(vUv.x), 1e-5), e.y / max(fwidth(vUv.y), 1e-5)));
  float a = (hatch * 0.18 + edge * 0.85 + 0.035) * smoothstep(0.85, 1.0, uRise);
  gl_FragColor = vec4(uPrice * a, a);
}`;

const PLANE_VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** GLSL ES 3.0 where the context is WebGL 2 (derivatives are core); GLSL ES 1.0 with the extension otherwise. */
function dialect(source: string, stage: 'vertex' | 'fragment', webgl2: boolean): string {
  if (webgl2) {
    const head =
      stage === 'vertex'
        ? '#version 300 es\n#define attribute in\n#define varying out\n'
        : '#version 300 es\n#define varying in\nout highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n';
    return head + source;
  }
  return stage === 'fragment' ? `#extension GL_OES_standard_derivatives : enable\n${source}` : source;
}

function rgb(color: string, fallback: [number, number, number]): [number, number, number] {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return fallback;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const height = (v: number, data: LandscapeData) =>
  HEIGHT * Math.min(1.15, Math.max(0, (v - data.low) / (data.high - data.low)));

/** The block: its engraved top and four walls down to the floor. */
function blockGeometry(renderer: Renderer, data: LandscapeData): Geometry {
  const N = data.waccs.length;
  const M = data.growths.length;
  const pos: number[] = [];
  const nrm: number[] = [];
  const uvs: number[] = [];
  const vals: number[] = [];
  const walls: number[] = [];
  const index: number[] = [];
  const xAt = (i: number) => -1 + (2 * i) / (N - 1);
  const zAt = (j: number) => 1 - (2 * j) / (M - 1);
  const h = (i: number, j: number) => height(data.values[j]![i]!, data);

  // Top: a grid with normals from central differences.
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      pos.push(xAt(i), h(i, j), zAt(j));
      const dx =
        (h(Math.min(N - 1, i + 1), j) - h(Math.max(0, i - 1), j)) /
        (xAt(Math.min(N - 1, i + 1)) - xAt(Math.max(0, i - 1)));
      const dz =
        (h(i, Math.min(M - 1, j + 1)) - h(i, Math.max(0, j - 1))) /
        (zAt(Math.min(M - 1, j + 1)) - zAt(Math.max(0, j - 1)));
      const n = new Vec3(-dx, 1, -dz).normalize();
      nrm.push(n.x, n.y, n.z);
      uvs.push(i / (N - 1), j / (M - 1));
      vals.push(data.values[j]![i]!);
      walls.push(0);
    }
  }
  for (let j = 0; j < M - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      index.push(a, a + N, a + 1, a + 1, a + N, a + N + 1);
    }
  }

  // Walls: for each edge, its top run and the same run on the floor.
  const wall = (cells: [number, number][], normal: [number, number, number]) => {
    const start = pos.length / 3;
    for (const [i, j] of cells) {
      for (const top of [true, false]) {
        pos.push(xAt(i), top ? h(i, j) : 0, zAt(j));
        nrm.push(...normal);
        uvs.push(i / (N - 1), j / (M - 1));
        vals.push(top ? data.values[j]![i]! : data.low);
        walls.push(1);
      }
    }
    for (let k = 0; k < cells.length - 1; k++) {
      const a = start + k * 2;
      index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  };
  wall(
    Array.from({ length: N }, (_, i) => [i, 0]),
    [0, 0, 1],
  );
  wall(
    Array.from({ length: N }, (_, i) => [N - 1 - i, M - 1]),
    [0, 0, -1],
  );
  wall(
    Array.from({ length: M }, (_, j) => [N - 1, j]),
    [1, 0, 0],
  );
  wall(
    Array.from({ length: M }, (_, j) => [0, M - 1 - j]),
    [-1, 0, 0],
  );

  return new Geometry(renderer.gl, {
    position: { size: 3, data: new Float32Array(pos) },
    normal: { size: 3, data: new Float32Array(nrm) },
    uv: { size: 2, data: new Float32Array(uvs) },
    value: { size: 1, data: new Float32Array(vals) },
    wall: { size: 1, data: new Float32Array(walls) },
    index: { data: pos.length / 3 < 65536 ? new Uint16Array(index) : new Uint32Array(index) },
  });
}

export class LandscapeScene {
  /** Drawn in software: every frame is read back to be composited, so the block should move only when handled. */
  readonly software: boolean;
  private readonly renderer: Renderer;
  private readonly camera: Camera;
  private readonly scene = new Transform();
  private readonly block: Mesh;
  private readonly plane?: Mesh;
  private readonly program: Program;
  private readonly planeProgram?: Program;
  private width = 1;
  private heightPx = 1;
  private yaw = 0.3;
  private pitch = 0.38;
  private distance = 5.2;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly data: LandscapeData,
    colors: LandscapeColors,
  ) {
    this.software = !claimGpu(canvas, {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'default',
    });
    this.renderer = new Renderer({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      alpha: true,
      antialias: true,
    });
    const gl = this.renderer.gl;
    const webgl2 = this.renderer.isWebgl2;
    if (!webgl2) gl.getExtension('OES_standard_derivatives');
    this.camera = new Camera(gl, { fov: 28, near: 0.1, far: 40 });

    this.program = new Program(gl, {
      vertex: dialect(VERTEX, 'vertex', webgl2),
      fragment: dialect(FRAGMENT, 'fragment', webgl2),
      uniforms: {
        uPaper: { value: rgb(colors.paper, [1, 1, 1]) },
        uInk: { value: rgb(colors.ink, [0.08, 0.37, 0.27]) },
        uPrice: { value: rgb(colors.price, [0.42, 0.29, 0.84]) },
        uPriceValue: { value: data.price ?? 0 },
        uHasPrice: { value: data.price === undefined ? 0 : 1 },
        uStep: { value: niceStep((data.high - data.low) / 14) },
        uPin: { value: [0.5, 0.5] },
        uRise: { value: 1 },
      },
      cullFace: false,
    });
    this.block = new Mesh(gl, { geometry: blockGeometry(this.renderer, data), program: this.program });
    this.block.setParent(this.scene);

    if (data.price !== undefined) {
      this.planeProgram = new Program(gl, {
        vertex: dialect(PLANE_VERTEX, 'vertex', webgl2),
        fragment: dialect(PLANE_FRAGMENT, 'fragment', webgl2),
        uniforms: { uPrice: { value: rgb(colors.price, [0.42, 0.29, 0.84]) }, uRise: { value: 1 } },
        transparent: true,
        depthWrite: false,
        cullFace: false,
      });
      const y = height(data.price, data);
      const s = 1.08;
      this.plane = new Mesh(gl, {
        geometry: new Geometry(gl, {
          position: { size: 3, data: new Float32Array([-s, y, s, s, y, s, -s, y, -s, s, y, -s]) },
          uv: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]) },
          index: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
        }),
        program: this.planeProgram,
      });
      this.plane.setParent(this.scene);
    }
    this.place();
  }

  setColors(colors: LandscapeColors) {
    const u = this.program.uniforms;
    u.uPaper!.value = rgb(colors.paper, [1, 1, 1]);
    u.uInk!.value = rgb(colors.ink, [0.08, 0.37, 0.27]);
    u.uPrice!.value = rgb(colors.price, [0.42, 0.29, 0.84]);
    if (this.planeProgram) this.planeProgram.uniforms.uPrice!.value = u.uPrice!.value;
  }

  /** The pin, in grid units: 0 to 1 across the costs of capital and the growth rates. */
  setPin(u: number, v: number) {
    this.program.uniforms.uPin!.value = [u, v];
  }

  /** How far the block has risen from the floor, 0 to 1. */
  setRise(t: number) {
    this.program.uniforms.uRise!.value = t;
    if (this.planeProgram) this.planeProgram.uniforms.uRise!.value = t;
  }

  /** Turn the view: yaw around the block, pitch above it (radians). */
  setView(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.place();
  }

  private place() {
    const r = this.distance;
    this.camera.position.set(
      r * Math.cos(this.pitch) * Math.sin(this.yaw),
      r * Math.sin(this.pitch),
      r * Math.cos(this.pitch) * Math.cos(this.yaw),
    );
    this.camera.lookAt([0, 0.32, 0]);
  }

  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    this.width = width;
    this.heightPx = height;
    this.renderer.setSize(width, height);
    this.camera.perspective({ aspect: width / height });
    // A narrow stage stands further back, so the whole block stays in frame.
    this.distance = 5.2 + Math.max(0, 1.45 - width / height) * 2.6;
    this.place();
  }

  render() {
    this.renderer.render({ scene: this.scene, camera: this.camera });
  }

  /**
   * Where a point of the landscape lands on the canvas, in CSS pixels: u and v in grid units, the value in
   * money (it sets the height). For placing HTML labels over the drawing.
   */
  project(u: number, v: number, value: number, rise = 1): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    const p = new Vec3(-1 + 2 * u, height(value, this.data) * rise, 1 - 2 * v);
    p.applyMatrix4(this.camera.projectionViewMatrix);
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.heightPx };
  }

  destroy() {
    this.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** A round step for contour lines near the given size: 1, 2 or 5 times a power of ten. */
export function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
