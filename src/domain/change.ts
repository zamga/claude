import { dec, HUNDRED, type Big, type DecimalInput } from './decimal';

/**
 * Price change (spec pages 23, 35).
 * Absolute change = value - reference.
 * Percentage change = 100 x (value / reference - 1), only when the reference is valid and nonzero.
 */
export interface Change {
  absolute: Big | null;
  percent: Big | null;
}

export function computeChange(
  value: DecimalInput | null | undefined,
  reference: DecimalInput | null | undefined,
): Change {
  if (value == null || reference == null) return { absolute: null, percent: null };
  const v = dec(value);
  const r = dec(reference);
  const absolute = v.minus(r);
  const percent = r.eq(0) ? null : v.div(r).minus(1).times(HUNDRED);
  return { absolute, percent };
}

export type ChangeBasis =
  { kind: 'previousClose'; label: string } | { kind: 'firstInWindow'; label: string };

export function basisLabel(range: string): ChangeBasis {
  if (range === '1D') return { kind: 'previousClose', label: 'vs previous close' };
  return { kind: 'firstInWindow', label: `vs start of ${range} window` };
}
