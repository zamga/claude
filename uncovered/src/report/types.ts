/*
 * The initiation report, as data. The research engine writes this shape; the
 * reader renders it; the valuation engine computes every derived number from
 * the assumptions here, so no figure in a report is typed in by hand.
 *
 * Prose uses markdown-style footnote markers, e.g. "revenue of €2,041.0m[^r25]",
 * where the id names an entry in `sources`, and model figures as tokens, e.g.
 * "{{fair.base}}", filled from the valuation engine (see bindings.ts).
 */

/** How strong the evidence for a figure is. */
export type Grade = 'filed' | 'reported' | 'estimated';

/**
 * One cited passage: a document, and the sentence in it that a figure or claim
 * rests on. Several passages can come from one document.
 */
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
  /**
   * How the quotation was obtained. `verbatim`: the engine found it word for
   * word in the text of the document it read. `excerpt`: condensed from a
   * search excerpt and not checked word for word against the document.
   */
  quoted?: 'verbatim' | 'excerpt';
  /** Page of the document the quotation is on, for documents with pages. */
  page?: number;
  /** Passages that share this key come from the same document. */
  document?: string;
  /** Our English translation of a quotation in another language. */
  translation?: string;
  /** The document was supplied by whoever requested the report. */
  supplied?: boolean;
}

export interface Company {
  name: string;
  legalName: string;
  shortName: string;
  country: string;
  countryCode: string;
  city?: string;
  sector: string;
  founded?: number;
  employees?: string;
  listed: boolean;
  ticker?: string;
  exchange?: string;
  isin?: string;
  /** Number in the national business register. */
  registration?: string;
  website?: string;
}

/** A fiscal period label such as "2025A", "H1 2026" or "2027E". */
export type Period = string;

export interface Line {
  label: string;
  /** Money in millions of the report's currency, money per share, a ratio, a multiple, or a plain count in millions. */
  unit: 'money-m' | 'money' | 'pct' | 'x' | 'm';
  values: Partial<Record<Period, number>>;
  /** Footnote per period, for reported figures. */
  sources?: Partial<Record<Period, string>>;
  emphasis?: boolean;
}

/**
 * What a valuation is expressed as: a value per share for a company with
 * traded shares, or the value of all of the equity for one without.
 */
export type Basis = 'share' | 'equity';

export interface Assumptions {
  /** Defaults to 'share'. */
  basis?: Basis;
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
  /** Cash and liquid investments less debt, in millions (positive = net cash). */
  netCash: number;
  netCashSource?: string;
  /** Shares in issue, millions. Needed for the share basis. */
  sharesM?: number;
  sharesSource?: string;
  /** Dividend model, for companies that pay one. */
  dpsNext?: number;
  dpsGrowth?: number;
  dpsYears?: number;
  dpsTerminalGrowth?: number;
  /** Earnings model, for companies with earnings per share. */
  epsNext?: number;
  /** Where next year's earnings per share come from, with its footnote. */
  epsBasis?: string;
  peLow?: number;
  peHigh?: number;
  /** Enterprise value to EBITDA, applied to the last reported year's EBITDA. */
  evEbitdaLow?: number;
  evEbitdaHigh?: number;
  /** Where the multiple range comes from, with its footnote. */
  evEbitdaBasis?: string;
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
  /** A sample written by hand to show the format, or a report researched by the engine. */
  kind?: 'sample' | 'engine';
  /** ISO 4217 code of the currency every money figure is in. Defaults to EUR. */
  currency?: string;
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
  /** The regions exhibit's title, e.g. "Sales by region, 2025". */
  regionsTitle?: string;
  /** Regions as money in millions (the default) or as percentages of the total. */
  regionsUnit?: 'money-m' | 'pct';
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
  /** What this report's evidence does and does not cover, for the disclosures. */
  disclosures?: string[];
  /** The question the requester asked; answered in the section with id "question". */
  question?: string;
}
