import type { Report } from '../../src/report/types';
import { valueReport } from '../../src/report/valuation';
import { bindings } from '../../src/report/bindings';
import { MODEL, ModelError, Usage, type ModelClient } from './claude';
import { DocumentStore } from './documents';
import { extractHtml, parts } from './extract/html';
import { extractPdf } from './extract/pdf';
import { decodeText, FetchError, RobotsCache } from './fetch';
import { GateError, write } from './write';
import { gate } from './gate';
import { buildHistory, NotEnoughEvidence } from './history';
import { Ledger } from './ledger';
import { proposeAssumptions } from './model';
import { research, type Brief } from './research';
import { Leads, type ToolContext } from './tools';

/*
 * One initiation, from request to checked report: research, model, write,
 * check. Each stage reports what it is doing as it goes, for the person
 * waiting; the run keeps an audit of what it read, what it rejected and what
 * it cost.
 */

import type { EngineEvent, Stage } from '../../src/lib/run';

export type { EngineEvent, Stage };

export interface Upload {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export interface EngineRequest {
  id: string;
  company: string;
  country: string;
  countryCode: string;
  listing: 'listed' | 'private' | 'unsure';
  ticker?: string;
  registration?: string;
  website?: string;
  purpose: string;
  question?: string;
  uploads: Upload[];
}

export interface EngineDeps {
  client: ModelClient;
  userAgent: string;
  signal?: AbortSignal;
  now?: () => Date;
  /** Tests only: let the fetcher reach local addresses. */
  allowPrivate?: boolean;
}

export interface Audit {
  model: string;
  startedAt: string;
  durationMs: number;
  usage: ReturnType<Usage['toJSON']>;
  researchTurns: number;
  researchFinished: boolean;
  documents: { id: string; url: string; title: string; format: string; pages: number; grade: string }[];
  passages: number;
  figures: number;
  rejected: number;
  writeRounds: number;
  withheld: number;
}

/** Text from a document the requester supplied. */
export async function readUpload(
  u: Upload,
): Promise<{ pages: string[]; paged: boolean; title: string; format: 'pdf' | 'html' | 'text' }> {
  const name = u.name.toLowerCase();
  const head = Buffer.from(u.bytes.subarray(0, 5)).toString();
  if (u.type === 'application/pdf' || name.endsWith('.pdf') || head === '%PDF-') {
    const pdf = await extractPdf(u.bytes);
    if (pdf.pages.every((p) => !p.trim()))
      throw new FetchError(`${u.name} has no text layer (a scan?), so nothing in it can be quoted.`, 'unsupported');
    return { pages: pdf.pages, paged: true, title: pdf.title ?? u.name, format: 'pdf' };
  }
  if (/\.(x?html?|xml)$/.test(name) || /html|xml/.test(u.type)) {
    const page = extractHtml(decodeText(u.bytes), 'https://upload.invalid/');
    return { pages: parts(page.text), paged: false, title: page.title ?? u.name, format: 'html' };
  }
  if (/\.(txt|csv)$/.test(name) || u.type.startsWith('text/'))
    return { pages: parts(decodeText(u.bytes)), paged: false, title: u.name, format: 'text' };
  throw new FetchError(`${u.name} is not a PDF, a web page or a text file.`, 'unsupported');
}

/** A sentence for the person waiting when a run cannot finish. */
export function failureMessage(e: unknown): string {
  if (e instanceof NotEnoughEvidence) return e.message;
  if (e instanceof GateError)
    return 'The report did not pass its checks after three drafts, so it was not published. Nothing was charged against the evidence; try again, or attach the filings.';
  if (e instanceof ModelError) {
    if (e.code === 'refusal') return 'The research model declined this request.';
    if (e.code === 'no-key') return 'The engine is not configured: it has no API key.';
    return `The research model returned something unusable (${e.message}). Try again.`;
  }
  if (e instanceof DOMException && e.name === 'AbortError') return 'The run was stopped before it finished.';
  if (e instanceof Error && e.name === 'TimeoutError') return 'The run took longer than its time limit.';
  return `The engine stopped: ${e instanceof Error ? e.message : String(e)}`;
}

export async function runEngine(
  req: EngineRequest,
  deps: EngineDeps,
  emit: (e: EngineEvent) => void,
): Promise<{ report: Report; audit: Audit }> {
  const started = deps.now?.() ?? new Date();
  const usage = new Usage();
  const store = new DocumentStore();
  const ledger = new Ledger(store);
  let stage: Stage = 'research';
  const activity = (text: string) => emit({ type: 'activity', stage, text });
  const fetchOpts = {
    userAgent: deps.userAgent,
    timeoutMs: 45_000,
    allowPrivate: deps.allowPrivate,
    signal: deps.signal,
  };
  const ctx: ToolContext = {
    store,
    ledger,
    leads: new Leads(),
    robots: new RobotsCache(fetchOpts),
    fetch: fetchOpts,
    activity,
    rejected: 0,
  };
  let counted = '';
  /** The evidence so far, sent only when it has changed. */
  const evidence = () => {
    const now = {
      type: 'evidence' as const,
      documents: store.list().length,
      passages: ledger.passages.length,
      figures: ledger.figures.length,
      rejected: ctx.rejected,
    };
    const key = JSON.stringify(now);
    if (key === counted) return;
    counted = key;
    emit(now);
  };
  const run = { client: deps.client, usage, signal: deps.signal };

  emit({ type: 'stage', stage: 'research', status: 'active' });
  for (const u of req.uploads) {
    try {
      const text = await readUpload(u);
      store.add({
        url: `upload:${u.name}`,
        origin: 'upload',
        format: text.format,
        title: text.title,
        pages: text.pages,
        paged: text.paged,
        pageCount: text.pages.length,
        links: [],
        raw: u.bytes,
      });
      activity(`Read your document ${u.name}${text.paged ? ` (${text.pages.length} pages)` : ''}`);
    } catch (e) {
      activity(`Could not read ${u.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  evidence();
  const today = started.toISOString().slice(0, 10);
  const brief: Brief = {
    company: req.company,
    country: req.country,
    countryCode: req.countryCode,
    listing: req.listing,
    ticker: req.ticker,
    registration: req.registration,
    website: req.website,
    purpose: req.purpose,
    question: req.question,
    today,
    supplied: store.list().map((d) => ({ id: d.id, title: d.title, pages: d.pages.length, paged: d.paged })),
  };
  const found = await research(brief, { ...run, tools: ctx, progress: evidence });
  evidence();
  emit({ type: 'stage', stage: 'research', status: 'done' });

  stage = 'model';
  emit({ type: 'stage', stage: 'model', status: 'active' });
  const history = buildHistory(ledger);
  activity(
    `Built the history: ${history.years.map((y) => y.slice(2)).join(', ')}${history.interim ? ` and ${history.interim}` : ''}`,
  );
  const model = await proposeAssumptions(ledger.identity, history, found.gaps, run);
  activity(`Set the assumptions: ${model.basis === 'share' ? 'valued per share' : 'valued as a whole company'}`);
  emit({ type: 'stage', stage: 'model', status: 'done' });

  stage = 'write';
  emit({ type: 'stage', stage: 'write', status: 'active' });
  const written = await write(
    {
      id: req.id,
      date: today,
      request: { company: req.company, country: req.country, countryCode: req.countryCode, question: req.question },
      identity: ledger.identity,
      ledger,
      history,
      model,
      gaps: found.gaps,
    },
    { ...run, activity },
  );
  emit({ type: 'stage', stage: 'write', status: 'done' });

  stage = 'check';
  emit({ type: 'stage', stage: 'check', status: 'active' });
  const report = written.report;
  // The last word: the report values, every note and token resolves, and it survives storage.
  valueReport(report);
  const left = gate(report, bindings(report));
  if (left.length) throw new GateError(left);
  const stored = JSON.parse(JSON.stringify(report)) as Report;
  const documents = new Set(report.sources.map((s) => s.document)).size;
  activity(
    `Every figure traced: ${report.sources.length} passages from ${documents} document${documents === 1 ? '' : 's'}`,
  );
  emit({ type: 'stage', stage: 'check', status: 'done' });

  const audit: Audit = {
    model: MODEL,
    startedAt: started.toISOString(),
    durationMs: (deps.now?.() ?? new Date()).getTime() - started.getTime(),
    usage: usage.toJSON(),
    researchTurns: found.turns,
    researchFinished: found.finished,
    documents: store.list().map((d) => ({
      id: d.id,
      url: d.url,
      title: d.meta?.title ?? d.title,
      format: d.format,
      pages: d.pages.length,
      grade: d.meta?.filed ? 'filed' : 'reported',
    })),
    passages: ledger.passages.length,
    figures: ledger.figures.length,
    rejected: ctx.rejected,
    writeRounds: written.rounds,
    withheld: written.withheld,
  };
  emit({ type: 'done', reportId: report.id });
  return { report: stored, audit };
}
