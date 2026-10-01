import { valuePerShare } from './dcf';
import type { ValuationInputs } from './types';

/** Search ranges for the reverse solvers. Beyond these the answer is not meaningful. */
export const MARGIN_BOUNDS = { min: -0.5, max: 0.95 } as const;
export const GROWTH_BOUNDS = { min: -0.4, max: 1.2 } as const;

export type Solved =
  | { kind: 'solved'; value: number }
  /** Even the top of the range is worth less than the price. */
  | { kind: 'beyond' }
  /** Even the bottom of the range is worth more than the price. */
  | { kind: 'below' };

function bisect(f: (x: number) => number, lo: number, hi: number, tol = 1e-7): number {
  let fLo = f(lo);
  for (let i = 0; i < 100 && hi - lo > tol; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (fMid > 0 === fLo > 0) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * The target operating margin at which the model is worth exactly `price`,
 * holding every other input. Value rises monotonically with margin, so a
 * bracketed bisection always converges.
 */
export function impliedMargin(inputs: ValuationInputs, price: number): Solved {
  const scratch = { ...inputs };
  const f = (m: number) => {
    scratch.targetMargin = m;
    return valuePerShare(scratch) - price;
  };
  if (f(MARGIN_BOUNDS.max) < 0) return { kind: 'beyond' };
  if (f(MARGIN_BOUNDS.min) > 0) return { kind: 'below' };
  return { kind: 'solved', value: bisect(f, MARGIN_BOUNDS.min, MARGIN_BOUNDS.max) };
}

/**
 * The years 1–5 revenue growth at which the model is worth exactly `price`.
 * Value is not always monotonic in growth: when returns on new capital sit
 * below the cost of capital, growth destroys value. We scan for crossings and
 * prefer the lowest growth rate where value rises through the price.
 */
export function impliedGrowth(inputs: ValuationInputs, price: number): Solved {
  const scratch = { ...inputs };
  const f = (g: number) => {
    scratch.growth = g;
    return valuePerShare(scratch) - price;
  };
  const steps = 160;
  const span = GROWTH_BOUNDS.max - GROWTH_BOUNDS.min;
  let prevX: number = GROWTH_BOUNDS.min;
  let prevF = f(prevX);
  let fallback: number | null = null;
  let allAbove = prevF > 0;

  for (let k = 1; k <= steps; k++) {
    const x = GROWTH_BOUNDS.min + (span * k) / steps;
    const fx = f(x);
    allAbove &&= fx > 0;
    if (prevF <= 0 && fx > 0) return { kind: 'solved', value: bisect(f, prevX, x) };
    if (fallback === null && prevF > 0 && fx <= 0) fallback = bisect(f, prevX, x);
    prevX = x;
    prevF = fx;
  }
  if (fallback !== null) return { kind: 'solved', value: fallback };
  return allAbove ? { kind: 'below' } : { kind: 'beyond' };
}
