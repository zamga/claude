/** Linear-interpolated percentile of an ascending-sorted array. */
export function percentile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0]!;
  const rank = Math.min(Math.max(p, 0), 1) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.min(n - 1, lo + 1);
  const w = rank - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

/** Share of values strictly above a threshold, for an ascending-sorted array. */
export function shareAbove(sorted: ArrayLike<number>, threshold: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= threshold) lo = mid + 1;
    else hi = mid;
  }
  return (n - lo) / n;
}

export interface Bin {
  x0: number;
  x1: number;
  count: number;
}

/** Fixed-width histogram over [min, max]; values outside are clamped into the end bins. */
export function histogram(values: ArrayLike<number>, min: number, max: number, bins: number): Bin[] {
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({
    x0: min + ((max - min) * i) / bins,
    x1: min + ((max - min) * (i + 1)) / bins,
    count: 0,
  }));
  const width = (max - min) / bins;
  if (!(width > 0)) return out;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    const k = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
    out[k]!.count++;
  }
  return out;
}

/** Compound annual growth rate between two positive values `years` apart. */
export function cagr(first: number, last: number, years: number): number | null {
  if (!(first > 0) || !(last > 0) || years <= 0) return null;
  return (last / first) ** (1 / years) - 1;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
