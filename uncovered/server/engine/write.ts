import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { bindings } from '../../src/report/bindings';
import type { Report } from '../../src/report/types';
import { valueReport } from '../../src/report/valuation';
import { assemble, type AssemblyInput } from './assemble';
import { MODEL, ModelError, type ModelClient, type Usage } from './claude';
import { curable, describeProblems, gate, withhold, type Problem } from './gate';
import { LINES } from './ledger';
import { WRITE_SYSTEM } from './prompts';

/*
 * The writing stage. Claude writes from a dossier: the passages it may cite,
 * the reported figures with their notes, and the model's figures as tokens.
 * The gate checks every sentence; what fails goes back with the reasons, up
 * to twice. A sentence whose figure still cannot be traced is withheld, and
 * the report says so, rather than published.
 */

export const PROSE = z.object({
  headline: z.string(),
  summary: z.string(),
  thesis: z.array(z.object({ title: z.string(), body: z.string() })),
  business: z.array(z.string()),
  markets: z.array(z.string()),
  financials: z.array(z.string()),
  ownership: z.array(z.string()),
  valuation: z.array(z.string()),
  question: z.array(z.string()),
  risks: z.array(z.object({ title: z.string(), body: z.string(), impact: z.enum(['high', 'medium', 'low']) })),
  catalysts: z.array(z.string()),
  regions_note: z.string(),
  ownership_note: z.string(),
});

export type Prose = z.infer<typeof PROSE>;

export const EMPTY_PROSE: Prose = {
  headline: '',
  summary: '',
  thesis: [],
  business: [],
  markets: [],
  financials: [],
  ownership: [],
  valuation: [],
  question: [],
  risks: [],
  catalysts: [],
  regions_note: '',
  ownership_note: '',
};

export class GateError extends Error {
  constructor(readonly problems: Problem[]) {
    super(`The report did not pass its checks: ${problems.map((p) => `${p.where}: ${p.problem}`).join('; ')}`);
    this.name = 'GateError';
  }
}

/** What each model token means, so the writer uses the right one. */
export function tokenMeaning(key: string, report: Report): string {
  const per = report.assumptions.basis === 'equity' ? 'for the whole equity' : 'per share';
  const fixed: Record<string, string> = {
    'fair.low': `low end of our fair value range, ${per}`,
    'fair.base': `middle of our fair value range (the base case), ${per}`,
    'fair.high': `high end of our fair value range, ${per}`,
    'dcf.base': `discounted-cash-flow value in the base case, ${per}`,
    wacc: 'cost of capital used to discount cash flows',
    ke: 'cost of equity',
    rf: 'risk-free rate',
    erp: 'equity risk premium',
    beta: 'beta',
    crp: 'country risk premium',
    g: 'terminal growth rate',
    netcash: 'net cash used in the valuation (negative means net debt)',
    'dps.next': 'our dividend per share for next year',
    'dps.growth': 'our annual dividend growth',
    'pe.low': 'low end of our P/E range',
    'pe.high': 'high end of our P/E range',
    'ev.low': 'low end of our EV/EBITDA range',
    'ev.high': 'high end of our EV/EBITDA range',
    'equity.base': 'equity value of the whole company at the base case',
    'ev.base': 'enterprise value at the base case',
    'base.evebitda': 'EV/EBITDA the base case pays on the last reported year',
    'base.evsales': 'EV/sales the base case pays on the last reported year',
    'base.pe': 'equity value over last year’s net profit at the base case',
    premium: 'size of the gap between the share price and our base case',
    'implied.margin': 'EBITDA margin the share price implies in every forecast year',
    'implied.growth': 'terminal growth the share price implies',
    'implied.pe': 'share price over our next-year earnings per share',
    'implied.yield': 'our next-year dividend over the share price',
  };
  if (fixed[key]) return fixed[key];
  const m = /^(margin|growth|revenue|netmargin)\.(.+)$/.exec(key);
  if (m) {
    const period = m[2]!;
    const forecast = period.endsWith('E');
    const what =
      m[1] === 'margin'
        ? 'EBITDA margin'
        : m[1] === 'growth'
          ? 'revenue growth'
          : m[1] === 'netmargin'
            ? 'net margin'
            : 'revenue';
    return forecast
      ? `our forecast ${what} for ${period.slice(0, 4)}`
      : `${what} in ${period.slice(0, 4)}, computed from the reported figures`;
  }
  return key;
}

/** The dossier the writer works from. */
export function dossier(draft: Report, input: Omit<AssemblyInput, 'prose'>, values: Record<string, string>): string {
  const { ledger, history: h, model } = input;
  const v = valueReport(draft);
  const c = draft.company;
  const passages = ledger.passages.map((p) => {
    const doc = ledger.documentOf(p);
    const meta = doc.meta;
    return `[^${p.id}] ${meta?.title ?? doc.title} (${meta?.publisher || doc.url || 'supplied document'}${meta?.published ? `, ${meta.published}` : ''}; ${ledger.gradeOf(p)})${p.page ? `, page ${p.page}` : ''}${p.topic ? ` [${p.topic}]` : ''}: "${p.quote}"${p.translation ? ` — in English: "${p.translation}"` : ''}`;
  });
  const figures = ledger.figures
    .filter((f) => !['risk_free_rate', 'equity_risk_premium', 'country_risk_premium'].includes(f.line))
    .map(
      (f) =>
        `${LINES[f.line].label}, ${f.period}${f.scope === 'company' ? ' (company alone)' : ''}: printed as ${f.printed} [^${f.passageId}]`,
    );
  const tokens = Object.entries(values).map(([k, val]) => `{{${k}}} = ${val} — ${tokenMeaning(k, draft)}`);
  const price =
    v.price !== undefined && v.premium !== undefined
      ? `The share price is ${v.premium >= 0 ? 'above' : 'below'} our base case; {{premium}} is the size of that gap.`
      : 'There is no market price: the valuation is of the whole equity, and the report says what a buyer at the base case would pay.';
  return [
    `COMPANY\n${c.legalName} (${c.shortName}), ${c.sector}, ${c.country}${c.city ? `, seat ${c.city}` : ''}. ${c.listed ? `Listed: ${c.exchange ?? ''} ${c.ticker ?? ''}.` : 'Not listed.'}${input.identity?.description ? ` ${input.identity.description}` : ''}`,
    `REQUEST\nPurpose: ${input.request.question ? 'the requester asked a question, answered in the question section' : 'no question asked; leave the question section empty'}.${input.request.question ? `\nQuestion: "${input.request.question}"` : ''}`,
    `PASSAGES (cite with the note shown; quote nothing else)\n${passages.join('\n')}`,
    `REPORTED FIGURES (write as text, rounded if you like, with the note in the same sentence)\n${figures.join('\n')}`,
    `MODEL FIGURES (write only as these tokens, never as numbers)\n${tokens.join('\n')}`,
    `VALUATION\n${v.methods.map((m) => `${m.label}: ${m.detail}`).join('\n')}\n${price}\nReasons for the assumptions: growth: ${model.reasons.growth}; margins: ${model.reasons.margin}; investment: ${model.reasons.capex}; terminal growth: ${model.reasons.terminal}; multiples: ${model.reasons.multiple}.`,
    `REPORTED HISTORY\nBase year ${h.base}; scope: ${h.scope === 'group' ? 'consolidated group' : 'the company alone'}.${h.derivedEbitda.length ? ` EBITDA for ${h.derivedEbitda.join(', ')} is operating profit plus depreciation (not reported as such).` : ''}`,
    input.gaps.length ? `GAPS\n${input.gaps.join('\n')}` : '',
    'Write the report.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export interface WriteResult {
  report: Report;
  rounds: number;
  withheld: number;
}

export async function write(
  input: Omit<AssemblyInput, 'prose'>,
  run: { client: ModelClient; usage: Usage; signal?: AbortSignal; activity?: (text: string) => void },
): Promise<WriteResult> {
  const draft = assemble({ ...input, prose: EMPTY_PROSE });
  const values = bindings(draft);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: dossier(draft, input, values) }];
  let report: Report | undefined;
  let problems: Problem[] = [];
  for (let round = 1; round <= 3; round++) {
    const { message, parsed } = await run.client.send(
      {
        model: MODEL,
        max_tokens: 32_000,
        system: WRITE_SYSTEM,
        messages,
        output_config: { effort: 'high', format: zodOutputFormat(PROSE) },
      },
      run.signal,
    );
    run.usage.add(message.usage);
    if (message.stop_reason === 'refusal') throw new ModelError('The model declined to write this report.', 'refusal');
    if (message.stop_reason === 'max_tokens')
      throw new ModelError('The report ran past its length limit.', 'truncated');
    const checked = PROSE.safeParse(parsed);
    if (!checked.success) throw new ModelError('The report came back in an unusable form.', 'unparseable');
    report = assemble({ ...input, prose: checked.data });
    problems = gate(report, bindings(report));
    run.activity?.(
      problems.length
        ? `Checked the draft: ${problems.length} problem${problems.length === 1 ? '' : 's'} sent back`
        : 'Checked the draft: every figure traced',
    );
    if (problems.length === 0) return { report, rounds: round, withheld: 0 };
    if (round === 3) break;
    messages.push({ role: 'assistant', content: message.content });
    messages.push({
      role: 'user',
      content: `The checks found these problems:\n${describeProblems(problems)}\n\nReturn the complete report again with them fixed.`,
    });
  }
  if (!report || !curable(problems)) throw new GateError(problems);
  const withheld = withhold(report, problems);
  const left = gate(report, bindings(report));
  if (left.length) throw new GateError(left);
  report.disclosures = [
    ...(report.disclosures ?? []),
    `${withheld} sentence${withheld === 1 ? ' was' : 's were'} withheld from this report because a figure in ${withheld === 1 ? 'it' : 'them'} could not be traced to a cited passage.`,
  ];
  return { report, rounds: 3, withheld };
}
