import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import type { LampState } from './lamp';
import { paperMap } from './paperMap';

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

/** WebGL that can run this shader, and a person who has not asked to save data. */
export function canInspect(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

export class Paper {
  private readonly renderer: Renderer;
  private readonly program: Program;
  private readonly mesh: Mesh;
  private texture: Texture;
  private lost = false;

  constructor(
    canvas: HTMLCanvasElement,
    seed: string,
    private readonly onLost: () => void,
  ) {
    this.renderer = new Renderer({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    });
    const gl = this.renderer.gl;
    this.texture = this.makeTexture(seed);
    this.program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uMap: { value: this.texture },
        uLight: { value: [0.7, 0.6] },
        uLit: { value: 0 },
        uUV: { value: 0 },
        uTilt: { value: [0, 0] },
        uFoil: { value: [0.8, 0.2, 0] },
        uAspect: { value: 297 / 210 },
        uPaper: { value: [1, 1, 1] },
        uPaperUV: { value: [0.086, 0.078, 0.122] },
        uThread: { value: [0.034, 0.0045] },
      },
    });
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program: this.program });
    canvas.addEventListener('webglcontextlost', this.contextLost, false);
  }

  private makeTexture(seed: string): Texture {
    const gl = this.renderer.gl;
    const map = paperMap(seed);
    return new Texture(gl, {
      image: map.data,
      width: map.width,
      height: map.height,
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
  }

  private contextLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.onLost();
  };

  /** A new company: its own watermark and fibres. */
  setSeed(seed: string) {
    this.texture = this.makeTexture(seed);
    this.program.uniforms.uMap!.value = this.texture;
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

  /** The sheet's size in CSS pixels. */
  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    this.renderer.setSize(width, height);
    this.program.uniforms.uAspect!.value = height / width;
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
