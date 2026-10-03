import { describe, expect, it } from 'vitest';
import { formatPercent, formatPoints } from '../format';
import {
  maxDrawdown,
  priceReturnPct,
  summarizeOutcomes,
  timeWeightedReturn,
  wealthIndex,
} from '../performance';

describe('F04 cash-flow return', () => {
  it('1,000 -> 1,100, deposit 1,000, end 2,100 is a 10% time-weighted return', () => {
    const twr = timeWeightedReturn('1000', [{ valueBefore: '1100', flow: '1000' }], '2100');
    expect(twr!.times(100).toFixed(2)).toBe('10.00');
  });

  it('a missing valuation at the deposit boundary yields unavailable', () => {
    expect(timeWeightedReturn('1000', [{ valueBefore: null, flow: '1000' }], '2100')).toBeNull();
  });

  it('the wealth index matches and ignores external flows', () => {
    const index = wealthIndex([
      { t: 0, equity: '1000' },
      { t: 1, equity: '1100' },
      { t: 2, equity: '2100', flow: '1000' },
    ]);
    expect(index[2]!.returnPct).toBeCloseTo(10, 10);
  });

  it('drawdown uses the running peak of the wealth index', () => {
    const index = wealthIndex([
      { t: 0, equity: '100' },
      { t: 1, equity: '120' },
      { t: 2, equity: '90' },
      { t: 3, equity: '130' },
    ]);
    expect(maxDrawdown(index)).toBeCloseTo(-25, 10);
  });
});

describe('historical pick statistics', () => {
  const returns = [8.6, 4.2, -5.1, 2.3, -1.8, 11.4, 9.7, 6.8, 7.9, -1.2, -0.6, -1.4];
  const benchmarks = [2.1, 1.6, 0.9, 2.4, 1.1, 2.8, 2.2, 1.9, 1.5, 1.7, 1.4, 2.0];

  it('reports mean, positive share, benchmark and difference with sample size', () => {
    const summary = summarizeOutcomes([
      ...returns.map((r, i) => ({
        status: 'complete' as const,
        returnPct: String(r),
        benchmarkPct: String(benchmarks[i]),
      })),
      { status: 'pending', returnPct: null, benchmarkPct: null },
      { status: 'pending', returnPct: '3.0', benchmarkPct: '1.0' },
    ]);
    expect(summary.complete).toBe(12);
    expect(summary.pending).toBe(2);
    expect(formatPercent(summary.meanPct, 1)).toBe('+3.4%');
    expect(formatPercent(summary.benchmarkMeanPct, 1)).toBe('+1.8%');
    expect(formatPoints(summary.differencePp)).toBe('+1.6 pp');
    expect(summary.positive).toBe(7);
  });

  it('withholds statistics when nothing is complete', () => {
    expect(
      summarizeOutcomes([{ status: 'pending', returnPct: null, benchmarkPct: null }]).meanPct,
    ).toBeNull();
  });

  it('computes a simple price return', () => {
    expect(priceReturnPct('100', '108.6')!.toFixed(1)).toBe('8.6');
    expect(priceReturnPct('0', '1')).toBeNull();
  });
});
