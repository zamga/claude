import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, Transform } from 'node:stream';
import {
  COUNTRY_INFO,
  MAX_FILE_BYTES,
  MAX_FILES,
  PURPOSES,
  normaliseWebsite,
  validate,
  type InitiationRequest,
  type Listing,
  type Purpose,
} from '../../src/lib/request';
import type { Report } from '../../src/report/types';
import { failureMessage, type Audit, type EngineEvent, type EngineRequest, type Upload } from '../engine/pipeline';
import type { Config } from './config';
import { codeAccepted, type RateLimit } from './limits';
import { encode, sendEncoded } from './static';
import { newId, type Store } from './store';

/*
 * The engine's API: start a run, follow it, fetch what it wrote.
 *
 *   GET  /api/health                     what this server can do
 *   POST /api/initiations                start a run (multipart form, files attached)
 *   GET  /api/initiations/:id            a run's state and events so far
 *   GET  /api/initiations/:id/events     the same events as a live stream
 *   GET  /api/reports/:id                a finished report
 */

export type Engine = (
  request: EngineRequest,
  signal: AbortSignal,
  emit: (e: EngineEvent) => void,
) => Promise<{ report: Report; audit: Audit }>;

export interface ApiDeps {
  config: Config;
  store: Store;
  limits: RateLimit;
  engine?: Engine;
  random: () => string;
}

/** More than ten files of 25 MB never needs to be read. */
const MAX_BODY = MAX_FILES * MAX_FILE_BYTES + 1024 * 1024;
const MAX_QUESTION = 600;

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(text);
}

const fail = (res: ServerResponse, status: number, error: string, field?: string) =>
  sendJson(res, status, field ? { error, field } : { error });

/** The address a request came from, behind a proxy only when the operator says to trust it. */
export function clientAddress(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    ?.trim();
  return (trustProxy && forwarded) || req.socket.remoteAddress || 'unknown';
}

export function health(res: ServerResponse, deps: ApiDeps) {
  sendJson(res, 200, {
    engine: deps.engine ? deps.config.engine : 'off',
    access: deps.config.accessCodes.length && !deps.config.open ? 'code' : 'open',
    accepts: { files: MAX_FILES, fileBytes: MAX_FILE_BYTES },
  });
}

/** The request body as a web stream that stops at the limit. */
function limited(req: IncomingMessage, limit: number): ReadableStream {
  let seen = 0;
  const guard = new Transform({
    transform(chunk: Buffer, _enc, done) {
      seen += chunk.length;
      if (seen > limit) done(new Error('too-large'));
      else done(null, chunk);
    },
  });
  return Readable.toWeb(req.pipe(guard)) as ReadableStream;
}

const field = (form: FormData, name: string, max = 200) => {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
};

export async function createRun(req: IncomingMessage, res: ServerResponse, deps: ApiDeps) {
  const { config, store, limits } = deps;
  if (!deps.engine) return fail(res, 503, 'The research engine is not running on this server.');
  const type = String(req.headers['content-type'] ?? '');
  if (!type.startsWith('multipart/form-data')) return fail(res, 415, 'Send the request as a multipart form.');
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) return fail(res, 413, 'The attachments are too large.');

  let form: FormData;
  try {
    const request = new Request('http://local/api/initiations', {
      method: 'POST',
      headers: { 'content-type': type },
      body: limited(req, MAX_BODY),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    form = await request.formData();
  } catch (e) {
    return e instanceof Error && /too-large/.test(e.message)
      ? fail(res, 413, 'The attachments are too large.')
      : fail(res, 400, 'The form could not be read.');
  }

  // Access first: an unauthorised request learns nothing else.
  if (config.accessCodes.length && !config.open && !codeAccepted(field(form, 'code'), config.accessCodes))
    return fail(res, 401, 'That access code is not valid.', 'code');

  const files = form.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  const country = field(form, 'country');
  const listing = field(form, 'listing') as Listing;
  const purpose = field(form, 'purpose') as Purpose;
  const draft: InitiationRequest = {
    company: field(form, 'company'),
    country,
    listing,
    ticker: field(form, 'ticker', 20),
    registration: field(form, 'registration', 40),
    website: field(form, 'website', 300),
    files: files.map((f) => ({ name: f.name, size: f.size })),
    purpose,
    focus: field(form, 'focus', MAX_QUESTION),
  };
  const info = COUNTRY_INFO[country];
  if (!info) return fail(res, 400, 'Choose a country from the list.', 'country');
  if (!['listed', 'private', 'unsure'].includes(listing))
    return fail(res, 400, 'Choose whether the shares are listed.', 'listing');
  if (!PURPOSES.includes(purpose)) return fail(res, 400, 'Choose what the report is for.', 'purpose');
  const errors = validate(draft);
  const first = Object.entries(errors)[0];
  if (first) return fail(res, 400, first[1], first[0]);

  if (store.running() >= config.maxConcurrent)
    return fail(res, 429, 'The engine is busy with other reports. Try again in a few minutes.');
  if (!limits.take(clientAddress(req, config.trustProxy)))
    return fail(res, 429, `You can start ${config.perHour} reports an hour. Try again later.`);

  const uploads: Upload[] = await Promise.all(
    files.map(async (f) => ({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })),
  );
  const id = newId(draft.company, deps.random);
  const website = normaliseWebsite(draft.website)?.toString();
  const run: EngineRequest = {
    id,
    company: draft.company,
    country,
    countryCode: info.code,
    listing,
    ticker: draft.ticker || undefined,
    registration: draft.registration || undefined,
    website,
    purpose,
    question: draft.focus || undefined,
    uploads,
  };
  store.create({
    id,
    createdAt: new Date().toISOString(),
    status: 'running',
    request: {
      company: run.company,
      country,
      listing,
      purpose,
      question: run.question,
      files: draft.files,
    },
    events: [],
  });

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('The run took longer than its time limit.', 'TimeoutError')),
    config.runMinutes * 60_000,
  );
  // The report is saved before anyone is told it is done, so following the link always finds it.
  deps
    .engine(run, controller.signal, (e) => {
      if (e.type !== 'done') store.push(id, e);
    })
    .then(async ({ report, audit }) => {
      await store.saveReport(report, audit);
      store.push(id, { type: 'done', reportId: report.id });
      console.info(`[uncovered] ${id} done in ${Math.round(audit.durationMs / 1000)}s, $${audit.usage.dollars}`);
    })
    .catch((e: unknown) => {
      console.error(`[uncovered] ${id} failed:`, e);
      store.push(id, { type: 'failed', message: failureMessage(controller.signal.reason ?? e) });
    })
    .finally(() => clearTimeout(timer));

  sendJson(res, 202, { id, status: 'running', events: `/api/initiations/${id}/events`, report: `/report/${id}` });
}

export function runState(res: ServerResponse, deps: ApiDeps, id: string) {
  const job = deps.store.get(id);
  if (!job) return fail(res, 404, 'No such run.');
  sendJson(res, 200, job);
}

/** A run's events as server-sent events: all so far, then each as it happens. */
export function runEvents(req: IncomingMessage, res: ServerResponse, deps: ApiDeps, id: string) {
  const job = deps.store.get(id);
  if (!job) return fail(res, 404, 'No such run.');
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  // Events already seen: the browser says which on reconnecting, or the page asks for those after the ones it shows.
  const seen = req.headers['last-event-id'] ?? new URL(req.url ?? '/', 'http://local').searchParams.get('after');
  const after = typeof seen === 'string' && /^\d+$/.test(seen) ? Number(seen) : -1;
  let index = 0;
  const send = (stored: { at: string; event: EngineEvent }) => {
    const n = index++;
    if (n <= after) return;
    res.write(`id: ${n}\nevent: ${stored.event.type}\ndata: ${JSON.stringify({ ...stored.event, at: stored.at })}\n\n`);
  };
  job.events.forEach(send);
  if (job.status !== 'running') {
    res.end();
    return;
  }
  const beat = setInterval(() => res.write(': still working\n\n'), 15_000);
  const stop = deps.store.watch(id, (stored) => {
    send(stored);
    if (stored.event.type === 'done' || stored.event.type === 'failed') {
      clearInterval(beat);
      stop();
      res.end();
    }
  });
  req.on('close', () => {
    clearInterval(beat);
    stop();
  });
}

export async function reportJson(req: IncomingMessage, res: ServerResponse, deps: ApiDeps, id: string) {
  const report = await deps.store.report(id);
  if (!report) return fail(res, 404, 'No such report.');
  // A report is a large document; send it compressed.
  sendEncoded(req, res, await encode(Buffer.from(JSON.stringify(report))), 200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60',
  });
}
