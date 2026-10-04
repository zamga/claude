import { dec, fractionDigits, isDecimalString, ZERO, type Big } from './decimal';
import type { CurrencyCode } from './format';

/**
 * Paper portfolio accounting (spec pages 35, 53). Holdings are always derived from an immutable
 * ledger; corrections are reversals, never edits. All arithmetic is decimal.
 *
 * Cash and cost basis are kept in the portfolio's base currency using the FX rate stored on each
 * entry (quote currency -> base). Same-currency entries carry a rate of exactly 1.
 */

export type LedgerType =
  'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend' | 'split' | 'reversal';

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  effectiveAt: number;
  /** Monotonic insertion order; breaks ties between entries with the same effective time. */
  sequence: number;
  instrumentId?: string;
  /** Units for buy/sell. */
  quantity?: string;
  /** Unit price in quote currency for buy/sell. */
  unitPrice?: string;
  /** Cash amount for deposit/withdrawal (base currency) or cash per share for dividends. */
  amount?: string;
  /** Split ratio as new units per old unit, e.g. "2" for a 2:1 split. */
  ratio?: string;
  fee?: string;
  currency?: CurrencyCode;
  /** Quote currency -> base currency rate used for this entry. */
  fxRate?: string;
  /** Provider event id for corporate actions; applied at most once. */
  sourceEventId?: string;
  /** For type "reversal": the entry being reversed. */
  reversalOf?: string;
  priceSource?: 'observation' | 'manual';
  idempotencyKey?: string;
}

export interface Holding {
  instrumentId: string;
  units: Big;
  /** Remaining cost basis in base currency, including capitalised buy fees. */
  costBasis: Big;
  realized: Big;
  currency: CurrencyCode;
}

export interface LedgerIssue {
  entryId: string;
  code: 'insufficient_cash' | 'oversell' | 'unknown_holding' | 'invalid_entry';
  message: string;
}

export interface LedgerState {
  cash: Big;
  contributed: Big;
  holdings: Map<string, Holding>;
  realized: Big;
  dividends: Big;
  fees: Big;
  issues: LedgerIssue[];
}

function rateOf(entry: LedgerEntry): Big {
  return dec(entry.fxRate ?? '1');
}

/** Entries that remain in effect after removing reversed entries and the reversals themselves. */
export function effectiveEntries(entries: readonly LedgerEntry[]): LedgerEntry[] {
  const reversed = new Set(
    entries
      .filter((entry) => entry.type === 'reversal' && entry.reversalOf)
      .map((entry) => entry.reversalOf!),
  );
  const seenCorporateActions = new Set<string>();
  return entries
    .filter((entry) => entry.type !== 'reversal' && !reversed.has(entry.id))
    .sort((a, b) => a.effectiveAt - b.effectiveAt || a.sequence - b.sequence)
    .filter((entry) => {
      if (!entry.sourceEventId) return true;
      if (seenCorporateActions.has(entry.sourceEventId)) return false;
      seenCorporateActions.add(entry.sourceEventId);
      return true;
    });
}

export function emptyLedgerState(): LedgerState {
  return {
    cash: ZERO,
    contributed: ZERO,
    holdings: new Map(),
    realized: ZERO,
    dividends: ZERO,
    fees: ZERO,
    issues: [],
  };
}

function cloneState(state: LedgerState): LedgerState {
  return {
    ...state,
    holdings: new Map([...state.holdings].map(([id, holding]) => [id, { ...holding }])),
    issues: [...state.issues],
  };
}

/** Apply one entry, returning a new state. Invalid entries are recorded as issues, not applied. */
export function applyEntry(previous: LedgerState, entry: LedgerEntry): LedgerState {
  const state = cloneState(previous);
  const fee = dec(entry.fee ?? '0');
  const rate = rateOf(entry);
  const issue = (code: LedgerIssue['code'], message: string): LedgerState => {
    state.issues.push({ entryId: entry.id, code, message });
    return state;
  };

  switch (entry.type) {
    case 'deposit': {
      const amount = dec(entry.amount ?? '0');
      state.cash = state.cash.plus(amount);
      state.contributed = state.contributed.plus(amount);
      return state;
    }
    case 'withdrawal': {
      const amount = dec(entry.amount ?? '0');
      if (amount.gt(state.cash))
        return issue('insufficient_cash', 'Withdrawal exceeds available cash.');
      state.cash = state.cash.minus(amount);
      state.contributed = state.contributed.minus(amount);
      return state;
    }
    case 'buy': {
      if (!entry.instrumentId || !entry.quantity || !entry.unitPrice) {
        return issue('invalid_entry', 'Buy entries need an instrument, quantity and price.');
      }
      const units = dec(entry.quantity);
      const cost = units.times(dec(entry.unitPrice)).plus(fee).times(rate);
      if (cost.gt(state.cash)) return issue('insufficient_cash', 'Not enough simulated cash.');
      const holding = state.holdings.get(entry.instrumentId) ?? {
        instrumentId: entry.instrumentId,
        units: ZERO,
        costBasis: ZERO,
        realized: ZERO,
        currency: entry.currency ?? 'USD',
      };
      holding.units = holding.units.plus(units);
      holding.costBasis = holding.costBasis.plus(cost);
      state.holdings.set(entry.instrumentId, holding);
      state.cash = state.cash.minus(cost);
      state.fees = state.fees.plus(fee.times(rate));
      return state;
    }
    case 'sell': {
      if (!entry.instrumentId || !entry.quantity || !entry.unitPrice) {
        return issue('invalid_entry', 'Sell entries need an instrument, quantity and price.');
      }
      const holding = state.holdings.get(entry.instrumentId);
      if (!holding) return issue('unknown_holding', 'There is no paper position to sell.');
      const units = dec(entry.quantity);
      if (units.gt(holding.units)) return issue('oversell', 'Sale exceeds the units held.');
      const averageCost = holding.costBasis.div(holding.units);
      const proceeds = units.times(dec(entry.unitPrice)).minus(fee).times(rate);
      const releasedBasis = averageCost.times(units);
      const realized = proceeds.minus(releasedBasis);
      holding.units = holding.units.minus(units);
      holding.costBasis = holding.units.eq(0) ? ZERO : holding.costBasis.minus(releasedBasis);
      holding.realized = holding.realized.plus(realized);
      state.cash = state.cash.plus(proceeds);
      state.realized = state.realized.plus(realized);
      state.fees = state.fees.plus(fee.times(rate));
      return state;
    }
    case 'dividend': {
      if (!entry.instrumentId || !entry.amount) {
        return issue('invalid_entry', 'Dividends need an instrument and cash per share.');
      }
      const holding = state.holdings.get(entry.instrumentId);
      if (!holding || holding.units.eq(0)) return state;
      const credit = holding.units.times(dec(entry.amount)).times(rate);
      state.cash = state.cash.plus(credit);
      state.dividends = state.dividends.plus(credit);
      return state;
    }
    case 'split': {
      if (!entry.instrumentId || !entry.ratio) {
        return issue('invalid_entry', 'Splits need an instrument and ratio.');
      }
      const holding = state.holdings.get(entry.instrumentId);
      if (!holding) return state;
      // Units scale; total basis is preserved, so unit cost scales inversely.
      holding.units = holding.units.times(dec(entry.ratio));
      return state;
    }
    case 'reversal':
      return state;
  }
}

export function applyLedger(entries: readonly LedgerEntry[]): LedgerState {
  return effectiveEntries(entries).reduce(applyEntry, emptyLedgerState());
}

export function averageCost(holding: Holding): Big | null {
  return holding.units.gt(0) ? holding.costBasis.div(holding.units) : null;
}

// ---------- Valuation ----------

export interface PriceMark {
  price: string;
  currency: CurrencyCode;
  asOf: number;
}

export interface PositionValuation {
  instrumentId: string;
  units: Big;
  costBasis: Big;
  averageCost: Big | null;
  /** Native-currency mark used for value; null when no valid quote exists. */
  mark: PriceMark | null;
  /** Value in base currency; null when the quote or FX rate is missing. */
  value: Big | null;
  unrealized: Big | null;
  unrealizedPercent: Big | null;
  realized: Big;
}

export interface PortfolioValuation {
  cash: Big;
  positions: PositionValuation[];
  /** Sum of the values that could be computed. */
  investedValue: Big;
  /** Cash plus every position value; null when any position could not be valued. */
  equity: Big | null;
  /** True when a missing quote or FX rate means the total is partial (never zero-filled). */
  incomplete: boolean;
  realized: Big;
  unrealized: Big | null;
  contributed: Big;
  totalGain: Big | null;
}

export type FxLookup = (from: CurrencyCode) => Big | null;

export function valuePortfolio(
  state: LedgerState,
  marks: ReadonlyMap<string, PriceMark | null>,
  fx: FxLookup,
  baseCurrency: CurrencyCode = 'USD',
): PortfolioValuation {
  let investedValue = ZERO;
  let unrealizedTotal = ZERO;
  let incomplete = false;
  const positions: PositionValuation[] = [];

  for (const holding of state.holdings.values()) {
    if (holding.units.eq(0)) continue;
    const mark = marks.get(holding.instrumentId) ?? null;
    const rate = mark ? (mark.currency === baseCurrency ? dec(1) : fx(mark.currency)) : null;
    const value = mark && rate ? holding.units.times(dec(mark.price)).times(rate) : null;
    const unrealized = value ? value.minus(holding.costBasis) : null;
    if (value) {
      investedValue = investedValue.plus(value);
      unrealizedTotal = unrealizedTotal.plus(unrealized!);
    } else {
      incomplete = true;
    }
    positions.push({
      instrumentId: holding.instrumentId,
      units: holding.units,
      costBasis: holding.costBasis,
      averageCost: averageCost(holding),
      mark,
      value,
      unrealized,
      unrealizedPercent:
        unrealized && holding.costBasis.gt(0) ? unrealized.div(holding.costBasis).times(100) : null,
      realized: holding.realized,
    });
  }

  const equity = incomplete ? null : state.cash.plus(investedValue);
  return {
    cash: state.cash,
    positions,
    investedValue,
    equity,
    incomplete,
    realized: state.realized,
    unrealized: incomplete ? null : unrealizedTotal,
    contributed: state.contributed,
    totalGain: equity ? equity.minus(state.contributed) : null,
  };
}

// ---------- Transaction drafts ----------

export interface TransactionDraft {
  side: 'buy' | 'sell';
  instrumentId: string;
  quantity: string;
  unitPrice: string;
  fee: string;
  currency: CurrencyCode;
  fxRate: string;
}

export interface FieldErrors {
  quantity?: string;
  unitPrice?: string;
  fee?: string;
  form?: string;
}

export const MAX_QUANTITY_DECIMALS = 6;

export function validateQuantity(input: string): string | undefined {
  const raw = input.trim();
  if (raw === '') return 'Enter a quantity.';
  if (!isDecimalString(raw)) return 'Enter a valid quantity.';
  if (dec(raw).lte(0)) return 'Enter a quantity greater than zero.';
  if (fractionDigits(raw) > MAX_QUANTITY_DECIMALS) {
    return `Use at most ${MAX_QUANTITY_DECIMALS} decimal places.`;
  }
  return undefined;
}

export function validatePrice(input: string): string | undefined {
  const raw = input.trim();
  if (raw === '') return 'Enter a reference price.';
  if (!isDecimalString(raw)) return 'Enter a valid price.';
  if (dec(raw).lte(0)) return 'Enter a price greater than zero.';
  if (fractionDigits(raw) > 4) return 'Use at most 4 decimal places.';
  return undefined;
}

export function validateFee(input: string): string | undefined {
  const raw = input.trim();
  if (raw === '') return undefined;
  if (!isDecimalString(raw)) return 'Enter a valid cost.';
  if (dec(raw).lt(0)) return 'Costs cannot be negative.';
  return undefined;
}

export interface TransactionPreview {
  errors: FieldErrors;
  cashEffect: Big | null;
  resultingUnits: Big | null;
  resultingAverageCost: Big | null;
  resultingCash: Big | null;
  realized: Big | null;
}

/** Reproducible preview of a simulated transaction before it is confirmed (spec pages 26, 44). */
export function previewTransaction(
  state: LedgerState,
  draft: TransactionDraft,
): TransactionPreview {
  const errors: FieldErrors = {};
  const quantityError = validateQuantity(draft.quantity);
  const priceError = validatePrice(draft.unitPrice);
  const feeError = validateFee(draft.fee);
  if (quantityError) errors.quantity = quantityError;
  if (priceError) errors.unitPrice = priceError;
  if (feeError) errors.fee = feeError;
  const empty: TransactionPreview = {
    errors,
    cashEffect: null,
    resultingUnits: null,
    resultingAverageCost: null,
    resultingCash: null,
    realized: null,
  };
  if (quantityError || priceError || feeError) return empty;

  const units = dec(draft.quantity);
  const price = dec(draft.unitPrice);
  const fee = dec(draft.fee.trim() === '' ? '0' : draft.fee);
  const rate = dec(draft.fxRate);
  const holding = state.holdings.get(draft.instrumentId);
  const heldUnits = holding?.units ?? ZERO;
  const heldBasis = holding?.costBasis ?? ZERO;

  if (draft.side === 'buy') {
    const cost = units.times(price).plus(fee).times(rate);
    if (cost.gt(state.cash)) {
      errors.form = 'insufficient_cash';
      return { ...empty, errors, cashEffect: cost.times(-1) };
    }
    const resultingUnits = heldUnits.plus(units);
    return {
      errors,
      cashEffect: cost.times(-1),
      resultingUnits,
      resultingAverageCost: heldBasis.plus(cost).div(resultingUnits),
      resultingCash: state.cash.minus(cost),
      realized: null,
    };
  }

  if (units.gt(heldUnits)) {
    errors.quantity = `You hold ${heldUnits.toFixed()} units in this paper position.`;
    return { ...empty, errors };
  }
  const average = heldUnits.gt(0) ? heldBasis.div(heldUnits) : ZERO;
  const proceeds = units.times(price).minus(fee).times(rate);
  const resultingUnits = heldUnits.minus(units);
  return {
    errors,
    cashEffect: proceeds,
    resultingUnits,
    resultingAverageCost: resultingUnits.gt(0) ? average : null,
    resultingCash: state.cash.plus(proceeds),
    realized: proceeds.minus(average.times(units)),
  };
}
