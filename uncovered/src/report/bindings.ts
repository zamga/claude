import { moneyFor, num, pct } from '../lib/format';
import type { Report } from './types';
import { costOfEquity, dcf, dividendModel, implied, impliedMultiples, valueReport, type Valuation } from './valuation';

/*
 * Model outputs that prose can quote. A report's text writes "{{implied.margin}}"
 * instead of a number, and the reader fills it from the valuation engine, so
 * the words can never drift from the model they describe. Ratios computed from
 * reported lines (growth, margins) are bound the same way: arithmetic is code.
 */

export const TOKEN = /\{\{([\w.-]+)\}\}/g;

const ANNUAL = /^\d{4}A$/;

const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;
const multiple = (v: number) => `${num(v, whole(v) ? 0 : 1)}×`;
/** A percentage without decimals when it is a whole number of percent: "5%", "5.5%". */
const pctAuto = (v: number) => pct(v, whole(v * 100) ? 0 : 1);

export function bindings(report: Report, v: Valuation = valueReport(report)): Record<string, string> {
  const a = report.assumptions;
  const m = moneyFor(v.currency, v.basis);
  const out: Record<string, string> = {
    'fair.low': m.value(v.fair.low, 0),
    'fair.base': m.value(v.fair.base, 0),
    'fair.high': m.value(v.fair.high, 0),
    'dcf.base': m.value(v.dcf.value, 0),
    wacc: pct(v.dcf.wacc),
    ke: pct(costOfEquity(a)),
    rf: pct(a.riskFree),
    erp: pctAuto(a.equityRiskPremium),
    beta: num(a.beta, 1),
    crp: pctAuto(a.countryRisk),
    g: pct(a.terminalGrowth),
    netcash: m.millions(a.netCash),
  };
  const dividends = dividendModel(a);
  if (dividends) {
    out['dps.next'] = m.amount(dividends.next);
    out['dps.growth'] = pct(dividends.growth, 0);
  }
  if (a.peLow !== undefined && a.peHigh !== undefined) {
    out['pe.low'] = multiple(a.peLow);
    out['pe.high'] = multiple(a.peHigh);
  }
  if (a.evEbitdaLow !== undefined && a.evEbitdaHigh !== undefined) {
    out['ev.low'] = multiple(a.evEbitdaLow);
    out['ev.high'] = multiple(a.evEbitdaHigh);
  }

  // Forecast years, from the model.
  for (const y of dcf(a, report.base.revenue).years) {
    out[`margin.${y.period}`] = pct(y.margin);
    out[`growth.${y.period}`] = pct(y.growth);
    out[`revenue.${y.period}`] = m.millions(y.revenue, 0);
  }

  // Reported years: ratios of reported lines, computed rather than retyped.
  const line = (label: string) => report.income.find((l) => l.label === label)?.values ?? {};
  const revenue = line('Revenue');
  const ebitda = line('EBITDA');
  const profit = line('Net profit');
  const annual = Object.keys(revenue)
    .filter((p) => ANNUAL.test(p))
    .sort();
  annual.forEach((p, i) => {
    const r = revenue[p];
    if (r === undefined || r <= 0) return;
    const prev = annual[i - 1];
    const before = prev === undefined ? undefined : revenue[prev];
    if (before !== undefined && before > 0) out[`growth.${p}`] = pct(r / before - 1);
    if (ebitda[p] !== undefined) out[`margin.${p}`] = pct(ebitda[p]! / r);
    if (profit[p] !== undefined) out[`netmargin.${p}`] = pct(profit[p]! / r);
  });

  // What the base case pays for the last reported year.
  const paid = impliedMultiples(report, v);
  out['equity.base'] = m.millions(paid.equity, 0);
  out['ev.base'] = m.millions(paid.enterpriseValue, 0);
  if (paid.evEbitda !== undefined) out['base.evebitda'] = `${num(paid.evEbitda, 1)}×`;
  if (paid.evSales !== undefined) out['base.evsales'] = `${num(paid.evSales, 1)}×`;
  if (paid.pe !== undefined) out['base.pe'] = `${num(paid.pe, 1)}×`;

  // What the market price implies, for a company with one.
  if (v.price !== undefined && v.premium !== undefined) {
    out.premium = pct(Math.abs(v.premium));
    const im = implied(report, v.price);
    if (im.margin !== undefined) out['implied.margin'] = pct(im.margin);
    if (im.terminalGrowth !== undefined) out['implied.growth'] = pct(im.terminalGrowth, 2);
    if (im.pe !== undefined) out['implied.pe'] = `${num(im.pe, 1)}×`;
    if (im.forwardYield !== undefined) out['implied.yield'] = pct(im.forwardYield);
  }
  return out;
}

/** Every passage of prose in a report, for checks that run over all of it. */
export function proseOf(report: Report): string[] {
  return [
    report.headline,
    report.summary,
    ...report.thesis.flatMap((t) => [t.title, t.body]),
    ...report.sections.flatMap((s) => s.paragraphs),
    ...report.catalysts,
    ...report.risks.flatMap((r) => [r.title, r.body]),
    report.assumptions.epsBasis ?? '',
    report.assumptions.evEbitdaBasis ?? '',
  ];
}

/** Every token a report's prose uses, for checking that each one resolves. */
export function tokensIn(report: Report): string[] {
  const keys = new Set<string>();
  for (const t of proseOf(report)) for (const m of t.matchAll(TOKEN)) keys.add(m[1]!);
  return [...keys];
}
