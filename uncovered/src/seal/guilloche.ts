import { createRandom, hashString, normaliseName } from '../lib/random';

/*
 * Guilloche seals, the engraved rosettes of share certificates and banknotes.
 * A rose-engine lathe cuts them by turning the plate while a cam pushes the
 * cutter in and out; here each layer is a family of phase-shifted curves:
 *
 *  - lace:    epitrochoids, z(t) = R·e^{it} + A·e^{i(p·t + φ)}, which loop
 *             p - 1 times around the band when A·|p| > R;
 *  - weave:   radial waves, r(t) = R + A·sin(p·t + φ)·(1 - ε + ε·cos(q·t));
 *  - rosette: hypotrochoid stars, z(t) = (R - r)·e^{it} + d·e^{-i(R - r)t / r}.
 *
 * Every parameter comes from a seed, so a company's name always yields the
 * same seal and no two names share one. Geometry is in unit space: the seal's
 * outer edge has radius 1.
 */

export type LayerKind = 'lace' | 'weave' | 'rosette' | 'ring';

export interface Layer {
  kind: LayerKind;
  /** Polylines as flat [x0, y0, x1, y1, ...] in unit space. */
  paths: Float32Array[];
  /** Line weight relative to the base hairline. */
  weight: number;
  /** Start of this layer's engraving, as a share of the whole animation. */
  start: number;
  /** End of this layer's engraving. */
  end: number;
}

export interface SealSpec {
  seed: number;
  layers: Layer[];
  /** Radius of the plain centre that carries the monogram. */
  hub: number;
  /** Radius of the microtext ring's baseline. */
  textRadius: number;
}

export type SealDetail = 'full' | 'glyph';

const TAU = Math.PI * 2;

function circle(r: number, steps = 360): Float32Array {
  const out = new Float32Array((steps + 1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TAU;
    out[i * 2] = r * Math.cos(t);
    out[i * 2 + 1] = r * Math.sin(t);
  }
  return out;
}

// Each closed curve starts at its own angle (t0), so line caps never stack
// into a visible seam where every curve would otherwise begin.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function lace(R: number, A: number, p: number, phase: number, steps: number, t0 = 0): Float32Array {
  const out = new Float32Array((steps + 1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = t0 + (i / steps) * TAU;
    out[i * 2] = R * Math.cos(t) + A * Math.cos(p * t + phase);
    out[i * 2 + 1] = R * Math.sin(t) + A * Math.sin(p * t + phase);
  }
  return out;
}

function weave(R: number, A: number, p: number, q: number, eps: number, phase: number, steps: number, t0 = 0) {
  const out = new Float32Array((steps + 1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = t0 + (i / steps) * TAU;
    const r = R + A * Math.sin(p * t + phase) * (1 - eps + eps * Math.cos(q * t));
    out[i * 2] = r * Math.cos(t);
    out[i * 2 + 1] = r * Math.sin(t);
  }
  return out;
}

function rosette(R: number, r: number, d: number, rotation: number, turns: number, steps: number) {
  const out = new Float32Array((steps + 1) * 2);
  const k = (R - r) / r;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TAU * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    out[i * 2] = x * Math.cos(rotation) - y * Math.sin(rotation);
    out[i * 2 + 1] = x * Math.sin(rotation) + y * Math.cos(rotation);
  }
  return out;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The seal for a seed. `glyph` is a sparse version for 20–40 px marks. */
export function sealSpec(seedText: string, detail: SealDetail = 'full'): SealSpec {
  const seed = hashString(normaliseName(seedText) || seedText);
  const rand = createRandom(seed);
  const pick = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const int = (lo: number, hi: number) => Math.floor(pick(lo, hi + 1));
  const glyph = detail === 'glyph';
  const layers: Layer[] = [];

  // Outer border: a double rule, engraved first.
  layers.push({
    kind: 'ring',
    paths: [circle(0.995), circle(glyph ? 0.9 : 0.968)],
    weight: glyph ? 2.2 : 1.2,
    start: 0,
    end: 0.35,
  });

  // Outer band: looping lace.
  const loops = glyph ? int(10, 14) : int(22, 38);
  const laceCopies = glyph ? 3 : int(6, 10);
  const laceR = glyph ? 0.7 : 0.8;
  const laceA = glyph ? 0.13 : pick(0.064, 0.084);
  const laceDir = rand() < 0.5 ? -1 : 1;
  const laceSteps = Math.max(240, loops * (glyph ? 18 : 44));
  const lacePaths: Float32Array[] = [];
  for (let k = 0; k < laceCopies; k++) {
    lacePaths.push(lace(laceR, laceA, laceDir * loops, (k / laceCopies) * TAU, laceSteps, k * GOLDEN));
  }
  layers.push({ kind: 'lace', paths: lacePaths, weight: glyph ? 1.6 : 0.9, start: 0.06, end: 0.78 });

  if (!glyph) {
    // Separating rules.
    layers.push({ kind: 'ring', paths: [circle(0.712), circle(0.7)], weight: 0.8, start: 0.18, end: 0.5 });

    // Middle band: a woven field of radial waves.
    const petals = int(9, 21);
    const lines = int(12, 20);
    const harmonic = int(2, 5);
    const eps = pick(0.15, 0.45);
    const waveA = pick(0.07, 0.095);
    const weavePaths: Float32Array[] = [];
    for (let k = 0; k < lines; k++) {
      weavePaths.push(weave(0.565, waveA, petals, harmonic, eps, (k / lines) * TAU, petals * 36, k * GOLDEN));
    }
    layers.push({ kind: 'weave', paths: weavePaths, weight: 0.7, start: 0.22, end: 0.88 });

    layers.push({ kind: 'ring', paths: [circle(0.425)], weight: 0.8, start: 0.3, end: 0.62 });
  }

  // Inner rosette: hypotrochoid stars, rotated copies.
  const points = glyph ? int(5, 7) : int(5, 13);
  let m = glyph ? 2 : int(2, 4);
  while (gcd(points, m) !== 1) m++;
  const outer = glyph ? 0.42 : 0.4;
  const roll = (outer * m) / points;
  const pen = roll * pick(0.62, 0.95);
  const copies = glyph ? 2 : int(4, 9);
  const rosPaths: Float32Array[] = [];
  for (let k = 0; k < copies; k++) {
    rosPaths.push(rosette(outer, roll, pen, (k / copies) * (TAU / points), m, points * m * 40));
  }
  layers.push({ kind: 'rosette', paths: rosPaths, weight: glyph ? 1.4 : 0.75, start: 0.34, end: 1 });

  const hub = glyph ? 0.16 : pick(0.19, 0.225);
  layers.push({
    kind: 'ring',
    paths: [circle(hub + 0.012), circle(hub)],
    weight: glyph ? 1.4 : 0.9,
    start: 0.55,
    end: 1,
  });

  return { seed, layers, hub, textRadius: 0.934 };
}

/** A short serial for a report: country, year and six digits from the seed. */
export function serialFor(seedText: string, country = 'SI', year = 2026): string {
  const n = hashString(`serial:${normaliseName(seedText)}`) % 1_000_000;
  return `${country} ${year} ${String(n).padStart(6, '0')}`;
}
