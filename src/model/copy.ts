import { formatPct, formatPrice } from '../engine/format';
import type { Solved } from '../engine/reverse';
import { GROWTH_BOUNDS, MARGIN_BOUNDS } from '../engine/reverse';
import type { Standing } from './useAnalysis';

/**
 * Plain-language readings. Written for someone who has never opened a
 * spreadsheet: one idea per sentence, numbers rounded to what matters.
 */
const pct0 = (v: number) => formatPct(v, 0);

export function marketGrowthLine(name: string, price: number, margin: number, implied: Solved): string {
  const p = formatPrice(price);
  if (implied.kind === 'solved') {
    return `At ${p}, the market is pricing ${name} to grow revenue about ${pct0(implied.value)} a year for five years at a ${pct0(margin)} operating margin.`;
  }
  if (implied.kind === 'beyond') {
    return `At ${p}, no growth rate up to ${pct0(GROWTH_BOUNDS.max)} a year justifies the price at a ${pct0(margin)} margin. The market must be counting on much fatter margins.`;
  }
  return `At ${p}, ${name} is worth more than the price even if revenue shrinks ${pct0(-GROWTH_BOUNDS.min)} a year at a ${pct0(margin)} margin.`;
}

export function marketMarginLine(growth: number, implied: Solved): string {
  if (implied.kind === 'solved') {
    return `Or, growing ${pct0(growth)} a year, it needs an operating margin of about ${pct0(implied.value)}.`;
  }
  if (implied.kind === 'beyond') {
    return `Growing ${pct0(growth)} a year, even a ${pct0(MARGIN_BOUNDS.max)} margin would not get there.`;
  }
  return `Growing ${pct0(growth)} a year, it clears the price at any margin above ${pct0(MARGIN_BOUNDS.min)}.`;
}

/** Compare what the price asks for with what the company has done. */
export function historyCheck(name: string, implied: Solved, historicalCagr: number | null, years: number): string | null {
  if (implied.kind !== 'solved' || historicalCagr === null || years < 2) return null;
  const gap = implied.value - historicalCagr;
  const span = `${years - 1} years`;
  if (Math.abs(gap) < 0.015) {
    return `That is about the pace ${name} managed over the last ${span} (${pct0(historicalCagr)} a year).`;
  }
  return gap > 0
    ? `That is faster than the ${pct0(historicalCagr)} a year ${name} managed over the last ${span}.`
    : `That is slower than the ${pct0(historicalCagr)} a year ${name} managed over the last ${span}.`;
}

export const STANDING_LABEL: Record<Standing, string> = {
  safe: 'Above your load line',
  thin: 'Afloat, thin freeboard',
  under: 'Under water',
};

export function standingLine(standing: Standing, value: number, price: number, marginOfSafety: number): string {
  const v = formatPrice(value);
  if (value <= 0) return 'On these assumptions the equity is worth nothing: debts exceed the value of the business.';
  const gap = Math.abs(value - price) / value;
  if (standing === 'safe') {
    return `Your story values it at ${v} a share. The price sits ${formatPct(gap, 0)} below that, more than your ${formatPct(marginOfSafety, 0)} margin of safety.`;
  }
  if (standing === 'thin') {
    return `Your story values it at ${v} a share. The price is below that, but by less than your ${formatPct(marginOfSafety, 0)} margin of safety.`;
  }
  const fall = (price - value) / price;
  return `Your story values it at ${v} a share. The price would have to fall ${formatPct(fall, 0)} to reach it.`;
}
