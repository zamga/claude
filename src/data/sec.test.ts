import { describe, expect, it } from 'vitest';
import { annualSeries, industryForSic, instantAt, normaliseCompanyFacts, padCik, type CompanyFacts, type SecFact } from './sec';

const fy = (year: number, val: number, filed = `${year + 1}-02-01`, form = '10-K'): SecFact => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
  val,
  fy: year,
  fp: 'FY',
  form,
  filed,
});

// A made-up company in the shape of SEC's companyfacts response.
const fixture: CompanyFacts = {
  cik: 1234567,
  entityName: 'Example Holdings Inc.',
  facts: {
    dei: {
      EntityCommonStockSharesOutstanding: {
        units: {
          shares: [
            { end: '2026-01-20', val: 800_000_000, form: '10-K', filed: '2026-02-01' },
            { end: '2026-01-20', val: 200_000_000, form: '10-K', filed: '2026-02-01' },
            { end: '2025-07-20', val: 990_000_000, form: '10-Q', filed: '2025-08-01' },
          ],
        },
      },
    },
    'us-gaap': {
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            fy(2021, 10_000e6),
            fy(2022, 11_000e6),
            fy(2023, 12_100e6),
            fy(2024, 13_000e6, '2025-02-01'),
            // Restated in the next annual report: the later filing wins.
            fy(2024, 13_310e6, '2026-02-01'),
            fy(2025, 14_641e6),
            // A quarter must be ignored.
            { start: '2025-07-01', end: '2025-09-30', val: 3_700e6, fp: 'Q3', form: '10-Q', filed: '2025-11-01' },
          ],
        },
      },
      SalesRevenueNet: { units: { USD: [fy(2020, 9_000e6), fy(2021, 9_999e6)] } },
      OperatingIncomeLoss: {
        units: { USD: [fy(2020, 900e6), fy(2021, 1_000e6), fy(2022, 1_200e6), fy(2023, 1_500e6), fy(2024, 1_900e6), fy(2025, 2_400e6)] },
      },
      NetIncomeLoss: { units: { USD: [fy(2025, 1_700e6)] } },
      IncomeTaxExpenseBenefit: { units: { USD: [fy(2025, 450e6)] } },
      IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest: {
        units: { USD: [fy(2025, 2_150e6)] },
      },
      CashAndCashEquivalentsAtCarryingValue: {
        units: { USD: [{ end: '2025-12-31', val: 3_000e6, form: '10-K', filed: '2026-02-01' }] },
      },
      ShortTermInvestments: { units: { USD: [{ end: '2025-12-31', val: 500e6, form: '10-K', filed: '2026-02-01' }] } },
      LongTermDebt: { units: { USD: [{ end: '2025-12-31', val: 4_000e6, form: '10-K', filed: '2026-02-01' }] } },
      CommercialPaper: { units: { USD: [{ end: '2025-12-31', val: 250e6, form: '10-K', filed: '2026-02-01' }] } },
      StockholdersEquity: { units: { USD: [{ end: '2025-12-31', val: 9_000e6, form: '10-K', filed: '2026-02-01' }] } },
      WeightedAverageNumberOfDilutedSharesOutstanding: {
        units: { shares: [{ ...fy(2025, 1_010_000_000) }] },
      },
    },
  },
};

describe('SEC companyfacts normaliser', () => {
  it('keeps full years from annual reports, latest filing first', () => {
    const rev = annualSeries(fixture, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']);
    expect(rev.get('2024-12-31')).toBe(13_310e6);
    expect(rev.has('2025-09-30')).toBe(false);
    // The second concept only fills years the first one lacks.
    expect(rev.get('2021-12-31')).toBe(10_000e6);
    expect(rev.get('2020-12-31')).toBe(9_000e6);
  });

  it('reads balance-sheet values at the fiscal year end', () => {
    expect(instantAt(fixture, ['CashAndCashEquivalentsAtCarryingValue'], '2025-12-31')).toBe(3_000e6);
    expect(instantAt(fixture, ['CashAndCashEquivalentsAtCarryingValue'], '2024-12-31')).toBeNull();
  });

  it('builds a five-year survey in USD millions', () => {
    const s = normaliseCompanyFacts(fixture);
    expect(s.fiscalYearLabel).toBe('FY2025');
    expect(s.history.map((h) => h.fy)).toEqual(['FY2021', 'FY2022', 'FY2023', 'FY2024', 'FY2025']);
    expect(s.history[3]).toEqual({ fy: 'FY2024', revenue: 13_310, operatingIncome: 1_900 });
    expect(s.latest.cash).toBe(3_000);
    expect(s.latest.shortTermInvestments).toBe(500);
    expect(s.latest.totalDebt).toBe(4_250);
    expect(s.latest.equity).toBe(9_000);
    expect(s.latest.incomeTax).toBe(450);
    expect(s.latest.pretaxIncome).toBe(2_150);
    expect(s.latest.dilutedShares).toBe(1_010);
  });

  it('adds share classes reported on the same cover date', () => {
    const s = normaliseCompanyFacts(fixture);
    expect(s.sharesOutstanding).toEqual({ value: 1_000, asOf: '2026-01-20' });
  });

  it('fails loudly without annual figures', () => {
    expect(() => normaliseCompanyFacts({ ...fixture, facts: { 'us-gaap': {} } })).toThrow(/No annual revenue/);
  });

  it('maps industry codes and pads CIKs', () => {
    expect(industryForSic(3674)).toBe('semiconductors');
    expect(industryForSic(7372)).toBe('software');
    expect(industryForSic(2086)).toBe('beverages');
    expect(industryForSic(5331)).toBe('retail');
    expect(industryForSic(1311)).toBe('other');
    expect(padCik(320193)).toBe('0000320193');
  });
});
