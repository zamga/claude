import type { ProjectionYear, ValuationInputs, ValuationResult } from './types';

/** Explicit forecast horizon. Years 1–5 at the chosen growth, 6–10 fade to terminal. */
export const HORIZON = 10;
const HIGH_GROWTH_YEARS = 5;
/** Terminal growth is kept at least this far below the terminal cost of capital. */
const MIN_SPREAD = 0.005;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fraction of the way through the fade period (years 6–10) for year t. */
const fade = (t: number) => (t <= HIGH_GROWTH_YEARS ? 0 : (t - HIGH_GROWTH_YEARS) / (HORIZON - HIGH_GROWTH_YEARS));

export function marginInYear(
  inputs: Pick<ValuationInputs, 'operatingMargin' | 'targetMargin' | 'convergenceYears'>,
  t: number,
): number {
  const n = Math.min(HORIZON, Math.max(1, Math.round(inputs.convergenceYears)));
  return t >= n ? inputs.targetMargin : lerp(inputs.operatingMargin, inputs.targetMargin, t / n);
}

export function taxInYear(inputs: Pick<ValuationInputs, 'taxRate' | 'marginalTaxRate'>, t: number): number {
  return lerp(inputs.taxRate, inputs.marginalTaxRate, fade(t));
}

export function costOfCapitalInYear(
  inputs: Pick<ValuationInputs, 'costOfCapital' | 'terminalCostOfCapital'>,
  t: number,
): number {
  return lerp(inputs.costOfCapital, inputs.terminalCostOfCapital, fade(t));
}

/** Terminal growth after enforcing the spread to the terminal cost of capital. */
export function safeTerminalGrowth(inputs: Pick<ValuationInputs, 'terminalGrowth' | 'terminalCostOfCapital'>) {
  return Math.min(inputs.terminalGrowth, inputs.terminalCostOfCapital - MIN_SPREAD);
}

const afterTax = (ebit: number, tax: number) => (ebit > 0 ? ebit * (1 - tax) : ebit);

/**
 * Free-cash-flow-to-the-firm DCF, after Damodaran:
 *  - revenue grows at `growth` for five years, then fades to `terminalGrowth`;
 *  - margin converges linearly to `targetMargin`;
 *  - reinvestment = revenue change / sales-to-capital;
 *  - terminal value = FCFF(11) / (WACC − g), where reinvestment in perpetuity
 *    is g / ROIC so growth is paid for.
 * Equity value is floored at zero (limited liability).
 */
export function valueCompany(inputs: ValuationInputs): ValuationResult {
  const gT = safeTerminalGrowth(inputs);
  const years: ProjectionYear[] = [];
  let revenue = inputs.revenue;
  let discount = 1;
  let pvCashFlows = 0;

  for (let t = 1; t <= HORIZON; t++) {
    const growth = t <= HIGH_GROWTH_YEARS ? inputs.growth : lerp(inputs.growth, gT, fade(t));
    const prior = revenue;
    revenue = prior * (1 + growth);
    const margin = marginInYear(inputs, t);
    const ebit = revenue * margin;
    const taxRate = taxInYear(inputs, t);
    const nopat = afterTax(ebit, taxRate);
    const reinvestment = (revenue - prior) / inputs.salesToCapital;
    const fcff = nopat - reinvestment;
    const costOfCapital = costOfCapitalInYear(inputs, t);
    discount /= 1 + costOfCapital;
    const presentValue = fcff * discount;
    pvCashFlows += presentValue;
    years.push({
      year: t,
      growth,
      revenue,
      margin,
      ebit,
      taxRate,
      nopat,
      reinvestment,
      fcff,
      costOfCapital,
      discountFactor: discount,
      presentValue,
    });
  }

  const terminalRevenue = revenue * (1 + gT);
  const terminalEbit = terminalRevenue * inputs.targetMargin;
  const terminalNopat = afterTax(terminalEbit, inputs.marginalTaxRate);
  const reinvestmentRate = terminalNopat > 0 && inputs.terminalRoic > 0 ? Math.max(0, gT / inputs.terminalRoic) : 0;
  const terminalFcff = terminalNopat * (1 - reinvestmentRate);
  const terminalValue = terminalFcff / (inputs.terminalCostOfCapital - gT);
  const pvTerminal = terminalValue * discount;

  const operatingAssets = pvCashFlows + pvTerminal;
  const equityValue =
    operatingAssets + inputs.cash + inputs.nonOperatingAssets - inputs.debt - inputs.minorityInterest;
  const valuePerShare = Math.max(0, equityValue) / inputs.shares;

  return {
    years,
    terminal: {
      revenue: terminalRevenue,
      ebit: terminalEbit,
      nopat: terminalNopat,
      reinvestmentRate,
      fcff: terminalFcff,
      value: terminalValue,
      presentValue: pvTerminal,
    },
    pvCashFlows,
    operatingAssets,
    equityValue,
    valuePerShare,
    terminalShare: operatingAssets > 0 ? pvTerminal / operatingAssets : 0,
  };
}

/**
 * Allocation-free version of {@link valueCompany} for hot loops (terrain grid,
 * Monte Carlo, solvers). Must stay numerically identical to `valueCompany`.
 */
export function valuePerShare(inputs: ValuationInputs): number {
  const gT = safeTerminalGrowth(inputs);
  const n = Math.min(HORIZON, Math.max(1, Math.round(inputs.convergenceYears)));
  const m0 = inputs.operatingMargin;
  const mT = inputs.targetMargin;
  let revenue = inputs.revenue;
  let discount = 1;
  let pv = 0;

  for (let t = 1; t <= HORIZON; t++) {
    const f = t <= HIGH_GROWTH_YEARS ? 0 : (t - HIGH_GROWTH_YEARS) / (HORIZON - HIGH_GROWTH_YEARS);
    const growth = t <= HIGH_GROWTH_YEARS ? inputs.growth : inputs.growth + (gT - inputs.growth) * f;
    const prior = revenue;
    revenue = prior * (1 + growth);
    const margin = t >= n ? mT : m0 + (mT - m0) * (t / n);
    const ebit = revenue * margin;
    const tax = inputs.taxRate + (inputs.marginalTaxRate - inputs.taxRate) * f;
    const nopat = ebit > 0 ? ebit * (1 - tax) : ebit;
    const fcff = nopat - (revenue - prior) / inputs.salesToCapital;
    discount /= 1 + inputs.costOfCapital + (inputs.terminalCostOfCapital - inputs.costOfCapital) * f;
    pv += fcff * discount;
  }

  const terminalEbit = revenue * (1 + gT) * mT;
  const terminalNopat = terminalEbit > 0 ? terminalEbit * (1 - inputs.marginalTaxRate) : terminalEbit;
  const rr = terminalNopat > 0 && inputs.terminalRoic > 0 ? Math.max(0, gT / inputs.terminalRoic) : 0;
  const terminalValue = (terminalNopat * (1 - rr)) / (inputs.terminalCostOfCapital - gT);
  const equity =
    pv + terminalValue * discount + inputs.cash + inputs.nonOperatingAssets - inputs.debt - inputs.minorityInterest;
  return Math.max(0, equity) / inputs.shares;
}

/** Enterprise value (operating assets) implied by a share price. */
export function enterpriseValueAt(
  price: number,
  inputs: Pick<ValuationInputs, 'shares' | 'cash' | 'debt' | 'minorityInterest' | 'nonOperatingAssets'>,
) {
  return price * inputs.shares - inputs.cash - inputs.nonOperatingAssets + inputs.debt + inputs.minorityInterest;
}
