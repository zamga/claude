import type { Figure, Ledger, LineKey, Scope } from './ledger';

/*
 * The reported history the model stands on, chosen from the ledger by rule:
 * one scope throughout (the consolidated group when there is one), and where
 * two documents disagree, the filed one, then the more recent one, then the
 * one recorded first. Every choice that is not obvious is noted for the
 * report's disclosures.
 */

export interface Point {
  value: number;
  passageId: string;
  period: string;
}

export interface History {
  scope: Scope;
  /** Fiscal years with revenue, oldest first: FY2023, FY2024, FY2025. */
  years: string[];
  /** The latest year with revenue and EBITDA: the model's base year. */
  base: string;
  revenue: Record<string, Point>;
  ebitda: Record<string, Point>;
  /** Years whose EBITDA is operating profit plus depreciation and amortisation, not a reported line. */
  derivedEbitda: string[];
  ebit: Record<string, Point>;
  da: Record<string, Point>;
  netProfit: Record<string, Point>;
  capex: Record<string, Point>;
  /** The latest interim period after the base year, if any (H1 2026). */
  interim?: string;
  balanceDate?: string;
  cash?: Point;
  investments?: Point;
  debt?: Point;
  leases?: Point;
  equity?: Point;
  shares?: Point;
  treasury?: Point;
  price?: Point;
  high?: Point;
  dividends: Record<string, Point>;
  eps: Record<string, Point>;
  employees?: Point;
  riskFree?: Point;
  equityRiskPremium?: Point;
  countryRisk?: Point;
  notes: string[];
}

export class NotEnoughEvidence extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotEnoughEvidence';
  }
}

const FY = /^FY(\d{4})$/;

/** The calendar date a period ends on, for ordering: FY2025 ends on the fiscal year end. */
export function periodEnd(period: string, fiscalYearEnd = '12-31'): string {
  const fy = FY.exec(period);
  if (fy) return `${fy[1]}-${fiscalYearEnd}`;
  const half = /^H([12]) (\d{4})$/.exec(period);
  if (half) return `${half[2]}-${half[1] === '1' ? '06-30' : '12-31'}`;
  const quarter = /^Q([1-4]) (\d{4})$/.exec(period);
  if (quarter) return `${quarter[2]}-${['03-31', '06-30', '09-30', '12-31'][Number(quarter[1]) - 1]}`;
  const nine = /^9M (\d{4})$/.exec(period);
  if (nine) return `${nine[1]}-09-30`;
  return period;
}

export function buildHistory(ledger: Ledger): History {
  const notes: string[] = [];
  const fye = ledger.identity?.fiscalYearEnd ?? '12-31';
  const group = ledger.figures.some((f) => f.line === 'revenue' && f.scope === 'group');
  const scope: Scope = group ? 'group' : 'company';

  const rank = (f: Figure) => {
    const passage = ledger.passageById(f.passageId)!;
    const doc = ledger.documentOf(passage);
    return { filed: doc.meta?.filed ? 1 : 0, published: doc.meta?.published ?? '', order: f.order };
  };
  /** The figure to use for a line and period, preferring the report's scope. */
  const pick = (line: LineKey, period: string, anyScope = false): Figure | undefined => {
    const all = ledger.figures.filter((f) => f.line === line && f.period === period);
    const own = all.filter((f) => f.scope === scope);
    const pool = own.length ? own : anyScope ? all : [];
    if (pool.length === 0) return undefined;
    const best = [...pool].sort((a, b) => {
      const x = rank(a);
      const y = rank(b);
      return y.filed - x.filed || y.published.localeCompare(x.published) || x.order - y.order;
    })[0]!;
    const differing = pool.filter((f) => Math.abs(f.value - best.value) > Math.max(1e-6, Math.abs(best.value) * 1e-6));
    if (differing.length)
      notes.push(
        `Two sources give different figures for ${line.replace(/_/g, ' ')} in ${period}; the report uses ${best.printed}, from the ${rank(best).filed ? 'filed' : 'more recent'} source.`,
      );
    if (best.scope !== scope)
      notes.push(
        `${line.replace(/_/g, ' ')} for ${period} is the ${best.scope === 'group' ? 'group’s' : 'company’s own'} figure; no ${scope} figure was found.`,
      );
    return best;
  };
  const point = (f: Figure | undefined): Point | undefined =>
    f ? { value: f.value, passageId: f.passageId, period: f.period } : undefined;
  const series = (line: LineKey, periods: string[], anyScope = false) => {
    const out: Record<string, Point> = {};
    for (const p of periods) {
      const v = point(pick(line, p, anyScope));
      if (v) out[p] = v;
    }
    return out;
  };

  const periodsOf = (line: LineKey) => [...new Set(ledger.figures.filter((f) => f.line === line).map((f) => f.period))];
  const years = periodsOf('revenue')
    .filter((p) => FY.test(p))
    .filter((p) => pick('revenue', p))
    .sort()
    .slice(-4);
  if (years.length === 0)
    throw new NotEnoughEvidence(
      'No reported revenue for a full fiscal year was found, so there is nothing to build a model on. Attach the annual report and try again.',
    );

  const revenue = series('revenue', years);
  const ebit = series('ebit', years);
  const da = series('depreciation_amortisation', years);
  const ebitda = series('ebitda', years);
  const derivedEbitda: string[] = [];
  for (const y of years) {
    if (ebitda[y] || !ebit[y] || !da[y]) continue;
    // Depreciation is often printed as a negative; EBITDA adds back its size.
    ebitda[y] = { value: ebit[y]!.value + Math.abs(da[y]!.value), passageId: ebit[y]!.passageId, period: y };
    derivedEbitda.push(y);
  }
  if (derivedEbitda.length)
    notes.push(
      `EBITDA for ${derivedEbitda.map((y) => y.slice(2)).join(' and ')} is operating profit plus depreciation and amortisation, as reported; the company does not report EBITDA itself.`,
    );
  const base = [...years].reverse().find((y) => revenue[y] && ebitda[y]);
  if (!base)
    throw new NotEnoughEvidence(
      'Revenue was found, but neither EBITDA nor operating profit with depreciation for the same year, so cash flows cannot be modelled. Attach the full financial statements and try again.',
    );

  const interim = periodsOf('revenue')
    .filter((p) => !FY.test(p) && periodEnd(p, fye) > periodEnd(base, fye))
    .sort((a, b) => periodEnd(a, fye).localeCompare(periodEnd(b, fye)))
    .at(-1);
  const flowPeriods = interim ? [...years, interim] : years;

  // The balance sheet at the latest date with cash, and debt at that date.
  const balanceDates = periodsOf('cash').sort((a, b) => periodEnd(a, fye).localeCompare(periodEnd(b, fye)));
  const balanceDate = balanceDates.at(-1);
  const at = (line: LineKey) => (balanceDate ? point(pick(line, balanceDate, true)) : undefined);
  const latest = (line: LineKey) => {
    const periods = periodsOf(line).sort((a, b) => periodEnd(a, fye).localeCompare(periodEnd(b, fye)));
    const p = periods.at(-1);
    return p ? point(pick(line, p, true)) : undefined;
  };
  const debt = at('financial_debt');
  if (balanceDate && !debt && periodsOf('financial_debt').length)
    notes.push(
      `Financial debt was not found at ${balanceDate}, the date of the cash figure, so debt from another date was not used.`,
    );

  return {
    scope,
    years,
    base,
    revenue: series('revenue', flowPeriods),
    ebitda: { ...series('ebitda', flowPeriods), ...Object.fromEntries(derivedEbitda.map((y) => [y, ebitda[y]!])) },
    derivedEbitda,
    ebit: series('ebit', flowPeriods),
    da,
    netProfit: series('net_profit', flowPeriods),
    capex: series('capex', years),
    interim: interim && series('revenue', [interim])[interim] ? interim : undefined,
    balanceDate,
    cash: at('cash'),
    investments: at('short_term_investments'),
    debt,
    leases: at('lease_liabilities'),
    equity: at('equity'),
    shares: latest('shares_outstanding'),
    treasury: latest('treasury_shares'),
    price: latest('share_price'),
    high: latest('high_52w'),
    dividends: series(
      'dividend_per_share',
      periodsOf('dividend_per_share')
        .filter((p) => FY.test(p))
        .sort()
        .slice(-4),
      true,
    ),
    eps: series(
      'eps',
      periodsOf('eps')
        .filter((p) => FY.test(p))
        .sort()
        .slice(-4),
      true,
    ),
    employees: latest('employees'),
    riskFree: latest('risk_free_rate'),
    equityRiskPremium: latest('equity_risk_premium'),
    countryRisk: latest('country_risk_premium'),
    notes: [...new Set(notes)],
  };
}

/** Net cash: cash and short-term investments less financial debt and leases, in millions. */
export function netCashOf(h: History): number {
  return (h.cash?.value ?? 0) + (h.investments?.value ?? 0) - (h.debt?.value ?? 0) - (h.leases?.value ?? 0);
}
