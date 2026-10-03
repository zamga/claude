import { dateKeyToWall, localDateKey, MINUTE, zonedTimeToInstant } from '@/domain/time';
import type { Sample } from '@/domain/series';
import { ARCHIVE_SPECS, WINDOW_SESSIONS } from './archiveSpec';
import {
  calendarTimeZone,
  isTradingDay,
  nextTradingDay,
  sessionTimes,
  tradingDays,
  type CalendarId,
} from './calendar';
import { DEMO_SESSION_DATE } from './clock';
import { INDEX_BY_ID, INSTRUMENT_BY_ID, type PriceSpec } from './instruments';
import { gaussians } from './random';

/**
 * Deterministic demo price paths.
 *
 * Daily closes are a log-space Brownian bridge through anchors (start, paper-ledger prices,
 * archive entry/exit closes, previous close). The last five sessions and the demo session also
 * carry 5-minute observations bridged from open to close. Nothing here is market data.
 */

export interface DailyBar {
  date: string;
  open: number;
  close: number;
  closesAt: number;
}

export interface IntradaySession {
  date: string;
  opensAt: number;
  closesAt: number;
  samples: Sample[];
}

export interface PricePath {
  calendar: CalendarId;
  timeZone: string;
  /** Completed sessions before the demo session (and the demo session itself for EU names). */
  daily: DailyBar[];
  /** Last five sessions of 5-minute observations, the demo session last. */
  intraday: IntradaySession[];
  /** The demo session (always present for listed names, even when complete). */
  demoSession: IntradaySession | null;
  previousClose: number;
  /** Listed history starts here (null = full year). */
  listedOn: string | null;
  lastSession: string | null;
}

const YEAR_START = '2025-10-21';
const STEP = 5;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Bridge in log space through sorted anchors; z supplies one shock per step. */
function bridge(
  length: number,
  anchors: Map<number, number>,
  sigma: number,
  z: readonly number[],
): number[] {
  const indices = [...anchors.keys()].sort((a, b) => a - b);
  const out = new Array<number>(length).fill(NaN);
  for (let a = 0; a < indices.length - 1; a += 1) {
    const i0 = indices[a]!;
    const i1 = indices[a + 1]!;
    const v0 = Math.log(anchors.get(i0)!);
    const v1 = Math.log(anchors.get(i1)!);
    const n = i1 - i0;
    const walk = [0];
    for (let k = 1; k <= n; k += 1) walk.push(walk[k - 1]! + sigma * (z[i0 + k] ?? 0));
    const end = walk[n]!;
    for (let k = 0; k <= n; k += 1) {
      const frac = k / n;
      out[i0 + k] = Math.exp(v0 + frac * (v1 - v0) + (walk[k]! - frac * end));
    }
  }
  return out;
}

function entrySessionAfter(calendar: CalendarId, publishedAt: number): string {
  const tz = calendarTimeZone(calendar);
  const day = localDateKey(publishedAt, tz);
  if (isTradingDay(calendar, day) && publishedAt < sessionTimes(calendar, day).opensAt) return day;
  return nextTradingDay(calendar, day);
}

export interface OutcomeWindow {
  entryDate: string;
  /** Session whose close is the entry reference for flat-open anchoring. */
  priorDate: string;
  exitDate: string;
  sessions: string[];
}

/** Disclosed rule: enter at the next regular-session open; measure WINDOW_SESSIONS sessions. */
export function outcomeWindow(
  calendar: CalendarId,
  publishedAt: number,
  lastSession: string | null = null,
): OutcomeWindow {
  const entryDate = entrySessionAfter(calendar, publishedAt);
  const days = tradingDays(calendar, entryDate, '2026-12-31');
  let sessions = days.slice(0, WINDOW_SESSIONS);
  if (lastSession) sessions = sessions.filter((day) => day <= lastSession);
  const all = tradingDays(calendar, YEAR_START, entryDate);
  return {
    entryDate,
    priorDate: all[all.length - 2] ?? entryDate,
    exitDate: sessions[sessions.length - 1] ?? entryDate,
    sessions,
  };
}

function archiveAnchorsFor(instrumentId: string, calendar: CalendarId, lastSession: string | null) {
  return ARCHIVE_SPECS.filter(
    (spec) => spec.instrumentId === instrumentId && spec.targetReturnPct != null,
  ).map((spec) => {
    const window = outcomeWindow(calendar, Date.parse(spec.publishedAt), lastSession);
    return { window, target: spec.targetReturnPct! };
  });
}

function generatePath(key: string, spec: PriceSpec, instrumentId: string | null): PricePath {
  const calendar = spec.calendar;
  const timeZone = calendarTimeZone(calendar);
  const firstDay = spec.listedOn ?? YEAR_START;
  const finalCompleted = spec.lastSession ?? (calendar === 'EU' ? DEMO_SESSION_DATE : '2026-10-20');
  const days = tradingDays(calendar, firstDay, finalCompleted);
  const dailySigma = spec.annualVol / Math.sqrt(252);
  const z = gaussians(spec.seed, days.length + 8);
  const gapZ = gaussians(spec.seed + 7, days.length + 8);

  const baseAnchors = new Map<number, number>();
  baseAnchors.set(0, spec.start);
  const lastIndex = days.length - 1;
  // For EU names the final completed session is the demo session itself (latest = its close).
  const finalClose = calendar === 'EU' && !spec.lastSession ? spec.latest : spec.previousClose;
  baseAnchors.set(lastIndex, finalClose);
  if (calendar === 'EU' && !spec.lastSession && lastIndex > 0) {
    baseAnchors.set(lastIndex - 1, spec.previousClose);
  }
  for (const [date, close] of Object.entries(spec.anchors ?? {})) {
    const index = days.indexOf(date);
    if (index > 0 && index < lastIndex) baseAnchors.set(index, close);
  }
  if (spec.shape) {
    const from = days.indexOf(spec.shape.from);
    const to = days.indexOf(spec.shape.to);
    if (from > 0 && to > from && to < lastIndex) {
      const { drift, amplitude } = spec.shape;
      const texture = (n: number) =>
        1 +
        amplitude * (Math.sin(n / 2.3) + 0.6 * Math.sin(n / 1.1 + 1) + 0.4 * Math.sin(n / 0.7 + 2));
      // Choose the level so extrapolating the shape to the final anchor lands on it.
      const level = finalClose / (Math.exp(drift * (lastIndex - from)) * texture(lastIndex - from));
      for (let n = 0; n <= to - from; n += 1) {
        baseAnchors.set(from + n, round(level * Math.exp(drift * n) * texture(n)));
      }
    }
  }

  // Pass 1: base path. Pass 2: add archive entry/exit anchors measured on pass 1.
  const flatOpen = new Set<string>();
  let closes = bridge(days.length, baseAnchors, dailySigma, z);
  if (instrumentId) {
    const anchors = new Map(baseAnchors);
    for (const { window, target } of archiveAnchorsFor(
      instrumentId,
      calendar,
      spec.lastSession ?? null,
    )) {
      const prior = days.indexOf(window.priorDate);
      const exit = days.indexOf(window.exitDate);
      if (prior < 0 || exit < 0) continue;
      const priorClose = anchors.get(prior) ?? round(closes[prior]!);
      anchors.set(prior, priorClose);
      if (!anchors.has(exit)) anchors.set(exit, round(priorClose * (1 + target / 100)));
      flatOpen.add(window.entryDate);
    }
    closes = bridge(days.length, anchors, dailySigma, z);
  }

  const daily: DailyBar[] = days.map((date, i) => {
    const close = round(closes[i]!);
    const previous = i === 0 ? close : round(closes[i - 1]!);
    const open = flatOpen.has(date)
      ? previous
      : round(previous * Math.exp(dailySigma * 0.3 * gapZ[i]!));
    return { date, open, close, closesAt: sessionTimes(calendar, date).closesAt };
  });

  // Intraday observations for the last sessions plus the demo session.
  const intraday: IntradaySession[] = [];
  const recent = daily.slice(-5);
  const sessionsForIntraday = calendar === 'US' && !spec.lastSession ? recent.slice(-4) : recent;
  sessionsForIntraday.forEach((bar, index) => {
    intraday.push(
      intradaySession(calendar, bar.date, bar.open, bar.close, spec, key, index, undefined),
    );
  });

  let demoSession: IntradaySession | null = null;
  if (!spec.lastSession) {
    if (calendar === 'US') {
      const open =
        spec.intraday?.[0] ??
        round(spec.previousClose * Math.exp(dailySigma * 0.3 * gapZ[lastIndex + 1]!));
      const close = spec.sessionClose ?? spec.latest;
      const anchors: Record<number, number> = {
        ...(spec.intraday ?? {}),
        0: open,
        295: spec.latest,
        390: close,
      };
      demoSession = intradaySession(
        calendar,
        DEMO_SESSION_DATE,
        open,
        close,
        spec,
        key,
        9,
        anchors,
      );
      intraday.push(demoSession);
    } else {
      demoSession = intraday[intraday.length - 1] ?? null;
    }
  }

  return {
    calendar,
    timeZone,
    daily,
    intraday,
    demoSession,
    previousClose: spec.previousClose,
    listedOn: spec.listedOn ?? null,
    lastSession: spec.lastSession ?? null,
  };
}

function intradaySession(
  calendar: CalendarId,
  date: string,
  open: number,
  close: number,
  spec: PriceSpec,
  key: string,
  salt: number,
  anchorOverrides: Record<number, number> | undefined,
): IntradaySession {
  const times = sessionTimes(calendar, date);
  const minutes = Math.round((times.closesAt - times.opensAt) / MINUTE);
  const steps = Math.floor(minutes / STEP);
  const sigma = (spec.annualVol / Math.sqrt(252 * 78)) * 0.55;
  const z = gaussians(spec.seed * 31 + salt * 977 + key.length, steps + 4);
  const anchors = new Map<number, number>();
  const source = anchorOverrides ?? { 0: open, [steps * STEP]: close };
  for (const [minute, value] of Object.entries(source))
    anchors.set(Math.round(Number(minute) / STEP), value);
  anchors.set(0, anchors.get(0) ?? open);
  anchors.set(steps, anchors.get(steps) ?? close);
  const values = bridge(steps + 1, anchors, sigma, z);
  return {
    date,
    opensAt: times.opensAt,
    closesAt: times.closesAt,
    samples: values.map((value, i) => ({ t: times.opensAt + i * STEP * MINUTE, v: round(value) })),
  };
}

const cache = new Map<string, PricePath>();

export function instrumentPath(instrumentId: string): PricePath | null {
  const cached = cache.get(instrumentId);
  if (cached) return cached;
  const instrument = INSTRUMENT_BY_ID.get(instrumentId);
  if (!instrument?.price) return null;
  const path = generatePath(instrumentId, instrument.price, instrumentId);
  cache.set(instrumentId, path);
  return path;
}

export function indexPath(indexId: string): PricePath | null {
  const cached = cache.get(indexId);
  if (cached) return cached;
  const index = INDEX_BY_ID.get(indexId);
  if (!index) return null;
  const path = generatePath(indexId, index.price, null);
  cache.set(indexId, path);
  return path;
}

export function anyPath(id: string): PricePath | null {
  return id.startsWith('idx_') ? indexPath(id) : instrumentPath(id);
}

/** Latest observation at or before `now` in a session; null before the open. */
export function observationAt(session: IntradaySession, now: number): Sample | null {
  let latest: Sample | null = null;
  for (const sample of session.samples) {
    if (sample.t > now) break;
    if (sample.v != null) latest = sample;
  }
  return latest;
}

export function dailyClose(path: PricePath, date: string): DailyBar | null {
  return path.daily.find((bar) => bar.date === date) ?? null;
}

export function dailyOpen(path: PricePath, date: string): number | null {
  return dailyClose(path, date)?.open ?? null;
}

/** Close for a date, including the demo session's close when it has finished. */
export function closeOn(path: PricePath, date: string, now: number): number | null {
  const bar = dailyClose(path, date);
  if (bar) return bar.close;
  if (path.demoSession && path.demoSession.date === date && now >= path.demoSession.closesAt) {
    const last = path.demoSession.samples[path.demoSession.samples.length - 1];
    return last?.v ?? null;
  }
  return null;
}

export function openOn(path: PricePath, date: string, now: number): number | null {
  const bar = dailyClose(path, date);
  if (bar) return bar.open;
  if (path.demoSession && path.demoSession.date === date && now >= path.demoSession.opensAt) {
    return path.demoSession.samples[0]?.v ?? null;
  }
  return null;
}

export function sessionCloseInstant(calendar: CalendarId, date: string): number {
  return sessionTimes(calendar, date).closesAt;
}

export function wallInstant(date: string, hour: number, minute: number, timeZone: string): number {
  return zonedTimeToInstant({ ...dateKeyToWall(date), hour, minute }, timeZone).instant;
}
