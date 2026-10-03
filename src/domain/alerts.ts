import { dec, fractionDigits, isDecimalString, isMultipleOf } from './decimal';
import { HOUR, nextPermittedDelivery, zonedTimeToInstant, type QuietHours } from './time';

/**
 * Server alert engine rules (spec pages 26, 38, 52). Pure functions: the caller persists the
 * returned rule state and enforces unique event keys, so reprocessing is harmless.
 */

export type Comparator = 'cross_above' | 'cross_below';
export type RepeatMode = 'once' | 'repeating';
export type RuleState = 'armed' | 'paused' | 'fired' | 'expired';
export type Side = 'pre' | 'beyond';
export type Channel = 'inbox' | 'push' | 'email';

export const DEFAULT_COOLDOWN_MS = 5 * 60_000;

export interface PriceRuleState {
  id: string;
  instrumentId: string;
  comparator: Comparator;
  threshold: string;
  repeat: RepeatMode;
  cooldownMs: number;
  state: RuleState;
  /** Relation of the last fresh observation to the threshold; null means "re-baseline". */
  lastSide: Side | null;
  baselineObservationId: string | null;
  lastFiredAt: number | null;
}

export interface PriceObservation {
  id: string;
  instrumentId: string;
  price: string;
  observedAt: number;
  /** False for stale, cached or gap-adjacent observations; these only re-baseline. */
  fresh: boolean;
  inSession: boolean;
}

export interface PriceAlertEvent {
  key: string;
  ruleId: string;
  instrumentId: string;
  observationId: string;
  type: 'price_cross';
  comparator: Comparator;
  threshold: string;
  price: string;
  occurredAt: number;
}

export function sideOf(price: string, comparator: Comparator, threshold: string): Side {
  const p = dec(price);
  const t = dec(threshold);
  if (comparator === 'cross_above') return p.lt(t) ? 'pre' : 'beyond';
  return p.gt(t) ? 'pre' : 'beyond';
}

export function eventKey(ruleId: string, observationId: string, type = 'price_cross'): string {
  return `${ruleId}:${observationId}:${type}`;
}

/** Arm a new or edited rule against the latest valid observation. Editing resets the baseline. */
export function armRule(
  rule: Omit<PriceRuleState, 'state' | 'lastSide' | 'baselineObservationId' | 'lastFiredAt'>,
  latest: PriceObservation | null,
): { rule: PriceRuleState; alreadyBeyond: boolean } {
  const usable =
    latest && latest.fresh && latest.instrumentId === rule.instrumentId ? latest : null;
  const side = usable ? sideOf(usable.price, rule.comparator, rule.threshold) : null;
  return {
    rule: {
      ...rule,
      state: 'armed',
      lastSide: side,
      baselineObservationId: usable?.id ?? null,
      lastFiredAt: null,
    },
    alreadyBeyond: side === 'beyond',
  };
}

/**
 * Evaluate one observation. Cross-above fires when the previous fresh price was below the
 * threshold and the current is at or above it (cross-below mirrors this). A one-shot rule fires
 * once; a repeating rule needs the price back on the opposite side and the cooldown to elapse.
 */
export function evaluatePriceRule(
  rule: PriceRuleState,
  observation: PriceObservation,
): { rule: PriceRuleState; event: PriceAlertEvent | null } {
  if (rule.state !== 'armed' || observation.instrumentId !== rule.instrumentId) {
    return { rule, event: null };
  }
  if (!observation.fresh || !observation.inSession) {
    // A feed gap or stale value re-baselines; never claim a crossing that was not observed.
    return { rule: { ...rule, lastSide: null, baselineObservationId: null }, event: null };
  }
  const side = sideOf(observation.price, rule.comparator, rule.threshold);
  if (rule.lastSide == null) {
    return {
      rule: { ...rule, lastSide: side, baselineObservationId: observation.id },
      event: null,
    };
  }
  const crossed = rule.lastSide === 'pre' && side === 'beyond';
  const coolingDown =
    rule.repeat === 'repeating' &&
    rule.lastFiredAt != null &&
    observation.observedAt - rule.lastFiredAt < rule.cooldownMs;
  if (!crossed || coolingDown) {
    return { rule: { ...rule, lastSide: side }, event: null };
  }
  const event: PriceAlertEvent = {
    key: eventKey(rule.id, observation.id),
    ruleId: rule.id,
    instrumentId: rule.instrumentId,
    observationId: observation.id,
    type: 'price_cross',
    comparator: rule.comparator,
    threshold: rule.threshold,
    price: observation.price,
    occurredAt: observation.observedAt,
  };
  return {
    rule: {
      ...rule,
      lastSide: side,
      lastFiredAt: observation.observedAt,
      state: rule.repeat === 'once' ? 'fired' : 'armed',
    },
    event,
  };
}

/** Apply a batch of observations, deduplicating against already-issued event keys. */
export function evaluateSequence(
  rule: PriceRuleState,
  observations: readonly PriceObservation[],
  issuedKeys: Set<string> = new Set(),
): { rule: PriceRuleState; events: PriceAlertEvent[] } {
  let current = rule;
  const events: PriceAlertEvent[] = [];
  for (const observation of observations) {
    const result = evaluatePriceRule(current, observation);
    current = result.rule;
    if (result.event && !issuedKeys.has(result.event.key)) {
      issuedKeys.add(result.event.key);
      events.push(result.event);
    }
  }
  return { rule: current, events };
}

// ---------- Validation ----------

export interface ThresholdRules {
  symbol: string;
  pricePrecision: number;
  tickSize: string;
}

export type ValidationResult = { ok: true; value: string } | { ok: false; message: string };

/** Finite positive decimal that respects the instrument's tick; never silently rounded. */
export function validateThreshold(input: string, rules: ThresholdRules): ValidationResult {
  const raw = input
    .trim()
    .replace(/^\$|^€/, '')
    .replace(/,/g, '');
  if (raw === '') return { ok: false, message: 'Enter a price.' };
  if (!isDecimalString(raw)) return { ok: false, message: 'Enter a valid price.' };
  const value = dec(raw);
  if (value.lte(0)) return { ok: false, message: 'Enter a price greater than zero.' };
  const tick = dec(rules.tickSize);
  if (fractionDigits(raw) > rules.pricePrecision || !isMultipleOf(value, tick)) {
    return {
      ok: false,
      message: `${rules.symbol} prices move in steps of ${rules.tickSize}. Enter a price with at most ${rules.pricePrecision} decimal places.`,
    };
  }
  return { ok: true, value: value.toFixed(rules.pricePrecision) };
}

export interface RuleIdentity {
  instrumentId: string;
  comparator: Comparator;
  threshold: string;
  repeat: RepeatMode;
  channels: readonly Channel[];
}

function sameChannels(a: readonly Channel[], b: readonly Channel[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((channel) => sb.has(channel));
}

/** Duplicate rule check (page 38): instrument, condition, threshold, repeat and channel. */
export function isDuplicateRule(a: RuleIdentity, b: RuleIdentity): boolean {
  return (
    a.instrumentId === b.instrumentId &&
    a.comparator === b.comparator &&
    dec(a.threshold).eq(dec(b.threshold)) &&
    a.repeat === b.repeat &&
    sameChannels(a.channels, b.channels)
  );
}

// ---------- Delivery planning ----------

export interface DeliveryJob {
  dedupeKey: string;
  eventKey: string;
  channel: Channel;
  destination: string;
  availableAt: number;
  deferredByQuietHours: boolean;
}

export interface DeliveryPreferences {
  channels: { channel: Exclude<Channel, 'inbox'>; destination: string; enabled: boolean }[];
  quietHours: QuietHours;
}

/**
 * One inbox row immediately, plus one job per enabled external channel. During quiet hours the
 * external jobs are deferred to the next permitted local time; the inbox is never deferred.
 */
export function planDeliveries(
  key: string,
  occurredAt: number,
  inboxOwner: string,
  preferences: DeliveryPreferences,
): DeliveryJob[] {
  const jobs: DeliveryJob[] = [
    {
      dedupeKey: `${key}:inbox:${inboxOwner}`,
      eventKey: key,
      channel: 'inbox',
      destination: inboxOwner,
      availableAt: occurredAt,
      deferredByQuietHours: false,
    },
  ];
  const permitted = nextPermittedDelivery(occurredAt, preferences.quietHours);
  for (const target of preferences.channels) {
    if (!target.enabled) continue;
    jobs.push({
      dedupeKey: `${key}:${target.channel}:${target.destination}`,
      eventKey: key,
      channel: target.channel,
      destination: target.destination,
      availableAt: permitted,
      deferredByQuietHours: permitted > occurredAt,
    });
  }
  return jobs;
}

/** Transient delivery failures retry at 1, 5 and 30 minutes, then the job is marked failed. */
export const RETRY_SCHEDULE_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;

export function nextRetryAt(attempt: number, failedAt: number): number | null {
  const delay = RETRY_SCHEDULE_MS[attempt - 1];
  return delay == null ? null : failedAt + delay;
}

// ---------- Event reminders ----------

export interface ScheduledEventTiming {
  /** Confirmed release instant, when known. */
  confirmedAt: number | null;
  /** Local calendar date of the event in the exchange zone (YYYY-MM-DD). */
  date: string;
}

/**
 * Earnings reminders default to 24 h before a confirmed time. With only a date, notify at
 * 08:00 in the user's zone on that date and label the time as unconfirmed.
 */
export function earningsReminderAt(
  timing: ScheduledEventTiming,
  userTimeZone: string,
): { at: number; timeConfirmed: boolean } {
  if (timing.confirmedAt != null) {
    return { at: timing.confirmedAt - 24 * HOUR, timeConfirmed: true };
  }
  const [year, month, day] = timing.date.split('-').map(Number);
  const { instant } = zonedTimeToInstant(
    { year: year!, month: month!, day: day!, hour: 8, minute: 0 },
    userTimeZone,
  );
  return { at: instant, timeConfirmed: false };
}
