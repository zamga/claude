import { describe, expect, it } from 'vitest';
import { valueCompany, valuePerShare, enterpriseValueAt } from './dcf';
import { impliedGrowth, impliedMargin } from './reverse';
import { chartExtent, elevation, growthAt, includePoint, marginAt, sampleGrid, valueGrid } from './grid';
import { defaultRanges, runMonteCarlo } from './montecarlo';
import { createRng, sampleTriangular, seedFrom } from './random';
import { sensitivityTable } from './sensitivity';
import { cagr, histogram, percentile, shareAbove } from './stats';
import { formatMoney, formatPct, formatPrice, formatSignedPct } from './format';
import type { ValuationInputs } from './types';

const flat: ValuationInputs = {
  revenue: 1000,
  operatingMargin: 0.2,
  growth: 0,
  terminalGrowth: 0,
  targetMargin: 0.2,
  convergenceYears: 5,
  taxRate: 0.25,
  marginalTaxRate: 0.25,
  salesToCapital: 2,
  costOfCapital: 0.1,
  terminalCostOfCapital: 0.1,
  terminalRoic: 0.1,
  cash: 100,
  debt: 300,
  minorityInterest: 0,
  nonOperatingAssets: 0,
  shares: 10,
};

describe('valueCompany', () => {
  it('reduces to a perpetuity for a no-growth business', () => {
    // FCFF = 1000 × 20% × (1 − 25%) = 150 a year, forever, at 10% → 1,500.
    const r = valueCompany(flat);
    expect(r.operatingAssets).toBeCloseTo(1500, 6);
    expect(r.equityValue).toBeCloseTo(1300, 6);
    expect(r.valuePerShare).toBeCloseTo(130, 6);
    expect(r.years).toHaveLength(10);
  });

  it('matches the Gordon growth model when growth is steady and paid for', () => {
    const g = 0.04;
    const margin = 0.2;
    const tax = 0.25;
    const s2c = 1.5;
    const inputs: ValuationInputs = {
      ...flat,
      growth: g,
      terminalGrowth: g,
      salesToCapital: s2c,
      // Return on capital consistent with lagged reinvestment in the explicit years.
      terminalRoic: margin * (1 - tax) * s2c * (1 + g),
    };
    const fcff1 = 1000 * (1 + g) * (margin * (1 - tax) - g / ((1 + g) * s2c));
    const expected = fcff1 / (0.1 - g);
    expect(valueCompany(inputs).operatingAssets).toBeCloseTo(expected, 6);
  });

  it('agrees with the allocation-free hot path', () => {
    const inputs: ValuationInputs = {
      ...flat,
      growth: 0.18,
      terminalGrowth: 0.03,
      operatingMargin: 0.08,
      targetMargin: 0.27,
      convergenceYears: 6,
      taxRate: 0.14,
      marginalTaxRate: 0.25,
      costOfCapital: 0.095,
      terminalCostOfCapital: 0.085,
      terminalRoic: 0.12,
    };
    expect(valuePerShare(inputs)).toBeCloseTo(valueCompany(inputs).valuePerShare, 9);
  });

  it('floors equity at zero', () => {
    const r = valueCompany({ ...flat, operatingMargin: -0.3, targetMargin: -0.3, debt: 5000 });
    expect(r.equityValue).toBeLessThan(0);
    expect(r.valuePerShare).toBe(0);
  });

  it('keeps terminal growth below the terminal cost of capital', () => {
    const v = valuePerShare({ ...flat, terminalGrowth: 0.2 });
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });

  it('does not tax operating losses', () => {
    const r = valueCompany({ ...flat, operatingMargin: -0.1, targetMargin: -0.1 });
    for (const y of r.years) expect(y.nopat).toBeCloseTo(y.ebit, 9);
  });

  it('derives enterprise value from a price', () => {
    expect(enterpriseValueAt(50, flat)).toBe(50 * 10 - 100 + 300);
    expect(enterpriseValueAt(50, { ...flat, nonOperatingAssets: 40 })).toBe(50 * 10 - 100 - 40 + 300);
  });

  it('adds non-operating assets to equity', () => {
    const base = valueCompany(flat).equityValue;
    expect(valueCompany({ ...flat, nonOperatingAssets: 250 }).equityValue).toBeCloseTo(base + 250, 9);
    expect(valuePerShare({ ...flat, nonOperatingAssets: 250 })).toBeCloseTo((base + 250) / 10, 9);
  });
});

describe('reverse DCF', () => {
  const base: ValuationInputs = { ...flat, growth: 0.08, terminalGrowth: 0.03, terminalRoic: 0.14 };

  it('recovers the margin that produced a price', () => {
    const price = valuePerShare({ ...base, targetMargin: 0.27 });
    const solved = impliedMargin(base, price);
    expect(solved.kind).toBe('solved');
    if (solved.kind === 'solved') expect(solved.value).toBeCloseTo(0.27, 5);
  });

  it('recovers the growth that produced a price', () => {
    const price = valuePerShare({ ...base, growth: 0.15 });
    const solved = impliedGrowth(base, price);
    expect(solved.kind).toBe('solved');
    if (solved.kind === 'solved') expect(solved.value).toBeCloseTo(0.15, 5);
  });

  it('reports prices no margin can justify', () => {
    expect(impliedMargin(base, 1e9).kind).toBe('beyond');
  });

  it('reports prices below the worst case', () => {
    expect(impliedMargin({ ...base, cash: 1e6 }, 1).kind).toBe('below');
  });
});

describe('value grid', () => {
  const inputs: ValuationInputs = { ...flat, growth: 0.1, terminalGrowth: 0.03, terminalRoic: 0.13 };

  it('evaluates every node exactly', () => {
    const extent = chartExtent(inputs, 120);
    const grid = valueGrid(inputs, extent, 9, 7);
    expect(grid.values).toHaveLength(63);
    const i = 4;
    const j = 5;
    const node = valuePerShare({ ...inputs, growth: growthAt(extent, i, 9), targetMargin: marginAt(extent, j, 7) });
    expect(grid.values[j * 9 + i]).toBeCloseTo(node, 9);
    expect(sampleGrid(grid, growthAt(extent, i, 9), marginAt(extent, j, 7))).toBeCloseTo(node, 9);
  });

  it('rises with margin', () => {
    const grid = valueGrid(inputs, chartExtent(inputs, 120), 5, 5);
    for (let i = 0; i < 5; i++) expect(grid.values[4 * 5 + i]!).toBeGreaterThan(grid.values[0 * 5 + i]!);
  });

  it('frames the bearing and rounds to clean steps', () => {
    const e = chartExtent(inputs, 120);
    expect(e.growthMin).toBeLessThanOrEqual(inputs.growth);
    expect(e.growthMax).toBeGreaterThanOrEqual(inputs.growth);
    expect(Math.round(e.marginMax * 100) % 5).toBe(0);
    const grown = includePoint(e, e.growthMax + 0.2, 0.2);
    expect(grown.growthMax).toBeGreaterThan(e.growthMax + 0.2);
  });

  it('maps value to elevation around sea level', () => {
    expect(elevation(100, 100)).toBe(0);
    expect(elevation(200, 100)).toBeCloseTo(Math.log(2), 9);
    expect(elevation(0, 100)).toBeLessThan(0);
  });
});

describe('Monte Carlo', () => {
  const inputs: ValuationInputs = { ...flat, growth: 0.1, terminalGrowth: 0.03, terminalRoic: 0.13 };

  it('is reproducible for a seed', () => {
    const ranges = defaultRanges(inputs);
    const a = runMonteCarlo(inputs, ranges, 100, { draws: 500, seed: 7 });
    const b = runMonteCarlo(inputs, ranges, 100, { draws: 500, seed: 7 });
    expect(Array.from(a.values)).toEqual(Array.from(b.values));
    expect(a.soundings.length).toBeGreaterThan(0);
  });

  it('collapses to the point estimate when ranges have no width', () => {
    const point = (v: number) => ({ low: v, mode: v, high: v });
    const ranges = {
      growth: point(inputs.growth),
      targetMargin: point(inputs.targetMargin),
      costOfCapital: point(inputs.costOfCapital),
      salesToCapital: point(inputs.salesToCapital),
    };
    const base = valuePerShare(inputs);
    const r = runMonteCarlo(inputs, ranges, base * 0.9, { draws: 200 });
    expect(r.p10).toBeCloseTo(base, 9);
    expect(r.p90).toBeCloseTo(base, 9);
    expect(r.probAbovePrice).toBe(1);
  });

  it('orders percentiles', () => {
    const r = runMonteCarlo(inputs, defaultRanges(inputs), 100, { draws: 2000 });
    expect(r.p10).toBeLessThanOrEqual(r.p50);
    expect(r.p50).toBeLessThanOrEqual(r.p90);
    expect(r.probAboveLoadLine).toBeLessThanOrEqual(r.probAbovePrice);
  });
});

describe('random', () => {
  it('samples a triangular distribution with the right mean', () => {
    const rng = createRng(seedFrom('plimsoll'));
    let sum = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) sum += sampleTriangular(rng(), 0, 0.2, 1);
    expect(sum / n).toBeCloseTo(0.4, 2);
  });

  it('stays inside its bounds', () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const x = sampleTriangular(rng(), -0.1, 0.05, 0.3);
      expect(x).toBeGreaterThanOrEqual(-0.1);
      expect(x).toBeLessThanOrEqual(0.3);
    }
  });
});

describe('sensitivity', () => {
  it('puts the base case at the centre', () => {
    const inputs: ValuationInputs = { ...flat, growth: 0.1, terminalGrowth: 0.03, terminalRoic: 0.13 };
    const t = sensitivityTable(inputs);
    expect(t).toHaveLength(7);
    expect(t[3]!.cells[2]!.value).toBeCloseTo(valuePerShare(inputs), 9);
    // Value falls as the cost of capital rises.
    expect(t[0]!.cells[2]!.value).toBeGreaterThan(t[6]!.cells[2]!.value);
  });
});

describe('stats', () => {
  it('interpolates percentiles', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([0, 10], 0.25)).toBe(2.5);
  });

  it('counts the share above a threshold', () => {
    expect(shareAbove([1, 2, 3, 4], 2)).toBe(0.5);
    expect(shareAbove([1, 2, 3, 4], 0)).toBe(1);
    expect(shareAbove([1, 2, 3, 4], 9)).toBe(0);
  });

  it('bins values', () => {
    const bins = histogram([0, 0.5, 1, 1.5, 2, 9], 0, 2, 2);
    expect(bins.map((b) => b.count)).toEqual([2, 4]);
  });

  it('computes CAGR', () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 9);
    expect(cagr(-1, 121, 2)).toBeNull();
  });
});

describe('format', () => {
  it('formats money compactly', () => {
    expect(formatMoney(391035)).toBe('$391B');
    expect(formatMoney(1_240_000)).toBe('$1.24T');
    expect(formatMoney(-845)).toBe('−$845M');
  });

  it('formats prices and percentages', () => {
    expect(formatPrice(254.6)).toBe('$254.60');
    expect(formatPrice(1204.4)).toBe('$1,204');
    expect(formatPct(0.1234)).toBe('12.3%');
    expect(formatSignedPct(-0.04)).toBe('−4.0%');
    expect(formatSignedPct(0.2)).toBe('+20.0%');
  });
});
