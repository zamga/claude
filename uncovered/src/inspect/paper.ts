import { Mesh, Program, Renderer, RenderTarget, Texture, Triangle } from 'ogl';
import { claimGpu } from '../lib/gpu';
import type { LampState } from './lamp';
import { WATERMARK, watermarkImage } from './paperMap';

/*
 * The sheet itself, drawn by one fragment shader under the cover's printed
 * HTML: paper that dims and lets light through when it is held to the lamp
 * (showing the watermark, the fibres and the security thread), fluoresces
 * under UV, and carries a foil under the seal whose colours move with the
 * angle. The printed text stays HTML above it, so nothing here carries
 * content: without WebGL the page is simply paper.
 */

export type PaperMode = 'day' | 'uv';

const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform vec2 uLight;
uniform float uLit;
uniform float uUV;
uniform vec2 uTilt;
uniform vec3 uFoil;
uniform float uAspect;
uniform vec3 uPaper;
uniform vec3 uPaperUV;
uniform vec2 uThread;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 hueToRgb(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
  // Sheet units: 0 to 1 across, 0 to 1 down, as the HTML above it.
  vec2 st = vec2(vUv.x, 1.0 - vUv.y);
  vec4 map = texture2D(uMap, vUv);
  float grain = hash(floor(gl_FragCoord.xy)) - 0.5;
  vec2 d = (st - uLight) * vec2(1.0, uAspect);
  float r2 = dot(d, d);
  float halo = uLit * exp(-r2 / 0.05);
  float core = uLit * exp(-r2 / 0.012);

  // The security thread runs inside the sheet: invisible on its face, a dark line against the light.
  float thread = 1.0 - smoothstep(uThread.y * 0.6, uThread.y, abs(st.x - uThread.x));

  vec3 col;
  if (uUV < 0.5) {
    // Held to the light: the sheet stays white, and where the lamp shines through it the light turns
    // warm and shows what is inside the pulp: the watermark and fibres (thicker, so darker) and the thread.
    vec3 face = uPaper * (1.0 + 0.012 * grain);
    float pulp = 0.85 * map.r + 0.45 * map.g + 0.75 * thread;
    vec3 warm = mix(vec3(1.0), vec3(1.0, 0.955, 0.86), halo * 0.85);
    col = face * warm * (1.0 - halo * pulp * 0.3);
  } else {
    vec3 base = uPaperUV * (1.0 + 0.04 * grain);
    vec3 lamp = vec3(0.36, 0.25, 0.78) * halo * 0.22;
    vec3 fibre = hueToRgb(map.a) * 0.75 + 0.25;
    vec3 glow = fibre * map.b * halo * 1.6;
    glow += vec3(0.98, 0.92, 0.42) * thread * halo * 0.9;
    glow += vec3(0.39, 0.89, 0.72) * map.r * halo * 0.16;
    col = base + lamp + glow;
  }

  // Foil under the seal: a diffraction grating whose colours move with the angle of the sheet.
  vec2 fd = (st - uFoil.xy) * vec2(1.0, uAspect);
  float fr = length(fd) / max(uFoil.z, 1e-4);
  if (fr < 1.02) {
    vec2 dir = fd / max(length(fd), 1e-4);
    float angle = dot(dir, uTilt) * 0.55 + dot(uTilt, vec2(0.35, 0.25));
    float t = angle + fr * 0.9 + sin(fr * 64.0) * 0.06 + 0.18 * (st.x - st.y);
    vec3 spectrum = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
    float flake = step(0.985, hash(floor(gl_FragCoord.xy / 2.0))) * (0.35 + 0.65 * halo);
    vec3 silver = uUV < 0.5 ? vec3(0.86, 0.87, 0.88) : vec3(0.22, 0.2, 0.3);
    vec3 foil = mix(silver, spectrum, uUV < 0.5 ? 0.42 : 0.6) + core * 0.55 + flake * 0.4;
    col = mix(col, foil, (1.0 - smoothstep(0.985, 1.02, fr)) * 0.92);
  }

  gl_FragColor = vec4(col, 1.0);
}`;

function rgb(color: string, fallback: [number, number, number]): [number, number, number] {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return fallback;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** The paper is decoration: leave it out for a person who has asked to save data. */
export function wantsPaper(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

/*
 * The paper's map is baked once on the GPU, never drawn on the CPU: R the
 * watermark (from a small canvas of the company's seal), G the fibres seen
 * against the light, B the fluorescent fibres, A the hue each glows in. Each
 * fibre is a short straight strand, one in about half of the cells of a
 * grid, found from the nine cells around a point.
 */
const BAKE = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uWatermark;
uniform vec4 uMark;
uniform float uSeed;
uniform vec2 uCells;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 fibre(vec2 st, float cells, float aspect, float seed) {
  vec2 p = st * vec2(cells, cells * aspect);
  vec2 cell = floor(p);
  float best = 0.0;
  float hue = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      float present = step(0.48, hash(c + seed * 5.3));
      vec2 centre = c + vec2(hash(c + seed), hash(c + seed * 2.1));
      float ang = hash(c + seed * 1.7) * 6.2831853;
      vec2 reach = vec2(cos(ang), sin(ang)) * (0.45 + 0.65 * hash(c + seed * 3.1)) * 0.5;
      vec2 a = centre - reach;
      vec2 ba = 2.0 * reach;
      float t = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
      float d = length(p - a - ba * t);
      float w = 0.045 + 0.03 * hash(c + seed * 4.7);
      float v = present * (1.0 - smoothstep(w * 0.5, w * 1.6, d)) * (0.45 + 0.55 * hash(c + seed * 6.1));
      if (v > best) {
        best = v;
        hue = hash(c + seed * 7.9);
      }
    }
  }
  return vec2(best, hue);
}

void main() {
  vec2 st = vec2(vUv.x, 1.0 - vUv.y);
  float aspect = uMark.w;
  vec2 wm = (st - uMark.xy) * vec2(1.0, aspect) / (2.0 * uMark.z) + 0.5;
  float inside = step(0.0, wm.x) * step(wm.x, 1.0) * step(0.0, wm.y) * step(wm.y, 1.0);
  float mark = inside * texture2D(uWatermark, vec2(wm.x, 1.0 - wm.y)).r;
  vec2 day = fibre(st, uCells.x, aspect, uSeed);
  vec2 glow = fibre(st, uCells.y, aspect, uSeed + 13.0);
  gl_FragColor = vec4(mark, day.x, glow.x, glow.y);
}`;

const BAKE_WIDTH = 1024;

export class Paper {
  private readonly renderer: Renderer;
  private readonly program: Program;
  private readonly mesh: Mesh;
  private readonly bakeProgram: Program;
  private readonly bakeMesh: Mesh;
  private readonly watermark: Texture;
  private target: RenderTarget;
  private aspect = 297 / 210;
  private lost = false;

  constructor(
    canvas: HTMLCanvasElement,
    seed: string,
    private readonly onLost: () => void,
  ) {
    const attributes = { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' } as const;
    // The paper is decoration: drawn in software it would cost more than it gives, so the sheet stays plain.
    if (!claimGpu(canvas, { ...attributes, stencil: false, premultipliedAlpha: false })) {
      throw new Error('No GPU to draw the paper');
    }
    this.renderer = new Renderer({ canvas, dpr: Math.min(window.devicePixelRatio || 1, 2), ...attributes });
    const gl = this.renderer.gl;
    const triangle = new Triangle(gl);
    this.watermark = new Texture(gl, {
      image: watermarkImage(seed),
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
    this.bakeProgram = new Program(gl, {
      vertex: VERTEX,
      fragment: BAKE,
      uniforms: {
        uWatermark: { value: this.watermark },
        uMark: { value: [WATERMARK.x, WATERMARK.y, WATERMARK.r, this.aspect] },
        uSeed: { value: seedNumber(seed) },
        uCells: { value: [70, 26] },
      },
    });
    this.bakeMesh = new Mesh(gl, { geometry: triangle, program: this.bakeProgram });
    this.target = this.makeTarget();
    this.program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uMap: { value: this.target.texture },
        uLight: { value: [0.7, 0.6] },
        uLit: { value: 0 },
        uUV: { value: 0 },
        uTilt: { value: [0, 0] },
        uFoil: { value: [0.8, 0.2, 0] },
        uAspect: { value: this.aspect },
        uPaper: { value: [1, 1, 1] },
        uPaperUV: { value: [0.086, 0.078, 0.122] },
        uThread: { value: [0.034, 0.0045] },
      },
    });
    this.mesh = new Mesh(gl, { geometry: triangle, program: this.program });
    this.bake();
    canvas.addEventListener('webglcontextlost', this.contextLost, false);
  }

  private makeTarget(): RenderTarget {
    return new RenderTarget(this.renderer.gl, {
      width: BAKE_WIDTH,
      height: Math.round(BAKE_WIDTH * this.aspect),
      depth: false,
    });
  }

  /** Bake the map for the sheet's current proportions. */
  private bake() {
    this.bakeProgram.uniforms.uMark!.value = [WATERMARK.x, WATERMARK.y, WATERMARK.r, this.aspect];
    this.renderer.render({ scene: this.bakeMesh, target: this.target });
  }

  private contextLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.onLost();
  };

  /** A new company: its own watermark and fibres. */
  setSeed(seed: string) {
    this.watermark.image = watermarkImage(seed);
    this.watermark.needsUpdate = true;
    this.bakeProgram.uniforms.uSeed!.value = seedNumber(seed);
    this.bake();
  }

  /** Daylight or UV, with the sheet's colour in each from the page's tokens. */
  setLook(mode: PaperMode, paper: string, paperUV: string) {
    const u = this.program.uniforms;
    u.uUV!.value = mode === 'uv' ? 1 : 0;
    u.uPaper!.value = rgb(paper, [1, 1, 1]);
    u.uPaperUV!.value = rgb(paperUV, [0.086, 0.078, 0.122]);
  }

  /** The foil's centre and radius, in sheet units (radius as a share of the width). */
  setFoil(x: number, y: number, r: number) {
    this.program.uniforms.uFoil!.value = [x, y, r];
  }

  /** The sheet's size in CSS pixels. A sheet whose proportions change is baked again, so fibres stay round. */
  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    this.renderer.setSize(width, height);
    const aspect = height / width;
    this.program.uniforms.uAspect!.value = aspect;
    if (Math.abs(aspect - this.aspect) / this.aspect > 0.02) {
      this.aspect = aspect;
      this.target = this.makeTarget();
      this.program.uniforms.uMap!.value = this.target.texture;
      this.bake();
    }
  }

  render(state: LampState) {
    if (this.lost) return;
    const u = this.program.uniforms;
    u.uLight!.value = [state.x, state.y];
    u.uLit!.value = state.lit;
    u.uTilt!.value = [state.tiltX, state.tiltY];
    this.renderer.render({ scene: this.mesh });
  }

  destroy() {
    this.renderer.gl.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** A small number from a name, for the shader's hashes (kept small so float precision holds). */
function seedNumber(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return h / 97;
}
