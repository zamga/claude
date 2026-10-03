import { dec, type Big } from './decimal';
import type { CurrencyCode } from './format';

/**
 * Currency handling (spec page 35). A quote is always labelled in its native currency. A base
 * currency preference converts portfolio totals only with an actual FX observation; without one,
 * native amounts are retained and the converted total is marked partial.
 */

export interface FxObservation {
  base: CurrencyCode; // 1 unit of base ...
  quote: CurrencyCode; // ... equals `rate` units of quote
  rate: string;
  observedAt: number;
  source: string;
}

/** Rate that converts an amount in `from` into `to`, or null when no observation covers it. */
export function conversionRate(
  from: CurrencyCode,
  to: CurrencyCode,
  observations: readonly FxObservation[],
): Big | null {
  if (from === to) return dec(1);
  const direct = observations.find((fx) => fx.base === from && fx.quote === to);
  if (direct) return dec(direct.rate);
  const inverse = observations.find((fx) => fx.base === to && fx.quote === from);
  if (inverse && dec(inverse.rate).gt(0)) return dec(1).div(dec(inverse.rate));
  return null;
}

export interface Money {
  amount: string;
  currency: CurrencyCode;
}

export interface ConvertedTotal {
  currency: CurrencyCode;
  /** Sum of the amounts that could be converted. */
  total: Big;
  /** True when at least one amount had no FX coverage and is excluded from `total`. */
  partial: boolean;
  /** Native amounts that could not be converted, kept for display. */
  unconverted: Money[];
}

export function convertTotal(
  amounts: readonly Money[],
  to: CurrencyCode,
  observations: readonly FxObservation[],
): ConvertedTotal {
  let total = dec(0);
  const unconverted: Money[] = [];
  for (const money of amounts) {
    const rate = conversionRate(money.currency, to, observations);
    if (rate == null) unconverted.push(money);
    else total = total.plus(dec(money.amount).times(rate));
  }
  return { currency: to, total, partial: unconverted.length > 0, unconverted };
}

/**
 * The currency a quote is displayed in. The user's base-currency preference is deliberately
 * ignored: changing a symbol would misstate the instrument's native quote.
 */
export function quoteDisplayCurrency(
  quote: { currency: CurrencyCode },
  _preferredCurrency: CurrencyCode,
): CurrencyCode {
  return quote.currency;
}
