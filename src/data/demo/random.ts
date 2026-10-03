/** Deterministic pseudo-random numbers for demo fixtures (mulberry32 + Box–Muller). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussians(seed: number, count: number): number[] {
  const random = mulberry32(seed);
  const out: number[] = [];
  while (out.length < count) {
    const u1 = Math.max(random(), 1e-12);
    const u2 = random();
    const radius = Math.sqrt(-2 * Math.log(u1));
    out.push(radius * Math.cos(2 * Math.PI * u2));
    if (out.length < count) out.push(radius * Math.sin(2 * Math.PI * u2));
  }
  return out;
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
