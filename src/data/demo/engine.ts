import {
  earningsReminderAt,
  evaluatePriceRule,
  planDeliveries,
  type PriceObservation,
  type PriceRuleState,
} from '@/domain/alerts';
import { formatClockWithZone, formatMoney, formatWeekdayDate } from '@/domain/format';
import { dateKeyToWall, zonedTimeToInstant } from '@/domain/time';
import type { AlertRule, EarningsEvent, InboxItem, MailMessage } from '../types';
import { EARNINGS } from './content/editorial';
import type { DemoAccount, DemoDb, UserData } from './db';
import { newId } from './db';
import { INSTRUMENT_BY_ID } from './instruments';
import { FEED_DELAY_MS, type FeedState } from './market';
import { instrumentPath } from './prices';

/**
 * The demo stand-in for the server alert worker (spec page 52). It evaluates committed
 * observations in order, issues each event at most once (unique event keys) and records an
 * honest per-channel delivery status. In a live build this runs as a durable server job.
 */

function toRuleState(rule: AlertRule): PriceRuleState {
  return {
    id: rule.id,
    instrumentId: rule.instrumentId,
    comparator: rule.comparator!,
    threshold: rule.threshold!,
    repeat: rule.repeat,
    cooldownMs: rule.cooldownMinutes * 60_000,
    state: rule.state,
    lastSide: rule.lastSide,
    baselineObservationId: rule.baselineObservationId,
    lastFiredAt: rule.lastFiredAt,
  };
}

function observationsBetween(
  instrumentId: string,
  after: number,
  through: number,
  fresh: boolean,
): PriceObservation[] {
  const session = instrumentPath(instrumentId)?.demoSession;
  if (!session) return [];
  return session.samples
    .filter((sample) => sample.v != null && sample.t > after && sample.t <= through)
    .map((sample) => ({
      id: `${instrumentId}:${sample.t}`,
      instrumentId,
      price: sample.v!.toFixed(2),
      observedAt: sample.t,
      fresh,
      inSession: sample.t >= session.opensAt && sample.t <= session.closesAt,
    }));
}

function evaluationWindow(feed: FeedState, now: number): { through: number; fresh: boolean } {
  if (feed.mode === 'delayed') return { through: now - FEED_DELAY_MS, fresh: true };
  if (feed.mode === 'interrupted') return { through: feed.since ?? now, fresh: false };
  return { through: now, fresh: true };
}

export function runAlertEngine(db: DemoDb, now: number): boolean {
  let changed = false;
  const window = evaluationWindow(db.feed, now);
  for (const [accountId, user] of Object.entries(db.users)) {
    const account = db.accounts[accountId];
    if (!account || account.deletedAt) continue;
    if (window.through <= user.evaluatedThrough && window.fresh) continue;
    const issued = new Set(user.issuedEventKeys);
    for (let index = 0; index < user.alertRules.length; index += 1) {
      const rule = user.alertRules[index]!;
      if (rule.type !== 'price' || rule.state !== 'armed' || !rule.comparator || !rule.threshold)
        continue;
      let state = toRuleState(rule);
      if (!window.fresh) {
        // Stale feed: stop price-trigger evaluation and re-baseline once data is fresh again.
        if (state.lastSide !== null) {
          user.alertRules[index] = { ...rule, lastSide: null, baselineObservationId: null };
          changed = true;
        }
        continue;
      }
      const observations = observationsBetween(
        rule.instrumentId,
        user.evaluatedThrough,
        window.through,
        true,
      );
      for (const observation of observations) {
        const result = evaluatePriceRule(state, observation);
        state = result.rule;
        if (result.event && !issued.has(result.event.key)) {
          issued.add(result.event.key);
          user.issuedEventKeys.push(result.event.key);
          user.inbox.unshift(
            priceInboxItem(
              db,
              account,
              user,
              rule,
              result.event.price,
              result.event.occurredAt,
              result.event.key,
            ),
          );
        }
      }
      user.alertRules[index] = {
        ...rule,
        state: state.state,
        lastSide: state.lastSide,
        baselineObservationId: state.baselineObservationId,
        lastFiredAt: state.lastFiredAt,
        waitingForReset: state.lastSide === 'beyond' && state.state === 'armed',
        updatedAt:
          state.lastFiredAt !== rule.lastFiredAt ? new Date(now).toISOString() : rule.updatedAt,
      };
      changed = true;
    }
    if (evaluateEarningsReminders(db, account, user, now)) changed = true;
    if (window.fresh && window.through > user.evaluatedThrough) {
      user.evaluatedThrough = window.through;
      changed = true;
    }
    if (releaseDeferredDeliveries(user, now)) changed = true;
  }
  return changed;
}

interface IssueInput {
  key: string;
  occurredAt: number;
  category: InboxItem['category'];
  categoryEnabled: boolean;
  categoryName: string;
  title: string;
  body: string;
  target: InboxItem['target'];
  rule: AlertRule;
}

/** One inbox row plus honest per-channel delivery records (spec pages 51–52). */
function issueItem(db: DemoDb, account: DemoAccount, user: UserData, input: IssueInput): InboxItem {
  const prefs = user.preferences;
  const quiet = { ...prefs.notifications.quietHours, timeZone: prefs.regional.timeZone };
  const jobs = planDeliveries(input.key, input.occurredAt, account.id, {
    channels: [
      {
        channel: 'push',
        destination: user.pushDevices[0]?.id ?? 'no-device',
        enabled: input.rule.channels.includes('push'),
      },
      {
        channel: 'email',
        destination: account.email,
        enabled: input.rule.channels.includes('email'),
      },
    ],
    quietHours: quiet,
  });
  const deliveries: InboxItem['deliveries'] = jobs.map((job) => {
    if (job.channel === 'inbox') {
      return {
        channel: 'inbox',
        status: 'delivered_inbox',
        at: new Date(input.occurredAt).toISOString(),
        detail: 'In your inbox',
      };
    }
    if (!input.categoryEnabled) {
      return {
        channel: job.channel,
        status: 'not_configured',
        at: null,
        detail: `${input.categoryName} notifications are turned off in settings`,
      };
    }
    if (job.deferredByQuietHours) {
      return {
        channel: job.channel,
        status: 'deferred',
        at: new Date(job.availableAt).toISOString(),
        detail: 'Held for quiet hours',
      };
    }
    return deliverExternal(
      db,
      account,
      user,
      job.channel as 'push' | 'email',
      input.title,
      input.occurredAt,
    );
  });
  return {
    id: newId('inb'),
    eventKey: input.key,
    category: input.category,
    title: input.title,
    body: input.body,
    occurredAt: new Date(input.occurredAt).toISOString(),
    deliveredAt: new Date(input.occurredAt).toISOString(),
    deferredByQuietHours: deliveries.some((delivery) => delivery.status === 'deferred'),
    readAt: null,
    archivedAt: null,
    target: input.target,
    ruleId: input.rule.id,
    deliveries,
    demo: true,
  };
}

function priceInboxItem(
  db: DemoDb,
  account: DemoAccount,
  user: UserData,
  rule: AlertRule,
  price: string,
  occurredAt: number,
  key: string,
): InboxItem {
  const instrument = INSTRUMENT_BY_ID.get(rule.instrumentId);
  const symbol = instrument?.symbol ?? 'Instrument';
  const currency = instrument?.currency ?? 'USD';
  const verb = rule.comparator === 'cross_above' ? 'rose above' : 'fell below';
  const timeZone = instrument?.timeZone ?? 'America/New_York';
  return issueItem(db, account, user, {
    key,
    occurredAt,
    category: 'price',
    categoryEnabled: user.preferences.notifications.categories.price,
    categoryName: 'Price',
    title: `${symbol} ${verb} ${formatMoney(rule.threshold!, currency)}`,
    body: `Price threshold crossed at ${formatMoney(price, currency)} (${formatClockWithZone(occurredAt, timeZone)}).${
      rule.repeat === 'once'
        ? ' One-time alert; this rule is now complete.'
        : ' Repeating alert; it re-arms after the price returns and a 5-minute cooldown.'
    }`,
    target: { kind: 'instrument', id: rule.instrumentId, symbol },
    rule,
  });
}

/** When an earnings reminder is due: 24 h before a confirmed release, else 08:00 local on the date. */
export function earningsReminderTime(
  event: EarningsEvent,
  userTimeZone: string,
): { at: number; timeConfirmed: boolean } {
  const confirmedAt = event.timeConfirmed && event.expectedAt ? Date.parse(event.expectedAt) : null;
  return earningsReminderAt({ confirmedAt, date: event.date }, userTimeZone);
}

function releaseText(event: EarningsEvent): string {
  const noon = zonedTimeToInstant(dateKeyToWall(event.date, 12, 0), event.timeZone).instant;
  const day = formatWeekdayDate(noon, event.timeZone);
  if (!event.dateConfirmed) return `around ${day}; the date is not confirmed yet`;
  if (!event.timeConfirmed || !event.expectedAt)
    return `on ${day}; the release time is not confirmed yet`;
  const timing =
    event.timing === 'before_open'
      ? 'before the open'
      : event.timing === 'after_close'
        ? 'after the close'
        : 'during the session';
  return `${day} ${timing} (${formatClockWithZone(Date.parse(event.expectedAt), event.timeZone)}, confirmed)`;
}

/**
 * Issue an earnings reminder for a rule. `late` marks a rule created inside the reminder window:
 * the reminder goes out at once and says why.
 */
export function issueEarningsReminder(
  db: DemoDb,
  account: DemoAccount,
  user: UserData,
  index: number,
  occurredAt: number,
  late: boolean,
): boolean {
  const rule = user.alertRules[index]!;
  const event = EARNINGS.find((candidate) => candidate.id === rule.earningsId);
  if (!event) return false;
  const key = `${rule.id}:${event.id}:reminder`;
  if (user.issuedEventKeys.includes(key)) return false;
  const instrument = INSTRUMENT_BY_ID.get(rule.instrumentId);
  const symbol = instrument?.symbol ?? 'Company';
  user.issuedEventKeys.push(key);
  user.inbox.unshift(
    issueItem(db, account, user, {
      key,
      occurredAt,
      category: 'earnings',
      categoryEnabled: user.preferences.notifications.categories.earnings,
      categoryName: 'Earnings',
      title: `${symbol} earnings reminder`,
      body: `${event.fiscalPeriod} results are expected ${releaseText(event)}.${late ? ' Sent now because the release is less than a day away.' : ''}`,
      target: { kind: 'earnings', id: event.id },
      rule,
    }),
  );
  user.alertRules[index] = {
    ...rule,
    state: 'fired',
    lastFiredAt: occurredAt,
    updatedAt: new Date(occurredAt).toISOString(),
    version: rule.version + 1,
  };
  return true;
}

function evaluateEarningsReminders(
  db: DemoDb,
  account: DemoAccount,
  user: UserData,
  now: number,
): boolean {
  let changed = false;
  user.alertRules.forEach((rule, index) => {
    if (rule.type !== 'earnings' || rule.state !== 'armed' || !rule.earningsId) return;
    const event = EARNINGS.find((candidate) => candidate.id === rule.earningsId);
    if (!event || event.status !== 'scheduled') return;
    const { at } = earningsReminderTime(event, user.preferences.regional.timeZone);
    if (at <= now && issueEarningsReminder(db, account, user, index, at, false)) changed = true;
  });
  return changed;
}

function deliverExternal(
  db: DemoDb,
  account: DemoAccount,
  user: UserData,
  channel: 'push' | 'email',
  title: string,
  occurredAt: number,
): InboxItem['deliveries'][number] {
  if (channel === 'push') {
    if (!user.preferences.notifications.channels.push) {
      return {
        channel,
        status: 'not_configured',
        at: null,
        detail: 'Push is turned off in your delivery settings',
      };
    }
    if (user.pushDevices.length === 0) {
      return {
        channel,
        status: 'permission_denied',
        at: null,
        detail: 'Push is off for this device',
      };
    }
    return {
      channel,
      status: 'queued',
      at: new Date(occurredAt).toISOString(),
      detail: 'Queued for this device',
    };
  }
  if (!user.preferences.notifications.channels.email) {
    return {
      channel,
      status: 'not_configured',
      at: null,
      detail: 'Email is turned off in your delivery settings',
    };
  }
  if (!account.verifiedAt) {
    return {
      channel,
      status: 'failed',
      at: null,
      detail: 'Verify your email address to receive alerts by email',
    };
  }
  const message: MailMessage = {
    id: newId('mail'),
    to: account.email,
    subject: `Stock Picks: ${title}`,
    body: 'An alert you created was triggered. Open the app to see the event and the rule behind it.',
    action: { label: 'Open your alerts', path: '/watchlist/alerts' },
    sentAt: new Date(occurredAt).toISOString(),
  };
  db.mailbox.unshift(message);
  return {
    channel,
    status: 'accepted',
    at: new Date(occurredAt).toISOString(),
    detail: 'Accepted by the demo mail outbox',
  };
}

/** Move deferred deliveries whose quiet period has ended into their channel. */
function releaseDeferredDeliveries(user: UserData, now: number): boolean {
  let changed = false;
  for (const item of user.inbox) {
    for (const delivery of item.deliveries) {
      if (delivery.status === 'deferred' && delivery.at && Date.parse(delivery.at) <= now) {
        delivery.status =
          user.pushDevices.length > 0 && delivery.channel === 'push'
            ? 'queued'
            : 'permission_denied';
        delivery.detail =
          delivery.status === 'queued'
            ? 'Released after quiet hours'
            : 'Released after quiet hours; push is off for this device';
        changed = true;
      }
    }
  }
  return changed;
}
