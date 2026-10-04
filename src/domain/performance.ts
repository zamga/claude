import { dec, ONE, ZERO, type Big, type DecimalInput } from './decimal';

/**
 * Return measurement (spec page 53).
 * Time-weighted return links sub-period returns split at external cash flows:
 * product(1 + r_i) - 1. A missing valuation at a flow boundary withholds the result.
 */

export interface FlowBoundary {
  /** Portfolio value immediately before the external flow. */
  valueBefore: DecimalInput | null;
  /** External flow applied right after the valuation: + deposit, - withdrawal. */
  flow: DecimalInput;
}

export function timeWeightedReturn(
  startValue: DecimalInput | null,
  boundaries: readonly FlowBoundary[],
  endValue: DecimalInput | null,
): Big | null {
  if (startValue == null || endValue == null) return null;
  let periodStart = dec(startValue);
  let growth = ONE;
  for (const boundary of boundaries) {
    if (boundary.valueBefore == null || periodStart.lte(0)) return null;
    const before = dec(boundary.valueBefore);
    growth = growth.times(before.div(periodStart));
    periodStart = before.plus(dec(boundary.flow));
  }
  if (periodStart.lte(0)) return null;
  growth = growth.times(dec(endValue).div(periodStart));
  return growth.minus(1);
}

export interface EquityPoint {
  t: number;
  /** Equity at the end of the period; null when it could not be valued. */
  equity: DecimalInput | null;
  /** External flow at the start of this period (+ deposit / - withdrawal). */
  flow?: DecimalInput;
}

export interface WealthPoint {
  t: number;
  /** Flow-adjusted wealth index starting at 1; null after an unvaluable period. */
  wealth: number | null;
  /** Return since the first point, in percent. */
  returnPct: number | null;
  drawdownPct: number | null;
}

/**
 * Flow-adjusted wealth index: r_t = E_t / (E_{t-1} + F_t) - 1. Missing equity breaks the index
 * from that point (the affected return is withheld rather than invented).
 */
export function wealthIndex(points: readonly EquityPoint[]): WealthPoint[] {
  const out: WealthPoint[] = [];
  let wealth: Big | null = null;
  let peak: Big = ONE;
  let previousEquity: Big | null = null;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const equity = point.equity == null ? null : dec(point.equity);
    if (index === 0) {
      wealth = equity == null ? null : ONE;
    } else if (wealth == null || equity == null || previousEquity == null) {
      wealth = null;
    } else {
      const base = previousEquity.plus(dec(point.flow ?? 0));
      wealth = base.lte(0) ? null : wealth.times(equity.div(base));
    }
    previousEquity = equity;
    if (wealth == null) {
      out.push({ t: point.t, wealth: null, returnPct: null, drawdownPct: null });
      continue;
    }
    if (wealth.gt(peak)) peak = wealth;
    out.push({
      t: point.t,
      wealth: Number(wealth.toString()),
      returnPct: Number(wealth.minus(1).times(100).toString()),
      drawdownPct: Number(wealth.div(peak).minus(1).times(100).toString()),
    });
  }
  return out;
}

/** Largest loss from a previous peak, in percent (negative or zero); null when unavailable. */
export function maxDrawdown(points: readonly WealthPoint[]): number | null {
  let worst: number | null = null;
  for (const point of points) {
    if (point.drawdownPct == null) return null;
    worst = worst == null ? point.drawdownPct : Math.min(worst, point.drawdownPct);
  }
  return worst;
}

// ---------- Pick outcome statistics ----------

export interface OutcomeSample {
  status: 'pending' | 'complete';
  returnPct: DecimalInput | null;
  benchmarkPct: DecimalInput | null;
}

export interface OutcomeSummary {
  complete: number;
  pending: number;
  meanPct: Big | null;
  medianPct: Big | null;
  positive: number;
  positiveSharePct: Big | null;
  benchmarkMeanPct: Big | null;
  differencePp: Big | null;
}

/**
 * Equal-weight statistics over complete eligible picks only; pending windows are counted but
 * never scored. An equal-weight average is not the return of an investable portfolio.
 */
export function summarizeOutcomes(samples: readonly OutcomeSample[]): OutcomeSummary {
  const complete = samples.filter(
    (sample) => sample.status === 'complete' && sample.returnPct != null,
  );
  const pending = samples.filter((sample) => sample.status === 'pending').length;
  if (complete.length === 0) {
    return {
      complete: 0,
      pending,
      meanPct: null,
      medianPct: null,
      positive: 0,
      positiveSharePct: null,
      benchmarkMeanPct: null,
      differencePp: null,
    };
  }
  const returns = complete.map((sample) => dec(sample.returnPct!)).sort((a, b) => a.cmp(b));
  const total = returns.reduce((acc, value) => acc.plus(value), ZERO);
  const meanPct = total.div(returns.length);
  const middle = Math.floor(returns.length / 2);
  const medianPct =
    returns.length % 2 === 0
      ? returns[middle - 1]!.plus(returns[middle]!).div(2)
      : returns[middle]!;
  const positive = returns.filter((value) => value.gt(0)).length;
  const benchmarks = complete.filter((sample) => sample.benchmarkPct != null);
  const benchmarkMeanPct =
    benchmarks.length === complete.length
      ? benchmarks
          .reduce((acc, sample) => acc.plus(dec(sample.benchmarkPct!)), ZERO)
          .div(benchmarks.length)
      : null;
  return {
    complete: complete.length,
    pending,
    meanPct,
    medianPct,
    positive,
    positiveSharePct: dec(positive).div(complete.length).times(100),
    benchmarkMeanPct,
    differencePp: benchmarkMeanPct ? meanPct.minus(benchmarkMeanPct) : null,
  };
}

/** Simple price return between an entry and exit price, in percent. */
export function priceReturnPct(entry: DecimalInput | null, exit: DecimalInput | null): Big | null {
  if (entry == null || exit == null) return null;
  const e = dec(entry);
  if (e.lte(0)) return null;
  return dec(exit).div(e).minus(1).times(100);
}
