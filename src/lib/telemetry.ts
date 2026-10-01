/**
 * Field telemetry: Core Web Vitals with attribution, uncaught errors, and the
 * handful of product actions listed in telemetry-schema.ts. Records are
 * batched and sent with sendBeacon when the page is hidden, so measuring never
 * competes with the visitor for the network or the main thread.
 *
 * Off unless VITE_TELEMETRY_URL is set at build time. Honours Global Privacy
 * Control and Do Not Track. No cookies, no storage, no fingerprinting: a page
 * view is a random id held in memory, and paths are reduced to route
 * templates, so share tokens and surveyed figures never leave the browser.
 */
import type { MetricType } from 'web-vitals';
import { currentPath } from './router';
import {
  MAX_BATCH_BYTES,
  MAX_RECORDS,
  routeTemplate,
  TELEMETRY_VERSION,
  type ActionName,
  type DeviceClass,
  type TelemetryBatch,
  type TelemetryRecord,
} from './telemetry-schema';

const ENDPOINT = import.meta.env.VITE_TELEMETRY_URL;
const SAMPLE_RATE = Math.min(1, Math.max(0, Number(import.meta.env.VITE_TELEMETRY_SAMPLE ?? '1') || 0));
const MAX_ERRORS = 10;

let active = false;
let vitalsStarted = false;
let flushQueued = false;
let view = '';
let landing = '/';
let queue: TelemetryRecord[] = [];
let errorCount = 0;
const seenErrors = new Set<string>();
const seenActions = new Set<string>();

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

const now = () => Math.round(performance.now());
const route = () => routeTemplate(currentPath());

function deviceClass(): DeviceClass {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
  const rem = window.innerWidth / 16;
  return {
    viewport: rem < 48 ? 's' : rem < 75 ? 'm' : 'l',
    ...(typeof nav.deviceMemory === 'number' ? { memory: nav.deviceMemory } : {}),
    ...(nav.connection?.effectiveType ? { network: nav.connection.effectiveType } : {}),
  };
}

function push(record: TelemetryRecord) {
  if (!active) return;
  queue.push(record);
  // CLS and INP report on the same visibilitychange that triggers a flush;
  // a microtask gathers everything reported during that event into one beacon.
  if (queue.length >= MAX_RECORDS || document.visibilityState === 'hidden') scheduleFlush();
}

function scheduleFlush() {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    flushQueued = false;
    flush();
  });
}

function flush() {
  if (!active || !ENDPOINT || queue.length === 0) return;
  const batch: TelemetryBatch = { v: TELEMETRY_VERSION, view, build: __BUILD_ID__, device: deviceClass(), records: queue };
  queue = [];
  let blob = new Blob([JSON.stringify(batch)], { type: 'text/plain;charset=UTF-8' });
  // A safety net for pathological stacks: keep the earliest records, which explain the rest.
  while (blob.size > MAX_BATCH_BYTES && batch.records.length > 1) {
    batch.records = batch.records.slice(0, Math.ceil(batch.records.length / 2));
    blob = new Blob([JSON.stringify(batch)], { type: 'text/plain;charset=UTF-8' });
  }
  // text/plain keeps the beacon a "simple" request: no CORS preflight, even cross-origin.
  const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(ENDPOINT, blob);
  if (!sent) {
    void fetch(ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => undefined);
  }
}

function stripOrigin(value: string, max: number) {
  return value.split(window.location.origin).join('').slice(0, max);
}

function captureError(message: string, error: unknown, source?: string, line?: number, col?: number) {
  if (!active || errorCount >= MAX_ERRORS) return;
  const key = `${message}|${source ?? ''}|${line ?? ''}`;
  if (seenErrors.has(key)) return;
  seenErrors.add(key);
  errorCount++;
  const stack = error instanceof Error && error.stack ? stripOrigin(error.stack, 1200) : undefined;
  const file = source ? stripOrigin(source.split('?')[0] ?? source, 200) : undefined;
  push({
    kind: 'error',
    t: now(),
    route: route(),
    message: stripOrigin(message, 300),
    ...(file ? { source: file } : {}),
    ...(line ? { line } : {}),
    ...(col ? { col } : {}),
    ...(stack ? { stack } : {}),
  });
}

const onError = (e: ErrorEvent) => captureError(e.message || 'Script error', e.error, e.filename, e.lineno, e.colno);

const onRejection = (e: PromiseRejectionEvent) => {
  const reason: unknown = e.reason;
  const message =
    reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unhandled promise rejection';
  captureError(message, reason);
};

/**
 * Start listening. Call once, as early as possible, so errors during
 * hydration are caught; the vitals library itself loads later.
 */
export function installTelemetry(): void {
  if (active || !ENDPOINT || typeof window === 'undefined' || optedOut() || Math.random() >= SAMPLE_RATE) return;
  active = true;
  view = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  landing = route();
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

function vital(metric: MetricType, target: string | undefined) {
  push({
    kind: 'vital',
    t: now(),
    // Page-load metrics belong to the page the visit landed on, as in the Chrome UX Report.
    route: landing,
    name: metric.name,
    value: metric.name === 'CLS' ? Math.round(metric.value * 10_000) / 10_000 : Math.round(metric.value),
    rating: metric.rating,
    metricId: metric.id,
    navigation: metric.navigationType,
    ...(target ? { target: target.slice(0, 160) } : {}),
  });
}

/** Load web-vitals once the page is interactive and idle. Its observers read buffered entries, so nothing is missed. */
export function startVitals(): void {
  if (!active || vitalsStarted) return;
  vitalsStarted = true;
  const load = () => {
    import('web-vitals/attribution')
      .then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
        onLCP((m) => vital(m, m.attribution.target));
        onCLS((m) => vital(m, m.attribution.largestShiftTarget));
        onINP((m) => vital(m, m.attribution.interactionTarget));
        onFCP((m) => vital(m, undefined));
        onTTFB((m) => vital(m, undefined));
      })
      .catch(() => undefined);
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 4000 });
  else window.setTimeout(load, 1500);
}

/**
 * Record a product action. With `once`, repeats on the same route are
 * ignored (the first drag of the bearing matters, not every frame of it).
 */
export function track(name: ActionName, detail?: string, options: { once?: boolean } = {}): void {
  if (!active) return;
  const where = route();
  if (options.once) {
    const key = `${name}|${detail ?? ''}|${where}`;
    if (seenActions.has(key)) return;
    seenActions.add(key);
  }
  push({ kind: 'action', t: now(), route: where, name, ...(detail ? { detail: detail.slice(0, 64) } : {}) });
}
