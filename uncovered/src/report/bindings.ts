import { eur, num, pct } from '../lib/format';
import type { Report } from './types';
import { costOfEquity, dcf, implied, valueReport, type Valuation } from './valuation';

/*
 * Model outputs that prose can quote. A report's text writes "{{implied.margin}}"
 * instead of a number, and the reader fills it from the valuation engine, so
 * the words can never drift from the model they describe.
 */

export const TOKEN = /\{\{([\w.-]+)\}\}/g;

export function bindings(report: Report, v: Valuation = valueReport(report)): Record<string, string> {
  const a = report.assumptions;
  const out: Record<string, string> = {
    'fair.low': eur(v.fair.low, 0),
    'fair.base': eur(v.fair.base, 0),
    'fair.high': eur(v.fair.high, 0),
    'dcf.base': eur(v.dcf.perShare, 0),
    wacc: pct(v.dcf.wacc),
    ke: pct(costOfEquity(a)),
    rf: pct(a.riskFree),
    erp: pct(a.equityRiskPremium, 0),
    beta: num(a.beta, 1),
    crp: pct(a.countryRisk, 0),
    g: pct(a.terminalGrowth),
    'dps.next': eur(a.dpsNext),
    'dps.growth': pct(a.dpsGrowth, 0),
    'pe.low': `${num(a.peLow, 0)}×`,
    'pe.high': `${num(a.peHigh, 0)}×`,
  };
  const years = dcf(a, report.base.revenue).years;
  for (const y of years) {
    out[`margin.${y.period}`] = pct(y.margin);
    out[`growth.${y.period}`] = pct(y.growth);
    out[`revenue.${y.period}`] = `€${num(y.revenue, 0)}m`;
  }
  if (v.price !== undefined && v.premium !== undefined) {
    out.premium = pct(Math.abs(v.premium));
    const im = implied(report, v.price);
    if (im.margin !== undefined) out['implied.margin'] = pct(im.margin);
    if (im.terminalGrowth !== undefined) out['implied.growth'] = pct(im.terminalGrowth, 2);
    out['implied.pe'] = `${num(im.pe, 1)}×`;
    out['implied.yield'] = pct(im.forwardYield);
  }
  return out;
}

/** Every token a report's prose uses, for checking that each one resolves. */
export function tokensIn(report: Report): string[] {
  const texts = [
    report.summary,
    ...report.thesis.map((t) => t.body),
    ...report.sections.flatMap((s) => s.paragraphs),
    ...report.catalysts,
    ...report.risks.map((r) => r.body),
  ];
  const keys = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(TOKEN)) keys.add(m[1]!);
  return [...keys];
}
