import type { BalanceAndIncome, FiscalYear, IndustryKey } from './types';

/*
 * Normalise SEC EDGAR XBRL "companyfacts" into the survey Plimsoll needs.
 * Pure functions: the refresh script, the live API and the tests share them.
 * Docs: https://www.sec.gov/edgar/sec-api-documentation
 */

export interface SecFact {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
}

export interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { units: Record<string, SecFact[]> }>>;
}

export interface SecSurvey {
  name: string;
  cik: number;
  fiscalYearLabel: string;
  fiscalYearEnd: string;
  history: FiscalYear[];
  latest: BalanceAndIncome;
  sharesOutstanding: { value: number; asOf: string } | null;
}

const M = 1e6;

const REVENUE = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueNet',
];
const PRETAX = [
  'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
  'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
];
const DEPRECIATION = ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet'];
const SHORT_TERM_INVESTMENTS = ['ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'];
const LONG_TERM_INVESTMENTS = ['MarketableSecuritiesNoncurrent', 'AvailableForSaleSecuritiesDebtSecuritiesNoncurrent'];

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

function series(facts: CompanyFacts, concept: string, unit = 'USD', taxonomy = 'us-gaap'): SecFact[] {
  return facts.facts[taxonomy]?.[concept]?.units[unit] ?? [];
}

const isAnnualForm = (f: SecFact) => f.form === '10-K' || f.form === '10-K/A' || f.form === '20-F' || f.form === '40-F';

/**
 * Full-year values from annual reports, one per fiscal year end. When a
 * period is reported more than once (restatements, later comparatives), the
 * most recent filing wins.
 */
export function annualSeries(facts: CompanyFacts, concepts: string[]): Map<string, number> {
  const out = new Map<string, number>();
  // Concepts are in priority order: a later concept only fills years the earlier ones lack.
  for (const concept of concepts) {
    const byEnd = new Map<string, { val: number; filed: string }>();
    for (const f of series(facts, concept)) {
      if (!f.start || !isAnnualForm(f)) continue;
      const span = days(f.start, f.end);
      if (span < 330 || span > 400) continue;
      const prev = byEnd.get(f.end);
      if (!prev || (f.filed ?? '') > prev.filed) byEnd.set(f.end, { val: f.val, filed: f.filed ?? '' });
    }
    for (const [end, v] of byEnd) if (!out.has(end)) out.set(end, v.val);
  }
  return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** A balance-sheet value at (or within a week before) a given date. */
export function instantAt(facts: CompanyFacts, concepts: string[], date: string, unit = 'USD'): number | null {
  for (const concept of concepts) {
    let best: SecFact | null = null;
    for (const f of series(facts, concept, unit)) {
      if (f.start) continue;
      const gap = days(f.end, date);
      if (gap < 0 || gap > 7) continue;
      if (!best || (f.filed ?? '') > (best.filed ?? '')) best = f;
    }
    if (best) return best.val;
  }
  return null;
}

function latestInstant(facts: CompanyFacts, concept: string, unit: string, taxonomy: string) {
  const all = series(facts, concept, unit, taxonomy).filter((f) => !f.start);
  if (!all.length) return null;
  const end = all.reduce((m, f) => (f.end > m ? f.end : m), all[0]!.end);
  // Several share classes can be reported for the same date; add them up.
  const sameDay = all.filter((f) => f.end === end);
  const filed = sameDay.reduce((m, f) => ((f.filed ?? '') > m ? (f.filed ?? '') : m), '');
  const value = sameDay.filter((f) => (f.filed ?? '') === filed).reduce((s, f) => s + f.val, 0);
  return { value, asOf: end };
}

const toM = (v: number | null) => (v === null ? null : v / M);

export function normaliseCompanyFacts(facts: CompanyFacts, years = 5): SecSurvey {
  const revenue = annualSeries(facts, REVENUE);
  const operating = annualSeries(facts, ['OperatingIncomeLoss']);
  const ends = [...revenue.keys()].filter((end) => operating.has(end)).slice(-years);
  if (ends.length === 0) throw new Error(`No annual revenue and operating income found for ${facts.entityName}`);

  const history: FiscalYear[] = ends.map((end) => ({
    fy: `FY${end.slice(0, 4)}`,
    revenue: revenue.get(end)! / M,
    operatingIncome: operating.get(end)! / M,
  }));
  const end = ends[ends.length - 1]!;
  const pick = (concepts: string[]) => annualSeries(facts, concepts).get(end) ?? null;
  const at = (concepts: string[]) => instantAt(facts, concepts, end);

  const longTermDebt = at(['LongTermDebt']);
  const debtParts =
    longTermDebt ?? (at(['LongTermDebtNoncurrent']) ?? 0) + (at(['LongTermDebtCurrent']) ?? 0);
  const totalDebt = debtParts + (at(['CommercialPaper']) ?? 0) + (at(['ShortTermBorrowings']) ?? 0);

  const sharesFact =
    latestInstant(facts, 'EntityCommonStockSharesOutstanding', 'shares', 'dei') ??
    latestInstant(facts, 'CommonStockSharesOutstanding', 'shares', 'us-gaap');
  const dilutedShares = (() => {
    const s = series(facts, 'WeightedAverageNumberOfDilutedSharesOutstanding', 'shares').filter(
      (f) => f.end === end && f.start && isAnnualForm(f),
    );
    return s.length ? s[s.length - 1]!.val / M : null;
  })();

  return {
    name: facts.entityName,
    cik: facts.cik,
    fiscalYearLabel: `FY${end.slice(0, 4)}`,
    fiscalYearEnd: end,
    history,
    latest: {
      netIncome: toM(pick(['NetIncomeLoss'])),
      pretaxIncome: toM(pick(PRETAX)),
      incomeTax: toM(pick(['IncomeTaxExpenseBenefit'])),
      dAndA: toM(pick(DEPRECIATION)),
      capex: toM(pick(['PaymentsToAcquirePropertyPlantAndEquipment'])),
      cash: (at(['CashAndCashEquivalentsAtCarryingValue']) ?? 0) / M,
      shortTermInvestments: (at(SHORT_TERM_INVESTMENTS) ?? 0) / M,
      longTermInvestments: (at(LONG_TERM_INVESTMENTS) ?? 0) / M,
      totalDebt: totalDebt / M,
      nonOperatingAssets: 0,
      equity: toM(at(['StockholdersEquity'])),
      minorityInterest: (at(['MinorityInterest']) ?? 0) / M,
      dilutedShares,
    },
    sharesOutstanding: sharesFact ? { value: sharesFact.value / M, asOf: sharesFact.asOf } : null,
  };
}

/** Map an SEC standard industrial classification code to an industry profile. */
export function industryForSic(sic: number | null): IndustryKey {
  if (sic === null || !Number.isFinite(sic)) return 'other';
  if (sic === 3674) return 'semiconductors';
  if (sic === 7372) return 'software';
  if (sic >= 7370 && sic <= 7379) return 'internet';
  if (sic === 5961) return 'ecommerce';
  if ((sic >= 3570 && sic <= 3579) || (sic >= 3600 && sic <= 3699)) return 'hardware';
  if (sic === 3711 || sic === 3713 || sic === 3714) return 'autos';
  if (sic === 4841 || sic === 7812 || sic === 7822 || sic === 7841) return 'media';
  if (sic >= 5200 && sic <= 5999) return 'retail';
  if (sic >= 2080 && sic <= 2087) return 'beverages';
  if (sic === 3021 || (sic >= 2300 && sic <= 2399) || (sic >= 3140 && sic <= 3149)) return 'apparel';
  return 'other';
}

/** CIK as the ten-digit, zero-padded string SEC URLs expect. */
export const padCik = (cik: number) => String(cik).padStart(10, '0');

export const SEC_ENDPOINTS = {
  tickers: 'https://www.sec.gov/files/company_tickers.json',
  facts: (cik: number) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`,
  submissions: (cik: number) => `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`,
};
