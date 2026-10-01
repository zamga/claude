/**
 * The telemetry wire format, shared by the browser (src/lib/telemetry.ts) and
 * the collector (api/telemetry.ts). It carries no personal data: a route
 * template, a coarse device class, numbers, and error text with the site's
 * origin stripped. Records from one page view share a random id that is held
 * in memory only, never stored on the device.
 */

export const TELEMETRY_VERSION = 1;
/** Browsers cap queued beacons at 64 KiB in total; one batch stays well below. */
export const MAX_BATCH_BYTES = 16 * 1024;
export const MAX_RECORDS = 40;

export const VITALS = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const;
export type VitalName = (typeof VITALS)[number];

export const RATINGS = ['good', 'needs-improvement', 'poor'] as const;
export type Rating = (typeof RATINGS)[number];

/**
 * Product actions: the few moments that say whether the chart does its job.
 *  - story   a narrative was chosen (detail: story id)
 *  - bearing the visitor moved their bearing on the chart itself
 *  - share   a chart link was copied
 *  - image   a chart image was made
 *  - search  a company was opened from the command palette (detail: route)
 *  - survey  a private company was surveyed
 *  - relief  the 3D relief rendered (detail: hero or chart)
 *  - flat    the relief fell back to the flat chart (detail: reason)
 */
export const ACTIONS = ['story', 'bearing', 'share', 'image', 'search', 'survey', 'relief', 'flat'] as const;
export type ActionName = (typeof ACTIONS)[number];

interface RecordBase {
  /** Milliseconds since the page started loading. */
  t: number;
  /** Route template the record belongs to. */
  route: string;
}

export interface VitalRecord extends RecordBase {
  kind: 'vital';
  name: VitalName;
  value: number;
  rating: Rating;
  /** web-vitals metric id. CLS and INP report again as they grow: keep the last value per id. */
  metricId: string;
  navigation: string;
  /** Selector of the element responsible: the LCP element, the slowest interaction, the largest shift. */
  target?: string;
}

export interface ErrorRecord extends RecordBase {
  kind: 'error';
  message: string;
  source?: string;
  line?: number;
  col?: number;
  stack?: string;
}

export interface ActionRecord extends RecordBase {
  kind: 'action';
  name: ActionName;
  detail?: string;
}

export type TelemetryRecord = VitalRecord | ErrorRecord | ActionRecord;

export interface DeviceClass {
  /** Viewport width class: s below 48rem, m below 75rem, l above. */
  viewport: 's' | 'm' | 'l';
  /** navigator.deviceMemory in GiB, where the browser shares it. */
  memory?: number;
  /** Effective connection type, where the browser shares it. */
  network?: string;
}

export interface TelemetryBatch {
  v: typeof TELEMETRY_VERSION;
  /** Random per page view. */
  view: string;
  /** Short commit hash of the deploy, so a regression points at a release. */
  build: string;
  device: DeviceClass;
  records: TelemetryRecord[];
}

const STATIC_ROUTES = new Set(['/', '/atlas', '/method', '/survey']);
const TICKER = /^[a-z0-9][a-z0-9.-]{0,9}$/;

/** Reduce a path to the route it belongs to. Query strings and share tokens never survive. */
export function routeTemplate(path: string): string {
  const bare = (path.split(/[?#~]/)[0] ?? '').toLowerCase().replace(/\/+$/, '') || '/';
  if (STATIC_ROUTES.has(bare)) return bare;
  const chart = /^\/chart\/([^/]+)$/.exec(bare);
  if (chart) return TICKER.test(chart[1]!) ? `/chart/${chart[1]}` : '/chart/*';
  return '/404';
}

const text = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.slice(0, max) : undefined;

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;

const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : undefined;

function parseRecord(raw: unknown): TelemetryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const t = Math.round(num(r.t, 0, 86_400_000) ?? 0);
  const route = routeTemplate(text(r.route, 80) ?? '/');

  if (r.kind === 'vital') {
    const name = oneOf(r.name, VITALS);
    const value = num(r.value, 0, 600_000);
    const rating = oneOf(r.rating, RATINGS);
    const metricId = text(r.metricId, 64);
    if (!name || value === undefined || !rating || !metricId) return null;
    const target = text(r.target, 160);
    return {
      kind: 'vital',
      t,
      route,
      name,
      value,
      rating,
      metricId,
      navigation: text(r.navigation, 24) ?? 'navigate',
      ...(target ? { target } : {}),
    };
  }

  if (r.kind === 'error') {
    const message = text(r.message, 300);
    if (!message) return null;
    const source = text(r.source, 200);
    const line = num(r.line, 0, 1e7);
    const col = num(r.col, 0, 1e7);
    const stack = text(r.stack, 1200);
    return {
      kind: 'error',
      t,
      route,
      message,
      ...(source ? { source } : {}),
      ...(line !== undefined ? { line } : {}),
      ...(col !== undefined ? { col } : {}),
      ...(stack ? { stack } : {}),
    };
  }

  if (r.kind === 'action') {
    const name = oneOf(r.name, ACTIONS);
    if (!name) return null;
    const detail = text(r.detail, 64);
    return { kind: 'action', t, route, name, ...(detail ? { detail } : {}) };
  }

  return null;
}

/** Validate an untrusted batch. Unknown fields are dropped, strings are capped, bad records are skipped. */
export function parseBatch(input: unknown): TelemetryBatch | null {
  if (!input || typeof input !== 'object') return null;
  const b = input as Record<string, unknown>;
  if (b.v !== TELEMETRY_VERSION || !Array.isArray(b.records)) return null;
  const view = text(b.view, 64);
  if (!view) return null;
  const d = (b.device && typeof b.device === 'object' ? b.device : {}) as Record<string, unknown>;
  const memory = num(d.memory, 0, 1024);
  const network = text(d.network, 16);
  const records = b.records
    .slice(0, MAX_RECORDS)
    .map(parseRecord)
    .filter((r): r is TelemetryRecord => r !== null);
  if (records.length === 0) return null;
  return {
    v: TELEMETRY_VERSION,
    view,
    build: text(b.build, 40) ?? 'unknown',
    device: {
      viewport: oneOf(d.viewport, ['s', 'm', 'l'] as const) ?? 'l',
      ...(memory !== undefined ? { memory } : {}),
      ...(network ? { network } : {}),
    },
    records,
  };
}
