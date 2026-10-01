import { chartExtent, valueGrid } from '../engine/grid';
import type { ChartExtent } from '../engine/types';
import { impliedGrowth, impliedMargin } from '../engine/reverse';
import { valuePerShare } from '../engine/dcf';
import { elevationField } from '../chart/contours';
import type { CompanySnapshot } from '../data/types';
import { baseInputs, survey } from './survey';

/**
 * The default chart for a company, computed without React state: used by
 * the hero, the atlas and the teaching diagrams. Memoised per ticker.
 */
const cache = new Map<string, ReturnType<typeof compute>>();

/** One window for every atlas chart, so coastlines can be compared at a glance. */
export const ATLAS_EXTENT: ChartExtent = { growthMin: -0.1, growthMax: 0.6, marginMin: -0.1, marginMax: 0.7 };

function compute(company: CompanySnapshot, size: number, fixed?: ChartExtent) {
  const inputs = baseInputs(company);
  const price = company.price.value;
  const extent = fixed ?? chartExtent(inputs, price);
  const grid = valueGrid(inputs, extent, size, size);
  const field = elevationField(grid, price);
  const facts = survey(company);
  const value = valuePerShare(inputs);
  return {
    inputs,
    price,
    grid,
    field,
    value,
    facts,
    marketGrowth: impliedGrowth(inputs, price),
    marketMargin: impliedMargin(inputs, price),
    bearing: { growth: inputs.growth, margin: inputs.targetMargin },
    today: { growth: facts.lastGrowth ?? inputs.growth, margin: facts.operatingMargin },
  };
}

export function quickChart(company: CompanySnapshot, size = 64, fixed?: ChartExtent) {
  const key = `${company.ticker}:${size}:${fixed ? 'fixed' : 'own'}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = compute(company, size, fixed);
    cache.set(key, hit);
  }
  return hit;
}

export type QuickChart = ReturnType<typeof quickChart>;
