import { useDeferredValue, useMemo } from 'react';
import { valueCompany } from '../engine/dcf';
import { chartExtent, includePoint, valueGrid } from '../engine/grid';
import { runMonteCarlo } from '../engine/montecarlo';
import { seedFrom } from '../engine/random';
import { impliedGrowth, impliedMargin } from '../engine/reverse';
import { sensitivityTable } from '../engine/sensitivity';
import type { ValuationInputs } from '../engine/types';
import { elevationField } from '../chart/contours';
import type { CompanySnapshot } from '../data/types';
import { baseInputs, survey } from './survey';
import { rangesFor, type Scenario } from './scenario';

export const GRID_SIZE = 80;
export const DRAWS = 4000;

export type Standing = 'safe' | 'thin' | 'under';

/**
 * Everything the chart page shows, derived from a scenario. The terrain is
 * rebuilt only when an input other than the two axes changes, so dragging
 * the bearing costs one DCF, not six thousand. Monte Carlo and the
 * sensitivity table run on a deferred copy so input stays responsive.
 */
export function useAnalysis(company: CompanySnapshot, scenario: Scenario) {
  const { inputs, price } = scenario;

  const baseExtent = useMemo(() => chartExtent(baseInputs(company), company.price.value), [company]);
  const extent = useMemo(
    () => includePoint(baseExtent, inputs.growth, inputs.targetMargin),
    [baseExtent, inputs.growth, inputs.targetMargin],
  );

  const {
    revenue,
    operatingMargin,
    terminalGrowth,
    convergenceYears,
    taxRate,
    marginalTaxRate,
    salesToCapital,
    costOfCapital,
    terminalCostOfCapital,
    terminalRoic,
    cash,
    debt,
    minorityInterest,
    nonOperatingAssets,
    shares,
  } = inputs;
  const grid = useMemo(() => {
    const terrain: ValuationInputs = {
      revenue,
      operatingMargin,
      growth: 0,
      terminalGrowth,
      targetMargin: 0,
      convergenceYears,
      taxRate,
      marginalTaxRate,
      salesToCapital,
      costOfCapital,
      terminalCostOfCapital,
      terminalRoic,
      cash,
      debt,
      minorityInterest,
      nonOperatingAssets,
      shares,
    };
    return valueGrid(terrain, extent, GRID_SIZE, GRID_SIZE);
  }, [
    revenue,
    operatingMargin,
    terminalGrowth,
    convergenceYears,
    taxRate,
    marginalTaxRate,
    salesToCapital,
    costOfCapital,
    terminalCostOfCapital,
    terminalRoic,
    cash,
    debt,
    minorityInterest,
    nonOperatingAssets,
    shares,
    extent,
  ]);

  const field = useMemo(() => elevationField(grid, price), [grid, price]);
  const result = useMemo(() => valueCompany(inputs), [inputs]);
  const marketGrowth = useMemo(() => impliedGrowth(inputs, price), [inputs, price]);
  const marketMargin = useMemo(() => impliedMargin(inputs, price), [inputs, price]);
  const facts = useMemo(() => survey(company, price), [company, price]);

  const deferred = useDeferredValue(scenario);
  const ranges = useMemo(() => rangesFor(deferred), [deferred]);
  const monteCarlo = useMemo(
    () =>
      runMonteCarlo(deferred.inputs, ranges, deferred.price, {
        draws: DRAWS,
        seed: seedFrom(company.ticker),
        marginOfSafety: deferred.marginOfSafety,
      }),
    [deferred, ranges, company.ticker],
  );
  const sensitivity = useMemo(() => sensitivityTable(deferred.inputs), [deferred.inputs]);

  const value = result.valuePerShare;
  const loadLine = value * (1 - scenario.marginOfSafety);
  const standing: Standing = price <= loadLine ? 'safe' : price <= value ? 'thin' : 'under';
  /**
   * Freeboard. Positive: the margin of safety, how far the price sits below
   * your value. Negative: how far the price would have to fall to reach it.
   * Either way it stays between −100% and +100%.
   */
  const freeboard = (value - price) / Math.max(value, price);

  return {
    extent,
    grid,
    field,
    result,
    value,
    loadLine,
    standing,
    freeboard,
    marketGrowth,
    marketMargin,
    facts,
    ranges,
    monteCarlo,
    sensitivity,
    stale: deferred !== scenario,
  };
}

export type Analysis = ReturnType<typeof useAnalysis>;
