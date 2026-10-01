export type IndustryKey =
  | 'semiconductors'
  | 'software'
  | 'hardware'
  | 'internet'
  | 'ecommerce'
  | 'autos'
  | 'media'
  | 'retail'
  | 'beverages'
  | 'apparel'
  | 'private'
  | 'other';

export interface FiscalYear {
  /** Label as the company reports it, e.g. "FY2025". */
  fy: string;
  /** USD millions. */
  revenue: number;
  /** GAAP operating income, USD millions. */
  operatingIncome: number;
}

export interface BalanceAndIncome {
  netIncome: number | null;
  pretaxIncome: number | null;
  incomeTax: number | null;
  dAndA: number | null;
  capex: number | null;
  cash: number;
  shortTermInvestments: number;
  longTermInvestments: number;
  /** Borrowings only; operating leases excluded. */
  totalDebt: number;
  /** Equity-method stakes and other investments outside operating income. */
  nonOperatingAssets: number;
  equity: number | null;
  minorityInterest: number;
  dilutedShares: number | null;
}

export interface Source {
  label: string;
  url: string;
}

/**
 * One company as surveyed from its latest annual report. Every figure is in
 * USD millions except share counts (millions) and the share price (USD).
 */
export interface CompanySnapshot {
  ticker: string;
  name: string;
  shortName: string;
  industry: IndustryKey;
  industryLabel: string;
  /** One line on what the company does, in our words. */
  blurb: string;
  fiscalYearLabel: string;
  fiscalYearEnd: string;
  /** Oldest to newest. */
  history: FiscalYear[];
  latest: BalanceAndIncome;
  sharesOutstanding: { value: number; asOf: string };
  price: { value: number; asOf: string; source: string };
  sources: Source[];
  notes?: string;
  /** Present on companies a visitor entered themselves. */
  custom?: boolean;
}
