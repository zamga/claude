import { describe, expect, it } from 'vitest';
import {
  armRule,
  DEFAULT_COOLDOWN_MS,
  earningsReminderAt,
  evaluatePriceRule,
  evaluateSequence,
  isDuplicateRule,
  nextRetryAt,
  planDeliveries,
  validateThreshold,
  type PriceObservation,
  type PriceRuleState,
} from '../alerts';

const base = {
  id: 'rule-1',
  instrumentId: 'ins-nvda',
  comparator: 'cross_above' as const,
  threshold: '100',
  repeat: 'once' as const,
  cooldownMs: DEFAULT_COOLDOWN_MS,
};

const obs = (id: string, price: string, t: number, fresh = true): PriceObservation => ({
  id,
  instrumentId: 'ins-nvda',
  price,
  observedAt: t,
  fresh,
  inSession: true,
});

describe('F02 crossing and dedupe', () => {
  it('fresh prices 99, 100, 101 produce exactly one event at 100', () => {
    const { rule } = armRule(base, null);
    const issued = new Set<string>();
    const result = evaluateSequence(
      rule,
      [obs('o1', '99', 1), obs('o2', '100', 2), obs('o3', '101', 3)],
      issued,
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ price: '100', observationId: 'o2' });
    expect(result.rule.state).toBe('fired');
  });

  it('reprocessing the same observation does not create a second event', () => {
    const { rule } = armRule(base, obs('o1', '99', 1));
    const issued = new Set<string>();
    const first = evaluateSequence(rule, [obs('o2', '100', 2)], issued);
    // A retried worker re-evaluates the same observation from the pre-commit rule state.
    const retried = evaluateSequence(rule, [obs('o2', '100', 2)], issued);
    expect(first.events).toHaveLength(1);
    expect(retried.events).toHaveLength(0);
    // And from the committed state the one-shot rule never fires again.
    expect(
      evaluateSequence(first.rule, [obs('o4', '99', 4), obs('o5', '102', 5)], issued).events,
    ).toHaveLength(0);
  });
});

describe('arming and baselines', () => {
  it('a rule created above a cross-above threshold waits for a new crossing from below', () => {
    const armed = armRule(base, obs('o1', '105', 1));
    expect(armed.alreadyBeyond).toBe(true);
    const r1 = evaluatePriceRule(armed.rule, obs('o2', '106', 2));
    expect(r1.event).toBeNull();
    const r2 = evaluatePriceRule(r1.rule, obs('o3', '99.5', 3));
    const r3 = evaluatePriceRule(r2.rule, obs('o4', '100.01', 4));
    expect(r3.event?.observationId).toBe('o4');
  });

  it('a stale observation re-baselines instead of claiming an unseen crossing', () => {
    const { rule } = armRule(base, obs('o1', '95', 1));
    const gap = evaluatePriceRule(rule, obs('o2', '120', 2, false));
    expect(gap.event).toBeNull();
    expect(gap.rule.lastSide).toBeNull();
    const after = evaluatePriceRule(gap.rule, obs('o3', '121', 3));
    expect(after.event).toBeNull();
    expect(after.rule.lastSide).toBe('beyond');
  });

  it('cross-below fires when the previous price was above and the current is at or below', () => {
    const { rule } = armRule(
      { ...base, comparator: 'cross_below', threshold: '100' },
      obs('o1', '101', 1),
    );
    expect(evaluatePriceRule(rule, obs('o2', '100', 2)).event).not.toBeNull();
  });

  it('paused rules do not evaluate', () => {
    const { rule } = armRule(base, obs('o1', '99', 1));
    const paused: PriceRuleState = { ...rule, state: 'paused' };
    expect(evaluatePriceRule(paused, obs('o2', '101', 2)).event).toBeNull();
  });

  it('repeating rules need the opposite side and the cooldown before firing again', () => {
    const { rule } = armRule({ ...base, repeat: 'repeating' }, obs('o1', '99', 0));
    const minute = 60_000;
    const seq = [
      obs('o2', '101', 1 * minute), // fires
      obs('o3', '99', 2 * minute),
      obs('o4', '101', 3 * minute), // within 5-minute cooldown: suppressed
      obs('o5', '99', 7 * minute),
      obs('o6', '102', 8 * minute), // fires again
    ];
    const result = evaluateSequence(rule, seq);
    expect(result.events.map((event) => event.observationId)).toEqual(['o2', 'o6']);
    expect(result.rule.state).toBe('armed');
  });
});

describe('threshold validation', () => {
  const rules = { symbol: 'NVDA', pricePrecision: 2, tickSize: '0.01' };
  it('requires a finite positive decimal', () => {
    expect(validateThreshold('', rules)).toEqual({ ok: false, message: 'Enter a price.' });
    expect(validateThreshold('abc', rules)).toEqual({ ok: false, message: 'Enter a valid price.' });
    expect(validateThreshold('0', rules)).toEqual({
      ok: false,
      message: 'Enter a price greater than zero.',
    });
    expect(validateThreshold('-5', rules)).toEqual({
      ok: false,
      message: 'Enter a price greater than zero.',
    });
  });
  it('explains an invalid increment instead of rounding', () => {
    const result = validateThreshold('150.005', rules);
    expect(result.ok).toBe(false);
  });
  it('accepts and normalises a valid price', () => {
    expect(validateThreshold('$1,150.5', rules)).toEqual({ ok: true, value: '1150.50' });
  });
});

describe('duplicate rules', () => {
  const a = {
    instrumentId: 'i',
    comparator: 'cross_above' as const,
    threshold: '150.00',
    repeat: 'once' as const,
    channels: ['push', 'inbox'] as const,
  };
  it('compares decimal thresholds and channel sets', () => {
    expect(isDuplicateRule(a, { ...a, threshold: '150', channels: ['inbox', 'push'] })).toBe(true);
    expect(isDuplicateRule(a, { ...a, channels: ['inbox'] })).toBe(false);
    expect(isDuplicateRule(a, { ...a, repeat: 'repeating' })).toBe(false);
  });
});

describe('delivery planning', () => {
  const quiet = { enabled: true, start: '22:00', end: '07:00', timeZone: 'Europe/Ljubljana' };
  const prefs = {
    channels: [
      { channel: 'push' as const, destination: 'device-1', enabled: true },
      { channel: 'email' as const, destination: 'alex@example.com', enabled: false },
    ],
    quietHours: quiet,
  };

  it('defers external delivery during quiet hours but never the inbox', () => {
    const occurred = Date.UTC(2026, 9, 20, 21, 0); // 23:00 CEST
    const jobs = planDeliveries('evt', occurred, 'user-1', prefs);
    expect(jobs.map((job) => job.channel)).toEqual(['inbox', 'push']);
    expect(jobs[0]!.availableAt).toBe(occurred);
    expect(jobs[1]!.deferredByQuietHours).toBe(true);
    expect(jobs[1]!.availableAt).toBe(Date.UTC(2026, 9, 21, 5, 0)); // 07:00 CEST next day
  });

  it('uses stable dedupe keys per event, channel and destination', () => {
    const jobs = planDeliveries('evt', Date.UTC(2026, 9, 21, 12), 'user-1', prefs);
    expect(jobs.map((job) => job.dedupeKey)).toEqual(['evt:inbox:user-1', 'evt:push:device-1']);
  });

  it('retries transient failures at 1, 5 and 30 minutes, then stops', () => {
    expect(nextRetryAt(1, 0)).toBe(60_000);
    expect(nextRetryAt(2, 0)).toBe(300_000);
    expect(nextRetryAt(3, 0)).toBe(1_800_000);
    expect(nextRetryAt(4, 0)).toBeNull();
  });
});

describe('earnings reminders', () => {
  it('defaults to 24 h before a confirmed time', () => {
    const confirmed = Date.UTC(2026, 9, 21, 20, 20);
    expect(
      earningsReminderAt({ confirmedAt: confirmed, date: '2026-10-21' }, 'Europe/Ljubljana'),
    ).toEqual({
      at: confirmed - 86_400_000,
      timeConfirmed: true,
    });
  });
  it('uses 08:00 user-local on the date when only the date is known', () => {
    const result = earningsReminderAt(
      { confirmedAt: null, date: '2026-10-27' },
      'Europe/Ljubljana',
    );
    expect(result).toEqual({ at: Date.UTC(2026, 9, 27, 7, 0), timeConfirmed: false }); // CET after 25 Oct
  });
});
