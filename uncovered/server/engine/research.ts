import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, ModelError, type ModelClient, type Usage } from './claude';
import { RESEARCH_SYSTEM } from './prompts';
import { researchTools, runTool, SEARCH_LIMIT, searchResultUrls, type ToolContext } from './tools';

/*
 * The research stage: Claude searches, reads and records evidence through the
 * tools until it calls finish_research or the turn budget runs out. The loop
 * is written out rather than left to the SDK's tool runner because it does
 * work between turns: it collects the addresses search returned (the only
 * new addresses Claude may then read), resumes paused server-side turns, and
 * keeps the budget.
 */

export const MAX_TURNS = 48;
export const DOCUMENT_BUDGET = 16;

const SYSTEM = RESEARCH_SYSTEM.replace('{{searches}}', String(SEARCH_LIMIT)).replace(
  '{{documents}}',
  String(DOCUMENT_BUDGET),
);

export interface Brief {
  company: string;
  country: string;
  countryCode: string;
  listing: 'listed' | 'private' | 'unsure';
  ticker?: string;
  registration?: string;
  website?: string;
  purpose: string;
  question?: string;
  today: string;
  supplied: { id: string; title: string; pages: number; paged: boolean }[];
}

export function briefText(b: Brief): string {
  const lines = [
    `Initiate coverage on: ${b.company}`,
    `Country: ${b.country}.`,
    b.listing === 'listed'
      ? `The requester says its shares are listed${b.ticker ? `, ticker ${b.ticker}` : ''}.`
      : b.listing === 'private'
        ? 'The requester says it is a private company.'
        : 'The requester does not know whether its shares are listed.',
    b.registration ? `Registration number given by the requester: ${b.registration}.` : '',
    b.website ? `Website given by the requester: ${b.website}` : '',
    `Purpose of the report: ${b.purpose}.`,
    b.question ? `The requester's question, which the report will answer: "${b.question}"` : '',
    `Today is ${b.today}.`,
    b.supplied.length
      ? `Documents the requester supplied, already read (show them with read_document and their id):\n${b.supplied
          .map(
            (d) =>
              `- ${d.id}: "${d.title}" (${d.paged ? `PDF, ${d.pages} pages` : `${d.pages} part${d.pages === 1 ? '' : 's'}`})`,
          )
          .join('\n')}`
      : 'The requester supplied no documents.',
    'Begin with the company’s identity, then its financial statements.',
  ];
  return lines.filter(Boolean).join('\n');
}

export interface ResearchRun {
  client: ModelClient;
  usage: Usage;
  signal?: AbortSignal;
  /** The context the tools run in. */
  tools: ToolContext;
  /** Evidence counts after each turn. */
  progress?: () => void;
}

export interface ResearchResult {
  finished: boolean;
  turns: number;
  summary?: string;
  gaps: string[];
}

export async function research(brief: Brief, run: ResearchRun): Promise<ResearchResult> {
  const ctx = run.tools;
  if (brief.website) ctx.leads.add(brief.website);
  const tools = researchTools(brief.countryCode);
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: briefText(brief) }];
  let nudges = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    run.signal?.throwIfAborted();
    const { message } = await run.client.send(
      {
        model: MODEL,
        max_tokens: 32_000,
        system,
        messages,
        tools,
        output_config: { effort: 'high' },
        // Cache the conversation so far: each turn re-reads it from the cache.
        cache_control: { type: 'ephemeral' },
      },
      run.signal,
    );
    run.usage.add(message.usage);
    for (const found of searchResultUrls(message.content)) {
      found.urls.forEach((u) => ctx.leads.add(u));
      if (found.query) ctx.activity(`Searched “${found.query}”`);
    }

    switch (message.stop_reason) {
      case 'refusal':
        throw new ModelError(
          message.stop_details?.explanation ?? 'The model declined to research this company.',
          'refusal',
        );
      case 'model_context_window_exceeded':
        return { finished: false, turns: turn, gaps: ['The research ran out of room before it finished.'] };
      case 'max_tokens':
        throw new ModelError('A research turn ran past its length limit.', 'truncated');
      case 'pause_turn':
        // A long server-side search turn paused; send it back unchanged to resume.
        messages.push({ role: 'assistant', content: message.content });
        continue;
      case 'tool_use': {
        messages.push({ role: 'assistant', content: message.content });
        const uses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        const results = await Promise.all(uses.map((u) => runTool(ctx, u.name, u.input)));
        const content: Anthropic.ContentBlockParam[] = uses.map((u, i) => ({
          type: 'tool_result',
          tool_use_id: u.id,
          content: results[i]!.content,
          ...(results[i]!.error ? { is_error: true } : {}),
        }));
        run.progress?.();
        if (ctx.finished)
          return { finished: true, turns: turn, summary: ctx.finished.summary, gaps: ctx.finished.gaps };
        const left = MAX_TURNS - turn;
        if (left === 6 || left === 2)
          content.push({
            type: 'text',
            text: `Budget: ${left} turns left. Record what you have and call finish_research.`,
          });
        if (ctx.store.list().length >= DOCUMENT_BUDGET + 4)
          content.push({
            type: 'text',
            text: 'You have read more documents than the budget allows. Record what you have and finish.',
          });
        messages.push({ role: 'user', content });
        continue;
      }
      default: {
        // end_turn (or a stop sequence) without finishing: ask once or twice to carry on.
        messages.push({ role: 'assistant', content: message.content });
        if (ctx.finished)
          return { finished: true, turns: turn, summary: ctx.finished.summary, gaps: ctx.finished.gaps };
        if (++nudges > 2) return { finished: false, turns: turn, gaps: [] };
        messages.push({
          role: 'user',
          content: 'Continue with the tools: record the evidence, and call finish_research when you are done.',
        });
      }
    }
  }
  return { finished: false, turns: MAX_TURNS, gaps: ['The research reached its turn limit.'] };
}
