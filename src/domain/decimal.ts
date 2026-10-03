import Big from 'big.js';

/**
 * Decimal helpers. Money, units and prices travel as strings (spec page 49) and are only
 * converted to binary floating point for drawing. Calculations that produce stored or
 * displayed financial values go through Big.
 */

Big.DP = 20;
Big.RM = Big.roundHalfUp;

export type DecimalInput = string | number | Big;

export const ZERO = new Big(0);
export const ONE = new Big(1);
export const HUNDRED = new Big(100);

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

export function dec(value: DecimalInput): Big {
  if (value instanceof Big) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`Not a finite number: ${value}`);
    return new Big(value);
  }
  const trimmed = value.trim();
  if (!isDecimalString(trimmed)) throw new RangeError(`Not a decimal value: "${value}"`);
  return new Big(trimmed);
}

/** Parse a decimal string; returns null for blank or malformed input instead of throwing. */
export function tryDec(value: string | null | undefined): Big | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '' || !isDecimalString(trimmed)) return null;
  return new Big(trimmed);
}

/** Number of digits after the decimal point as typed (trailing zeros count: "1.50" -> 2). */
export function fractionDigits(value: string): number {
  const trimmed = value.trim().replace(/^[+-]/, '');
  const dot = trimmed.indexOf('.');
  return dot === -1 ? 0 : trimmed.length - dot - 1;
}

/** Canonical string without exponent notation; never rounds. */
export function toPlain(value: Big): string {
  return value.toFixed();
}

export function toNumber(value: DecimalInput): number {
  return Number(dec(value).toString());
}

export function sum(values: Iterable<DecimalInput>): Big {
  let total = ZERO;
  for (const value of values) total = total.plus(dec(value));
  return total;
}

export function isMultipleOf(value: Big, step: Big): boolean {
  if (step.lte(0)) return true;
  return value.mod(step).eq(0);
}

export function max(a: Big, b: Big): Big {
  return a.gte(b) ? a : b;
}

export function min(a: Big, b: Big): Big {
  return a.lte(b) ? a : b;
}

export { Big };
