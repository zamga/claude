import { describe, expect, it } from 'vitest';
import { PRIMER_PROPOSAL } from '../fixtures/primer';
import type { History } from './history';
import { buildAssumptions, proposalProblems } from './model';

const point = (value: number, passageId = 'p1', period = 'FY2025') => ({ value, passageId, period });

const history: History = {
  scope: 'group',
  years: ['FY2024', 'FY2025'],
  base: 'FY2025',
  revenue: { FY2024: point(1909.5), FY2025: point(2041) },
  ebitda: { FY2024: point(520), FY2025: point(558.7) },
  derivedEbitda: [],
  ebit: {},
  da: {},
  netProfit: { FY2025: point(403.7) },
  capex: {},
  cash: point(370.6, 'p2', '2025-09-30'),
  balanceDate: '2025-09-30',
  shares: point(30.5, 'p3', '2026-04-02'),
  treasury: point(0.2, 'p3', '2026-04-02'),
  price: point(262.5, 'p4', '2026-09-30'),
  dividends: { FY2024: point(8.25, 'p5', 'FY2024'), FY2025: point(9.1, 'p5', 'FY2025') },
  eps: {},
  riskFree: point(0.027, 'p6', '2026-09-30'),
  notes: [],
};

describe('the modelling stage', () => {
  it('values a listed dividend payer per share, on rates from the evidence', () => {
    const { assumptions: a, basis } = buildAssumptions(
      { ...PRIMER_PROPOSAL, multiple_low: 15, multiple_high: 20, dividend_growth: 0.06 },
      history,
      'share',
    );
    expect(basis).toBe('share');
    expect(a.periods).toEqual(['2026E', '2027E', '2028E', '2029E', '2030E']);
    expect(a.sharesM).toBeCloseTo(30.3, 9);
    expect(a.riskFree).toBe(0.027);
    expect(a.rationale?.riskFree).toMatch(/\[\^p6\]$/);
    expect(a.peLow).toBe(15);
    expect(a.evEbitdaLow).toBeUndefined();
    expect(a.dpsNext).toBeCloseTo(9.1 * 1.06, 4);
    expect(a.netCash).toBeCloseTo(370.6, 6);
    expect(a.debtWeight).toBe(0);
  });

  it('names what is outside the limits', () => {
    const problems = proposalProblems(
      {
        ...PRIMER_PROPOSAL,
        revenue_growth: [0.9, 0.1],
        beta: 4,
        terminal_growth: 0.05,
        multiple_low: 30,
        multiple_high: 20,
      },
      history,
      'equity',
    );
    expect(problems.join(' ')).toMatch(/exactly 5 values/);
    expect(problems.join(' ')).toMatch(/between -0.3 and 0.5/);
    expect(problems.join(' ')).toMatch(/beta must be between/);
    expect(problems.join(' ')).toMatch(/terminal_growth/);
    expect(problems.join(' ')).toMatch(/EV\/EBITDA range/);
  });

  it('keeps the discount rate two points above terminal growth', () => {
    const notes: string[] = [];
    const { assumptions: a } = buildAssumptions(
      {
        ...PRIMER_PROPOSAL,
        risk_free: 0.01,
        equity_risk_premium: 0.03,
        beta: 0.4,
        country_risk: 0,
        terminal_growth: 0.03,
      },
      { ...history, riskFree: undefined },
      'equity',
      notes,
    );
    expect(a.terminalGrowth).toBeCloseTo(0.022 - 0.02, 9);
    expect(notes.join(' ')).toMatch(/Terminal growth was lowered/);
  });
});
