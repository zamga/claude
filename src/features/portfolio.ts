import { dec, ZERO, type Big } from '@/domain/decimal';
import { emptyLedgerState, type LedgerState } from '@/domain/ledger';
import { formatMoney, formatQuantity } from '@/domain/format';
import type { LedgerRecord, PositionDetail, Series } from '@/data/types';
import type { PortfolioPerformance } from '@/data/types';

/** Records still in effect: reversed entries and the reversals themselves drop out. */
export function effectiveRecords(records: readonly LedgerRecord[]): LedgerRecord[] {
  const reversed = new Set(
    records
      .filter((record) => record.type === 'reversal' && record.reversalOf)
      .map((record) => record.reversalOf!),
  );
  return records
    .filter((record) => record.type !== 'reversal' && !reversed.has(record.id))
    .sort(
      (a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.sequence - b.sequence,
    );
}

/**
 * Average entry in the instrument's own currency (average-cost method, fees included). The
 * portfolio's cost basis is in USD; this is the level to compare with the native quote.
 */
export function nativeAverageEntry(records: readonly LedgerRecord[]): Big | null {
  let units = ZERO;
  let cost = ZERO;
  for (const record of effectiveRecords(records)) {
    if (!record.quantity || !record.unitPrice) continue;
    const quantity = dec(record.quantity);
    if (record.type === 'buy') {
      units = units.plus(quantity);
      cost = cost.plus(quantity.times(record.unitPrice)).plus(record.fee);
    } else if (record.type === 'sell' && units.gt(0)) {
      const average = cost.div(units);
      units = units.minus(quantity);
      cost = units.gt(0) ? average.times(units) : ZERO;
    }
  }
  return units.gt(0) ? cost.div(units) : null;
}

/** Client preview state: available cash and this position's holding. */
export function previewState(detail: PositionDetail): LedgerState {
  const state = emptyLedgerState();
  state.cash = dec(detail.cash);
  const units = dec(detail.position.units);
  if (units.gt(0)) {
    state.holdings.set(detail.position.instrumentId, {
      instrumentId: detail.position.instrumentId,
      units,
      costBasis: dec(detail.position.costBasis),
      realized: ZERO,
      currency: detail.position.currency,
    });
  }
  return state;
}

export function describeRecord(record: LedgerRecord, symbol: string): string {
  const quantity = record.quantity ? formatQuantity(record.quantity) : '';
  const price = record.unitPrice ? formatMoney(record.unitPrice, record.currency) : '';
  switch (record.type) {
    case 'buy':
      return `Bought ${quantity} ${symbol} at ${price}`;
    case 'sell':
      return `Sold ${quantity} ${symbol} at ${price}`;
    case 'reversal':
      return `Reversed an earlier ${symbol} entry`;
    case 'dividend':
      return `Dividend ${record.amount ? formatMoney(record.amount, record.currency) : ''}`;
    case 'split':
      return `Split ${record.ratio ?? ''}`;
    case 'deposit':
      return `Simulated deposit ${record.amount ? formatMoney(record.amount, record.currency) : ''}`;
    case 'withdrawal':
      return `Simulated withdrawal ${record.amount ? formatMoney(record.amount, record.currency) : ''}`;
  }
}

/** Present portfolio performance through the shared chart contract (percent mode). */
export function performanceSeries(performance: PortfolioPerformance): {
  series: Series;
  benchmark: { t: number; v: number | null }[];
} {
  return {
    series: {
      instrumentId: 'portfolio',
      range: performance.period,
      interval: '1d',
      axis: 'ordinal',
      samples: performance.points.map((point) => ({ t: point.t, v: point.portfolioPct })),
      window: null,
      reference: { value: '0', label: 'since the start of the period', kind: 'firstInWindow' },
      currency: 'USD',
      asOf: performance.window.end,
      status: 'demo',
      source: performance.sampling,
      adjustment: 'split-adjusted',
      timeZone: 'America/New_York',
    },
    benchmark: performance.points.map((point) => ({ t: point.t, v: point.benchmarkPct })),
  };
}
