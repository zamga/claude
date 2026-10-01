/**
 * Small, fast, seedable PRNG (sfc32). Seeded runs make every chart
 * reproducible: the same assumptions always produce the same soundings.
 */
export function createRng(seed: number): () => number {
  let a = 0x9e3779b9 ^ seed;
  let b = 0x243f6a88 ^ (seed * 31);
  let c = 0xb7e15162 ^ (seed * 17);
  let d = 0xdeadbeef ^ seed;
  const next = () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Discard the first outputs so similar seeds diverge.
  for (let i = 0; i < 12; i++) next();
  return next;
}

/** Hash a string to a 32-bit seed (FNV-1a). */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Inverse-CDF sample from a triangular distribution. */
export function sampleTriangular(u: number, low: number, mode: number, high: number): number {
  if (high <= low) return mode;
  const m = Math.min(Math.max(mode, low), high);
  const f = (m - low) / (high - low);
  return u < f
    ? low + Math.sqrt(u * (high - low) * (m - low))
    : high - Math.sqrt((1 - u) * (high - low) * (high - m));
}
