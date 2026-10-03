import type { AlertRule, InboxItem, LedgerRecord, Preferences } from '../types';
import { DEMO_START } from './clock';
import { DEMO_EMAIL, DEMO_PASSWORD_HASH, DEMO_SALT } from './crypto';
import { SCHEMA_VERSION, type DemoDb, type UserData } from './db';

/** Initial demo database: one verified sample account with populated private data. */

export const DEMO_ACCOUNT_ID = 'acc_demo_alex';
const iso = (value: string) => value;
const nowIso = new Date(DEMO_START).toISOString();

export function defaultPreferences(now: string): Preferences {
  return {
    version: 1,
    research: {
      interests: ['earnings', 'ipo', 'quality'],
      horizon: 'weeks',
      markets: ['US', 'EU'],
      completedAt: null,
    },
    display: {
      appearance: 'editorial',
      textScale: 1,
      reduceMotion: 'system',
      increaseContrast: false,
      keepPrivateOffline: false,
    },
    regional: { currency: 'USD', timeZone: 'Europe/Ljubljana', language: 'en' },
    notifications: {
      categories: { price: true, earnings: true, research: true, product: false },
      // The 08:00 briefing stays off until a delivery channel is enabled (spec page 42).
      briefing: { enabled: false, time: '08:00' },
      quietHours: { enabled: true, start: '22:00', end: '07:00' },
      channels: { push: false, email: false },
    },
    updatedAt: now,
  };
}

export function emptyUserData(now: string, evaluatedThrough: number): UserData {
  return {
    preferences: defaultPreferences(now),
    watchlists: [],
    alertRules: [],
    issuedEventKeys: [],
    inbox: [],
    savedReports: [],
    scenarios: [],
    ledger: [
      {
        id: 'led_initial_cash',
        type: 'deposit',
        effectiveAt: now,
        sequence: 1,
        instrumentId: null,
        quantity: null,
        unitPrice: null,
        amount: '100000.00',
        ratio: null,
        fee: '0',
        currency: 'USD',
        fxRate: '1',
        priceSource: null,
        reversalOf: null,
        sourceEventId: null,
        idempotencyKey: null,
      },
    ],
    journal: [],
    reviewTriggers: [],
    dataRequests: [],
    pushDevices: [],
    evaluatedThrough,
  };
}

function rule(
  partial: Partial<AlertRule> & Pick<AlertRule, 'id' | 'instrumentId' | 'type'>,
): AlertRule {
  return {
    symbol: partial.instrumentId.replace('ins_', '').toUpperCase(),
    comparator: null,
    threshold: null,
    currency: 'USD',
    earningsId: null,
    reportId: null,
    repeat: 'once',
    cooldownMinutes: 5,
    channels: ['inbox', 'push'],
    state: 'armed',
    lastSide: null,
    baselineObservationId: null,
    lastFiredAt: null,
    waitingForReset: false,
    version: 1,
    createdAt: iso('2026-10-12T09:00:00Z'),
    updatedAt: iso('2026-10-12T09:00:00Z'),
    ...partial,
  };
}

function ledger(
  partial: Partial<LedgerRecord> & Pick<LedgerRecord, 'id' | 'type' | 'effectiveAt' | 'sequence'>,
): LedgerRecord {
  return {
    instrumentId: null,
    quantity: null,
    unitPrice: null,
    amount: null,
    ratio: null,
    fee: '0',
    currency: 'USD',
    fxRate: '1',
    priceSource: 'observation',
    reversalOf: null,
    sourceEventId: null,
    idempotencyKey: null,
    ...partial,
  };
}

function demoInbox(): InboxItem[] {
  return [
    {
      id: 'inb_nvda_140',
      eventKey: 'rule_nvda_140:ins_nvda:1792589700000:price_cross',
      category: 'price',
      title: 'NVDA rose above $140.00',
      body: 'Price threshold crossed at $140.25 (09:35 ET). One-time alert; this rule is now complete.',
      occurredAt: iso('2026-10-21T13:35:00Z'),
      deliveredAt: iso('2026-10-21T13:35:00Z'),
      deferredByQuietHours: false,
      readAt: null,
      archivedAt: null,
      target: { kind: 'instrument', id: 'ins_nvda', symbol: 'NVDA' },
      ruleId: 'rule_nvda_140',
      deliveries: [
        {
          channel: 'inbox',
          status: 'delivered_inbox',
          at: iso('2026-10-21T13:35:00Z'),
          detail: 'In your inbox',
        },
        {
          channel: 'push',
          status: 'permission_denied',
          at: null,
          detail: 'Push is off for this device',
        },
      ],
      demo: true,
    },
    {
      id: 'inb_nvda_thesis_v2',
      eventKey: 'rule_nvda_thesis:rep_nvda_thesis:2:thesis_revision',
      category: 'research',
      title: 'Research updated',
      body: 'Export licensing added as a risk to the NVDA thesis (version 2). Valuation assumptions unchanged.',
      occurredAt: iso('2026-10-21T11:30:00Z'),
      deliveredAt: iso('2026-10-21T11:30:00Z'),
      deferredByQuietHours: false,
      readAt: null,
      archivedAt: null,
      target: { kind: 'report', id: 'rep_nvda_thesis', version: 2 },
      ruleId: 'rule_nvda_thesis',
      deliveries: [
        {
          channel: 'inbox',
          status: 'delivered_inbox',
          at: iso('2026-10-21T11:30:00Z'),
          detail: 'In your inbox',
        },
      ],
      demo: true,
    },
    {
      id: 'inb_nvda_earnings',
      eventKey: 'rule_nvda_earnings:ern_nvda_q3fy27:reminder',
      category: 'earnings',
      title: 'NVDA earnings reminder',
      body: 'Q3 FY2027 results are expected Wed 21 Oct after the close (16:20 ET, confirmed).',
      occurredAt: iso('2026-10-20T20:20:00Z'),
      deliveredAt: iso('2026-10-21T05:00:00Z'),
      deferredByQuietHours: true,
      readAt: null,
      archivedAt: null,
      target: { kind: 'earnings', id: 'ern_nvda_q3fy27' },
      ruleId: 'rule_nvda_earnings',
      deliveries: [
        {
          channel: 'inbox',
          status: 'delivered_inbox',
          at: iso('2026-10-20T20:20:00Z'),
          detail: 'In your inbox',
        },
        {
          channel: 'push',
          status: 'permission_denied',
          at: null,
          detail: 'Generated during quiet hours; push is off for this device',
        },
      ],
      demo: true,
    },
    {
      id: 'inb_briefing_1021',
      eventKey: 'briefing:2026-10-21',
      category: 'briefing',
      title: 'Morning briefing',
      body: 'Five picks today. NVIDIA reports after the close; Alto Systems raised its IPO range.',
      occurredAt: iso('2026-10-21T06:00:00Z'),
      deliveredAt: iso('2026-10-21T06:00:00Z'),
      deferredByQuietHours: false,
      readAt: iso('2026-10-21T06:30:00Z'),
      archivedAt: null,
      target: { kind: 'report', id: 'rep_semis_cycle', version: 1 },
      ruleId: null,
      deliveries: [
        {
          channel: 'inbox',
          status: 'delivered_inbox',
          at: iso('2026-10-21T06:00:00Z'),
          detail: 'In your inbox',
        },
      ],
      demo: true,
    },
    {
      id: 'inb_alto_terms',
      eventKey: 'ipo:ipo_alto:terms:2026-10-20',
      category: 'ipo',
      title: 'IPO watchlist update',
      body: 'Alto Systems raised its indicative range to $18–20. Terms are not final.',
      occurredAt: iso('2026-10-20T21:00:00Z'),
      deliveredAt: iso('2026-10-21T05:00:00Z'),
      deferredByQuietHours: true,
      readAt: iso('2026-10-21T07:10:00Z'),
      archivedAt: null,
      target: { kind: 'ipo', id: 'ipo_alto' },
      ruleId: null,
      deliveries: [
        {
          channel: 'inbox',
          status: 'delivered_inbox',
          at: iso('2026-10-20T21:00:00Z'),
          detail: 'In your inbox',
        },
      ],
      demo: true,
    },
  ];
}

export function demoUserData(): UserData {
  const base = emptyUserData('2026-09-03T08:00:00Z', DEMO_START);
  const preferences: Preferences = {
    ...base.preferences,
    research: {
      interests: ['earnings', 'ipo'],
      horizon: 'weeks',
      markets: ['US', 'EU'],
      completedAt: iso('2026-09-03T08:05:00Z'),
    },
    notifications: {
      ...base.preferences.notifications,
      briefing: { enabled: true, time: '08:00' },
      channels: { push: true, email: false },
    },
    version: 3,
    updatedAt: iso('2026-10-02T10:00:00Z'),
  };
  return {
    ...base,
    preferences,
    watchlists: [
      {
        id: 'wl_high_conviction',
        name: 'High conviction',
        position: 0,
        version: 4,
        createdAt: iso('2026-09-03T08:10:00Z'),
        updatedAt: iso('2026-10-14T12:00:00Z'),
        members: ['ins_nvda', 'ins_tsm', 'ins_msft', 'ins_amd', 'ins_asml', 'ins_sap'].map(
          (instrumentId, position) => ({
            instrumentId,
            symbol: instrumentId.replace('ins_', '').toUpperCase(),
            position,
            addedAt: iso('2026-09-10T12:00:00Z'),
          }),
        ),
      },
      {
        id: 'wl_earnings',
        name: 'Earnings',
        position: 1,
        version: 2,
        createdAt: iso('2026-09-12T08:10:00Z'),
        updatedAt: iso('2026-10-12T12:00:00Z'),
        members: ['ins_nvda', 'ins_crm', 'ins_cost'].map((instrumentId, position) => ({
          instrumentId,
          symbol: instrumentId.replace('ins_', '').toUpperCase(),
          position,
          addedAt: iso('2026-10-12T12:00:00Z'),
        })),
      },
      {
        id: 'wl_ipos',
        name: 'IPOs',
        position: 2,
        version: 2,
        createdAt: iso('2026-09-20T08:10:00Z'),
        updatedAt: iso('2026-10-16T12:00:00Z'),
        members: ['ins_alto', 'ins_nora'].map((instrumentId, position) => ({
          instrumentId,
          symbol: instrumentId.replace('ins_', '').toUpperCase(),
          position,
          addedAt: iso('2026-10-16T12:00:00Z'),
        })),
      },
    ],
    alertRules: [
      rule({
        id: 'rule_nvda_150',
        instrumentId: 'ins_nvda',
        type: 'price',
        comparator: 'cross_above',
        threshold: '150.00',
        lastSide: 'pre',
        baselineObservationId: `ins_nvda:${DEMO_START}`,
      }),
      rule({
        id: 'rule_nvda_140',
        instrumentId: 'ins_nvda',
        type: 'price',
        comparator: 'cross_above',
        threshold: '140.00',
        state: 'fired',
        lastSide: 'beyond',
        lastFiredAt: Date.parse('2026-10-21T13:35:00Z'),
        createdAt: iso('2026-10-19T09:00:00Z'),
        updatedAt: iso('2026-10-21T13:35:00Z'),
      }),
      rule({
        id: 'rule_nvda_earnings',
        instrumentId: 'ins_nvda',
        type: 'earnings',
        earningsId: 'ern_nvda_q3fy27',
        state: 'fired',
        lastFiredAt: Date.parse('2026-10-20T20:20:00Z'),
      }),
      rule({
        id: 'rule_nvda_thesis',
        instrumentId: 'ins_nvda',
        type: 'thesis',
        reportId: 'rep_nvda_thesis',
        repeat: 'repeating',
        channels: ['inbox'],
      }),
      rule({
        id: 'rule_amd_150',
        instrumentId: 'ins_amd',
        type: 'price',
        comparator: 'cross_below',
        threshold: '150.00',
        repeat: 'repeating',
        channels: ['inbox'],
        lastSide: 'pre',
        baselineObservationId: `ins_amd:${DEMO_START}`,
      }),
    ],
    issuedEventKeys: demoInbox().map((item) => item.eventKey),
    inbox: demoInbox(),
    savedReports: [
      {
        reportId: 'rep_semis_cycle',
        version: 1,
        savedAt: iso('2026-10-19T19:00:00Z'),
        readingOffset: 0,
      },
      {
        reportId: 'rep_nvda_thesis',
        version: 1,
        savedAt: iso('2026-10-15T19:00:00Z'),
        readingOffset: 0,
      },
    ],
    ledger: [
      ledger({
        id: 'led_deposit',
        type: 'deposit',
        effectiveAt: iso('2026-06-01T13:00:00Z'),
        sequence: 1,
        amount: '100000.00',
        priceSource: null,
      }),
      ledger({
        id: 'led_buy_nvda',
        type: 'buy',
        effectiveAt: iso('2026-07-15T20:00:00Z'),
        sequence: 2,
        instrumentId: 'ins_nvda',
        quantity: '150',
        unitPrice: '128.00',
      }),
      ledger({
        id: 'led_buy_msft',
        type: 'buy',
        effectiveAt: iso('2026-08-03T20:00:00Z'),
        sequence: 3,
        instrumentId: 'ins_msft',
        quantity: '40',
        unitPrice: '397.92',
      }),
      ledger({
        id: 'led_buy_asml',
        type: 'buy',
        effectiveAt: iso('2026-08-20T15:30:00Z'),
        sequence: 4,
        instrumentId: 'ins_asml',
        quantity: '15',
        unitPrice: '612.40',
        currency: 'EUR',
        fxRate: '1.0850',
      }),
      ledger({
        id: 'led_buy_tsm',
        type: 'buy',
        effectiveAt: iso('2026-09-08T20:00:00Z'),
        sequence: 5,
        instrumentId: 'ins_tsm',
        quantity: '80',
        unitPrice: '161.95',
      }),
      ledger({
        id: 'led_sell_tsm',
        type: 'sell',
        effectiveAt: iso('2026-10-05T20:00:00Z'),
        sequence: 6,
        instrumentId: 'ins_tsm',
        quantity: '30',
        unitPrice: '168.90',
      }),
    ],
    journal: [
      {
        id: 'jnl_nvda_entry',
        instrumentId: 'ins_nvda',
        body: 'Starting a paper position to follow data-centre demand through the next two reports.',
        kind: 'entry_reason',
        createdAt: iso('2026-07-15T20:05:00Z'),
        updatedAt: iso('2026-07-15T20:05:00Z'),
        revision: 1,
      },
      {
        id: 'jnl_nvda_0921',
        instrumentId: 'ins_nvda',
        body: 'Tracking earnings momentum and margin durability.',
        kind: 'note',
        createdAt: iso('2026-09-21T18:00:00Z'),
        updatedAt: iso('2026-09-21T18:00:00Z'),
        revision: 1,
      },
      {
        id: 'jnl_tsm_trim',
        instrumentId: 'ins_tsm',
        body: 'Trimmed after the monthly revenue release; keeping the core position through results.',
        kind: 'note',
        createdAt: iso('2026-10-05T20:10:00Z'),
        updatedAt: iso('2026-10-05T20:10:00Z'),
        revision: 1,
      },
    ],
    reviewTriggers: [
      {
        instrumentId: 'ins_nvda',
        text: 'Reassess if guidance weakens.',
        updatedAt: iso('2026-07-15T20:05:00Z'),
        version: 1,
      },
      {
        instrumentId: 'ins_msft',
        text: 'Reassess if cloud growth slows for two quarters.',
        updatedAt: iso('2026-08-03T20:05:00Z'),
        version: 1,
      },
    ],
  };
}

export function createSeedDb(): DemoDb {
  return {
    schema: SCHEMA_VERSION,
    createdAt: Date.now(),
    clockOffsetMs: 0,
    feed: { mode: 'normal', since: null },
    accounts: {
      [DEMO_ACCOUNT_ID]: {
        id: DEMO_ACCOUNT_ID,
        email: DEMO_EMAIL,
        emailNormalized: DEMO_EMAIL,
        pendingEmail: null,
        displayName: 'Alex Morgan',
        passwordHash: DEMO_PASSWORD_HASH,
        salt: DEMO_SALT,
        verifiedAt: Date.parse('2026-09-03T08:02:00Z'),
        createdAt: Date.parse('2026-09-03T08:00:00Z'),
        deletedAt: null,
        verification: null,
        reset: null,
      },
    },
    sessions: {},
    mailbox: [],
    idempotency: {},
    users: { [DEMO_ACCOUNT_ID]: demoUserData() },
    seq: 100,
  };
}

export { nowIso as DEMO_NOW_ISO };
