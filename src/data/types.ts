/**
 * Resource types returned by the application API (spec pages 47–49).
 * Decimal values travel as strings; instants are ISO 8601 UTC strings or epoch milliseconds in
 * chart samples. Null always means unavailable, never zero.
 */
import type { Comparator, RepeatMode, RuleState, Side } from '@/domain/alerts';
import type { CurrencyCode } from '@/domain/format';
import type { Sample } from '@/domain/series';

export type Id = string;
export type IsoTime = string;
export type Decimal = string;
export type { CurrencyCode, Sample };

export type Region = 'US' | 'EU';
export type DataStatus = 'live' | 'delayed' | 'stale' | 'cached' | 'demo' | 'unavailable';
export type MarketSession = 'pre' | 'regular' | 'post' | 'closed' | 'halted';
export type ChartRange = '1D' | '1W' | '1M' | '3M' | '1Y';
export type MarketCap = 'large' | 'mid' | 'small';
export type Interest = 'earnings' | 'ipo' | 'quality';
export type Horizon = 'days' | 'weeks' | 'months';

export interface ResponseMeta {
  requestId: string;
  asOf: IsoTime;
  nextCursor?: string | null;
  demo: boolean;
}

export interface Envelope<T> {
  data: T;
  meta: ResponseMeta;
}

// ---------- Instruments and market data ----------

export interface Instrument {
  id: Id;
  symbol: string;
  mic: string;
  exchange: string;
  name: string;
  shortName: string;
  type: 'equity' | 'adr';
  currency: CurrencyCode;
  timeZone: string;
  pricePrecision: number;
  tickSize: Decimal;
  sector: string;
  industry: string;
  marketCap: MarketCap;
  region: Region;
  status: 'listed' | 'pending' | 'delisted';
  themes: string[];
  description: string;
  listedOn: string | null;
  delistedOn: string | null;
  filingsUrl: string | null;
}

export interface Quote {
  instrumentId: Id;
  price: Decimal | null;
  previousClose: Decimal | null;
  currency: CurrencyCode;
  asOf: IsoTime | null;
  session: MarketSession;
  source: string;
  status: DataStatus;
  delaySeconds: number;
  adjustment: 'split-adjusted';
  observationId: string | null;
  nextOpen: IsoTime | null;
  /** Explanation when the quote cannot be shown (e.g. not yet listed). */
  unavailableReason: string | null;
}

export interface Series {
  instrumentId: Id;
  /** Stock charts use ChartRange; performance charts reuse the series contract with '6M'. */
  range: ChartRange | '6M';
  interval: '5m' | '30m' | '1d';
  /** 'time' plots by timestamp across a session window; 'ordinal' compresses closed periods. */
  axis: 'time' | 'ordinal';
  samples: Sample[];
  /** For time axes: the plotted window (session open to close). */
  window: { start: number; end: number } | null;
  reference: { value: Decimal | null; label: string; kind: 'previousClose' | 'firstInWindow' };
  currency: CurrencyCode;
  asOf: IsoTime | null;
  status: DataStatus;
  source: string;
  adjustment: 'split-adjusted';
  timeZone: string;
}

export interface InstrumentSearchResult {
  instrument: Instrument;
  quote: Quote;
  sparkline: Sample[];
  setups: Interest[];
}

export interface SearchQuery {
  q: string;
  region?: Region | 'all';
  sector?: string | 'all';
  marketCap?: MarketCap | 'any';
  setup?: Interest | 'any';
  sort?: 'relevance' | 'change' | 'name' | 'marketCap';
}

export interface MarketIndex {
  id: Id;
  name: string;
  shortName: string;
  kind: 'index' | 'volatility';
  value: Decimal | null;
  previousClose: Decimal | null;
  region: Region;
  session: MarketSession;
  asOf: IsoTime | null;
  status: DataStatus;
  series: Sample[];
  window: { start: number; end: number };
  timeZone: string;
}

export interface SectorMove {
  id: Id;
  name: string;
  changePct: Decimal | null;
  region: Region;
}

export interface Catalyst {
  id: Id;
  at: IsoTime;
  title: string;
  detail: string;
  region: Region;
  kind: 'macro' | 'earnings' | 'ipo';
  timeConfirmed: boolean;
  source: string;
  targetEarningsId?: Id;
}

export interface MarketOverview {
  sessions: {
    region: Region;
    label: string;
    session: MarketSession;
    opensAt: IsoTime | null;
    closesAt: IsoTime | null;
    nextOpen: IsoTime | null;
    timeZone: string;
  }[];
  indices: MarketIndex[];
  sectors: SectorMove[];
  catalysts: Catalyst[];
  asOf: IsoTime;
}

// ---------- Editorial research ----------

export type EvidenceKind = 'reported' | 'estimate' | 'management' | 'assumption' | 'interpretation';

export interface Source {
  id: Id;
  title: string;
  publisher: string;
  kind: 'filing' | 'transcript' | 'release' | 'dataset' | 'article';
  period: string | null;
  publishedAt: IsoTime;
  retrievedAt: IsoTime;
  /** External document; null when no document is attached to the demo record. */
  url: string | null;
  status: 'available' | 'unattached' | 'withdrawn';
  note: string;
  alternate: { label: string; url: string } | null;
}

export interface Evidence {
  kind: EvidenceKind;
  statement: string;
  sourceId: Id | null;
}

export interface ThesisPoint {
  id: Id;
  title: string;
  summary: string;
  evidence: Evidence[];
}

export interface FinancialRow {
  label: string;
  unit: string;
  values: (Decimal | null)[];
  kind: EvidenceKind;
}

export interface ReportBody {
  takeaway: string;
  sections: { heading: string; paragraphs: string[] }[];
  monitor: { title: string; detail: string }[];
  arguments: ThesisPoint[];
  risks: ThesisPoint[];
  financials: { periods: string[]; rows: FinancialRow[]; note: string } | null;
}

export interface ReportVersion {
  reportId: Id;
  version: number;
  author: string;
  reviewer: string;
  publishedAt: IsoTime;
  changeSummary: string | null;
  body: ReportBody;
  sourceIds: Id[];
  methodologyVersion: string;
}

export type ReportKind = 'thesis' | 'sector' | 'earnings' | 'ipo';

export interface ReportSummary {
  id: Id;
  kind: ReportKind;
  label: string;
  title: string;
  dek: string;
  readingMinutes: number;
  instrumentIds: Id[];
  sectorTags: string[];
  latestVersion: number;
  firstPublishedAt: IsoTime;
  latestPublishedAt: IsoTime;
  status: 'published' | 'withdrawn';
  withdrawnReason: string | null;
  versions: { version: number; publishedAt: IsoTime; changeSummary: string | null }[];
}

export interface Report extends ReportSummary {
  current: ReportVersion;
  sources: Source[];
}

export interface Assessment {
  key: 'momentum' | 'quality' | 'risk';
  label: string;
  value: string;
  tone: 'positive' | 'neutral' | 'negative';
  basis: 'rule' | 'analyst';
  attribution: string;
  definition: string;
}

export interface Pick {
  id: Id;
  instrumentId: Id;
  symbol: string;
  name: string;
  industry: string;
  editorialDate: string;
  order: number;
  category: Interest;
  headline: string;
  whyHere: string;
  thesisLine: string;
  horizon: Horizon;
  thesisStatus: 'active' | 'under_review' | 'closed';
  publishedAt: IsoTime;
  reportId: Id;
  reportVersion: number;
  methodologyVersion: string;
  analyst: string;
  assessments: Assessment[];
  catalyst: { label: string; detail: string; earningsId: Id | null };
  keyRisk: { label: string; detail: string };
  ratingLabel: Assessment | null;
}

export interface DailyPicks {
  editorialDate: string;
  publishedAt: IsoTime | null;
  methodology: { version: string; summary: string };
  picks: Pick[];
}

// ---------- Earnings and IPOs ----------

export type ReleaseTiming = 'before_open' | 'after_close' | 'during_session' | 'unconfirmed';

export interface EarningsEvent {
  id: Id;
  instrumentId: Id;
  fiscalPeriod: string;
  date: string;
  timing: ReleaseTiming;
  timeConfirmed: boolean;
  dateConfirmed: boolean;
  expectedAt: IsoTime | null;
  timeZone: string;
  status: 'scheduled' | 'reported' | 'postponed' | 'cancelled';
  consensus: { eps: Decimal | null; revenueB: Decimal | null; source: string; asOf: IsoTime };
  actual: { eps: Decimal | null; revenueB: Decimal | null; reportedAt: IsoTime } | null;
  guidance: {
    direction: 'raised' | 'maintained' | 'lowered' | 'withdrawn' | 'none';
    detail: string;
  } | null;
  reaction: {
    changePct: Decimal | null;
    basis: string;
    series: Sample[];
  } | null;
  readThrough: {
    label: string;
    assessment: string;
    tone: 'positive' | 'neutral' | 'negative';
    detail: string;
  }[];
  reportId: Id | null;
  previousEventId: Id | null;
  sourceIds: Id[];
  currency: CurrencyCode;
}

export interface IpoIssuer {
  id: Id;
  instrumentId: Id;
  name: string;
  proposedSymbol: string;
  sector: string;
  region: Region;
  exchange: string;
  status: 'upcoming' | 'priced' | 'listed' | 'postponed' | 'withdrawn';
  expectedDate: string | null;
  dateConfirmed: boolean;
  termsStatus: 'indicative' | 'final';
  currency: CurrencyCode;
  rangeLow: Decimal | null;
  rangeHigh: Decimal | null;
  finalPrice: Decimal | null;
  indicativeValuationB: Decimal | null;
  sharesOfferedM: Decimal | null;
  freeFloatPct: Decimal | null;
  lockupDays: number | null;
  useOfProceeds: string;
  primaryProceeds: string;
  opportunity: string;
  keyRisk: string;
  sourceIds: Id[];
  revisions: { at: IsoTime; summary: string }[];
  listedAt: IsoTime | null;
  reportId: Id | null;
}

// ---------- Pick archive ----------

export interface PickOutcome {
  windowSessions: number;
  status: 'pending' | 'complete';
  entryRule: string;
  entryAt: IsoTime | null;
  entryPrice: Decimal | null;
  exitAt: IsoTime | null;
  exitPrice: Decimal | null;
  sessionsElapsed: number;
  returnPct: Decimal | null;
  benchmark: {
    name: string;
    entryPrice: Decimal | null;
    exitPrice: Decimal | null;
    returnPct: Decimal | null;
  };
  basis: string;
  currency: CurrencyCode;
  note: string | null;
}

export interface ArchivedPick {
  id: Id;
  pickId: Id;
  instrumentId: Id;
  symbolAtPublication: string;
  nameAtPublication: string;
  publishedAt: IsoTime;
  category: Interest;
  originalHeadline: string;
  originalThesis: string;
  reportId: Id;
  reportVersionAtPublication: number;
  latestVersion: number;
  revisions: { version: number; at: IsoTime; summary: string }[];
  thesisStatus: 'active' | 'under_review' | 'closed';
  outcome: PickOutcome;
  delisted: { on: string; reason: string } | null;
}

export interface MeasurementMethod {
  version: string;
  entry: string;
  window: string;
  coverage: string;
  returnBasis: string;
  benchmark: string;
  costs: string;
  corporateActions: string;
  universe: string;
}

// ---------- Private account data ----------

export interface Watchlist {
  id: Id;
  name: string;
  position: number;
  version: number;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  members: { instrumentId: Id; symbol: string; position: number; addedAt: IsoTime }[];
}

export type AlertType = 'price' | 'earnings' | 'thesis';
export type ChannelName = 'inbox' | 'push' | 'email';

export interface AlertRule {
  id: Id;
  instrumentId: Id;
  symbol: string;
  type: AlertType;
  comparator: Comparator | null;
  threshold: Decimal | null;
  currency: CurrencyCode;
  earningsId: Id | null;
  reportId: Id | null;
  repeat: RepeatMode;
  cooldownMinutes: number;
  channels: ChannelName[];
  state: RuleState;
  lastSide: Side | null;
  baselineObservationId: string | null;
  lastFiredAt: number | null;
  /** True while a cross rule waits for the price to return to the starting side. */
  waitingForReset: boolean;
  version: number;
  createdAt: IsoTime;
  updatedAt: IsoTime;
}

export interface AlertRuleInput {
  instrumentId: Id;
  type: AlertType;
  comparator?: Comparator;
  threshold?: string;
  earningsId?: Id;
  reportId?: Id;
  repeat: RepeatMode;
  channels: ChannelName[];
}

export type DeliveryStatus =
  | 'delivered_inbox'
  | 'queued'
  | 'deferred'
  | 'shown_on_device'
  | 'accepted'
  | 'failed'
  | 'not_configured'
  | 'permission_denied';

export interface InboxItem {
  id: Id;
  eventKey: string;
  category: 'price' | 'earnings' | 'research' | 'ipo' | 'briefing';
  title: string;
  body: string;
  occurredAt: IsoTime;
  deliveredAt: IsoTime | null;
  deferredByQuietHours: boolean;
  readAt: IsoTime | null;
  archivedAt: IsoTime | null;
  target:
    | { kind: 'instrument'; id: Id; symbol?: string }
    | { kind: 'earnings'; id: Id }
    | { kind: 'report'; id: Id; version: number }
    | { kind: 'ipo'; id: Id };
  ruleId: Id | null;
  deliveries: {
    channel: ChannelName;
    status: DeliveryStatus;
    at: IsoTime | null;
    detail: string;
  }[];
  demo: boolean;
}

export interface Preferences {
  version: number;
  research: {
    interests: Interest[];
    horizon: Horizon;
    markets: Region[];
    completedAt: IsoTime | null;
  };
  display: {
    appearance: 'editorial' | 'night' | 'system';
    textScale: number;
    reduceMotion: 'system' | 'reduce' | 'full';
    increaseContrast: boolean;
    keepPrivateOffline: boolean;
  };
  regional: {
    currency: CurrencyCode;
    timeZone: string;
    language: 'en';
  };
  notifications: {
    categories: { price: boolean; earnings: boolean; research: boolean; product: boolean };
    briefing: { enabled: boolean; time: string };
    quietHours: { enabled: boolean; start: string; end: string };
    channels: { push: boolean; email: boolean };
  };
  updatedAt: IsoTime;
}

export interface SavedReport {
  reportId: Id;
  version: number;
  savedAt: IsoTime;
  readingOffset: number;
}

export interface SavedScenario {
  id: Id;
  instrumentId: Id;
  modelVersion: string;
  scenario: 'bear' | 'base' | 'bull';
  assumptions: { revenueGrowthPct: string; operatingMarginPct: string; exitPe: string };
  referencePrice: Decimal;
  referenceAt: IsoTime;
  version: number;
  savedAt: IsoTime;
}

export interface ValuationModel {
  instrumentId: Id;
  modelVersion: string;
  baseDate: IsoTime;
  currency: CurrencyCode;
  units: string;
  base: {
    baseRevenueB: Decimal;
    dilutedSharesB: Decimal;
    taxRatePct: Decimal;
  };
  referencePrice: Decimal;
  referenceAt: IsoTime;
  scenarios: Record<
    'bear' | 'base' | 'bull',
    { revenueGrowthPct: string; operatingMarginPct: string; exitPe: string; narrative: string }
  >;
  author: string;
  sourceIds: Id[];
}

export interface LedgerRecord {
  id: Id;
  type: 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend' | 'split' | 'reversal';
  effectiveAt: IsoTime;
  sequence: number;
  instrumentId: Id | null;
  quantity: Decimal | null;
  unitPrice: Decimal | null;
  amount: Decimal | null;
  ratio: Decimal | null;
  fee: Decimal;
  currency: CurrencyCode;
  fxRate: Decimal;
  priceSource: 'observation' | 'manual' | null;
  reversalOf: Id | null;
  sourceEventId: Id | null;
  idempotencyKey: string | null;
}

export interface PositionSummary {
  instrumentId: Id;
  symbol: string;
  name: string;
  units: Decimal;
  averageCost: Decimal | null;
  costBasis: Decimal;
  price: Decimal | null;
  priceAsOf: IsoTime | null;
  priceStatus: DataStatus;
  currency: CurrencyCode;
  value: Decimal | null;
  unrealized: Decimal | null;
  unrealizedPct: Decimal | null;
  realized: Decimal;
  firstBoughtAt: IsoTime | null;
}

export type PortfolioPeriod = '1M' | '3M' | '6M' | '1Y';

export interface PortfolioPerformance {
  period: PortfolioPeriod;
  points: { t: number; portfolioPct: number | null; benchmarkPct: number | null }[];
  returnPct: Decimal | null;
  benchmarkPct: Decimal | null;
  maxDrawdownPct: Decimal | null;
  benchmarkName: string;
  basis: string;
  sampling: string;
  window: { start: IsoTime; end: IsoTime };
}

export interface PortfolioSummary {
  id: Id;
  name: string;
  baseCurrency: CurrencyCode;
  asOf: IsoTime;
  cash: Decimal;
  equity: Decimal | null;
  investedValue: Decimal;
  contributed: Decimal;
  totalGain: Decimal | null;
  totalGainPct: Decimal | null;
  realized: Decimal;
  unrealized: Decimal | null;
  incomplete: boolean;
  positions: PositionSummary[];
  performance: PortfolioPerformance;
}

export interface JournalEntry {
  id: Id;
  instrumentId: Id;
  body: string;
  kind: 'entry_reason' | 'note';
  createdAt: IsoTime;
  updatedAt: IsoTime;
  revision: number;
}

export interface ReviewTrigger {
  instrumentId: Id;
  text: string;
  updatedAt: IsoTime;
  version: number;
}

export interface PositionDetail {
  position: PositionSummary;
  ledger: LedgerRecord[];
  journal: JournalEntry[];
  reviewTrigger: ReviewTrigger | null;
  cash: Decimal;
}

export interface TransactionInput {
  side: 'buy' | 'sell';
  instrumentId: Id;
  quantity: string;
  unitPrice: string;
  fee: string;
  priceSource: 'observation' | 'manual';
}

export interface DataRequest {
  id: Id;
  kind: 'export' | 'deletion';
  status: 'preparing' | 'ready' | 'failed' | 'expired' | 'processing' | 'completed' | 'cancelled';
  requestedAt: IsoTime;
  finishedAt: IsoTime | null;
  expiresAt: IsoTime | null;
  safeErrorCode: string | null;
}

export interface SessionInfo {
  id: Id;
  current: boolean;
  createdAt: IsoTime;
  lastSeenAt: IsoTime;
  device: string;
}

export interface Me {
  id: Id;
  email: string;
  pendingEmail: string | null;
  displayName: string;
  verified: boolean;
  memberSince: IsoTime;
  access: { plan: 'core'; label: string; detail: string };
  demo: boolean;
}

export interface MailMessage {
  id: Id;
  to: string;
  subject: string;
  body: string;
  action: { label: string; path: string } | null;
  sentAt: IsoTime;
}
