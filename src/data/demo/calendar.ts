import { addDaysToKey, weekdayOfKey, zonedTimeToInstant, dateKeyToWall } from '@/domain/time';

/**
 * Exchange calendars for the demo dataset (2025-10 to 2026-12). Holidays and early closes are
 * modelled so charts never synthesize quotes for closed sessions (spec pages 23, 48, 60).
 */

export type CalendarId = 'US' | 'EU';

interface CalendarSpec {
  timeZone: string;
  open: { hour: number; minute: number };
  close: { hour: number; minute: number };
  earlyClose: { hour: number; minute: number };
  holidays: Set<string>;
  earlyCloses: Set<string>;
}

const CALENDARS: Record<CalendarId, CalendarSpec> = {
  US: {
    timeZone: 'America/New_York',
    open: { hour: 9, minute: 30 },
    close: { hour: 16, minute: 0 },
    earlyClose: { hour: 13, minute: 0 },
    holidays: new Set([
      '2025-11-27',
      '2025-12-25',
      '2026-01-01',
      '2026-01-19',
      '2026-02-16',
      '2026-04-03',
      '2026-05-25',
      '2026-06-19',
      '2026-07-03',
      '2026-09-07',
      '2026-11-26',
      '2026-12-25',
    ]),
    earlyCloses: new Set(['2025-11-28', '2025-12-24', '2026-11-27', '2026-12-24']),
  },
  EU: {
    timeZone: 'Europe/Amsterdam',
    open: { hour: 9, minute: 0 },
    close: { hour: 17, minute: 30 },
    earlyClose: { hour: 14, minute: 0 },
    holidays: new Set([
      '2025-12-25',
      '2025-12-26',
      '2026-01-01',
      '2026-04-03',
      '2026-04-06',
      '2026-05-01',
      '2026-12-25',
      '2026-12-26',
    ]),
    earlyCloses: new Set(['2025-12-24', '2025-12-31', '2026-12-24', '2026-12-31']),
  },
};

export function calendarTimeZone(id: CalendarId): string {
  return CALENDARS[id].timeZone;
}

export function isTradingDay(id: CalendarId, dateKey: string): boolean {
  const weekday = weekdayOfKey(dateKey);
  if (weekday === 0 || weekday === 6) return false;
  return !CALENDARS[id].holidays.has(dateKey);
}

export function isHoliday(id: CalendarId, dateKey: string): boolean {
  return CALENDARS[id].holidays.has(dateKey);
}

export interface SessionTimes {
  date: string;
  opensAt: number;
  closesAt: number;
  early: boolean;
}

// Session times and trading-day ranges are pure functions of their inputs; the demo world asks
// for the same dates thousands of times while building price paths, so both are memoised.
const sessionCache = new Map<string, SessionTimes>();
const rangeCache = new Map<string, readonly string[]>();

export function sessionTimes(id: CalendarId, dateKey: string): SessionTimes {
  const cacheKey = `${id}:${dateKey}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;
  const result = computeSessionTimes(id, dateKey);
  sessionCache.set(cacheKey, result);
  return result;
}

function computeSessionTimes(id: CalendarId, dateKey: string): SessionTimes {
  const spec = CALENDARS[id];
  const early = spec.earlyCloses.has(dateKey);
  const close = early ? spec.earlyClose : spec.close;
  const opensAt = zonedTimeToInstant(
    { ...dateKeyToWall(dateKey), ...spec.open },
    spec.timeZone,
  ).instant;
  const closesAt = zonedTimeToInstant(
    { ...dateKeyToWall(dateKey), ...close },
    spec.timeZone,
  ).instant;
  return { date: dateKey, opensAt, closesAt, early };
}

/** Trading days from `start` to `end` inclusive (a fresh array the caller may modify). */
export function tradingDays(id: CalendarId, start: string, end: string): string[] {
  const cacheKey = `${id}:${start}:${end}`;
  const cached = rangeCache.get(cacheKey);
  if (cached) return [...cached];
  const days: string[] = [];
  for (let key = start; key <= end; key = addDaysToKey(key, 1)) {
    if (isTradingDay(id, key)) days.push(key);
  }
  rangeCache.set(cacheKey, days);
  return [...days];
}

export function nextTradingDay(id: CalendarId, after: string): string {
  let key = addDaysToKey(after, 1);
  while (!isTradingDay(id, key)) key = addDaysToKey(key, 1);
  return key;
}

export function previousTradingDay(id: CalendarId, before: string): string {
  let key = addDaysToKey(before, -1);
  while (!isTradingDay(id, key)) key = addDaysToKey(key, -1);
  return key;
}
