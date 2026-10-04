import { dec } from '@/domain/decimal';
import { formatClockWithZone, formatWeekdayDate } from '@/domain/format';
import {
  addDaysToKey,
  dateKeyToWall,
  localDateKey,
  weekdayOfKey,
  zonedTimeToInstant,
} from '@/domain/time';
import type { EarningsEvent, ReleaseTiming } from '@/data/types';

/**
 * Earnings calendar selection and labelling (spec pages 31, 50). The calendar's selected week,
 * day and view live in the URL so Back, reload and the wide-screen default detail agree.
 */

export type EarningsView = 'upcoming' | 'reported';

export const MARKET_ZONE = 'America/New_York';

export const TIMING_LABEL: Record<ReleaseTiming, string> = {
  before_open: 'Before open',
  after_close: 'After close',
  during_session: 'During session',
  unconfirmed: 'Time unconfirmed',
};

/** Monday of the week containing the date key. */
export function weekStartOf(key: string): string {
  const weekday = weekdayOfKey(key); // 0 = Sunday
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDaysToKey(key, offset);
}

export function isWeekKey(value: string | null): value is string {
  return value != null && /^\d{4}-\d{2}-\d{2}$/.test(value) && weekdayOfKey(value) === 1;
}

export interface EarningsSelection {
  week: string;
  day: string;
  view: EarningsView;
  /** True when the view came from the URL rather than the day-based default. */
  explicitView: boolean;
  today: string;
}

/** Resolve the calendar state from the URL; defaults follow the demo market clock. */
export function resolveEarningsSelection(params: URLSearchParams, now: number): EarningsSelection {
  const today = localDateKey(now, MARKET_ZONE);
  const currentWeek = weekStartOf(today);
  const requestedWeek = params.get('week');
  const week = isWeekKey(requestedWeek) ? requestedWeek : currentWeek;
  const days = [0, 1, 2, 3, 4].map((offset) => addDaysToKey(week, offset));
  const requestedDay = params.get('day');
  const day =
    requestedDay && days.includes(requestedDay)
      ? requestedDay
      : days.includes(today)
        ? today
        : days[0]!;
  const rawView = params.get('view');
  const explicitView = rawView === 'upcoming' || rawView === 'reported';
  const view: EarningsView = explicitView
    ? (rawView as EarningsView)
    : day < today
      ? 'reported'
      : 'upcoming';
  return { week, day, view, explicitView, today };
}

export function isReported(event: EarningsEvent): boolean {
  return event.status === 'reported';
}

export function eventsForDay(
  events: readonly EarningsEvent[],
  day: string,
  view: EarningsView,
): EarningsEvent[] {
  return events.filter(
    (event) => event.date === day && (view === 'reported' ? isReported(event) : !isReported(event)),
  );
}

/** Noon of a date key in the market zone (for weekday/date labels that must not drift). */
export function dayInstant(key: string, timeZone = MARKET_ZONE): number {
  return zonedTimeToInstant(dateKeyToWall(key, 12, 0), timeZone).instant;
}

export function dayLabel(key: string, timeZone = MARKET_ZONE): string {
  return formatWeekdayDate(dayInstant(key, timeZone), timeZone);
}

/** "After close · 16:20 ET", "Before open · 07:00 CET", "Time unconfirmed". */
export function releaseTimingText(event: EarningsEvent): string {
  if (!event.dateConfirmed) return 'Date unconfirmed';
  if (!event.timeConfirmed || !event.expectedAt)
    return TIMING_LABEL[event.timing === 'unconfirmed' ? 'unconfirmed' : event.timing];
  return `${TIMING_LABEL[event.timing]} · ${formatClockWithZone(Date.parse(event.expectedAt), event.timeZone)}`;
}

/** Surprise against an estimate. Missing estimates or actuals produce no surprise (spec page 31). */
export function surprisePct(
  actual: string | null | undefined,
  estimate: string | null | undefined,
): string | null {
  if (actual == null || estimate == null) return null;
  const est = dec(estimate);
  if (est.eq(0)) return null;
  return dec(actual).div(est.abs()).minus(est.div(est.abs())).times(100).toFixed(4);
}

export const GUIDANCE_LABEL: Record<NonNullable<EarningsEvent['guidance']>['direction'], string> = {
  raised: 'Raised',
  maintained: 'Maintained',
  lowered: 'Lowered',
  withdrawn: 'Withdrawn',
  none: 'Not given',
};

export const GUIDANCE_TONE: Record<
  NonNullable<EarningsEvent['guidance']>['direction'],
  'positive' | 'neutral' | 'negative'
> = {
  raised: 'positive',
  maintained: 'neutral',
  lowered: 'negative',
  withdrawn: 'negative',
  none: 'neutral',
};
