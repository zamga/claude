/*
 * The initiation report, as data. The research engine writes this shape; the
 * reader renders it; the valuation engine computes every derived number from
 * the assumptions here, so no figure in a report is typed in by hand.
 *
 * Prose uses markdown-style footnote markers, e.g. "revenue of €2,041.0m[^r25]",
 * where the id names an entry in `sources`.
 */

/** How strong the evidence for a figure is. */
export type Grade = 'filed' | 'reported' | 'estimated';

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** ISO date of publication, when known. */
  date?: string;
  grade: Grade;
  /** The sentence that supports the claim, quoted. */
  quote?: string;
}

export interface Company {
  name: string;
  legalName: string;
  shortName: string;
  country: string;
  countryCode: string;
  city: string;
  sector: string;
  founded: number;
  employees: string;
  listed: boolean;
  ticker?: string;
  exchange?: string;
  isin?: string;
  website: string;
}

/** A fiscal period label such as "2025A" or "2027E". */
export type Period = string;

export interface Line {
  label: string;
  unit: 'eurm' | 'pct' | 'eur' | 'x' | 'm';
  values: Partial<Record<Period, number>>;
  /** Footnote per period, for reported figures. */
  sources?: Partial<Record<Period, string>>;
  emphasis?: boolean;
}

export interface Assumptions {
  /** Forecast years after the last actual year, in order. */
  periods: Period[];
  revenueGrowth: number[];
  ebitdaMargin: number[];
  daPctRevenue: number;
  capexPctRevenue: number;
  /** Change in working capital as a share of the change in revenue. */
  nwcPctDeltaRevenue: number;
  taxRate: number;
  riskFree: number;
  equityRiskPremium: number;
  beta: number;
  countryRisk: number;
  /** Debt weight in the capital structure (0 for a net-cash company). */
  debtWeight: number;
  costOfDebt: number;
  terminalGrowth: number;
  /** Cash and liquid investments less debt, € millions (positive = net cash). */
  netCash: number;
  netCashSource?: string;
  sharesM: number;
  sharesSource?: string;
  /** Dividend model. */
  dpsNext: number;
  dpsGrowth: number;
  dpsYears: number;
  dpsTerminalGrowth: number;
  /** Earnings model. */
  epsNext: number;
  /** Where next year's earnings per share come from, with its footnote. */
  epsBasis?: string;
  peLow: number;
  peHigh: number;
  /** One-line reasons for the cost-of-capital inputs, shown beside them. */
  rationale?: { riskFree?: string; beta?: string; countryRisk?: string };
}

export interface MarketData {
  price: number;
  priceDate: string;
  priceSource: string;
  high?: number;
  highDate?: string;
  highSource?: string;
}

export interface Section {
  id: string;
  title: string;
  /** Paragraphs with footnote markers. */
  paragraphs: string[];
}

export interface Risk {
  title: string;
  body: string;
  impact: 'high' | 'medium' | 'low';
}

export interface Breakdown {
  label: string;
  value: number;
  sourceId?: string;
}

export interface Report {
  id: string;
  company: Company;
  date: string;
  analyst: string;
  headline: string;
  summary: string;
  thesis: { title: string; body: string }[];
  keyFacts: { label: string; value: string; sourceId?: string }[];
  base: { year: Period; revenue: number; ebitda: number; netProfit: number };
  income: Line[];
  regions: Breakdown[];
  regionsNote: string;
  ownership: Breakdown[];
  ownershipNote: string;
  dividends: { year: string; dps: number; sourceId?: string }[];
  assumptions: Assumptions;
  market?: MarketData;
  sections: Section[];
  catalysts: string[];
  risks: Risk[];
  sources: Source[];
}
