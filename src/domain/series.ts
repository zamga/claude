/**
 * Chart data utilities (spec pages 23 and 39).
 *
 * The source series is the truth: inspection always binary-searches the full, timestamp-sorted
 * source. Drawing may use a reduced representation that keeps gaps, extrema and endpoints.
 */

export interface Sample {
  /** Epoch milliseconds (UTC) of the observation or bar end. */
  t: number;
  /** Observed value; null marks a missing interval, which breaks the line. */
  v: number | null;
}

/** Index of the first sample with t >= target (samples sorted by t). */
export function lowerBound(samples: readonly Sample[], target: number): number {
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid]!.t < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function previousValid(samples: readonly Sample[], from: number): number {
  for (let i = Math.min(from, samples.length - 1); i >= 0; i -= 1) {
    if (samples[i]!.v != null) return i;
  }
  return -1;
}

function nextValid(samples: readonly Sample[], from: number): number {
  for (let i = Math.max(from, 0); i < samples.length; i += 1) {
    if (samples[i]!.v != null) return i;
  }
  return -1;
}

/**
 * The actual sample whose timestamp minimises |sample.t - t|, skipping missing values.
 * Exact ties choose the earlier sample. Returns -1 when no valid sample exists.
 */
export function nearestValidIndex(samples: readonly Sample[], t: number): number {
  if (samples.length === 0) return -1;
  const insertion = lowerBound(samples, t);
  const after = nextValid(samples, insertion);
  const before = previousValid(samples, insertion - 1);
  if (before === -1) return after;
  if (after === -1) return before;
  const dBefore = Math.abs(t - samples[before]!.t);
  const dAfter = Math.abs(samples[after]!.t - t);
  return dAfter < dBefore ? after : before;
}

/**
 * Nearest valid sample on an ordinal (index) axis — used where closed sessions are compressed.
 * `position` is a fractional index; exact half-way ties choose the earlier sample.
 */
export function nearestValidOrdinal(samples: readonly Sample[], position: number): number {
  if (samples.length === 0) return -1;
  const clamped = Math.min(Math.max(position, 0), samples.length - 1);
  const floor = Math.floor(clamped);
  const before = previousValid(samples, floor);
  const after = nextValid(samples, floor === clamped ? floor : floor + 1);
  if (before === -1) return after;
  if (after === -1) return before;
  return after - clamped < clamped - before ? after : before;
}

export function firstValidIndex(samples: readonly Sample[]): number {
  return nextValid(samples, 0);
}

export function lastValidIndex(samples: readonly Sample[]): number {
  return previousValid(samples, samples.length - 1);
}

export function validCount(samples: readonly Sample[]): number {
  let count = 0;
  for (const sample of samples) if (sample.v != null) count += 1;
  return count;
}

/** Step to the adjacent valid sample (keyboard Left/Right). */
export function stepValid(samples: readonly Sample[], from: number, delta: -1 | 1): number {
  if (from < 0) return delta > 0 ? firstValidIndex(samples) : lastValidIndex(samples);
  const candidate = delta > 0 ? nextValid(samples, from + 1) : previousValid(samples, from - 1);
  return candidate === -1 ? from : candidate;
}

/** Contiguous runs of valid samples; a missing value ends a run. */
export function segments(samples: readonly Sample[]): Sample[][] {
  const runs: Sample[][] = [];
  let current: Sample[] = [];
  for (const sample of samples) {
    if (sample.v == null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push(sample);
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

export interface Extent {
  min: number;
  max: number;
}

/** Value extent with padding; a flat series receives symmetric padding (spec page 23). */
export function valueExtent(samples: readonly Sample[], paddingRatio = 0.08): Extent | null {
  let min = Infinity;
  let max = -Infinity;
  for (const sample of samples) {
    if (sample.v == null) continue;
    if (sample.v < min) min = sample.v;
    if (sample.v > max) max = sample.v;
  }
  if (!Number.isFinite(min)) return null;
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1;
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * paddingRatio;
  return { min: min - pad, max: max + pad };
}

/**
 * Reduce a series for drawing to roughly `target` points using per-bucket min/max, keeping
 * gaps, the global extrema and both endpoints. Inspection must still use the source series.
 */
export function downsampleForDrawing(samples: readonly Sample[], target: number): Sample[] {
  if (samples.length <= target || target < 4) return samples.slice();
  const bucketSize = Math.ceil(samples.length / Math.floor(target / 2));
  const out: Sample[] = [];
  for (let start = 0; start < samples.length; start += bucketSize) {
    const bucket = samples.slice(start, start + bucketSize);
    let lo: Sample | null = null;
    let hi: Sample | null = null;
    let sawGap = false;
    for (const sample of bucket) {
      if (sample.v == null) {
        sawGap = true;
        continue;
      }
      if (!lo || sample.v < lo.v!) lo = sample;
      if (!hi || sample.v > hi.v!) hi = sample;
    }
    if (sawGap) {
      // Preserve the break: emit the valid extremes around a null marker in time order.
      const firstNull = bucket.find((sample) => sample.v == null)!;
      const beforeGap = bucket.filter((sample) => sample.v != null && sample.t < firstNull.t);
      const afterGap = bucket.filter((sample) => sample.v != null && sample.t > firstNull.t);
      if (beforeGap.length) out.push(beforeGap[beforeGap.length - 1]!);
      out.push(firstNull);
      if (afterGap.length) out.push(afterGap[0]!);
      continue;
    }
    if (lo && hi) {
      if (lo === hi) out.push(lo);
      else if (lo.t < hi.t) out.push(lo, hi);
      else out.push(hi, lo);
    }
  }
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  if (out[0] !== first) out.unshift(first);
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** "Nice" axis ticks between min and max. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const rawStep = (max - min) / Math.max(count, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceResidual = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  const step = niceResidual * magnitude;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}
