import { ApiError } from './errors';
import type { Envelope } from './types';

/**
 * Request transport for the demo service. It reproduces the network behaviour the interface must
 * handle honestly (spec pages 27, 38, 49): latency, offline, slow responses, rejected writes and
 * writes whose response is lost after the server committed them.
 */

export type DataMode = 'demo' | 'live';
export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === 'live' ? 'live' : 'demo';

export interface NetworkConditions {
  /** Simulate a lost connection (real `navigator.onLine === false` is always respected). */
  offline: boolean;
  /** Add 2.5 s to every request. */
  slow: boolean;
  /** Next write: 'reject' fails before commit; 'lose-response' commits then times out. */
  nextWrite: 'normal' | 'reject' | 'lose-response';
  /** Remove simulated latency (used by automated checks). */
  instant: boolean;
}

const CONDITIONS_KEY = 'stockpicks.demo.network.v1';
const DEFAULT_CONDITIONS: NetworkConditions = {
  offline: false,
  slow: false,
  nextWrite: 'normal',
  instant: false,
};

function loadConditions(): NetworkConditions {
  try {
    const raw = sessionStorage.getItem(CONDITIONS_KEY);
    const instant =
      typeof location !== 'undefined' && new URLSearchParams(location.search).has('instant');
    const parsed = raw
      ? { ...DEFAULT_CONDITIONS, ...(JSON.parse(raw) as Partial<NetworkConditions>) }
      : DEFAULT_CONDITIONS;
    return instant ? { ...parsed, instant: true } : parsed;
  } catch {
    return DEFAULT_CONDITIONS;
  }
}

let conditions: NetworkConditions =
  typeof window === 'undefined' ? DEFAULT_CONDITIONS : loadConditions();
const listeners = new Set<() => void>();

export function getConditions(): NetworkConditions {
  return conditions;
}

export function setConditions(patch: Partial<NetworkConditions>): void {
  conditions = { ...conditions, ...patch };
  try {
    sessionStorage.setItem(CONDITIONS_KEY, JSON.stringify(conditions));
  } catch {
    // Conditions then last for this page view only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeConditions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isEffectivelyOffline(): boolean {
  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return browserOffline || conditions.offline;
}

// ---------- Diagnostics (safe request ids for support; no payloads) ----------

export interface DiagnosticEntry {
  requestId: string;
  name: string;
  outcome: 'ok' | string;
  durationMs: number;
  at: number;
}

const diagnostics: DiagnosticEntry[] = [];

export function recentDiagnostics(): DiagnosticEntry[] {
  return diagnostics.slice(-30);
}

function record(entry: DiagnosticEntry): void {
  diagnostics.push(entry);
  if (diagnostics.length > 60) diagnostics.shift();
}

// ---------- Calls ----------

export function newRequestId(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return `req_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}

function latencyFor(name: string): number {
  if (conditions.instant) return 0;
  const base = 70 + (hash(name) % 140);
  return conditions.slow ? base + 2500 : base;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('The request was superseded.', 'AbortError'));
      },
      { once: true },
    );
  });
}

export interface CallOptions {
  kind: 'read' | 'write';
  signal?: AbortSignal;
  asOf?: () => number;
}

export async function call<T>(
  name: string,
  run: () => T | Promise<T>,
  options: CallOptions,
): Promise<Envelope<T>> {
  const requestId = newRequestId();
  const started = performance.now();
  const finish = (outcome: string) =>
    record({
      requestId,
      name,
      outcome,
      durationMs: Math.round(performance.now() - started),
      at: Date.now(),
    });

  try {
    if (DATA_MODE === 'live') {
      throw new ApiError(
        'not_configured',
        'Live data is not configured for this build. Use the demo build or provide service credentials.',
        {
          retryable: false,
        },
      );
    }
    await wait(Math.round(latencyFor(name) / 2), options.signal);
    if (isEffectivelyOffline()) {
      throw new ApiError('offline', 'You’re offline. Showing the last available information.', {
        retryable: true,
      });
    }
    let loseResponse = false;
    if (options.kind === 'write' && conditions.nextWrite !== 'normal') {
      const mode = conditions.nextWrite;
      setConditions({ nextWrite: 'normal' });
      if (mode === 'reject') {
        throw new ApiError(
          'unavailable',
          'We could not save your changes. Your draft is still here.',
          { retryable: true },
        );
      }
      loseResponse = true;
    }
    const data = await run();
    await wait(Math.round(latencyFor(name) / 2), options.signal);
    if (loseResponse) {
      throw new ApiError(
        'timeout',
        'The connection dropped before we heard back. Check whether the change was saved before trying again.',
        {
          retryable: true,
        },
      );
    }
    finish('ok');
    return {
      data,
      meta: {
        requestId,
        asOf: new Date(options.asOf ? options.asOf() : Date.now()).toISOString(),
        nextCursor: null,
        demo: DATA_MODE === 'demo',
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      error.requestId = requestId;
      finish(error.code);
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      finish('aborted');
    } else {
      finish('error');
    }
    throw error;
  }
}
