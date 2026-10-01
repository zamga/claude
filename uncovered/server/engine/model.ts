import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Assumptions, Basis } from '../../src/report/types';
import { costOfEquity, wacc } from '../../src/report/valuation';
import { MODEL, ModelError, type ModelClient, type Usage } from './claude';
import { netCashOf, type History } from './history';
import type { Identity } from './ledger';
import { MODEL_SYSTEM } from './prompts';

/*
 * The modelling stage. Claude proposes the forecast and cost-of-capital
 * inputs with a reason for each; code holds every input inside limits a
 * reviewer would accept, uses rates from the evidence where the research
 * found them, and assembles the assumptions the valuation engine runs on.
 */

export const YEARS = 5;

const reason = z.string().describe('One short line on why, in plain English.');

export const PROPOSAL = z.object({
  revenue_growth: z.array(z.number()).describe(`Revenue growth for each of the next ${YEARS} years, as decimals.`),
  revenue_growth_reason: reason,
  ebitda_margin: z.array(z.number()).describe(`EBITDA margin for each of the next ${YEARS} years, as decimals.`),
  ebitda_margin_reason: reason,
  da_pct_revenue: z.number().describe('Depreciation and amortisation as a share of revenue.'),
  capex_pct_revenue: z.number().describe('Capital expenditure as a share of revenue.'),
  capex_reason: reason,
  nwc_pct_delta_revenue: z.number().describe('Change in working capital as a share of the change in revenue.'),
  tax_rate: z.number().describe('Effective tax rate on operating profit.'),
  risk_free: z.number().describe('Risk-free rate; use the rate in the evidence if there is one.'),
  risk_free_reason: reason,
  equity_risk_premium: z.number(),
  beta: z.number(),
  beta_reason: reason,
  country_risk: z.number().describe('Country risk premium for where the company earns its money.'),
  country_risk_reason: reason,
  debt_weight: z.number().describe('Debt as a share of capital; 0 for a company with net cash.'),
  cost_of_debt: z.number().describe('Pre-tax cost of debt.'),
  terminal_growth: z.number(),
  terminal_growth_reason: reason,
  multiple_low: z
    .number()
    .describe('Low end of the multiple range: P/E for a listed company with earnings, else EV/EBITDA.'),
  multiple_high: z.number(),
  multiple_reason: reason,
  dividend_growth: z.number().describe('Annual growth of the dividend per share for a dividend payer; 0 otherwise.'),
});

export type Proposal = z.infer<typeof PROPOSAL>;

export interface ModelResult {
  assumptions: Assumptions;
  basis: Basis;
  /** Plain-English lines the report's valuation section can draw on. */
  reasons: Record<string, string>;
  notes: string[];
  proposal: Proposal;
}

const round = (v: number, places = 4) => Math.round(v * 10 ** places) / 10 ** places;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const m = (v: number) => `${v.toFixed(1)}m`;

/** Whether the company is valued per share: listed, with a share count and a price. */
export function basisFor(identity: Identity | undefined, h: History): Basis {
  return identity?.listed && h.shares && h.price ? 'share' : 'equity';
}

/** The facts the modelling desk sees, as text. */
export function modelBrief(identity: Identity | undefined, h: History, gaps: string[]): string {
  const rows = (label: string, s: Record<string, { value: number }>) =>
    `${label}: ${Object.entries(s)
      .map(([p, v]) => `${p} ${m(v.value)}`)
      .join('; ')}`;
  const margin = (y: string) =>
    h.revenue[y] && h.ebitda[y] ? `${y} ${pct(h.ebitda[y]!.value / h.revenue[y]!.value)}` : undefined;
  const growth = h.years
    .slice(1)
    .map((y, i) => {
      const a = h.revenue[y]?.value;
      const b = h.revenue[h.years[i]!]?.value;
      return a && b ? `${y} ${pct(a / b - 1)}` : undefined;
    })
    .filter(Boolean);
  const basis = basisFor(identity, h);
  const lines = [
    `Company: ${identity?.legalName ?? 'unknown'} · ${identity?.sector ?? ''} · ${identity?.country ?? ''}${identity?.listed ? ' · listed' : ' · not listed'}`,
    identity?.description ? `What it does: ${identity.description}` : '',
    `Reporting currency: ${identity?.currency ?? 'EUR'}; figures below in millions. Scope: ${h.scope === 'group' ? 'consolidated group' : 'the company alone'}.`,
    rows('Revenue', h.revenue),
    rows('EBITDA', h.ebitda) +
      (h.derivedEbitda.length ? ' (operating profit plus depreciation where not reported)' : ''),
    `EBITDA margin: ${h.years.map(margin).filter(Boolean).join('; ')}`,
    growth.length ? `Revenue growth: ${growth.join('; ')}` : '',
    Object.keys(h.da).length ? rows('Depreciation and amortisation', h.da) : '',
    Object.keys(h.capex).length ? rows('Capital expenditure', h.capex) : 'Capital expenditure: not found.',
    Object.keys(h.netProfit).length ? rows('Net profit', h.netProfit) : 'Net profit: not found.',
    h.cash
      ? `Balance at ${h.balanceDate}: cash ${m(h.cash.value)}${h.investments ? `, short-term investments ${m(h.investments.value)}` : ''}, financial debt ${h.debt ? m(h.debt.value) : 'not found'}${h.leases ? `, leases ${m(h.leases.value)}` : ''}; net cash ${m(netCashOf(h))}.`
      : 'Balance sheet: cash and debt not found; net cash is taken as zero.',
    h.employees ? `Employees: ${h.employees.value}.` : '',
    basis === 'share'
      ? `Listed: price ${h.price!.value} at ${h.price!.period}; shares ${h.shares!.value.toFixed(3)}m${h.treasury ? `, treasury ${h.treasury.value.toFixed(3)}m` : ''}.`
      : 'No market price: the company is valued as a whole, by cash flow and EV/EBITDA.',
    Object.keys(h.dividends).length
      ? `Dividends per share: ${Object.entries(h.dividends)
          .map(([p, v]) => `${p} ${v.value}`)
          .join('; ')}`
      : '',
    Object.keys(h.eps).length
      ? `Earnings per share: ${Object.entries(h.eps)
          .map(([p, v]) => `${p} ${v.value}`)
          .join('; ')}`
      : '',
    `Rates in the evidence: risk-free ${h.riskFree ? `${pct(h.riskFree.value)} (${h.riskFree.period})` : 'not found'}; equity risk premium ${h.equityRiskPremium ? pct(h.equityRiskPremium.value) : 'not found'}; country risk premium ${h.countryRisk ? pct(h.countryRisk.value) : 'not found'}.`,
    gaps.length ? `Gaps the research reported: ${gaps.join('; ')}` : '',
    `Forecast the ${YEARS} years after ${h.base}. The multiple range is ${basis === 'share' && Object.keys(h.netProfit).length ? 'price to earnings' : 'EV/EBITDA'}.`,
  ];
  return lines.filter(Boolean).join('\n');
}

interface Limit {
  key: keyof Proposal;
  lo: number;
  hi: number;
}

const LIMITS: Limit[] = [
  { key: 'da_pct_revenue', lo: 0, hi: 0.25 },
  { key: 'capex_pct_revenue', lo: 0, hi: 0.35 },
  { key: 'nwc_pct_delta_revenue', lo: -0.5, hi: 1 },
  { key: 'tax_rate', lo: 0, hi: 0.4 },
  { key: 'risk_free', lo: 0, hi: 0.1 },
  { key: 'equity_risk_premium', lo: 0.03, hi: 0.09 },
  { key: 'beta', lo: 0.4, hi: 2.5 },
  { key: 'country_risk', lo: 0, hi: 0.1 },
  { key: 'debt_weight', lo: 0, hi: 0.7 },
  { key: 'cost_of_debt', lo: 0, hi: 0.2 },
  { key: 'terminal_growth', lo: -0.01, hi: 0.03 },
  { key: 'dividend_growth', lo: -0.1, hi: 0.15 },
];

/** What is wrong with a proposal, in sentences the model can act on. */
export function proposalProblems(p: Proposal, h: History, basis: Basis): string[] {
  const problems: string[] = [];
  for (const [key, list] of [
    ['revenue_growth', p.revenue_growth],
    ['ebitda_margin', p.ebitda_margin],
  ] as const)
    if (list.length !== YEARS) problems.push(`${key} needs exactly ${YEARS} values; it has ${list.length}.`);
  if (p.revenue_growth.some((g) => g < -0.3 || g > 0.5))
    problems.push('revenue_growth must stay between -0.3 and 0.5 a year.');
  const shown = h.years
    .map((y) => (h.revenue[y] && h.ebitda[y] ? h.ebitda[y]!.value / h.revenue[y]!.value : NaN))
    .filter(Number.isFinite);
  const best = Math.max(...shown, 0);
  if (p.ebitda_margin.some((x) => x < -0.2 || x > 0.7)) problems.push('ebitda_margin must stay between -0.2 and 0.7.');
  if (p.ebitda_margin.some((x) => x > best + 0.1))
    problems.push(
      `ebitda_margin goes more than ten points above the best reported margin (${pct(best)}); justify less, or stay closer.`,
    );
  for (const l of LIMITS) {
    const v = p[l.key] as number;
    if (!(v >= l.lo && v <= l.hi)) problems.push(`${l.key} must be between ${l.lo} and ${l.hi}; it is ${v}.`);
  }
  if (p.terminal_growth > p.risk_free + 0.01)
    problems.push('terminal_growth should not exceed the risk-free rate by more than one point.');
  const multiple =
    basis === 'share' && Object.keys(h.netProfit).length
      ? { lo: 4, hi: 40, name: 'P/E' }
      : { lo: 2, hi: 25, name: 'EV/EBITDA' };
  if (!(p.multiple_low >= multiple.lo && p.multiple_high <= multiple.hi && p.multiple_low < p.multiple_high))
    problems.push(`The ${multiple.name} range must sit within ${multiple.lo}–${multiple.hi}×, low below high.`);
  return problems;
}

/** Hold a proposal inside the limits, noting each value moved. */
function clamp(p: Proposal, notes: string[]): Proposal {
  const out = { ...p };
  const fit = (list: number[], lo: number, hi: number) => {
    const five = Array.from({ length: YEARS }, (_, i) => list[i] ?? list.at(-1) ?? 0);
    return five.map((v) => Math.min(hi, Math.max(lo, v)));
  };
  out.revenue_growth = fit(p.revenue_growth, -0.3, 0.5);
  out.ebitda_margin = fit(p.ebitda_margin, -0.2, 0.7);
  for (const l of LIMITS) {
    const v = p[l.key] as number;
    const held = Math.min(l.hi, Math.max(l.lo, Number.isFinite(v) ? v : l.lo));
    if (held !== v) notes.push(`The model’s ${String(l.key).replace(/_/g, ' ')} was held at ${held} (its limit).`);
    (out[l.key] as number) = held;
  }
  return out;
}

export async function proposeAssumptions(
  identity: Identity | undefined,
  h: History,
  gaps: string[],
  run: { client: ModelClient; usage: Usage; signal?: AbortSignal },
): Promise<ModelResult> {
  const basis = basisFor(identity, h);
  const notes: string[] = [];
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `${modelBrief(identity, h, gaps)}\n\nPropose the assumptions.` },
  ];
  let proposal: Proposal | undefined;
  for (let round = 0; round < 2; round++) {
    const { message, parsed } = await run.client.send(
      {
        model: MODEL,
        max_tokens: 16_000,
        system: MODEL_SYSTEM,
        messages,
        output_config: { effort: 'high', format: zodOutputFormat(PROPOSAL) },
      },
      run.signal,
    );
    run.usage.add(message.usage);
    if (message.stop_reason === 'refusal') throw new ModelError('The model declined to set assumptions.', 'refusal');
    const checked = PROPOSAL.safeParse(parsed);
    if (!checked.success) throw new ModelError('The assumptions came back in an unusable form.', 'unparseable');
    proposal = checked.data;
    const problems = proposalProblems(proposal, h, basis);
    if (problems.length === 0) break;
    if (round === 1) {
      notes.push(...problems.map((p) => `Held within limits: ${p}`));
      break;
    }
    messages.push({ role: 'assistant', content: message.content });
    messages.push({
      role: 'user',
      content: `Outside the engine’s limits:\n- ${problems.join('\n- ')}\nReturn corrected assumptions.`,
    });
  }
  const p = clamp(proposal!, notes);
  return { ...buildAssumptions(p, h, basis, notes), proposal: p };
}

/** The valuation engine's assumptions from a proposal and the reported history. */
export function buildAssumptions(
  p: Proposal,
  h: History,
  basis: Basis,
  notes: string[] = [],
): Omit<ModelResult, 'proposal'> {
  const first = Number(h.base.slice(2));
  const periods = Array.from({ length: YEARS }, (_, i) => `${first + i + 1}E`);
  // Rates found in the evidence stand; the model's own are the fallback.
  const riskFree = h.riskFree?.value ?? p.risk_free;
  const equityRiskPremium = h.equityRiskPremium?.value ?? p.equity_risk_premium;
  const countryRisk = h.countryRisk?.value ?? p.country_risk;
  const netCash = netCashOf(h);
  const a: Assumptions = {
    basis,
    periods,
    revenueGrowth: p.revenue_growth.map((v) => round(v)),
    ebitdaMargin: p.ebitda_margin.map((v) => round(v)),
    daPctRevenue: round(p.da_pct_revenue),
    capexPctRevenue: round(p.capex_pct_revenue),
    nwcPctDeltaRevenue: round(p.nwc_pct_delta_revenue),
    taxRate: round(p.tax_rate),
    riskFree: round(riskFree),
    equityRiskPremium: round(equityRiskPremium),
    beta: round(p.beta, 2),
    countryRisk: round(countryRisk),
    debtWeight: netCash >= 0 ? 0 : round(p.debt_weight),
    costOfDebt: round(p.cost_of_debt),
    terminalGrowth: round(p.terminal_growth),
    netCash: round(netCash, 6),
    netCashSource: h.cash?.passageId,
    rationale: {
      riskFree: h.riskFree ? `${p.risk_free_reason}[^${h.riskFree.passageId}]` : p.risk_free_reason,
      beta: p.beta_reason,
      countryRisk: h.countryRisk ? `${p.country_risk_reason}[^${h.countryRisk.passageId}]` : p.country_risk_reason,
    },
  };
  if (!h.cash) notes.push('No cash or debt figures were found, so the valuation takes net cash as zero.');

  // Keep the discount rate at least two points above terminal growth.
  const r = wacc(a);
  if (r - a.terminalGrowth < 0.02) {
    const g = round(r - 0.02);
    notes.push(`Terminal growth was lowered to ${pct(g)} to stay two points below the cost of capital.`);
    a.terminalGrowth = g;
  }

  if (basis === 'share') {
    const shares = h.shares!.value - (h.treasury?.value ?? 0);
    a.sharesM = round(shares, 6);
    a.sharesSource = h.shares!.passageId;
    const y1 = h.revenue[h.base]!.value * (1 + a.revenueGrowth[0]!);
    const nopat = y1 * (a.ebitdaMargin[0]! - a.daPctRevenue) * (1 - a.taxRate);
    const eps = nopat / shares;
    if (eps > 0 && Object.keys(h.netProfit).length) {
      a.epsNext = round(eps, 4);
      a.epsBasis = `our ${periods[0]!.slice(0, 4)} operating profit after tax, per share`;
      a.peLow = round(p.multiple_low, 1);
      a.peHigh = round(p.multiple_high, 1);
    } else {
      a.evEbitdaLow = round(p.multiple_low, 1);
      a.evEbitdaHigh = round(p.multiple_high, 1);
      a.evEbitdaBasis = p.multiple_reason;
    }
    const lastDividend = Object.keys(h.dividends).sort().at(-1);
    if (lastDividend) {
      const last = h.dividends[lastDividend]!.value;
      a.dpsGrowth = round(p.dividend_growth);
      a.dpsNext = round(last * (1 + a.dpsGrowth), 4);
      a.dpsYears = YEARS;
      a.dpsTerminalGrowth = a.terminalGrowth;
      if (costOfEquity(a) - a.dpsTerminalGrowth < 0.02) a.dpsTerminalGrowth = round(costOfEquity(a) - 0.02);
    }
  } else {
    a.evEbitdaLow = round(p.multiple_low, 1);
    a.evEbitdaHigh = round(p.multiple_high, 1);
    a.evEbitdaBasis = p.multiple_reason;
  }

  return {
    assumptions: a,
    basis,
    reasons: {
      growth: p.revenue_growth_reason,
      margin: p.ebitda_margin_reason,
      capex: p.capex_reason,
      terminal: p.terminal_growth_reason,
      multiple: p.multiple_reason,
    },
    notes,
  };
}
