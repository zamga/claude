import { describe, expect, it } from 'vitest';
import { costOfEquity, dcf, ddm, implied, sensitivity, solve, valueReport, wacc } from './valuation';
import type { Assumptions } from './types';
import { KRKA } from './krka';
import { bindings, tokensIn } from './bindings';

const flat: Assumptions = {
  periods: ['2026E', '2027E'],
  revenueGrowth: [0, 0],
  ebitdaMargin: [0.2, 0.2],
  daPctRevenue: 0.05,
  capexPctRevenue: 0.05,
  nwcPctDeltaRevenue: 0.2,
  taxRate: 0.2,
  riskFree: 0.03,
  equityRiskPremium: 0.05,
  beta: 1,
  countryRisk: 0,
  debtWeight: 0,
  costOfDebt: 0.05,
  terminalGrowth: 0,
  netCash: 100,
  sharesM: 10,
  dpsNext: 1,
  dpsGrowth: 0,
  dpsYears: 3,
  dpsTerminalGrowth: 0,
  epsNext: 1.2,
  peLow: 10,
  peHigh: 14,
};

describe('valuation engine', () => {
  it('builds the cost of capital from its parts', () => {
    expect(costOfEquity(flat)).toBeCloseTo(0.08, 10);
    expect(wacc({ ...flat, debtWeight: 0.25, costOfDebt: 0.04 })).toBeCloseTo(0.75 * 0.08 + 0.25 * 0.04 * 0.8, 10);
  });

  it('values a no-growth business as a perpetuity of its free cash flow', () => {
    // Revenue 1,000: EBITDA 200, D&A 50, EBIT 150, NOPAT 120, capex 50 → FCF 120 a year.
    const r = dcf(flat, 1000);
    expect(r.years.map((y) => y.fcf)).toEqual([120, 120]);
    expect(r.enterpriseValue).toBeCloseTo(120 / 0.08, 6);
    expect(r.perShare).toBeCloseTo((1500 + 100) / 10, 6);
  });

  it('values flat dividends as a perpetuity', () => {
    expect(ddm(flat).perShare).toBeCloseTo(1 / 0.08, 6);
  });

  it('refuses a terminal growth at or above the discount rate', () => {
    expect(() => dcf(flat, 1000, { wacc: 0.03, g: 0.03 })).toThrow(RangeError);
  });

  it('raises value as WACC falls in the sensitivity grid', () => {
    const grid = sensitivity(flat, 1000, [0.09, 0.08, 0.07], [0, 0.01]);
    for (const row of grid) {
      expect(row[0]!).toBeLessThan(row[1]!);
      expect(row[1]!).toBeLessThan(row[2]!);
    }
  });

  it('produces a coherent valuation for the Krka sample', () => {
    const v = valueReport(KRKA);
    expect(v.methods).toHaveLength(3);
    for (const m of v.methods) {
      expect(m.low).toBeLessThan(m.base);
      expect(m.base).toBeLessThan(m.high);
    }
    expect(v.fair.low).toBeLessThan(v.fair.base);
    expect(v.fair.base).toBeLessThan(v.fair.high);
    // A sane band for a company priced near €260 a share.
    expect(v.fair.base).toBeGreaterThan(150);
    expect(v.fair.base).toBeLessThan(400);
    expect(v.dcf.terminalShare).toBeGreaterThan(0.5);
    expect(v.dcf.terminalShare).toBeLessThan(0.9);
  });

  it('cites every footnote it uses', () => {
    const ids = new Set(KRKA.sources.map((s) => s.id));
    const text = [
      KRKA.summary,
      ...KRKA.thesis.map((t) => t.body),
      ...KRKA.sections.flatMap((s) => s.paragraphs),
      ...KRKA.risks.map((r) => r.body),
      ...KRKA.catalysts,
    ].join(' ');
    const used = [...text.matchAll(/\[\^([\w-]+)\]/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(10);
    for (const id of used) expect(ids.has(id), `missing source ${id}`).toBe(true);
    for (const f of KRKA.keyFacts) if (f.sourceId) expect(ids.has(f.sourceId)).toBe(true);
  });
});

describe('what the price implies', () => {
  it('solves a monotonic equation and refuses a target outside the interval', () => {
    expect(solve((x) => x * x, 2, 0, 2)).toBeCloseTo(Math.SQRT2, 8);
    expect(solve((x) => x, 5, 0, 1)).toBeUndefined();
  });

  it('reads the modelled value back as the assumptions that produced it', () => {
    const report = { ...KRKA, assumptions: flat, base: { ...KRKA.base, revenue: 1000 } };
    const price = dcf(flat, 1000).perShare;
    const r = implied(report, price);
    expect(r.margin).toBeCloseTo(0.2, 6);
    expect(r.terminalGrowth).toBeCloseTo(0, 6);
    expect(r.pe).toBeCloseTo(price / 1.2, 10);
  });

  it('prices Krka at a margin and growth that reproduce the share price', () => {
    const price = KRKA.market!.price;
    const r = implied(KRKA, price);
    const a = KRKA.assumptions;
    const atMargin = dcf({ ...a, ebitdaMargin: a.ebitdaMargin.map(() => r.margin!) }, KRKA.base.revenue).perShare;
    const atGrowth = dcf(a, KRKA.base.revenue, { g: r.terminalGrowth! }).perShare;
    expect(atMargin).toBeCloseTo(price, 4);
    expect(atGrowth).toBeCloseTo(price, 4);
    // The price sits above the DCF base case, so it needs more than the modelled margin and growth.
    expect(r.margin!).toBeGreaterThan(Math.max(...a.ebitdaMargin));
    expect(r.terminalGrowth!).toBeGreaterThan(a.terminalGrowth);
    console.info(
      `Krka at €${price}: implied margin ${(r.margin! * 100).toFixed(2)}%, terminal growth ${(r.terminalGrowth! * 100).toFixed(2)}%, P/E ${r.pe.toFixed(1)}, yield ${(r.dividendYield! * 100).toFixed(2)}% / ${(r.forwardYield * 100).toFixed(2)}%`,
    );
  });
});

describe('prose bound to the model', () => {
  it('resolves every token the sample report uses', () => {
    const values = bindings(KRKA);
    const tokens = tokensIn(KRKA);
    expect(tokens.length).toBeGreaterThan(5);
    for (const t of tokens) expect(values[t], t).toBeDefined();
  });

  it('keeps the summary’s claims true to the numbers it quotes', () => {
    const v = valueReport(KRKA);
    const im = implied(KRKA, v.price!);
    // "sit … above the middle of our fair-value range"
    expect(v.premium!).toBeGreaterThan(0);
    // "above 2025’s 27.4%, short of the first half’s 31.9%"
    expect(im.margin!).toBeGreaterThan(558.7 / 2041.0);
    expect(im.margin!).toBeLessThan(357.5 / 1119.3);
  });
});
