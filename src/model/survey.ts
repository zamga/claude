import { cagr, clamp } from '../engine/stats';
import type { ValuationInputs } from '../engine/types';
import { INDUSTRIES, MARKET, MATURE_COST_OF_CAPITAL, costOfCapitalFor } from '../data/market';
import type { CompanySnapshot } from '../data/types';

/** Facts read straight from the filings, before any judgement. */
export interface Survey {
  revenue: number;
  operatingMargin: number;
  /** Growth over the last reported year. */
  lastGrowth: number | null;
  /** Compound growth over the history we hold (up to four years). */
  historicalCagr: number | null;
  historyYears: number;
  averageMargin: number;
  peakMargin: number;
  troughMargin: number;
  effectiveTaxRate: number | null;
  cashAndInvestments: number;
  debt: number;
  investedCapital: number | null;
  salesToCapital: number | null;
  /** After-tax operating return on invested capital, latest year. */
  roic: number | null;
  shares: number;
  marketCap: number;
  enterpriseValue: number;
  evToRevenue: number;
  evToEbit: number | null;
  priceToEarnings: number | null;
}

const taxRateOf = (l: CompanySnapshot['latest']) =>
  l.incomeTax !== null && l.pretaxIncome !== null && l.pretaxIncome > 0 ? l.incomeTax / l.pretaxIncome : null;

/** Named moat widths: the return on capital a business keeps above its cost of capital, forever. */
export const MOATS = [
  { id: 'none', label: 'None', spread: 0 },
  { id: 'narrow', label: 'Narrow', spread: 0.03 },
  { id: 'wide', label: 'Wide', spread: 0.06 },
] as const;

export function survey(company: CompanySnapshot, price = company.price.value): Survey {
  const h = company.history;
  const last = h[h.length - 1]!;
  const prev = h.length > 1 ? h[h.length - 2]! : null;
  const margins = h.filter((y) => y.revenue > 0).map((y) => y.operatingIncome / y.revenue);
  const l = company.latest;
  const cashAndInvestments = l.cash + l.shortTermInvestments + l.longTermInvestments;
  // Capital tied up in operations: excludes cash and non-operating stakes.
  const investedCapital =
    l.equity === null ? null : l.equity + l.minorityInterest + l.totalDebt - cashAndInvestments - l.nonOperatingAssets;
  const shares = company.sharesOutstanding.value;
  const marketCap = price * shares;
  const enterpriseValue = marketCap - cashAndInvestments - l.nonOperatingAssets + l.totalDebt + l.minorityInterest;

  return {
    revenue: last.revenue,
    operatingMargin: last.revenue > 0 ? last.operatingIncome / last.revenue : 0,
    lastGrowth: prev && prev.revenue > 0 ? last.revenue / prev.revenue - 1 : null,
    historicalCagr: h.length > 1 ? cagr(h[0]!.revenue, last.revenue, h.length - 1) : null,
    historyYears: h.length,
    averageMargin: margins.reduce((a, b) => a + b, 0) / Math.max(1, margins.length),
    peakMargin: Math.max(...margins),
    troughMargin: Math.min(...margins),
    effectiveTaxRate: taxRateOf(l),
    cashAndInvestments,
    debt: l.totalDebt,
    investedCapital,
    salesToCapital: investedCapital !== null && investedCapital > 0 ? last.revenue / investedCapital : null,
    roic:
      investedCapital !== null && investedCapital > 0
        ? (last.operatingIncome * (1 - clamp(taxRateOf(l) ?? 0.21, 0, 0.35))) / investedCapital
        : null,
    shares,
    marketCap,
    enterpriseValue,
    evToRevenue: last.revenue > 0 ? enterpriseValue / last.revenue : Number.NaN,
    evToEbit: last.operatingIncome > 0 ? enterpriseValue / last.operatingIncome : null,
    priceToEarnings: l.netIncome !== null && l.netIncome > 0 ? marketCap / l.netIncome : null,
  };
}

/**
 * Starting assumptions: the company as it is today. Growth starts from the
 * recent trend (bounded so a single boom year does not run for five) and the
 * margin holds where it is. Businesses earning well above their cost of
 * capital keep a narrow moat in perpetuity; everyone else competes their
 * excess returns away.
 */
export function baseInputs(company: CompanySnapshot): ValuationInputs {
  const s = survey(company);
  const beta = INDUSTRIES[company.industry].beta;
  const costOfCapital = costOfCapitalFor(beta);
  const trend = s.historicalCagr ?? s.lastGrowth ?? 0.04;
  const recent = s.lastGrowth ?? trend;
  const growth = clamp(0.5 * trend + 0.5 * recent, -0.05, 0.3);
  const terminalGrowth = Math.min(MARKET.terminalGrowthCap, MARKET.riskFreeRate);
  const terminalCostOfCapital = Math.min(costOfCapital, MATURE_COST_OF_CAPITAL);

  return {
    revenue: s.revenue,
    operatingMargin: s.operatingMargin,
    growth,
    terminalGrowth,
    targetMargin: clamp(s.operatingMargin, -0.2, 0.85),
    convergenceYears: 5,
    taxRate: clamp(s.effectiveTaxRate ?? 0.21, 0.05, 0.3),
    marginalTaxRate: MARKET.marginalTaxRate,
    salesToCapital: clamp(s.salesToCapital ?? 2, 0.5, 6),
    costOfCapital,
    terminalCostOfCapital,
    terminalRoic:
      terminalCostOfCapital + (s.roic !== null && s.roic > costOfCapital + MOATS[1].spread ? MOATS[1].spread : 0),
    cash: s.cashAndInvestments,
    debt: s.debt,
    minorityInterest: company.latest.minorityInterest,
    nonOperatingAssets: company.latest.nonOperatingAssets,
    shares: s.shares,
  };
}

/** The moat as the spread of terminal return over terminal cost of capital. */
export const moatOf = (inputs: ValuationInputs) => inputs.terminalRoic - inputs.terminalCostOfCapital;
