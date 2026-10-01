import { moneyM } from '../lib/format';
import type { Assumptions, Basis, Report } from './types';

/*
 * The valuation engine: a free-cash-flow-to-the-firm DCF, a two-stage
 * dividend discount model, an earnings-multiple range and an EV/EBITDA range.
 * Every number a report shows about value is computed here from its
 * assumptions.
 *
 * Conventions: money in millions of the report's currency except per-share
 * figures; cash flows are discounted at the end of each forecast year from the
 * start of the first. A company with traded shares is valued per share; one
 * without is valued as the whole of its equity (the 'equity' basis).
 */

export interface DcfYear {
  period: string;
  revenue: number;
  growth: number;
  ebitda: number;
  margin: number;
  da: number;
  ebit: number;
  nopat: number;
  capex: number;
  nwc: number;
  fcf: number;
  discount: number;
  pv: number;
}

export interface DcfResult {
  years: DcfYear[];
  costOfEquity: number;
  wacc: number;
  terminalGrowth: number;
  terminalValue: number;
  pvTerminal: number;
  pvExplicit: number;
  enterpriseValue: number;
  equityValue: number;
  /** Equity value per share; NaN without a share count. */
  perShare: number;
  /** The value in the report's basis: per share, or the whole equity. */
  value: number;
  terminalShare: number;
}

export function basisOf(a: Assumptions): Basis {
  return a.basis ?? 'share';
}

export function costOfEquity(a: Assumptions): number {
  return a.riskFree + a.beta * a.equityRiskPremium + a.countryRisk;
}

export function wacc(a: Assumptions): number {
  const ke = costOfEquity(a);
  return (1 - a.debtWeight) * ke + a.debtWeight * a.costOfDebt * (1 - a.taxRate);
}

export function dcf(a: Assumptions, baseRevenue: number, override: { wacc?: number; g?: number } = {}): DcfResult {
  const r = override.wacc ?? wacc(a);
  const g = override.g ?? a.terminalGrowth;
  if (r <= g) throw new RangeError(`WACC (${r}) must exceed terminal growth (${g}).`);
  let revenue = baseRevenue;
  const years: DcfYear[] = a.periods.map((period, i) => {
    const growth = a.revenueGrowth[i]!;
    const previous = revenue;
    revenue = previous * (1 + growth);
    const margin = a.ebitdaMargin[i]!;
    const ebitda = revenue * margin;
    const da = revenue * a.daPctRevenue;
    const ebit = ebitda - da;
    const nopat = ebit * (1 - a.taxRate);
    const capex = revenue * a.capexPctRevenue;
    const nwc = (revenue - previous) * a.nwcPctDeltaRevenue;
    const fcf = nopat + da - capex - nwc;
    const discount = 1 / (1 + r) ** (i + 1);
    return { period, revenue, growth, ebitda, margin, da, ebit, nopat, capex, nwc, fcf, discount, pv: fcf * discount };
  });
  const last = years[years.length - 1]!;
  const terminalValue = (last.fcf * (1 + g)) / (r - g);
  const pvTerminal = terminalValue * last.discount;
  const pvExplicit = years.reduce((s, y) => s + y.pv, 0);
  const enterpriseValue = pvExplicit + pvTerminal;
  const equityValue = enterpriseValue + a.netCash;
  const perShare = a.sharesM ? equityValue / a.sharesM : Number.NaN;
  return {
    years,
    costOfEquity: costOfEquity(a),
    wacc: r,
    terminalGrowth: g,
    terminalValue,
    pvTerminal,
    pvExplicit,
    enterpriseValue,
    equityValue,
    perShare,
    value: basisOf(a) === 'share' ? perShare : equityValue,
    terminalShare: pvTerminal / enterpriseValue,
  };
}

/** The dividend inputs, when the assumptions carry a dividend model. */
export function dividendModel(
  a: Assumptions,
): { next: number; growth: number; years: number; terminalGrowth: number } | undefined {
  if (a.dpsNext === undefined || a.dpsNext <= 0) return undefined;
  return {
    next: a.dpsNext,
    growth: a.dpsGrowth ?? 0,
    years: a.dpsYears ?? 5,
    terminalGrowth: a.dpsTerminalGrowth ?? a.terminalGrowth,
  };
}

/** Two-stage dividend discount model: explicit growth, then a perpetuity. */
export function ddm(a: Assumptions, ke = costOfEquity(a)): { perShare: number; dividends: number[] } {
  const m = dividendModel(a);
  if (!m) throw new RangeError('No dividend model in these assumptions.');
  if (ke <= m.terminalGrowth) throw new RangeError('Cost of equity must exceed dividend growth.');
  const dividends: number[] = [];
  let pv = 0;
  let d = m.next;
  for (let t = 1; t <= m.years; t++) {
    if (t > 1) d *= 1 + m.growth;
    dividends.push(d);
    pv += d / (1 + ke) ** t;
  }
  const terminal = (d * (1 + m.terminalGrowth)) / (ke - m.terminalGrowth);
  pv += terminal / (1 + ke) ** m.years;
  return { perShare: pv, dividends };
}

/** DCF value, in the report's basis, for every pair of WACC and terminal growth. */
export function sensitivity(a: Assumptions, baseRevenue: number, waccs: number[], growths: number[]): number[][] {
  return growths.map((g) => waccs.map((w) => (w > g ? dcf(a, baseRevenue, { wacc: w, g }).value : Number.NaN)));
}

export interface MethodRange {
  id: 'dcf' | 'ddm' | 'pe' | 'ev';
  label: string;
  detail: string;
  low: number;
  base: number;
  high: number;
}

export interface Valuation {
  basis: Basis;
  currency: string;
  dcf: DcfResult;
  methods: MethodRange[];
  fair: { low: number; base: number; high: number };
  price?: number;
  /** Price relative to the base-case fair value (positive: price above value). */
  premium?: number;
}

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

/** Everything the report shows about value, from one call. */
export function valueReport(report: Report): Valuation {
  const a = report.assumptions;
  const basis = basisOf(a);
  const currency = report.currency ?? 'EUR';
  if (basis === 'share' && !a.sharesM) throw new RangeError('A per-share valuation needs a share count.');
  const rev = report.base.revenue;
  const base = dcf(a, rev);
  const w = base.wacc;
  const g = a.terminalGrowth;
  // DCF range: WACC ±0.5 pp against terminal growth ∓0.5 pp.
  const methods: MethodRange[] = [
    {
      id: 'dcf',
      label: 'Discounted cash flow',
      detail: `WACC ${pct(w)} ± 0.5 pp, terminal growth ${pct(g)} ∓ 0.5 pp`,
      low: dcf(a, rev, { wacc: w + 0.005, g: g - 0.005 }).value,
      base: base.value,
      high: dcf(a, rev, { wacc: w - 0.005, g: g + 0.005 }).value,
    },
  ];
  const ke = costOfEquity(a);
  const dividends = basis === 'share' ? dividendModel(a) : undefined;
  if (dividends) {
    methods.push({
      id: 'ddm',
      label: 'Dividend discount',
      detail: `Cost of equity ${pct(ke)} ± 0.5 pp; dividends +${pct(dividends.growth, 0)} a year for ${dividends.years} years`,
      low: ddm(a, ke + 0.005).perShare,
      base: ddm(a, ke).perShare,
      high: ddm(a, ke - 0.005).perShare,
    });
  }
  const earnings =
    basis === 'share' && a.epsNext !== undefined && a.epsNext > 0 && a.peLow !== undefined && a.peHigh !== undefined;
  if (earnings) {
    const low = a.epsNext! * a.peLow!;
    const high = a.epsNext! * a.peHigh!;
    methods.push({
      id: 'pe',
      label: 'Earnings multiple',
      detail: `${a.peLow}–${a.peHigh}× ${a.periods[0] ?? ''} earnings per share`,
      low,
      base: (low + high) / 2,
      high,
    });
  }
  // EV/EBITDA values a company without traded shares, or a listed one without earnings to multiply.
  if (a.evEbitdaLow !== undefined && a.evEbitdaHigh !== undefined && !earnings && report.base.ebitda > 0) {
    const ebitda = report.base.ebitda;
    const toValue = (m: number) => {
      const equity = ebitda * m + a.netCash;
      return basis === 'share' ? equity / a.sharesM! : equity;
    };
    methods.push({
      id: 'ev',
      label: 'EV/EBITDA multiple',
      detail: `${a.evEbitdaLow}–${a.evEbitdaHigh}× ${report.base.year.slice(0, 4)} EBITDA of ${moneyM(ebitda, 1, currency)}`,
      low: toValue(a.evEbitdaLow),
      base: toValue((a.evEbitdaLow + a.evEbitdaHigh) / 2),
      high: toValue(a.evEbitdaHigh),
    });
  }
  const mean = (k: 'low' | 'base' | 'high') => methods.reduce((s, m) => s + m[k], 0) / methods.length;
  const fair = { low: mean('low'), base: mean('base'), high: mean('high') };
  const price = basis === 'share' ? report.market?.price : undefined;
  return {
    basis,
    currency,
    dcf: base,
    methods,
    fair,
    price,
    premium: price === undefined ? undefined : price / fair.base - 1,
  };
}

/**
 * Solve f(x) = target on [lo, hi] by bisection. f must be continuous and
 * monotonic on the interval; returns undefined when the target is outside it.
 */
export function solve(
  f: (x: number) => number,
  target: number,
  lo: number,
  hi: number,
  tol = 1e-9,
): number | undefined {
  let flo = f(lo) - target;
  const fhi = f(hi) - target;
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return undefined;
  for (let i = 0; i < 200 && hi - lo > tol; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid) - target;
    if (fm === 0) return mid;
    if (fm * flo < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export interface Implied {
  /** The EBITDA margin, held in every forecast year, at which the DCF equals the price. */
  margin?: number;
  /** The terminal growth at which the DCF equals the price. */
  terminalGrowth?: number;
  /** Price over next year's earnings per share. */
  pe?: number;
  /** Last paid dividend over the price. */
  dividendYield?: number;
  /** Next year's modelled dividend over the price. */
  forwardYield?: number;
}

/** What the market price implies, read back through the same models. */
export function implied(report: Report, price: number): Implied {
  const a = report.assumptions;
  const rev = report.base.revenue;
  const margin = solve((m) => dcf({ ...a, ebitdaMargin: a.ebitdaMargin.map(() => m) }, rev).perShare, price, 0, 0.95);
  const r = wacc(a);
  const terminalGrowth = solve((g) => dcf(a, rev, { g }).perShare, price, -0.1, r - 0.0005);
  const lastDps = report.dividends[report.dividends.length - 1]?.dps;
  return {
    margin,
    terminalGrowth,
    pe: a.epsNext !== undefined && a.epsNext > 0 ? price / a.epsNext : undefined,
    dividendYield: lastDps === undefined ? undefined : lastDps / price,
    forwardYield: a.dpsNext !== undefined ? a.dpsNext / price : undefined,
  };
}

export interface ImpliedMultiples {
  /** The whole equity at the base case, millions. */
  equity: number;
  enterpriseValue: number;
  /** Enterprise value over the last reported year's EBITDA. */
  evEbitda?: number;
  /** Enterprise value over the last reported year's revenue. */
  evSales?: number;
  /** Equity value over the last reported year's net profit. */
  pe?: number;
}

/** The multiples the base case pays for the last reported year: what a buyer at that value would be paying. */
export function impliedMultiples(report: Report, v: Valuation): ImpliedMultiples {
  const a = report.assumptions;
  const equity = v.basis === 'share' ? v.fair.base * (a.sharesM ?? Number.NaN) : v.fair.base;
  const enterpriseValue = equity - a.netCash;
  const { revenue, ebitda, netProfit } = report.base;
  return {
    equity,
    enterpriseValue,
    evEbitda: ebitda > 0 ? enterpriseValue / ebitda : undefined,
    evSales: revenue > 0 ? enterpriseValue / revenue : undefined,
    pe: netProfit > 0 ? equity / netProfit : undefined,
  };
}
