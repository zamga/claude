/** FNV-1a: a stable 32-bit hash for seeding from text. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** sfc32: a small, fast PRNG with good statistical quality. Returns [0, 1). */
export function createRandom(seed: number): () => number {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Warm up so nearby seeds diverge.
  for (let i = 0; i < 12; i++) next();
  return next;
}

/** Normalise a company name so trivial differences ("d.d." vs "d. d.") share a seal. */
export function normaliseName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(d ?d|d ?o ?o|s ?p|d ?n ?o|k ?d|ltd|plc|inc|ag|gmbh|sa|s ?a|n ?v|corp|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
