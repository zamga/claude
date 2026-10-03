import type {
  AlertRule,
  DataRequest,
  InboxItem,
  JournalEntry,
  LedgerRecord,
  MailMessage,
  Preferences,
  ReviewTrigger,
  SavedReport,
  SavedScenario,
  Watchlist,
} from '../types';
import type { FeedState } from './market';

/**
 * Persisted state of the in-browser demo service. It stands in for the server database: private
 * rows are keyed by account, survive sign-out, and are shared by every tab of this browser
 * (a second tab behaves like a second device). Nothing leaves the browser.
 */

export const DB_KEY = 'stockpicks.demo.db.v1';
export const SESSION_KEY = 'stockpicks.demo.session.v1';
export const SCHEMA_VERSION = 1;

export interface DemoAccount {
  id: string;
  email: string;
  emailNormalized: string;
  pendingEmail: string | null;
  displayName: string;
  passwordHash: string;
  salt: string;
  verifiedAt: number | null;
  createdAt: number;
  deletedAt: number | null;
  verification: { token: string; email: string; sentAt: number; expiresAt: number } | null;
  reset: { token: string; sentAt: number; expiresAt: number; usedAt: number | null } | null;
}

export interface DemoSession {
  id: string;
  accountId: string;
  createdAt: number;
  lastSeenAt: number;
  authenticatedAt: number;
  device: string;
  revokedAt: number | null;
}

export interface PushDevice {
  id: string;
  label: string;
  registeredAt: number;
}

export interface UserData {
  preferences: Preferences;
  watchlists: Watchlist[];
  alertRules: AlertRule[];
  issuedEventKeys: string[];
  inbox: InboxItem[];
  savedReports: SavedReport[];
  scenarios: SavedScenario[];
  ledger: LedgerRecord[];
  journal: JournalEntry[];
  reviewTriggers: ReviewTrigger[];
  dataRequests: DataRequest[];
  pushDevices: PushDevice[];
  evaluatedThrough: number;
}

export interface IdempotencyRecord {
  fingerprint: string;
  at: number;
  result: unknown;
}

export interface SupportTicket {
  id: string;
  ref: string;
  accountId: string | null;
  topic: string;
  message: string;
  email: string;
  diagnostics: { requestId: string; name: string; outcome: string }[] | null;
  createdAt: number;
}

export interface DemoDb {
  schema: number;
  createdAt: number;
  clockOffsetMs: number;
  feed: FeedState;
  accounts: Record<string, DemoAccount>;
  sessions: Record<string, DemoSession>;
  mailbox: MailMessage[];
  idempotency: Record<string, IdempotencyRecord>;
  users: Record<string, UserData>;
  /** Added after schema 1 shipped; older stored databases simply lack it. */
  supportTickets?: SupportTicket[];
  /** The last content timestamp handed out (see DemoServer.stamp); absent in older databases. */
  lastStamp?: number;
  seq: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readDb(): DemoDb | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoDb;
    return parsed.schema === SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDb(db: DemoDb): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(DB_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

export function clearDb(): void {
  const store = storage();
  try {
    store?.removeItem(DB_KEY);
    store?.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable: nothing persisted to clear.
  }
}

export function readSessionToken(): string | null {
  try {
    return storage()?.getItem(SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeSessionToken(token: string | null): void {
  try {
    const store = storage();
    if (!store) return;
    if (token) store.setItem(SESSION_KEY, token);
    else store.removeItem(SESSION_KEY);
  } catch {
    // Without storage the session lasts only for this page view.
  }
}

export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
