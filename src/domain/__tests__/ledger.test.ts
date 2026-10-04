import { describe, expect, it } from 'vitest';
import { conversionRate, convertTotal, quoteDisplayCurrency } from '../currency';
import { dec } from '../decimal';
import { formatMoney } from '../format';
import {
  applyLedger,
  averageCost,
  previewTransaction,
  validateQuantity,
  valuePortfolio,
  type LedgerEntry,
} from '../ledger';

let seq = 0;
const entry = (
  partial: Omit<LedgerEntry, 'sequence' | 'effectiveAt'> & { effectiveAt?: number },
): LedgerEntry => ({
  effectiveAt: (seq += 1),
  sequence: seq,
  ...partial,
});

describe('F03 paper arithmetic', () => {
  const entries: LedgerEntry[] = [
    entry({ id: 'd', type: 'deposit', amount: '1000' }),
    entry({ id: 'b', type: 'buy', instrumentId: 'X', quantity: '2', unitPrice: '100', fee: '1' }),
    entry({ id: 's', type: 'sell', instrumentId: 'X', quantity: '1', unitPrice: '120', fee: '1' }),
  ];
  const state = applyLedger(entries);
  const valuation = valuePortfolio(
    state,
    new Map([['X', { price: '110', currency: 'USD' as const, asOf: 0 }]]),
    () => null,
  );

  it('cash 918, basis 100.50, realized 18.50', () => {
    expect(state.cash.toFixed(2)).toBe('918.00');
    expect(state.holdings.get('X')!.costBasis.toFixed(2)).toBe('100.50');
    expect(state.realized.toFixed(2)).toBe('18.50');
  });

  it('unrealized 9.50, equity 1,028 and total gain 28', () => {
    expect(valuation.unrealized!.toFixed(2)).toBe('9.50');
    expect(valuation.equity!.toFixed(2)).toBe('1028.00');
    expect(valuation.totalGain!.toFixed(2)).toBe('28.00');
    expect(valuation.incomplete).toBe(false);
  });
});

describe('ledger invariants', () => {
  it('rejects overselling and negative cash without applying the entry', () => {
    const state = applyLedger([
      entry({ id: 'd', type: 'deposit', amount: '100' }),
      entry({ id: 'b', type: 'buy', instrumentId: 'X', quantity: '2', unitPrice: '100', fee: '0' }),
      entry({ id: 'b2', type: 'buy', instrumentId: 'X', quantity: '1', unitPrice: '50', fee: '0' }),
      entry({ id: 's', type: 'sell', instrumentId: 'X', quantity: '5', unitPrice: '60', fee: '0' }),
    ]);
    expect(state.issues.map((issue) => issue.code)).toEqual(['insufficient_cash', 'oversell']);
    expect(state.cash.toFixed(2)).toBe('50.00');
    expect(state.holdings.get('X')!.units.toFixed()).toBe('1');
  });

  it('a correction is an auditable reversal plus replacement', () => {
    const state = applyLedger([
      entry({ id: 'd', type: 'deposit', amount: '1000' }),
      entry({ id: 'b', type: 'buy', instrumentId: 'X', quantity: '3', unitPrice: '100', fee: '0' }),
      entry({ id: 'r', type: 'reversal', reversalOf: 'b' }),
      entry({
        id: 'b2',
        type: 'buy',
        instrumentId: 'X',
        quantity: '2',
        unitPrice: '100',
        fee: '0',
      }),
    ]);
    expect(state.cash.toFixed(2)).toBe('800.00');
    expect(state.holdings.get('X')!.units.toFixed()).toBe('2');
  });

  it('missing quotes make the total partial, never zero', () => {
    const state = applyLedger([
      entry({ id: 'd', type: 'deposit', amount: '1000' }),
      entry({ id: 'b', type: 'buy', instrumentId: 'X', quantity: '1', unitPrice: '100', fee: '0' }),
    ]);
    const valuation = valuePortfolio(state, new Map([['X', null]]), () => null);
    expect(valuation.incomplete).toBe(true);
    expect(valuation.equity).toBeNull();
    expect(valuation.positions[0]!.value).toBeNull();
  });

  it('quantity allows up to six fractional digits', () => {
    expect(validateQuantity('0.123456')).toBeUndefined();
    expect(validateQuantity('0.1234567')).toBe('Use at most 6 decimal places.');
    expect(validateQuantity('0')).toBe('Enter a quantity greater than zero.');
  });

  it('previews a buy and rejects insufficient cash', () => {
    const state = applyLedger([entry({ id: 'd', type: 'deposit', amount: '1000' })]);
    const ok = previewTransaction(state, {
      side: 'buy',
      instrumentId: 'X',
      quantity: '4',
      unitPrice: '200',
      fee: '2',
      currency: 'USD',
      fxRate: '1',
    });
    expect(ok.resultingCash!.toFixed(2)).toBe('198.00');
    expect(ok.resultingAverageCost!.toFixed(2)).toBe('200.50');
    const tooMuch = previewTransaction(state, {
      side: 'buy',
      instrumentId: 'X',
      quantity: '6',
      unitPrice: '200',
      fee: '0',
      currency: 'USD',
      fxRate: '1',
    });
    expect(tooMuch.errors.form).toBe('insufficient_cash');
  });
});

describe('F06 currency and corporate actions', () => {
  it('a native EUR quote remains EUR under a USD preference', () => {
    expect(quoteDisplayCurrency({ currency: 'EUR' }, 'USD')).toBe('EUR');
    expect(formatMoney('648.20', quoteDisplayCurrency({ currency: 'EUR' }, 'USD'))).toBe('€648.20');
  });

  it('a 2:1 split doubles units and halves unit cost while preserving basis', () => {
    const state = applyLedger([
      entry({ id: 'd', type: 'deposit', amount: '1000' }),
      entry({ id: 'b', type: 'buy', instrumentId: 'X', quantity: '4', unitPrice: '100', fee: '0' }),
      entry({
        id: 'sp',
        type: 'split',
        instrumentId: 'X',
        ratio: '2',
        sourceEventId: 'prov-split-1',
      }),
      entry({
        id: 'sp-dup',
        type: 'split',
        instrumentId: 'X',
        ratio: '2',
        sourceEventId: 'prov-split-1',
      }),
    ]);
    const holding = state.holdings.get('X')!;
    expect(holding.units.toFixed()).toBe('8');
    expect(holding.costBasis.toFixed(2)).toBe('400.00');
    expect(averageCost(holding)!.toFixed(2)).toBe('50.00');
  });

  it('missing FX marks the converted total incomplete', () => {
    const state = applyLedger([
      entry({ id: 'd', type: 'deposit', amount: '10000' }),
      entry({
        id: 'b',
        type: 'buy',
        instrumentId: 'ASML',
        quantity: '2',
        unitPrice: '600',
        fee: '0',
        currency: 'EUR',
        fxRate: '1.08',
      }),
    ]);
    const marks = new Map([['ASML', { price: '650', currency: 'EUR' as const, asOf: 0 }]]);
    expect(valuePortfolio(state, marks, () => null).incomplete).toBe(true);
    const withFx = valuePortfolio(state, marks, (from) => (from === 'EUR' ? dec('1.10') : null));
    expect(withFx.incomplete).toBe(false);
    expect(withFx.positions[0]!.value!.toFixed(2)).toBe('1430.00');
    const total = convertTotal(
      [
        { amount: '100', currency: 'USD' },
        { amount: '100', currency: 'EUR' },
      ],
      'USD',
      [],
    );
    expect(total.partial).toBe(true);
    expect(total.total.toFixed(2)).toBe('100.00');
  });

  it('same-currency conversion is exactly 1 and inverse rates are derived', () => {
    expect(conversionRate('USD', 'USD', [])!.toFixed()).toBe('1');
    const fx = [
      { base: 'EUR' as const, quote: 'USD' as const, rate: '1.25', observedAt: 0, source: 'demo' },
    ];
    expect(conversionRate('USD', 'EUR', fx)!.toFixed(2)).toBe('0.80');
  });
});
