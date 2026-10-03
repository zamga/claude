import { dec, tryDec, type DecimalInput } from './decimal';
import { zonedParts } from './time';

/**
 * Display formatting. Values are rounded only here, for display (spec page 35).
 * Missing values render as an em dash with an accessible "unavailable" label, never as zero.
 */

export const MINUS = '−';
export const UNAVAILABLE = '—';
export const NUMBER_LOCALE = 'en-US';
export const DATE_LOCALE = 'en-GB';

export type CurrencyCode = 'USD' | 'EUR';

const numberFormatters = new Map<string, Intl.NumberFormat>();

function numberFormatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(NUMBER_LOCALE, options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function toFixedNumber(value: DecimalInput, digits: number): number {
  return Number(dec(value).round(digits, 1).toFixed(digits));
}

/** "$142.80", "€648.20". The currency is always the instrument's native currency. */
export function formatMoney(
  value: DecimalInput | null | undefined,
  currency: CurrencyCode,
  digits = 2,
): string {
  if (value == null || (typeof value === 'string' && tryDec(value) == null)) return UNAVAILABLE;
  const amount = toFixedNumber(value, digits);
  const formatter = numberFormatter(`money:${currency}:${digits}`, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const text = formatter.format(Math.abs(amount));
  return amount < 0 ? `${MINUS}${text}` : text;
}

/** "+$296.00" / "−$12.40" for gains and losses. */
export function formatSignedMoney(
  value: DecimalInput | null | undefined,
  currency: CurrencyCode,
  digits = 2,
): string {
  if (value == null) return UNAVAILABLE;
  const amount = toFixedNumber(value, digits);
  const body = formatMoney(Math.abs(amount), currency, digits);
  if (amount > 0) return `+${body}`;
  if (amount < 0) return `${MINUS}${body}`;
  return body;
}

/** Compact money for large figures: "$1.2B", "$30.0B", "$8.0M". */
export function formatCompactMoney(
  value: DecimalInput | null | undefined,
  currency: CurrencyCode,
  digits = 1,
): string {
  if (value == null) return UNAVAILABLE;
  const amount = Number(dec(value).toString());
  const formatter = numberFormatter(`compact:${currency}:${digits}`, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return formatter.format(amount);
}

export function formatCompactNumber(value: DecimalInput | null | undefined, digits = 1): string {
  if (value == null) return UNAVAILABLE;
  const formatter = numberFormatter(`compactn:${digits}`, {
    notation: 'compact',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return formatter.format(Number(dec(value).toString()));
}

export function formatNumber(
  value: DecimalInput | null | undefined,
  digits = 2,
  minDigits = digits,
): string {
  if (value == null) return UNAVAILABLE;
  const amount = toFixedNumber(value, digits);
  const formatter = numberFormatter(`num:${digits}:${minDigits}`, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: digits,
  });
  const text = formatter.format(Math.abs(amount));
  return amount < 0 ? `${MINUS}${text}` : text;
}

/** Quantities keep up to six fractional digits without padding: "20", "0.125". */
export function formatQuantity(value: DecimalInput | null | undefined): string {
  return formatNumber(value, 6, 0);
}

/** "+2.34%", "−0.48%", "0.00%". */
export function formatPercent(value: DecimalInput | null | undefined, digits = 2): string {
  if (value == null) return UNAVAILABLE;
  const amount = toFixedNumber(value, digits);
  const body = `${formatNumber(Math.abs(amount), digits)}%`;
  if (amount > 0) return `+${body}`;
  if (amount < 0) return `${MINUS}${body}`;
  return body;
}

/** Unsigned percentage for shares and allocations: "14%". */
export function formatShare(value: DecimalInput | null | undefined, digits = 0): string {
  if (value == null) return UNAVAILABLE;
  return `${formatNumber(value, digits)}%`;
}

/** Percentage-point difference: "+1.6 pp". */
export function formatPoints(value: DecimalInput | null | undefined, digits = 1): string {
  if (value == null) return UNAVAILABLE;
  const amount = toFixedNumber(value, digits);
  const body = `${formatNumber(Math.abs(amount), digits)} pp`;
  if (amount > 0) return `+${body}`;
  if (amount < 0) return `${MINUS}${body}`;
  return body;
}

export function formatMultiple(value: DecimalInput | null | undefined, digits = 0): string {
  if (value == null) return UNAVAILABLE;
  return `${formatNumber(value, digits)}×`;
}

export type Direction = 'up' | 'down' | 'flat' | 'none';

export function direction(value: DecimalInput | null | undefined): Direction {
  if (value == null) return 'none';
  const amount = dec(value);
  if (amount.gt(0)) return 'up';
  if (amount.lt(0)) return 'down';
  return 'flat';
}

/** Words that pair with colour so direction is never carried by colour alone. */
export function directionWord(value: DecimalInput | null | undefined): string {
  switch (direction(value)) {
    case 'up':
      return 'up';
    case 'down':
      return 'down';
    case 'flat':
      return 'unchanged';
    default:
      return 'unavailable';
  }
}

// ---------- Dates and times ----------

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(DATE_LOCALE, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

const GENERIC_ZONE_LABELS: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  UTC: 'UTC',
};

/** Short zone label: "ET" for New York, "CEST"/"CET" for central Europe. */
export function zoneLabel(instant: number, timeZone: string): string {
  const generic = GENERIC_ZONE_LABELS[timeZone];
  if (generic) return generic;
  const parts = dateFormatter(`zone:${timeZone}`, {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(new Date(instant));
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}

/** "14:25" in the given zone (24-hour clock). */
export function formatClock(instant: number, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** "14:25 ET" */
export function formatClockWithZone(instant: number, timeZone: string): string {
  return `${formatClock(instant, timeZone)} ${zoneLabel(instant, timeZone)}`;
}

/** "21 Oct" */
export function formatDayMonth(instant: number, timeZone: string): string {
  return dateFormatter(`dm:${timeZone}`, { timeZone, day: 'numeric', month: 'short' }).format(
    new Date(instant),
  );
}

/** "21 Oct 2026" */
export function formatDate(instant: number, timeZone: string): string {
  return dateFormatter(`dmy:${timeZone}`, {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(instant));
}

/** "Wed 21 Oct" */
export function formatWeekdayDate(instant: number, timeZone: string): string {
  return dateFormatter(`wdm:${timeZone}`, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(instant))
    .replace(',', '');
}

/** "Wed 21 Oct 2026, 14:25 ET" */
export function formatDateTime(instant: number, timeZone: string): string {
  return `${formatWeekdayDate(instant, timeZone)} ${zonedParts(instant, timeZone).year}, ${formatClockWithZone(instant, timeZone)}`;
}

/** "October 2026" */
export function formatMonthYear(instant: number, timeZone: string): string {
  return dateFormatter(`my:${timeZone}`, { timeZone, month: 'long', year: 'numeric' }).format(
    new Date(instant),
  );
}

export function formatMonth(instant: number, timeZone: string): string {
  return dateFormatter(`m:${timeZone}`, { timeZone, month: 'short' }).format(new Date(instant));
}

/** Weekday abbreviation for date strips: "WED". */
export function formatWeekdayShort(instant: number, timeZone: string): string {
  return dateFormatter(`wd:${timeZone}`, { timeZone, weekday: 'short' })
    .format(new Date(instant))
    .toUpperCase();
}

/** Relative day label used in inboxes: Today, Yesterday, or a date. */
export function relativeDayLabel(instant: number, now: number, timeZone: string): string {
  const a = zonedParts(instant, timeZone);
  const b = zonedParts(now, timeZone);
  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  const diff = Math.round((dayB - dayA) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatWeekdayDate(instant, timeZone);
}

/** Minutes/seconds in prose: "15 minutes", "1 hour 30 minutes". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = `${hours} hour${hours === 1 ? '' : 's'}`;
  return rest === 0 ? hourText : `${hourText} ${rest} minute${rest === 1 ? '' : 's'}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
