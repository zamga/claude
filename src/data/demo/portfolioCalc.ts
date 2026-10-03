import { dec, ZERO } from '@/domain/decimal';
import {
  applyLedger,
  valuePortfolio,
  type LedgerEntry,
  type LedgerState,
  type PriceMark,
} from '@/domain/ledger';
import { maxDrawdown, wealthIndex } from '@/domain/performance';
import type {
  LedgerRecord,
  PortfolioPerformance,
  PortfolioPeriod,
  PortfolioSummary,
  PositionSummary,
} from '../types';
import { sessionTimes, tradingDays } from './calendar';
import { eurUsdAt } from './fx';
import { INSTRUMENT_BY_ID } from './instruments';
import { demoQuote, type FeedState } from './market';
import { anyPath, closeOn } from './prices';

/** Derive holdings, valuation and flow-adjusted performance from the immutable ledger. */

export function toEntries(records: readonly LedgerRecord[]): LedgerEntry[] {
  return records.map((record) => ({
    id: record.id,
    type: record.type,
    effectiveAt: Date.parse(record.effectiveAt),
    sequence: record.sequence,
    instrumentId: record.instrumentId ?? undefined,
    quantity: record.quantity ?? undefined,
    unitPrice: record.unitPrice ?? undefined,
    amount: record.amount ?? undefined,
    ratio: record.ratio ?? undefined,
    fee: record.fee,
    currency: record.currency,
    fxRate: record.fxRate,
    sourceEventId: record.sourceEventId ?? undefined,
    reversalOf: record.reversalOf ?? undefined,
    priceSource: record.priceSource ?? undefined,
    idempotencyKey: record.idempotencyKey ?? undefined,
  }));
}

export function ledgerState(
  records: readonly LedgerRecord[],
  at = Number.POSITIVE_INFINITY,
): LedgerState {
  return applyLedger(toEntries(records).filter((entry) => entry.effectiveAt <= at));
}

function fxLookup(at: number, feed: FeedState) {
  return (from: string) => {
    if (from !== 'EUR') return null;
    if (feed.mode === 'interrupted') return null;
    const fx = eurUsdAt(at);
    return fx ? dec(fx.rate) : null;
  };
}

const PERIOD_SESSIONS: Record<PortfolioPeriod, number> = {
  '1M': 21,
  '3M': 63,
  '6M': 126,
  '1Y': 252,
};

function performance(
  records: readonly LedgerRecord[],
  period: PortfolioPeriod,
  now: number,
  feed: FeedState,
): PortfolioPerformance {
  const inception = records.reduce(
    (min, record) => Math.min(min, Date.parse(record.effectiveAt)),
    Number.POSITIVE_INFINITY,
  );
  const allDays = tradingDays('US', '2025-10-21', '2026-10-20');
  const days = allDays
    .slice(-PERIOD_SESSIONS[period])
    .filter((day) => sessionTimes('US', day).closesAt >= inception);
  const instants = days.map((day) => sessionTimes('US', day).closesAt);
  instants.push(now);
  const benchmark = anyPath('idx_spx')!;

  const equityPoints = instants.map((t, index) => {
    const state = ledgerState(records, t);
    const marks = new Map<string, PriceMark | null>();
    for (const holding of state.holdings.values()) {
      const instrument = INSTRUMENT_BY_ID.get(holding.instrumentId);
      if (!instrument) continue;
      let price: number | null;
      if (index === instants.length - 1) {
        const quote = demoQuote(holding.instrumentId, now, feed);
        price = quote.price == null ? null : Number(quote.price);
      } else {
        const path = anyPath(holding.instrumentId);
        price = path ? (closeOn(path, days[index]!, now) ?? lastCloseBefore(path, t)) : null;
      }
      marks.set(
        holding.instrumentId,
        price == null ? null : { price: price.toFixed(2), currency: instrument.currency, asOf: t },
      );
    }
    const valuation = valuePortfolio(state, marks, fxLookup(t, feed));
    const previous = index === 0 ? null : ledgerState(records, instants[index - 1]!);
    const flow = previous ? state.contributed.minus(previous.contributed) : ZERO;
    return {
      t,
      equity: valuation.equity ? valuation.equity.toFixed(2) : null,
      flow: flow.toFixed(2),
    };
  });

  const wealth = wealthIndex(equityPoints);
  const benchmarkValues = instants.map((_t, index) =>
    index === instants.length - 1
      ? Number(demoQuote('idx_spx', now, feed).price ?? NaN)
      : (closeOn(benchmark, days[index]!, now) ?? NaN),
  );
  const base = benchmarkValues[0]!;
  const points = instants.map((t, index) => ({
    t,
    portfolioPct: wealth[index]?.returnPct ?? null,
    benchmarkPct:
      Number.isFinite(benchmarkValues[index]!) && Number.isFinite(base)
        ? (benchmarkValues[index]! / base - 1) * 100
        : null,
  }));
  const last = points[points.length - 1]!;
  const drawdown = maxDrawdown(wealth);
  return {
    period,
    points,
    returnPct: last.portfolioPct == null ? null : last.portfolioPct.toFixed(4),
    benchmarkPct: last.benchmarkPct == null ? null : last.benchmarkPct.toFixed(4),
    maxDrawdownPct: drawdown == null ? null : drawdown.toFixed(4),
    benchmarkName: 'S&P 500 (price return)',
    basis:
      'Time-weighted return of the paper portfolio including cash, split at deposits and withdrawals. The benchmark is a price index over the same sessions; dividends are excluded from both.',
    sampling: 'Daily closes (New York), plus the latest demo quote',
    window: { start: new Date(instants[0]!).toISOString(), end: new Date(now).toISOString() },
  };
}

function lastCloseBefore(path: NonNullable<ReturnType<typeof anyPath>>, t: number): number | null {
  let value: number | null = null;
  for (const bar of path.daily) {
    if (bar.closesAt > t) break;
    value = bar.close;
  }
  return value;
}

export function portfolioSummary(
  records: readonly LedgerRecord[],
  period: PortfolioPeriod,
  now: number,
  feed: FeedState,
): PortfolioSummary {
  const state = ledgerState(records);
  const marks = new Map<string, PriceMark | null>();
  const quoteMeta = new Map<
    string,
    { asOf: string | null; status: PositionSummary['priceStatus'] }
  >();
  for (const holding of state.holdings.values()) {
    const quote = demoQuote(holding.instrumentId, now, feed);
    quoteMeta.set(holding.instrumentId, { asOf: quote.asOf, status: quote.status });
    marks.set(
      holding.instrumentId,
      quote.price
        ? {
            price: quote.price,
            currency: quote.currency,
            asOf: quote.asOf ? Date.parse(quote.asOf) : now,
          }
        : null,
    );
  }
  const valuation = valuePortfolio(state, marks, fxLookup(now, feed));
  const firstBuys = new Map<string, string>();
  for (const record of records) {
    if (record.type === 'buy' && record.instrumentId && !firstBuys.has(record.instrumentId)) {
      firstBuys.set(record.instrumentId, record.effectiveAt);
    }
  }
  const positions: PositionSummary[] = valuation.positions.map((position) => {
    const meta = quoteMeta.get(position.instrumentId);
    const instrument = INSTRUMENT_BY_ID.get(position.instrumentId);
    return {
      instrumentId: position.instrumentId,
      symbol: instrument?.symbol ?? position.instrumentId,
      name: instrument?.shortName ?? position.instrumentId,
      units: position.units.toFixed(),
      averageCost: position.averageCost ? position.averageCost.toFixed(6) : null,
      costBasis: position.costBasis.toFixed(2),
      price: position.mark?.price ?? null,
      priceAsOf: meta?.asOf ?? null,
      priceStatus: meta?.status ?? 'unavailable',
      currency: instrument?.currency ?? 'USD',
      value: position.value ? position.value.toFixed(2) : null,
      unrealized: position.unrealized ? position.unrealized.toFixed(2) : null,
      unrealizedPct: position.unrealizedPercent ? position.unrealizedPercent.toFixed(4) : null,
      realized: position.realized.toFixed(2),
      firstBoughtAt: firstBuys.get(position.instrumentId) ?? null,
    };
  });
  const totalGainPct =
    valuation.totalGain && valuation.contributed.gt(0)
      ? valuation.totalGain.div(valuation.contributed).times(100)
      : null;
  return {
    id: 'pf_default',
    name: 'Paper portfolio',
    baseCurrency: 'USD',
    asOf: new Date(now).toISOString(),
    cash: valuation.cash.toFixed(2),
    equity: valuation.equity ? valuation.equity.toFixed(2) : null,
    investedValue: valuation.investedValue.toFixed(2),
    contributed: valuation.contributed.toFixed(2),
    totalGain: valuation.totalGain ? valuation.totalGain.toFixed(2) : null,
    totalGainPct: totalGainPct ? totalGainPct.toFixed(4) : null,
    realized: valuation.realized.toFixed(2),
    unrealized: valuation.unrealized ? valuation.unrealized.toFixed(2) : null,
    incomplete: valuation.incomplete,
    positions,
    performance: performance(records, period, now, feed),
  };
}

/** Units of base currency per unit of the instrument's currency, for previews. */
export function fxRateFor(instrumentId: string, now: number, feed: FeedState): string | null {
  const instrument = INSTRUMENT_BY_ID.get(instrumentId);
  if (!instrument || instrument.currency === 'USD') return '1';
  const rate = fxLookup(now, feed)(instrument.currency);
  return rate ? rate.toFixed(4) : null;
}
