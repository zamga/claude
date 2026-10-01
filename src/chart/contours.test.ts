import { describe, expect, it } from 'vitest';
import { valueGrid, chartExtent } from '../engine/grid';
import { elevationField, isoSegments, isoSegmentsMulti, levelsBetween } from './contours';
import type { ValuationInputs } from '../engine/types';

const inputs: ValuationInputs = {
  revenue: 1000,
  operatingMargin: 0.2,
  growth: 0.1,
  terminalGrowth: 0.03,
  targetMargin: 0.2,
  convergenceYears: 5,
  taxRate: 0.21,
  marginalTaxRate: 0.25,
  salesToCapital: 2,
  costOfCapital: 0.09,
  terminalCostOfCapital: 0.085,
  terminalRoic: 0.11,
  cash: 100,
  debt: 200,
  minorityInterest: 0,
  nonOperatingAssets: 0,
  shares: 10,
};

describe('contours', () => {
  const grid = valueGrid(inputs, chartExtent(inputs, 150), 40, 40);
  const field = elevationField(grid, 150);

  it('traces the same lines in one pass as level by level', () => {
    const levels = [...levelsBetween(-1, 1, 0.1), 0];
    const multi = isoSegmentsMulti(grid, field, levels);
    levels.forEach((level, k) => {
      expect(Array.from(multi[k]!)).toEqual(Array.from(isoSegments(grid, field, level)));
    });
  });

  it('finds a coastline at the price', () => {
    expect(isoSegments(grid, field, 0).length).toBeGreaterThan(0);
  });

  it('skips sea level when listing contour levels', () => {
    expect(levelsBetween(-0.2, 0.2, 0.1)).toEqual([-0.2, -0.1, 0.1, 0.2]);
  });
});
