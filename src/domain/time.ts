/**
 * IANA time-zone arithmetic built on Intl (spec pages 26, 38, 52).
 *
 * Instants are epoch milliseconds (UTC). Wall times are local calendar fields in a named zone.
 * Rules for ambiguous local times (page 38): a skipped DST time resolves to the first valid time
 * afterwards; a repeated time resolves to its first occurrence.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

export interface ZonedParts extends WallTime {
  second: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(instant: number, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(new Date(instant));
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '0';
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')) % 24,
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekday: WEEKDAYS[value('weekday')] ?? 0,
  };
}

/** Offset of the zone from UTC at an instant, in minutes (Ljubljana summer = +120). */
export function zoneOffsetMinutes(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant / 1000) * 1000;
  return Math.round((asUtc - truncated) / MINUTE);
}

function wallKey(w: WallTime): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
}

function wallAt(instant: number, timeZone: string): number {
  return wallKey(zonedParts(instant, timeZone));
}

export type WallResolution = 'exact' | 'skipped' | 'repeated';

/** Convert a local wall time in a zone to an instant, applying the page-38 DST rules. */
export function zonedTimeToInstant(
  wall: WallTime,
  timeZone: string,
): { instant: number; resolution: WallResolution } {
  const target = wallKey(wall);
  const offsets = new Set([
    zoneOffsetMinutes(target - DAY, timeZone),
    zoneOffsetMinutes(target, timeZone),
    zoneOffsetMinutes(target + DAY, timeZone),
  ]);
  const matches = [...offsets]
    .map((offset) => target - offset * MINUTE)
    .filter((instant) => wallAt(instant, timeZone) === target)
    .sort((a, b) => a - b);

  const first = matches[0];
  if (first !== undefined) {
    return { instant: first, resolution: matches.length > 1 ? 'repeated' : 'exact' };
  }

  // Skipped: find the first instant whose local wall time is at or after the target.
  let lo = target - 15 * HOUR;
  let hi = target + 15 * HOUR;
  while (hi - lo > MINUTE) {
    const mid = Math.floor((lo + hi) / 2 / MINUTE) * MINUTE;
    if (wallAt(mid, timeZone) >= target) hi = mid;
    else lo = mid;
  }
  return { instant: hi, resolution: 'skipped' };
}

export function parseClock(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function addDays(wall: WallTime, days: number): WallTime {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return {
    ...wall,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** The next instant strictly after `after` at which the local clock reads `clock` (HH:MM). */
export function nextLocalOccurrence(after: number, clock: string, timeZone: string): number {
  const parsed = parseClock(clock);
  if (!parsed) throw new RangeError(`Invalid clock time: ${clock}`);
  const today = zonedParts(after, timeZone);
  for (let offset = 0; offset < 3; offset += 1) {
    const day = addDays(today, offset);
    const { instant } = zonedTimeToInstant({ ...day, ...parsed }, timeZone);
    if (instant > after) return instant;
  }
  throw new Error('Unable to resolve next local occurrence');
}

export interface QuietHours {
  enabled: boolean;
  start: string; // HH:MM local
  end: string; // HH:MM local
  timeZone: string;
}

function minutesOfDay(clock: string): number {
  const parsed = parseClock(clock);
  if (!parsed) throw new RangeError(`Invalid clock time: ${clock}`);
  return parsed.hour * 60 + parsed.minute;
}

/** Quiet hours may span midnight (22:00–07:00). Equal start and end means no quiet period. */
export function isWithinQuietHours(instant: number, quiet: QuietHours): boolean {
  if (!quiet.enabled) return false;
  const start = minutesOfDay(quiet.start);
  const end = minutesOfDay(quiet.end);
  if (start === end) return false;
  const p = zonedParts(instant, quiet.timeZone);
  const now = p.hour * 60 + p.minute;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Earliest instant at or after `instant` when external delivery is permitted. */
export function nextPermittedDelivery(instant: number, quiet: QuietHours): number {
  if (!isWithinQuietHours(instant, quiet)) return instant;
  return nextLocalOccurrence(instant, quiet.end, quiet.timeZone);
}

export function sameLocalDay(a: number, b: number, timeZone: string): boolean {
  const pa = zonedParts(a, timeZone);
  const pb = zonedParts(b, timeZone);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(instant: number, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function dateKeyToWall(key: string, hour = 0, minute = 0): WallTime {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) throw new RangeError(`Invalid date key: ${key}`);
  return { year, month, day, hour, minute };
}

export function addDaysToKey(key: string, days: number): string {
  const wall = addDays(dateKeyToWall(key), days);
  return `${wall.year}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`;
}

export function weekdayOfKey(key: string): number {
  const wall = dateKeyToWall(key);
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
}
