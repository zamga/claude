import type { MarketIndex, Series } from '@/data/types';

/** Present an index's intraday observations through the shared chart contract. */
export function indexToSeries(index: MarketIndex): Series {
  return {
    instrumentId: index.id,
    range: '1D',
    interval: '5m',
    axis: 'time',
    samples: index.series,
    window: index.window,
    reference: { value: index.previousClose, label: 'vs previous close', kind: 'previousClose' },
    currency: index.region === 'EU' ? 'EUR' : 'USD',
    asOf: index.asOf,
    status: index.status,
    source: 'Demo feed — simulated index levels, not market data',
    adjustment: 'split-adjusted',
    timeZone: index.timeZone,
  };
}
