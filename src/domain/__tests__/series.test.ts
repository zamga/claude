import { describe, expect, it } from 'vitest';
import { computeChange } from '../change';
import { formatClockWithZone, formatMoney, formatPercent } from '../format';
import {
  downsampleForDrawing,
  lastValidIndex,
  nearestValidIndex,
  nearestValidOrdinal,
  segments,
  stepValid,
  valueExtent,
  type Sample,
} from '../series';
import { F01, F01_PREVIOUS_CLOSE, F01_START } from './fixtures';

const FIVE_MIN = 5 * 60_000;

describe('F01 chart selection', () => {
  it('a hold at the fifth point inspects 134.50 at 13:50 ET', () => {
    const index = nearestValidIndex(F01, F01_START + 4 * FIVE_MIN + 40_000);
    const sample = F01[index]!;
    expect(index).toBe(4);
    expect(formatMoney(String(sample.v), 'USD')).toBe('$134.50');
    expect(formatClockWithZone(sample.t, 'America/New_York')).toBe('13:50 ET');
  });

  it('the ninth point inspects 139.40 at 14:10 ET with a matching delta', () => {
    const index = nearestValidIndex(F01, F01_START + 8 * FIVE_MIN - 30_000);
    const sample = F01[index]!;
    expect(index).toBe(8);
    expect(formatMoney(String(sample.v), 'USD')).toBe('$139.40');
    expect(formatClockWithZone(sample.t, 'America/New_York')).toBe('14:10 ET');
    const change = computeChange(String(sample.v), String(F01_PREVIOUS_CLOSE));
    expect(formatPercent(change.percent)).toBe('−0.09%');
  });

  it('the latest point is 142.80 at 14:25 ET', () => {
    const last = F01[lastValidIndex(F01)]!;
    expect(last.v).toBe(142.8);
    expect(formatClockWithZone(last.t, 'America/New_York')).toBe('14:25 ET');
    expect(formatPercent(computeChange('142.8', '139.53').percent)).toBe('+2.34%');
  });

  it('chooses the earlier sample on an exact tie', () => {
    expect(nearestValidIndex(F01, F01_START + 2.5 * FIVE_MIN)).toBe(2);
    expect(nearestValidOrdinal(F01, 6.5)).toBe(6);
  });

  it('clamps outside the plotted range', () => {
    expect(nearestValidIndex(F01, F01_START - 3_600_000)).toBe(0);
    expect(nearestValidIndex(F01, F01_START + 99 * FIVE_MIN)).toBe(11);
  });
});

describe('gaps and sparse data', () => {
  const gappy: Sample[] = [
    { t: 0, v: 10 },
    { t: 1, v: null },
    { t: 2, v: null },
    { t: 3, v: 13 },
    { t: 4, v: 14 },
  ];

  it('never selects a missing value', () => {
    expect(nearestValidIndex(gappy, 1)).toBe(0);
    expect(nearestValidIndex(gappy, 2)).toBe(3);
    expect(nearestValidIndex(gappy, 1.5)).toBe(0); // exact tie -> earlier valid sample
  });

  it('breaks the line at missing intervals', () => {
    expect(segments(gappy).map((run) => run.map((s) => s.v))).toEqual([[10], [13, 14]]);
  });

  it('keyboard stepping skips gaps', () => {
    expect(stepValid(gappy, 0, 1)).toBe(3);
    expect(stepValid(gappy, 3, -1)).toBe(0);
    expect(stepValid(gappy, 4, 1)).toBe(4);
  });

  it('returns -1 when nothing is valid', () => {
    expect(nearestValidIndex([{ t: 0, v: null }], 0)).toBe(-1);
    expect(nearestValidIndex([], 0)).toBe(-1);
  });

  it('pads a flat series symmetrically', () => {
    const extent = valueExtent([
      { t: 0, v: 50 },
      { t: 1, v: 50 },
    ])!;
    expect(extent.max - 50).toBeCloseTo(50 - extent.min);
    expect(extent.max).toBeGreaterThan(50);
    expect(valueExtent([{ t: 0, v: null }])).toBeNull();
  });
});

describe('downsampling for drawing', () => {
  const long: Sample[] = Array.from({ length: 1000 }, (_, i) => ({
    t: i,
    v: i === 500 ? null : Math.sin(i / 20) * 10 + (i === 321 ? 50 : 0) + (i === 777 ? -50 : 0),
  }));

  it('keeps endpoints, extrema and gaps while bounding the point count', () => {
    const drawn = downsampleForDrawing(long, 200);
    expect(drawn.length).toBeLessThanOrEqual(260);
    expect(drawn[0]).toBe(long[0]);
    expect(drawn[drawn.length - 1]).toBe(long[999]);
    expect(drawn.some((s) => s.t === 321)).toBe(true);
    expect(drawn.some((s) => s.t === 777)).toBe(true);
    expect(drawn.some((s) => s.v == null)).toBe(true);
  });
});
