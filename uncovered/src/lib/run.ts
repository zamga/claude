/*
 * A research run as both sides see it: the events the engine reports while
 * it works, and the record the server keeps. The browser starts a run with a
 * form post and follows it as a stream of server-sent events.
 */

export type Stage = 'research' | 'model' | 'write' | 'check';
export const STAGES: Stage[] = ['research', 'model', 'write', 'check'];

export type EngineEvent =
  | { type: 'stage'; stage: Stage; status: 'active' | 'done' }
  | { type: 'activity'; stage: Stage; text: string }
  | { type: 'evidence'; documents: number; passages: number; figures: number; rejected: number }
  | { type: 'done'; reportId: string }
  | { type: 'failed'; message: string };

export interface RunRecord {
  id: string;
  createdAt: string;
  status: 'running' | 'done' | 'failed';
  request: {
    company: string;
    country: string;
    listing: string;
    purpose: string;
    question?: string;
    files: { name: string; size: number }[];
  };
  events: { at: string; event: EngineEvent }[];
  error?: string;
}

export interface EngineStatus {
  engine: 'live' | 'fixture' | 'off';
  access: 'code' | 'open';
}

/** A run's address: the request page, following the run. */
export const runAddress = (id: string) => `/initiate?run=${encodeURIComponent(id)}`;

/**
 * The address a page is rendered from: its path and, on the request page, the run it follows.
 * Other query parameters, such as a campaign tag, change nothing on the page.
 */
export function renderedAddress(path: string, query: URLSearchParams): string {
  const run = path === '/initiate' ? query.get('run') : null;
  return run ? runAddress(run) : path;
}

/** A run as the server found it when it rendered the page: null when there was no such run. */
export interface GivenRun {
  id: string;
  record: RunRecord | null;
  /** When the page was rendered, so the first render on both sides shows the same elapsed time. */
  at: string;
}

let given: GivenRun | undefined;

/** The run a page was rendered with, given to the renderer on the server and read from the page in the browser. */
export function provideRun(run: GivenRun) {
  given = run;
}

export function givenRun(id: string): GivenRun | undefined {
  return given?.id === id ? given : undefined;
}

const OFF: EngineStatus = { engine: 'off', access: 'open' };
let status: EngineStatus | undefined;
let rendering = OFF;

/**
 * The engine a page is rendered for on the server: none at build time, since a
 * static host runs none, and the server's own when it renders the page itself.
 */
export function renderForEngine(engine: EngineStatus) {
  rendering = engine;
}

/**
 * What the server this page came from can do. A server running the engine
 * says so in every page it sends (<meta name="uncovered-engine">); a static
 * host sends none, so the page knows there is no engine without asking.
 */
export function engineStatus(): EngineStatus {
  if (typeof document === 'undefined') return rendering;
  if (!status) {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="uncovered-engine"]');
    const engine = meta?.content;
    status =
      engine === 'live' || engine === 'fixture'
        ? { engine, access: meta?.dataset.access === 'code' ? 'code' : 'open' }
        : OFF;
  }
  return status;
}

/** The meta element a server running the engine adds to every page it sends. */
export function engineMeta(engine: EngineStatus): string {
  return `<meta name="uncovered-engine" content="${engine.engine}" data-access="${engine.access}">`;
}

export type StartResult = { ok: true; id: string } | { ok: false; error: string; field?: string };

/** Post a request with its files; the server answers with the run's id. */
export async function startRun(form: FormData): Promise<StartResult> {
  try {
    const res = await fetch('/api/initiations', { method: 'POST', body: form });
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; field?: string };
    if (res.ok && body.id) return { ok: true, id: body.id };
    return { ok: false, error: body.error ?? `The request was not accepted (${res.status}).`, field: body.field };
  } catch {
    return { ok: false, error: 'The engine could not be reached. Check your connection and try again.' };
  }
}

export async function fetchRun(id: string): Promise<RunRecord | undefined> {
  try {
    const res = await fetch(`/api/initiations/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
    return res.ok ? ((await res.json()) as RunRecord) : undefined;
  } catch {
    return undefined;
  }
}

const TYPES = ['stage', 'activity', 'evidence', 'done', 'failed'] as const;

/**
 * Follow a run's events as they happen: all of them from the start, or those after the event
 * numbered `after` (counting from 0). Returns a function that stops following.
 */
export function followRun(id: string, on: (event: EngineEvent, at: string) => void, after = -1): () => void {
  const source = new EventSource(
    `/api/initiations/${encodeURIComponent(id)}/events${after >= 0 ? `?after=${after}` : ''}`,
  );
  const handle = (e: MessageEvent<string>) => {
    try {
      const data = JSON.parse(e.data) as EngineEvent & { at: string };
      const { at, ...event } = data;
      on(event as EngineEvent, at);
      if (event.type === 'done' || event.type === 'failed') source.close();
    } catch {
      // A malformed event is skipped.
    }
  };
  for (const t of TYPES) source.addEventListener(t, handle);
  return () => source.close();
}

/** The state of a run, folded from its events. */
export interface RunView {
  stages: Record<Stage, 'waiting' | 'active' | 'done'>;
  evidence: { documents: number; passages: number; figures: number; rejected: number };
  activity: { at: string; stage: Stage; text: string }[];
  status: 'running' | 'done' | 'failed';
  reportId?: string;
  error?: string;
  /** When the run finished or stopped. */
  endedAt?: string;
}

export const EMPTY_RUN: RunView = {
  stages: { research: 'waiting', model: 'waiting', write: 'waiting', check: 'waiting' },
  evidence: { documents: 0, passages: 0, figures: 0, rejected: 0 },
  activity: [],
  status: 'running',
};

export function fold(view: RunView, event: EngineEvent, at: string): RunView {
  switch (event.type) {
    case 'stage':
      return { ...view, stages: { ...view.stages, [event.stage]: event.status } };
    case 'activity':
      return { ...view, activity: [{ at, stage: event.stage, text: event.text }, ...view.activity].slice(0, 40) };
    case 'evidence': {
      const { documents, passages, figures, rejected } = event;
      return { ...view, evidence: { documents, passages, figures, rejected } };
    }
    case 'done':
      return { ...view, status: 'done', reportId: event.reportId, endedAt: at };
    case 'failed':
      return { ...view, status: 'failed', error: event.message, endedAt: at };
  }
}

/** How far the seal should be engraved for a run in this state, 0 to 1. */
export function runProgress(view: RunView): number {
  if (view.status === 'done' || view.stages.check === 'done') return 1;
  if (view.stages.write === 'done') return 0.92;
  if (view.stages.write === 'active') return 0.78;
  if (view.stages.model === 'done') return 0.72;
  if (view.stages.model === 'active') return 0.58;
  if (view.stages.research === 'done') return 0.52;
  if (view.stages.research === 'active')
    return Math.min(0.48, 0.1 + view.evidence.passages * 0.012 + view.evidence.documents * 0.02);
  return 0.04;
}
