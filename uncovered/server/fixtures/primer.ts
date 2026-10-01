import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, type MessageParams, type ModelClient } from '../engine/claude';
import { MODEL_SYSTEM, WRITE_SYSTEM } from '../engine/prompts';
import type { Proposal } from '../engine/model';
import type { EngineRequest } from '../engine/pipeline';
import type { Prose } from '../engine/write';

/*
 * A scripted stand-in for Claude, for tests and for running the whole
 * product without an API key. It researches "Primer d.o.o.", a fictional
 * company whose one annual report (primer-letno-porocilo-2025.pdf) was made
 * for these tests, and it answers each stage the way the real model is asked
 * to: tool calls with exact quotations, assumptions with reasons, and a report
 * whose first draft cites one figure to the wrong passage, so the checks and
 * the redraft are exercised too.
 */

const PDF_NAME = 'primer-letno-porocilo-2025.pdf';

/** The test report: beside this file in the source tree, or under a project root when bundled. */
export function primerPdf(root?: string): string {
  return root ? join(root, 'server', 'fixtures', PDF_NAME) : fileURLToPath(new URL(`./${PDF_NAME}`, import.meta.url));
}

export async function primerRequest(id = 'primer-test'): Promise<EngineRequest> {
  return {
    id,
    company: 'Primer d.o.o.',
    country: 'Slovenia',
    countryCode: 'SI',
    listing: 'private',
    purpose: 'Credit',
    question: 'Could the company take on more bank debt?',
    uploads: [{ name: PDF_NAME, type: 'application/pdf', bytes: new Uint8Array(await readFile(primerPdf())) }],
  };
}

let counter = 0;
const id = (prefix: string) => `${prefix}_fixture_${++counter}`;

function message(content: Anthropic.ContentBlock[], stop: Anthropic.StopReason): Anthropic.Message {
  return {
    id: id('msg'),
    type: 'message',
    role: 'assistant',
    model: MODEL,
    content,
    stop_reason: stop,
    stop_sequence: null,
    stop_details: null,
    container: null,
    diagnostics: null,
    usage: {
      input_tokens: 4_000,
      output_tokens: 900,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 2_000,
      cache_creation: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: 'standard',
    },
  } as Anthropic.Message;
}

const toolUse = (name: string, input: unknown): Anthropic.ToolUseBlock =>
  ({ type: 'tool_use', id: id('toolu'), name, input, caller: { type: 'direct' } }) as Anthropic.ToolUseBlock;

const text = (t: string): Anthropic.TextBlock => ({ type: 'text', text: t, citations: null }) as Anthropic.TextBlock;

const row = (label: string, a: string, b: string) => `${label} ${a} ${b}`;

const figure = (line: string, period: string, printed: string, quote: string, translation: string, page: number) => ({
  line,
  period,
  as_printed: printed,
  decimal_mark: ',',
  scale: 'units',
  currency: line === 'employees' ? '' : 'EUR',
  scope: 'company',
  document_id: 'u1',
  page,
  quote,
  translation,
});

/** The research turns, in order. */
function researchTurn(turn: number): Anthropic.Message {
  if (turn === 0)
    return message(
      [
        text('I will start with the annual report the requester supplied.'),
        toolUse('read_document', { url: '', document_id: 'u1', pages: '' }),
      ],
      'tool_use',
    );
  if (turn === 1) {
    const revenue = row('Čisti prihodki od prodaje', '48.312.904', '45.407.211');
    const da = row('Amortizacija', '2.104.556', '1.988.012');
    const ebit = row('Poslovni izid iz poslovanja (EBIT)', '5.731.220', '5.102.877');
    const profit = row('Čisti poslovni izid obračunskega obdobja', '4.402.118', '3.951.660');
    return message(
      [
        toolUse('record_document', {
          document_id: 'u1',
          title: 'Letno poročilo 2025',
          publisher: 'Primer d.o.o.',
          published: '2026',
          kind: 'audited_annual_report',
          language: 'sl',
          evidence_quote: '',
          evidence_page: 0,
        }),
        toolUse('record_company', {
          legal_name: 'Primer d.o.o.',
          short_name: 'Primer',
          country: 'Slovenia',
          city: 'Novo mesto',
          sector: 'Industrial components',
          description: 'A fictional maker of industrial components, used to test the engine.',
          founded: '1991',
          registration_number: '',
          website: '',
          listed: false,
          exchange: '',
          ticker: '',
          isin: '',
          reporting_currency: 'EUR',
          fiscal_year_end: '12-31',
          evidence: [
            {
              field: 'founded',
              document_id: 'u1',
              page: 1,
              quote: 'Družba Primer d.o.o. je bila ustanovljena leta 1991 v Novem mestu.',
              translation: 'Primer d.o.o. was founded in 1991 in Novo mesto.',
            },
          ],
        }),
        toolUse('record_figures', {
          figures: [
            figure('revenue', 'FY2025', '48.312.904', revenue, 'Net sales revenue 48,312,904 45,407,211', 2),
            figure('revenue', 'FY2024', '45.407.211', revenue, 'Net sales revenue 48,312,904 45,407,211', 2),
            figure(
              'depreciation_amortisation',
              'FY2025',
              '2.104.556',
              da,
              'Depreciation and amortisation 2,104,556 1,988,012',
              2,
            ),
            figure(
              'depreciation_amortisation',
              'FY2024',
              '1.988.012',
              da,
              'Depreciation and amortisation 2,104,556 1,988,012',
              2,
            ),
            figure('ebit', 'FY2025', '5.731.220', ebit, 'Operating profit (EBIT) 5,731,220 5,102,877', 2),
            figure('ebit', 'FY2024', '5.102.877', ebit, 'Operating profit (EBIT) 5,731,220 5,102,877', 2),
            figure('net_profit', 'FY2025', '4.402.118', profit, 'Net profit for the period 4,402,118 3,951,660', 2),
            figure('net_profit', 'FY2024', '3.951.660', profit, 'Net profit for the period 4,402,118 3,951,660', 2),
            figure(
              'cash',
              '2025-12-31',
              '6.218.400',
              'Denarna sredstva na dan 31. 12. 2025 so znašala 6.218.400 EUR',
              'Cash at 31 December 2025 amounted to EUR 6,218,400',
              2,
            ),
            figure(
              'financial_debt',
              '2025-12-31',
              '3.100.000',
              'finančne obveznosti do bank pa 3.100.000 EUR.',
              'and financial liabilities to banks EUR 3,100,000.',
              2,
            ),
            figure(
              'employees',
              'FY2025',
              '214',
              'V letu 2025 je zaposlovala 214 delavcev.',
              'In 2025 it employed 214 people.',
              1,
            ),
          ],
        }),
        toolUse('record_passages', {
          passages: [
            {
              topic: 'business',
              document_id: 'u1',
              page: 1,
              quote:
                'Čisti prihodki od prodaje so v letu 2025 znašali 48.312.904 EUR in so bili za 6,4 % višji kot v letu 2024.',
              translation: 'Net sales revenue in 2025 amounted to EUR 48,312,904, 6.4% higher than in 2024.',
            },
          ],
        }),
      ],
      'tool_use',
    );
  }
  return message(
    [
      toolUse('finish_research', {
        summary: 'One annual report, supplied by the requester, covers 2024 and 2025.',
        gaps: ['the main customers', 'revenue by market'],
      }),
    ],
    'tool_use',
  );
}

export const PRIMER_PROPOSAL: Proposal = {
  revenue_growth: [0.05, 0.045, 0.04, 0.035, 0.03],
  revenue_growth_reason: 'Close to the last year’s pace, easing towards the economy’s',
  ebitda_margin: [0.16, 0.16, 0.16, 0.16, 0.16],
  ebitda_margin_reason: 'Held at the 2025 level',
  da_pct_revenue: 0.044,
  capex_pct_revenue: 0.05,
  capex_reason: 'A little above depreciation, for a growing business',
  nwc_pct_delta_revenue: 0.15,
  tax_rate: 0.22,
  risk_free: 0.026,
  risk_free_reason: 'Long-dated euro government yield',
  equity_risk_premium: 0.05,
  beta: 1,
  beta_reason: 'An industrial supplier moves with the cycle',
  country_risk: 0.01,
  country_risk_reason: 'For a small open economy',
  debt_weight: 0,
  cost_of_debt: 0.05,
  terminal_growth: 0.02,
  terminal_growth_reason: 'Long-run nominal growth in its markets',
  multiple_low: 5,
  multiple_high: 7,
  multiple_reason: 'A range for small private industrial companies',
  dividend_growth: 0,
};

export function primerProse(round: number): Prose {
  return {
    headline: 'A steady manufacturer with more cash than debt',
    summary:
      'Primer makes industrial components in Novo mesto and employs 214 people[^p8]. Revenue reached €48.3m in 2025[^p2], {{growth.2025A}} more than in 2024, at an EBITDA margin of {{margin.2025A}}. Net profit was €4.4m[^p5], and the year ended with net cash of {{netcash}}. We value the whole equity at {{fair.low}} to {{fair.high}}, with a base case of {{fair.base}}. The main uncertainty is how much of the recent growth repeats.',
    thesis: [
      {
        title: 'Growth from a solid base',
        body: 'Revenue grew from €45.4m in 2024 to €48.3m in 2025[^p2]. The company’s own report puts the rise at 6.4%[^p9].',
      },
      {
        title: 'Margins hold',
        body: 'Operating profit rose to €5.7m in 2025 from €5.1m[^p4], and the EBITDA margin was {{margin.2025A}}.',
      },
      {
        title: 'More cash than debt',
        body: 'Cash of €6.2m[^p6] exceeded bank debt of €3.1m[^p7] at the end of 2025.',
      },
    ],
    business: ['Primer d.o.o. was founded in 1991 in Novo mesto[^p1] and employs 214 people[^p8].'],
    markets: [],
    financials: [
      // The first draft cites the 6.4% rise to the table row, which does not print it; the checks send it back.
      round === 1
        ? 'Revenue rose 6.4% in 2025[^p2]. Net profit rose from €4.0m in 2024 to €4.4m in 2025[^p5].'
        : 'Revenue rose 6.4% in 2025[^p9]. Net profit rose from €4.0m in 2024 to €4.4m in 2025[^p5].',
      'Depreciation and amortisation were €2.1m in 2025[^p3].',
    ],
    ownership: [],
    valuation: [
      'We value Primer as a whole company, because its shares do not trade. The cash-flow model gives {{dcf.base}} for the equity, discounting at {{wacc}} with terminal growth of {{g}}. An EV/EBITDA range of {{ev.low}} to {{ev.high}} cross-checks it, and together they give {{fair.low}} to {{fair.high}}.',
    ],
    question: [
      'On the evidence, yes, within limits. At the end of 2025 Primer held more cash than bank debt, €6.2m against €3.1m[^p6][^p7], and operating profit was €5.7m[^p4]. A lender would still want the latest management accounts before relying on this.',
    ],
    risks: [
      {
        title: 'Customer concentration',
        body: 'The documents read do not name the main customers, so how concentrated sales are cannot be judged.',
        impact: 'medium',
      },
      {
        title: 'Margin pressure',
        body: 'A margin below {{margin.2025A}} would lower every value in this report.',
        impact: 'high',
      },
      {
        title: 'Thin evidence',
        body: 'The valuation rests on one annual report, supplied by the requester.',
        impact: 'medium',
      },
      { title: 'Rates', body: 'A cost of capital above {{wacc}} would reduce the value.', impact: 'low' },
    ],
    catalysts: [
      'The 2026 annual report, which will show whether growth continued.',
      'Any new financing or investment programme.',
    ],
    regions_note: '',
    ownership_note: '',
  };
}

/** A client that answers each stage from the script, optionally pausing like a real model would. */
export function primerClient(delayMs = 0): ModelClient & { calls: MessageParams[] } {
  const calls: MessageParams[] = [];
  let research = 0;
  return {
    calls,
    async send(params, signal) {
      calls.push(params);
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      signal?.throwIfAborted();
      if (params.tools?.length) return { message: researchTurn(research++), parsed: null };
      const rounds = params.messages.filter((m) => m.role === 'assistant').length + 1;
      const parsed =
        params.system === MODEL_SYSTEM ? PRIMER_PROPOSAL : params.system === WRITE_SYSTEM ? primerProse(rounds) : null;
      return { message: message([text(JSON.stringify(parsed))], 'end_turn'), parsed };
    },
  };
}
