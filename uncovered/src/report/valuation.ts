import type { Assumptions, Report } from './types';

/*
 * The valuation engine: a free-cash-flow-to-the-firm DCF, a two-stage
 * dividend discount model and an earnings-multiple range. Every number a
 * report shows about value is computed here from its assumptions.
 *
 * Conventions: values in € millions except per-share figures; cash flows are
 * discounted at the end of each forecast year from the start of the first.
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
  perShare: number;
  terminalShare: number;
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
    perShare: equityValue / a.sharesM,
    terminalShare: pvTerminal / enterpriseValue,
  };
}

/** Two-stage dividend discount model: explicit growth, then a perpetuity. */
export function ddm(a: Assumptions, ke = costOfEquity(a)): { perShare: number; dividends: number[] } {
  if (ke <= a.dpsTerminalGrowth) throw new RangeError('Cost of equity must exceed dividend growth.');
  const dividends: number[] = [];
  let pv = 0;
  let d = a.dpsNext;
  for (let t = 1; t <= a.dpsYears; t++) {
    if (t > 1) d *= 1 + a.dpsGrowth;
    dividends.push(d);
    pv += d / (1 + ke) ** t;
  }
  const terminal = (d * (1 + a.dpsTerminalGrowth)) / (ke - a.dpsTerminalGrowth);
  pv += terminal / (1 + ke) ** a.dpsYears;
  return { perShare: pv, dividends };
}

/** Value per share for every pair of WACC and terminal growth. */
export function sensitivity(a: Assumptions, baseRevenue: number, waccs: number[], growths: number[]): number[][] {
  return growths.map((g) => waccs.map((w) => (w > g ? dcf(a, baseRevenue, { wacc: w, g }).perShare : Number.NaN)));
}

export interface MethodRange {
  id: 'dcf' | 'ddm' | 'pe';
  label: string;
  detail: string;
  low: number;
  base: number;
  high: number;
}

export interface Valuation {
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
  const rev = report.base.revenue;
  const base = dcf(a, rev);
  const w = base.wacc;
  const g = a.terminalGrowth;
  // DCF range: WACC ±0.5 pp against terminal growth ∓0.5 pp.
  const dcfLow = dcf(a, rev, { wacc: w + 0.005, g: g - 0.005 }).perShare;
  const dcfHigh = dcf(a, rev, { wacc: w - 0.005, g: g + 0.005 }).perShare;
  const ke = costOfEquity(a);
  const ddmBase = ddm(a, ke).perShare;
  const ddmLow = ddm(a, ke + 0.005).perShare;
  const ddmHigh = ddm(a, ke - 0.005).perShare;
  const peLow = a.epsNext * a.peLow;
  const peHigh = a.epsNext * a.peHigh;
  const methods: MethodRange[] = [
    {
      id: 'dcf',
      label: 'Discounted cash flow',
      detail: `WACC ${pct(w)} ± 0.5 pp, terminal growth ${pct(g)} ∓ 0.5 pp`,
      low: dcfLow,
      base: base.perShare,
      high: dcfHigh,
    },
    {
      id: 'ddm',
      label: 'Dividend discount',
      detail: `Cost of equity ${pct(ke)} ± 0.5 pp; dividends +${pct(a.dpsGrowth, 0)} a year for ${a.dpsYears} years`,
      low: ddmLow,
      base: ddmBase,
      high: ddmHigh,
    },
    {
      id: 'pe',
      label: 'Earnings multiple',
      detail: `${a.peLow}–${a.peHigh}× ${a.periods[0] ?? ''} earnings per share`,
      low: peLow,
      base: (peLow + peHigh) / 2,
      high: peHigh,
    },
  ];
  const mean = (k: 'low' | 'base' | 'high') => methods.reduce((s, m) => s + m[k], 0) / methods.length;
  const fair = { low: mean('low'), base: mean('base'), high: mean('high') };
  const price = report.market?.price;
  return {
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
  pe: number;
  /** Last paid dividend over the price. */
  dividendYield?: number;
  /** Next year's modelled dividend over the price. */
  forwardYield: number;
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
    pe: price / a.epsNext,
    dividendYield: lastDps === undefined ? undefined : lastDps / price,
    forwardYield: a.dpsNext / price,
  };
}
