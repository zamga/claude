import { computeChange } from '@/domain/change';
import { dec } from '@/domain/decimal';
import { armRule, isDuplicateRule, validateThreshold } from '@/domain/alerts';
import { previewTransaction, type TransactionDraft } from '@/domain/ledger';
import { summarizeOutcomes } from '@/domain/performance';
import { addDaysToKey, localDateKey } from '@/domain/time';
import {
  normalizeName,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
  validateNote,
  validateWatchlistName,
} from '@/domain/validation';
import { formatDateTime, formatMoney } from '@/domain/format';
import { ApiError } from '../errors';
import type {
  AlertRule,
  AlertRuleInput,
  ArchivedPick,
  Assessment,
  ChartRange,
  DailyPicks,
  DataRequest,
  EarningsEvent,
  InboxItem,
  Instrument,
  InstrumentSearchResult,
  Interest,
  IpoIssuer,
  JournalEntry,
  LedgerRecord,
  MailMessage,
  MarketOverview,
  Me,
  Pick,
  PortfolioPeriod,
  PortfolioSummary,
  PositionDetail,
  Preferences,
  Quote,
  Report,
  ReportSummary,
  ReviewTrigger,
  SavedReport,
  SavedScenario,
  SearchQuery,
  Series,
  SessionInfo,
  Source,
  TransactionInput,
  ValuationModel,
  Watchlist,
} from '../types';
import { archiveFromSpecs, computeOutcome, MEASUREMENT_METHOD } from './archive';
import { sessionTimes } from './calendar';
import { DEMO_MAX_OFFSET, DEMO_START, DEMO_STEP_MS } from './clock';
import { REPORTS, REPORT_BY_ID, type DemoReport } from './content/reports';
import {
  CATALYSTS,
  EARNINGS,
  EDITORIAL_DATE,
  IPOS,
  METHODOLOGY,
  MOMENTUM_RULE,
  PICK_SPECS,
  PICKS_PUBLISHED_AT,
  SECTORS,
  VALUATION_MODELS,
} from './content/editorial';
import { SOURCE_BY_ID } from './content/sources';
import { digestsEqual, hashPassword, randomHex } from './crypto';
import {
  clearDb,
  DB_KEY,
  newId,
  readDb,
  readSessionToken,
  writeDb,
  writeSessionToken,
  type DemoAccount,
  type DemoDb,
  type DemoSession,
  type UserData,
} from './db';
import { earningsReminderTime, issueEarningsReminder, runAlertEngine } from './engine';
import {
  INDICES,
  INSTRUMENTS,
  INSTRUMENT_BY_ID,
  INSTRUMENT_BY_SYMBOL,
  stripPrice,
} from './instruments';
import { demoIndex, demoQuote, demoSeries, demoSparkline, type FeedMode } from './market';
import { fxRateFor, ledgerState, portfolioSummary } from './portfolioCalc';
import { anyPath, closeOn } from './prices';
import { createSeedDb, emptyUserData } from './seed';

const FRESH_AUTH_MS = 5 * 60_000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function notFound(what = 'This item'): ApiError {
  return new ApiError(
    'not_found',
    `${what} is not available. It may have been removed, or the link may be wrong.`,
  );
}

interface Authed {
  session: DemoSession;
  account: DemoAccount;
  user: UserData;
}

export interface DemoState {
  now: number;
  offsetMs: number;
  maxOffsetMs: number;
  feed: FeedMode;
  feedSince: number | null;
  usSessionCloses: number;
}

export class DemoServer {
  private db: DemoDb;

  constructor() {
    this.db = readDb() ?? createSeedDb();
    writeDb(this.db);
  }

  /** Re-read state written by another tab (the "second device"). */
  reload(): void {
    this.db = readDb() ?? this.db;
  }

  now(): number {
    return DEMO_START + this.db.clockOffsetMs;
  }

  private commit(): void {
    writeDb(this.db);
  }

  private tick(): void {
    if (runAlertEngine(this.db, this.now())) this.commit();
  }

  // ---------- Session helpers ----------

  private currentSession(): Authed | null {
    const token = readSessionToken();
    if (!token) return null;
    const session = this.db.sessions[token];
    if (!session || session.revokedAt) return null;
    const account = this.db.accounts[session.accountId];
    const user = this.db.users[session.accountId];
    if (!account || account.deletedAt || !user) return null;
    session.lastSeenAt = Date.now();
    return { session, account, user };
  }

  private requireUser(): Authed {
    const authed = this.currentSession();
    if (!authed) throw new ApiError('unauthenticated', 'Please sign in again to continue.');
    return authed;
  }

  private requireVerified(): Authed {
    const authed = this.requireUser();
    if (!authed.account.verifiedAt) {
      throw new ApiError(
        'unverified',
        'Verify your email address to save research, alerts and paper positions.',
      );
    }
    return authed;
  }

  private requireFreshAuth(authed: Authed): void {
    if (Date.now() - authed.session.authenticatedAt > FRESH_AUTH_MS) {
      throw new ApiError(
        'reauthentication_required',
        'For your security, confirm your password to continue.',
      );
    }
  }

  private idempotent<T>(key: string | undefined, input: unknown, run: () => T): T {
    if (!key) return run();
    const now = Date.now();
    for (const [stored, record] of Object.entries(this.db.idempotency)) {
      if (now - record.at > IDEMPOTENCY_TTL_MS) delete this.db.idempotency[stored];
    }
    const existing = this.db.idempotency[key];
    const print = fingerprint(input);
    if (existing) {
      if (existing.fingerprint !== print) {
        throw new ApiError(
          'idempotency_conflict',
          'This request was already used for a different change. Start the action again.',
        );
      }
      return existing.result as T;
    }
    const result = run();
    this.db.idempotency[key] = { fingerprint: print, at: now, result };
    return result;
  }

  // ---------- Demo controls ----------

  demoState(): DemoState {
    return {
      now: this.now(),
      offsetMs: this.db.clockOffsetMs,
      maxOffsetMs: DEMO_MAX_OFFSET,
      feed: this.db.feed.mode,
      feedSince: this.db.feed.since,
      usSessionCloses: sessionTimes('US', EDITORIAL_DATE).closesAt,
    };
  }

  advanceClock(steps: number): DemoState {
    const next = Math.min(
      Math.max(this.db.clockOffsetMs + steps * DEMO_STEP_MS, 0),
      DEMO_MAX_OFFSET,
    );
    this.db.clockOffsetMs = next;
    this.tick();
    this.commit();
    return this.demoState();
  }

  setFeed(mode: FeedMode): DemoState {
    this.db.feed = { mode, since: mode === 'interrupted' ? this.now() : null };
    this.tick();
    this.commit();
    return this.demoState();
  }

  resetDemo(): void {
    clearDb();
    this.db = createSeedDb();
    writeDb(this.db);
  }

  // ---------- Instruments and market data ----------

  resolveInstrument(idOrSymbol: string): Instrument {
    const instrument =
      INSTRUMENT_BY_ID.get(idOrSymbol) ?? INSTRUMENT_BY_SYMBOL.get(idOrSymbol.toLowerCase());
    if (!instrument) throw notFound('This company');
    return stripPrice(instrument);
  }

  quote(instrumentId: string): Quote {
    this.resolveInstrument(instrumentId);
    this.tick();
    return demoQuote(instrumentId, this.now(), this.db.feed);
  }

  quotes(instrumentIds: string[]): Quote[] {
    this.tick();
    return instrumentIds
      .filter((id) => INSTRUMENT_BY_ID.has(id) || id.startsWith('idx_'))
      .map((id) => demoQuote(id, this.now(), this.db.feed));
  }

  series(instrumentId: string, range: ChartRange): Series {
    if (!instrumentId.startsWith('idx_')) this.resolveInstrument(instrumentId);
    return demoSeries(instrumentId, range, this.now(), this.db.feed);
  }

  search(query: SearchQuery): InstrumentSearchResult[] {
    const q = query.q.trim().toLowerCase();
    const setupsFor = (instrumentId: string): Interest[] => {
      const out = new Set<Interest>();
      if (
        EARNINGS.some(
          (event) => event.instrumentId === instrumentId && event.status === 'scheduled',
        )
      )
        out.add('earnings');
      const instrument = INSTRUMENT_BY_ID.get(instrumentId)!;
      if (instrument.themes.includes('New listings')) out.add('ipo');
      if (instrument.themes.includes('Quality')) out.add('quality');
      return [...out];
    };
    const scored = INSTRUMENTS.filter((instrument) => instrument.status !== 'delisted')
      .map((instrument) => {
        let score = 0;
        if (q === '') score = 1;
        else if (instrument.symbol.toLowerCase() === q) score = 100;
        else if (instrument.symbol.toLowerCase().startsWith(q)) score = 60;
        else if (
          instrument.name.toLowerCase().includes(q) ||
          instrument.shortName.toLowerCase().includes(q)
        )
          score = 40;
        else if (instrument.themes.some((theme) => theme.toLowerCase().includes(q))) score = 25;
        else if (
          instrument.industry.toLowerCase().includes(q) ||
          instrument.sector.toLowerCase().includes(q)
        )
          score = 20;
        return { instrument, score };
      })
      .filter(({ score }) => score > 0)
      .filter(
        ({ instrument }) =>
          !query.region || query.region === 'all' || instrument.region === query.region,
      )
      .filter(
        ({ instrument }) =>
          !query.sector || query.sector === 'all' || instrument.sector === query.sector,
      )
      .filter(
        ({ instrument }) =>
          !query.marketCap || query.marketCap === 'any' || instrument.marketCap === query.marketCap,
      )
      .filter(
        ({ instrument }) =>
          !query.setup || query.setup === 'any' || setupsFor(instrument.id).includes(query.setup),
      );
    const now = this.now();
    const results = scored.map(({ instrument, score }) => ({
      score,
      result: {
        instrument: stripPrice(instrument),
        quote: demoQuote(instrument.id, now, this.db.feed),
        sparkline: demoSparkline(instrument.id, now, this.db.feed),
        setups: setupsFor(instrument.id),
      } satisfies InstrumentSearchResult,
    }));
    const changeOf = (quote: Quote) => computeChange(quote.price, quote.previousClose).percent;
    const capRank = { large: 0, mid: 1, small: 2 } as const;
    results.sort((a, b) => {
      let order: number;
      switch (query.sort ?? 'relevance') {
        case 'change': {
          const ca = changeOf(a.result.quote);
          const cb = changeOf(b.result.quote);
          if (ca == null && cb == null) order = 0;
          else if (ca == null) order = 1;
          else if (cb == null) order = -1;
          else order = cb.cmp(ca);
          break;
        }
        case 'name':
          order = a.result.instrument.name.localeCompare(b.result.instrument.name);
          break;
        case 'marketCap':
          order = capRank[a.result.instrument.marketCap] - capRank[b.result.instrument.marketCap];
          break;
        default:
          order = b.score - a.score;
      }
      // Stable final tie-break on the instrument identifier (spec page 24).
      return order !== 0 ? order : a.result.instrument.id.localeCompare(b.result.instrument.id);
    });
    return results.map(({ result }) => result);
  }

  sectorsList(): string[] {
    return [
      ...new Set(
        INSTRUMENTS.filter((instrument) => instrument.status !== 'delisted').map(
          (instrument) => instrument.sector,
        ),
      ),
    ].sort();
  }

  marketOverview(): MarketOverview {
    this.tick();
    const now = this.now();
    const usTimes = sessionTimes('US', EDITORIAL_DATE);
    const euTimes = sessionTimes('EU', EDITORIAL_DATE);
    const usQuote = demoQuote('idx_spx', now, this.db.feed);
    const euQuote = demoQuote('idx_sxxp', now, this.db.feed);
    return {
      sessions: [
        {
          region: 'US',
          label: 'US session',
          session: usQuote.session,
          opensAt: iso(usTimes.opensAt),
          closesAt: iso(usTimes.closesAt),
          nextOpen: usQuote.nextOpen,
          timeZone: 'America/New_York',
        },
        {
          region: 'EU',
          label: 'Europe',
          session: euQuote.session,
          opensAt: iso(euTimes.opensAt),
          closesAt: iso(euTimes.closesAt),
          nextOpen: euQuote.nextOpen,
          timeZone: 'Europe/Amsterdam',
        },
      ],
      indices: INDICES.map((index) => demoIndex(index.id, now, this.db.feed)).filter(
        (value) => value != null,
      ),
      sectors: SECTORS,
      catalysts: CATALYSTS.filter((catalyst) => Date.parse(catalyst.at) > now - 60 * 60_000).sort(
        (a, b) => Date.parse(a.at) - Date.parse(b.at),
      ),
      asOf: iso(now),
    };
  }

  // ---------- Picks, research, archive ----------

  private momentumAssessment(instrumentId: string): Assessment {
    const series = demoSeries(instrumentId, '3M', this.now(), this.db.feed);
    const valid = series.samples.filter((sample) => sample.v != null);
    const base: Omit<Assessment, 'value' | 'tone'> = {
      key: 'momentum',
      label: 'Momentum',
      basis: 'rule',
      attribution: MOMENTUM_RULE.id,
      definition: MOMENTUM_RULE.definition,
    };
    if (valid.length < 63) return { ...base, value: 'Not enough history', tone: 'neutral' };
    const last = valid[valid.length - 1]!.v!;
    const first = valid[0]!.v!;
    const window = valid.slice(-50);
    const average = window.reduce((sum, sample) => sum + sample.v!, 0) / window.length;
    const ret = (last / first - 1) * 100;
    if (last > average && ret >= 10) return { ...base, value: 'Strong', tone: 'positive' };
    if (last > average) return { ...base, value: 'Positive', tone: 'positive' };
    return { ...base, value: 'Weak', tone: 'negative' };
  }

  private buildPick(spec: (typeof PICK_SPECS)[number]): Pick {
    const momentum = this.momentumAssessment(spec.instrumentId);
    const quality: Assessment = {
      key: 'quality',
      label: 'Quality',
      basis: 'analyst',
      attribution: 'M. Novak (sample analyst)',
      ...spec.quality,
    };
    const risk: Assessment = {
      key: 'risk',
      label: 'Risk',
      basis: 'analyst',
      attribution: 'M. Novak (sample analyst)',
      ...spec.risk,
    };
    const instrument = INSTRUMENT_BY_ID.get(spec.instrumentId)!;
    return {
      id: spec.id,
      instrumentId: spec.instrumentId,
      symbol: instrument.symbol,
      name: instrument.shortName,
      industry: instrument.industry,
      editorialDate: EDITORIAL_DATE,
      order: spec.order,
      category: spec.category,
      headline: spec.headline,
      whyHere: spec.whyHere,
      thesisLine: spec.thesisLine,
      horizon: spec.horizon,
      thesisStatus: 'active',
      publishedAt: PICKS_PUBLISHED_AT,
      reportId: spec.reportId,
      reportVersion: spec.reportVersion,
      methodologyVersion: METHODOLOGY.version,
      analyst: 'M. Novak (sample analyst)',
      assessments: [momentum, quality, risk],
      catalyst: spec.catalyst,
      keyRisk: spec.keyRisk,
      ratingLabel: momentum.value === 'Strong' ? { ...momentum, value: 'Strong momentum' } : null,
    };
  }

  picksToday(): DailyPicks {
    this.tick();
    return {
      editorialDate: EDITORIAL_DATE,
      publishedAt: PICKS_PUBLISHED_AT,
      methodology: METHODOLOGY,
      picks: PICK_SPECS.map((spec) => this.buildPick(spec)).sort((a, b) => a.order - b.order),
    };
  }

  pick(id: string): Pick {
    const spec = PICK_SPECS.find((candidate) => candidate.id === id);
    if (!spec) throw notFound('This pick');
    return this.buildPick(spec);
  }

  /** Today's pick for an instrument, if one exists (S02 context). */
  pickForInstrument(instrumentId: string): Pick | null {
    const spec = PICK_SPECS.find((candidate) => candidate.instrumentId === instrumentId);
    return spec ? this.buildPick(spec) : null;
  }

  private reportSummary(report: DemoReport): ReportSummary {
    const latest = report.versions[report.versions.length - 1]!;
    return {
      id: report.id,
      kind: report.kind,
      label: report.label,
      title: report.title,
      dek: report.dek,
      readingMinutes: report.readingMinutes,
      instrumentIds: report.instrumentIds,
      sectorTags: report.sectorTags,
      latestVersion: latest.version,
      firstPublishedAt: report.versions[0]!.publishedAt,
      latestPublishedAt: latest.publishedAt,
      status: report.status,
      withdrawnReason: report.withdrawnReason,
      versions: report.versions.map((version) => ({
        version: version.version,
        publishedAt: version.publishedAt,
        changeSummary: version.changeSummary,
      })),
    };
  }

  reports(filter: {
    kind?: 'latest' | 'sector' | 'thesis';
    instrumentId?: string;
  }): ReportSummary[] {
    const now = this.now();
    let list = REPORTS.filter((report) => Date.parse(report.versions[0]!.publishedAt) <= now);
    if (filter.kind === 'latest') list = list.filter((report) => !report.id.startsWith('rep_arc_'));
    if (filter.kind === 'sector')
      list = list.filter(
        (report) => report.kind === 'sector' || report.kind === 'earnings' || report.kind === 'ipo',
      );
    if (filter.kind === 'thesis') list = list.filter((report) => report.kind === 'thesis');
    if (filter.instrumentId)
      list = list.filter((report) => report.instrumentIds.includes(filter.instrumentId!));
    return list
      .map((report) => this.reportSummary(report))
      .sort(
        (a, b) =>
          Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt) ||
          a.id.localeCompare(b.id),
      );
  }

  report(id: string, version?: number): Report {
    const report = REPORT_BY_ID.get(id);
    if (!report) throw notFound('This report');
    const chosen =
      version == null
        ? report.versions[report.versions.length - 1]
        : report.versions.find((v) => v.version === version);
    if (!chosen) throw notFound(`Version ${version} of this report`);
    return {
      ...this.reportSummary(report),
      current: chosen,
      sources: chosen.sourceIds
        .map((sourceId) => SOURCE_BY_ID.get(sourceId))
        .filter((source) => source != null),
    };
  }

  archive(filter: {
    status?: 'all' | 'active' | 'closed';
    sinceDays?: number | null;
  }): ArchivedPick[] {
    const now = this.now();
    const today: ArchivedPick[] = PICK_SPECS.map((spec) => {
      const instrument = INSTRUMENT_BY_ID.get(spec.instrumentId)!;
      const report = REPORT_BY_ID.get(spec.reportId)!;
      const archiveSpec = {
        id: spec.id,
        instrumentId: spec.instrumentId,
        publishedAt: PICKS_PUBLISHED_AT,
        category: spec.category,
        targetReturnPct: null,
        headline: spec.headline,
        thesis: spec.thesisLine,
        benchmarkId: instrument.region === 'EU' ? ('idx_sxxp' as const) : ('idx_spx' as const),
      };
      return {
        id: `arc_${spec.id}`,
        pickId: spec.id,
        instrumentId: spec.instrumentId,
        symbolAtPublication: instrument.symbol,
        nameAtPublication: instrument.name,
        publishedAt: PICKS_PUBLISHED_AT,
        category: spec.category,
        originalHeadline: spec.headline,
        originalThesis: spec.thesisLine,
        reportId: spec.reportId,
        reportVersionAtPublication: spec.reportVersion,
        latestVersion: report.versions.length,
        revisions: report.versions
          .filter((version) => version.version > spec.reportVersion)
          .map((version) => ({
            version: version.version,
            at: version.publishedAt,
            summary: version.changeSummary ?? '',
          })),
        thesisStatus: 'active',
        outcome: computeOutcome(archiveSpec, now),
        delisted: null,
      };
    });
    let list = [...today, ...archiveFromSpecs(now)];
    if (filter.status === 'active') list = list.filter((pick) => pick.outcome.status === 'pending');
    if (filter.status === 'closed')
      list = list.filter((pick) => pick.outcome.status === 'complete');
    if (filter.sinceDays != null) {
      const cutoff = now - filter.sinceDays * 24 * 60 * 60_000;
      list = list.filter((pick) => Date.parse(pick.publishedAt) >= cutoff);
    }
    return list.sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id),
    );
  }

  archivedPick(id: string): ArchivedPick {
    const pick = this.archive({ status: 'all' }).find((candidate) => candidate.id === id);
    if (!pick) throw notFound('This archived pick');
    return pick;
  }

  performanceReview(filter: { sinceDays?: number | null }) {
    const picks = this.archive({ status: 'all', sinceDays: filter.sinceDays ?? null });
    const summary = summarizeOutcomes(
      picks.map((pick) => ({
        status: pick.outcome.status,
        returnPct: pick.outcome.returnPct,
        benchmarkPct: pick.outcome.benchmark.returnPct,
      })),
    );
    return {
      method: MEASUREMENT_METHOD,
      summary: {
        complete: summary.complete,
        pending: summary.pending,
        meanPct: summary.meanPct?.toFixed(4) ?? null,
        medianPct: summary.medianPct?.toFixed(4) ?? null,
        positive: summary.positive,
        positiveSharePct: summary.positiveSharePct?.toFixed(4) ?? null,
        benchmarkMeanPct: summary.benchmarkMeanPct?.toFixed(4) ?? null,
        differencePp: summary.differencePp?.toFixed(4) ?? null,
      },
      picks,
      demo: true,
    };
  }

  measurementMethod() {
    return MEASUREMENT_METHOD;
  }

  valuationModel(instrumentId: string): ValuationModel {
    const model = VALUATION_MODELS.find((candidate) => candidate.instrumentId === instrumentId);
    if (!model) throw notFound('A valuation model for this company');
    return model;
  }

  // ---------- Earnings and IPOs ----------

  private withReaction(event: EarningsEvent): EarningsEvent {
    if (event.status !== 'reported' || !event.reaction) return event;
    const path = anyPath(event.instrumentId);
    const instrument = INSTRUMENT_BY_ID.get(event.instrumentId)!;
    const calendar = instrument.price?.calendar ?? 'US';
    if (!path) return event;
    const now = this.now();
    const releasedAt = Date.parse(
      event.actual?.reportedAt ?? event.expectedAt ?? `${event.date}T12:00:00Z`,
    );
    const tz = path.timeZone;
    const day = localDateKey(releasedAt, tz);
    const beforeOpen = releasedAt < sessionTimes(calendar, day).opensAt;
    const days = [
      ...path.daily.map((bar) => bar.date),
      ...(path.demoSession ? [path.demoSession.date] : []),
    ];
    const reactionDay = beforeOpen ? day : (days.find((candidate) => candidate > day) ?? null);
    const priorDay = reactionDay
      ? ([...days].reverse().find((candidate) => candidate < reactionDay) ?? null)
      : null;
    const priorClose = priorDay ? closeOn(path, priorDay, now) : null;
    const reactionClose = reactionDay ? closeOn(path, reactionDay, now) : null;
    const inProgress = reactionDay != null && reactionClose == null;
    const current = inProgress ? demoQuote(event.instrumentId, now, this.db.feed).price : null;
    const value = reactionClose ?? (current ? Number(current) : null);
    const changePct = priorClose && value ? ((value / priorClose - 1) * 100).toFixed(4) : null;
    const index = reactionDay ? days.indexOf(reactionDay) : -1;
    const windowDays = index >= 0 ? days.slice(Math.max(0, index - 6), index + 5) : [];
    const series = windowDays
      .map((date) => {
        const close = closeOn(path, date, now);
        return close == null ? null : { t: sessionTimes(calendar, date).closesAt, v: close };
      })
      .filter((sample) => sample != null);
    return {
      ...event,
      reaction: {
        changePct,
        basis: inProgress
          ? 'Session in progress: latest price vs. pre-release close. Final after today’s close.'
          : beforeOpen
            ? 'Same-session close vs. previous close'
            : 'Next-session close vs. pre-release close',
        series,
      },
    };
  }

  earningsWeek(weekStart: string): { weekStart: string; days: string[]; events: EarningsEvent[] } {
    const days = [0, 1, 2, 3, 4].map((offset) => addDaysToKey(weekStart, offset));
    const events = EARNINGS.filter((event) => days.includes(event.date))
      .map((event) => this.withReaction(event))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.expectedAt ? Date.parse(a.expectedAt) : Number.MAX_SAFE_INTEGER) -
            (b.expectedAt ? Date.parse(b.expectedAt) : Number.MAX_SAFE_INTEGER) ||
          a.id.localeCompare(b.id),
      );
    return { weekStart, days, events };
  }

  earningsEvent(id: string): EarningsEvent {
    const event = EARNINGS.find((candidate) => candidate.id === id);
    if (!event) throw notFound('This earnings event');
    return this.withReaction(event);
  }

  earningsForInstrument(instrumentId: string): EarningsEvent[] {
    return EARNINGS.filter((event) => event.instrumentId === instrumentId).map((event) =>
      this.withReaction(event),
    );
  }

  ipos(filter: { tab: 'upcoming' | 'listed' | 'saved'; region: 'US' | 'EU' | 'all' }): IpoIssuer[] {
    let list = IPOS;
    if (filter.region !== 'all') list = list.filter((ipo) => ipo.region === filter.region);
    if (filter.tab === 'upcoming')
      list = list.filter((ipo) => ipo.status === 'upcoming' || ipo.status === 'postponed');
    if (filter.tab === 'listed') list = list.filter((ipo) => ipo.status === 'listed');
    if (filter.tab === 'saved') {
      const authed = this.currentSession();
      const saved = new Set(
        authed
          ? authed.user.watchlists.flatMap((list) =>
              list.members.map((member) => member.instrumentId),
            )
          : [],
      );
      list = list.filter((ipo) => saved.has(ipo.instrumentId));
    }
    return [...list].sort(
      (a, b) =>
        (a.expectedDate ?? '9999').localeCompare(b.expectedDate ?? '9999') ||
        a.id.localeCompare(b.id),
    );
  }

  /** Source records by id, in the requested order; unknown ids are omitted. */
  sources(ids: string[]): Source[] {
    return ids.map((id) => SOURCE_BY_ID.get(id)).filter((source) => source != null);
  }

  ipo(id: string): IpoIssuer {
    const ipo = IPOS.find((candidate) => candidate.id === id || candidate.instrumentId === id);
    if (!ipo) throw notFound('This listing');
    return ipo;
  }

  // ---------- Account ----------

  me(): Me | null {
    const authed = this.currentSession();
    if (!authed) return null;
    const { account } = authed;
    this.commit();
    return {
      id: account.id,
      email: account.email,
      pendingEmail: account.pendingEmail,
      displayName: account.displayName,
      verified: account.verifiedAt != null,
      memberSince: iso(account.createdAt),
      access: {
        plan: 'core',
        label: 'Core',
        detail: 'Free research access. Paid plans are not offered in this release.',
      },
      demo: true,
    };
  }

  private startSession(account: DemoAccount, device: string): string {
    const id = newId('ses');
    const now = Date.now();
    this.db.sessions[id] = {
      id,
      accountId: account.id,
      createdAt: now,
      lastSeenAt: now,
      authenticatedAt: now,
      device,
      revokedAt: null,
    };
    writeSessionToken(id);
    return id;
  }

  async signIn(email: string, password: string, device: string): Promise<Me> {
    const normalized = email.trim().toLowerCase();
    const account = Object.values(this.db.accounts).find(
      (candidate) => candidate.emailNormalized === normalized && !candidate.deletedAt,
    );
    // Same message for unknown email and wrong password: never reveal whether an account exists.
    const failure = new ApiError(
      'validation',
      'That email and password combination is not recognised.',
      {
        fieldErrors: { password: 'Check your password and try again.' },
      },
    );
    if (!account) {
      await hashPassword(password, randomHex(16));
      throw failure;
    }
    const digest = await hashPassword(password, account.salt);
    if (!digestsEqual(digest, account.passwordHash)) throw failure;
    this.startSession(account, device);
    this.commit();
    return this.me()!;
  }

  signOut(): void {
    const token = readSessionToken();
    if (token && this.db.sessions[token]) this.db.sessions[token]!.revokedAt = Date.now();
    writeSessionToken(null);
    this.commit();
  }

  async register(
    input: { email: string; password: string; displayName: string; acceptedTerms: boolean },
    device: string,
  ): Promise<Me> {
    const fieldErrors: Record<string, string> = {};
    const emailError = validateEmail(input.email);
    const passwordError = validateNewPassword(input.password);
    const nameError = validateDisplayName(input.displayName);
    if (emailError) fieldErrors.email = emailError;
    if (passwordError) fieldErrors.password = passwordError;
    if (nameError) fieldErrors.displayName = nameError;
    if (!input.acceptedTerms) fieldErrors.acceptedTerms = 'Accept the account terms to continue.';
    if (Object.keys(fieldErrors).length)
      throw new ApiError('validation', 'Check the highlighted fields.', { fieldErrors });
    const normalized = input.email.trim().toLowerCase();
    if (
      Object.values(this.db.accounts).some(
        (account) => account.emailNormalized === normalized && !account.deletedAt,
      )
    ) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        fieldErrors: {
          email: 'An account may already use this email. Sign in or reset your password.',
        },
      });
    }
    const salt = randomHex(16);
    const id = newId('acc');
    const now = Date.now();
    const account: DemoAccount = {
      id,
      email: input.email.trim(),
      emailNormalized: normalized,
      pendingEmail: null,
      displayName: input.displayName.trim(),
      passwordHash: await hashPassword(input.password, salt),
      salt,
      verifiedAt: null,
      createdAt: now,
      deletedAt: null,
      verification: null,
      reset: null,
    };
    this.db.accounts[id] = account;
    this.db.users[id] = emptyUserData(iso(now), this.now());
    this.sendVerification(account, account.email);
    this.startSession(account, device);
    this.commit();
    return this.me()!;
  }

  private sendVerification(account: DemoAccount, email: string): void {
    const token = randomHex(20);
    const now = Date.now();
    account.verification = { token, email, sentAt: now, expiresAt: now + 24 * 60 * 60_000 };
    this.db.mailbox.unshift({
      id: newId('mail'),
      to: email,
      subject: 'Verify your email for Stock Picks',
      body: 'Confirm this address to save companies, research and alerts. The link expires in 24 hours.',
      action: { label: 'Verify email', path: `/auth/verify?token=${token}` },
      sentAt: iso(now),
    });
  }

  resendVerification(): { nextAllowedAt: string } {
    const { account } = this.requireUser();
    const last = account.verification?.sentAt ?? 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
      throw new ApiError('throttled', 'Please wait a minute before requesting another email.', {
        details: { nextAllowedAt: iso(last + RESEND_COOLDOWN_MS) },
      });
    }
    this.sendVerification(account, account.pendingEmail ?? account.email);
    this.commit();
    return { nextAllowedAt: iso(Date.now() + RESEND_COOLDOWN_MS) };
  }

  verifyEmail(token: string): { verified: true; email: string } {
    const account = Object.values(this.db.accounts).find(
      (candidate) => candidate.verification?.token === token,
    );
    if (!account || !account.verification) {
      throw new ApiError(
        'validation',
        'This verification link has already been used or is not valid. Request a new one.',
      );
    }
    if (Date.now() > account.verification.expiresAt) {
      throw new ApiError('validation', 'This verification link has expired. Request a new one.');
    }
    const email = account.verification.email;
    if (account.pendingEmail && email === account.pendingEmail) {
      account.email = email;
      account.emailNormalized = email.toLowerCase();
      account.pendingEmail = null;
    }
    account.verifiedAt = Date.now();
    account.verification = null;
    this.commit();
    return { verified: true, email };
  }

  requestPasswordReset(email: string): { sent: true } {
    const normalized = email.trim().toLowerCase();
    const account = Object.values(this.db.accounts).find(
      (candidate) => candidate.emailNormalized === normalized && !candidate.deletedAt,
    );
    if (account) {
      const token = randomHex(20);
      const now = Date.now();
      account.reset = { token, sentAt: now, expiresAt: now + 60 * 60_000, usedAt: null };
      this.db.mailbox.unshift({
        id: newId('mail'),
        to: account.email,
        subject: 'Reset your Stock Picks password',
        body: 'Use this single-use link within one hour to choose a new password. If you did not ask for this, ignore this email.',
        action: { label: 'Choose a new password', path: `/auth/reset?token=${token}` },
        sentAt: iso(now),
      });
      this.commit();
    }
    // Neutral response whether or not the address has an account.
    return { sent: true };
  }

  checkResetToken(token: string): {
    valid: boolean;
    reason: 'expired' | 'used' | 'invalid' | null;
  } {
    const account = Object.values(this.db.accounts).find(
      (candidate) => candidate.reset?.token === token,
    );
    if (!account?.reset) return { valid: false, reason: 'invalid' };
    if (account.reset.usedAt) return { valid: false, reason: 'used' };
    if (Date.now() > account.reset.expiresAt) return { valid: false, reason: 'expired' };
    return { valid: true, reason: null };
  }

  async resetPassword(token: string, password: string): Promise<{ reset: true }> {
    const check = this.checkResetToken(token);
    if (!check.valid) {
      throw new ApiError(
        'validation',
        check.reason === 'expired'
          ? 'This reset link has expired. Request a new one.'
          : 'This reset link has already been used or is not valid. Request a new one.',
      );
    }
    const passwordError = validateNewPassword(password);
    if (passwordError)
      throw new ApiError('validation', 'Check the highlighted fields.', {
        fieldErrors: { password: passwordError },
      });
    const account = Object.values(this.db.accounts).find(
      (candidate) => candidate.reset?.token === token,
    )!;
    account.salt = randomHex(16);
    account.passwordHash = await hashPassword(password, account.salt);
    account.reset!.usedAt = Date.now();
    // Revoke existing sessions after a password reset.
    for (const session of Object.values(this.db.sessions)) {
      if (session.accountId === account.id) session.revokedAt = session.revokedAt ?? Date.now();
    }
    this.commit();
    return { reset: true };
  }

  async reauthenticate(password: string): Promise<{ ok: true }> {
    const authed = this.requireUser();
    const digest = await hashPassword(password, authed.account.salt);
    if (!digestsEqual(digest, authed.account.passwordHash)) {
      throw new ApiError('validation', 'That password is not correct.', {
        fieldErrors: { password: 'That password is not correct.' },
      });
    }
    authed.session.authenticatedAt = Date.now();
    this.commit();
    return { ok: true };
  }

  updateProfile(displayName: string): Me {
    const { account } = this.requireUser();
    const error = validateDisplayName(displayName);
    if (error)
      throw new ApiError('validation', 'Check the highlighted fields.', {
        fieldErrors: { displayName: error },
      });
    account.displayName = displayName.trim();
    this.commit();
    return this.me()!;
  }

  changeEmail(email: string): Me {
    const authed = this.requireUser();
    this.requireFreshAuth(authed);
    const error = validateEmail(email);
    if (error)
      throw new ApiError('validation', 'Check the highlighted fields.', {
        fieldErrors: { email: error },
      });
    authed.account.pendingEmail = email.trim();
    this.sendVerification(authed.account, email.trim());
    this.commit();
    return this.me()!;
  }

  async changePassword(current: string, next: string): Promise<{ ok: true }> {
    const authed = this.requireUser();
    const digest = await hashPassword(current, authed.account.salt);
    if (!digestsEqual(digest, authed.account.passwordHash)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        fieldErrors: { current: 'That password is not correct.' },
      });
    }
    const error = validateNewPassword(next);
    if (error)
      throw new ApiError('validation', 'Check the highlighted fields.', {
        fieldErrors: { next: error },
      });
    authed.account.salt = randomHex(16);
    authed.account.passwordHash = await hashPassword(next, authed.account.salt);
    authed.session.authenticatedAt = Date.now();
    this.commit();
    return { ok: true };
  }

  sessions(): SessionInfo[] {
    const authed = this.requireUser();
    return Object.values(this.db.sessions)
      .filter((session) => session.accountId === authed.account.id && !session.revokedAt)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map((session) => ({
        id: session.id,
        current: session.id === authed.session.id,
        createdAt: iso(session.createdAt),
        lastSeenAt: iso(session.lastSeenAt),
        device: session.device,
      }));
  }

  revokeSession(id: string): SessionInfo[] {
    const authed = this.requireUser();
    const session = this.db.sessions[id];
    if (!session || session.accountId !== authed.account.id) throw notFound('This session');
    session.revokedAt = Date.now();
    if (id === authed.session.id) writeSessionToken(null);
    this.commit();
    return id === authed.session.id ? [] : this.sessions();
  }

  mailbox(): MailMessage[] {
    return this.db.mailbox.slice(0, 30);
  }

  // ---------- Support ----------

  submitSupportTicket(
    input: {
      topic: string;
      message: string;
      email: string;
      diagnostics: { requestId: string; name: string; outcome: string }[] | null;
    },
    idempotencyKey: string,
  ): { ref: string } {
    const authed = this.currentSession();
    return this.idempotent(idempotencyKey, { op: 'support', input }, () => {
      const fieldErrors: Record<string, string> = {};
      if (!input.topic) fieldErrors.topic = 'Choose a topic.';
      if (input.message.trim().length < 10)
        fieldErrors.message = 'Describe what happened in a sentence or two.';
      if (input.message.length > 4000) fieldErrors.message = 'Use 4,000 characters or fewer.';
      const emailError = validateEmail(input.email);
      if (emailError) fieldErrors.email = emailError;
      if (Object.keys(fieldErrors).length)
        throw new ApiError('validation', 'Check the highlighted fields.', { fieldErrors });
      this.db.supportTickets ??= [];
      const ref = `SUP-${String(this.db.supportTickets.length + 1041).padStart(5, '0')}`;
      this.db.supportTickets.unshift({
        id: newId('sup'),
        ref,
        accountId: authed?.account.id ?? null,
        topic: input.topic,
        message: input.message.trim(),
        email: input.email.trim(),
        diagnostics: input.diagnostics,
        createdAt: Date.now(),
      });
      this.db.mailbox.unshift({
        id: newId('mail'),
        to: input.email.trim(),
        subject: `We received your report (${ref})`,
        body: 'Thanks for telling us. A person reads every report; replies usually arrive within two working days. Keep this reference.',
        action: null,
        sentAt: iso(Date.now()),
      });
      this.commit();
      return { ref };
    });
  }

  // ---------- Preferences ----------

  preferences(): Preferences {
    return this.requireUser().user.preferences;
  }

  updatePreferences(
    patch: Partial<Omit<Preferences, 'version' | 'updatedAt'>>,
    version: number,
  ): Preferences {
    const { user } = this.requireUser();
    if (version !== user.preferences.version) {
      throw new ApiError(
        'version_conflict',
        'These settings changed on another device. Review both versions before saving.',
        {
          details: { latest: user.preferences },
        },
      );
    }
    const next: Preferences = {
      ...user.preferences,
      ...patch,
      research: { ...user.preferences.research, ...(patch.research ?? {}) },
      display: { ...user.preferences.display, ...(patch.display ?? {}) },
      regional: { ...user.preferences.regional, ...(patch.regional ?? {}) },
      notifications: {
        ...user.preferences.notifications,
        ...(patch.notifications ?? {}),
        categories: {
          ...user.preferences.notifications.categories,
          ...(patch.notifications?.categories ?? {}),
        },
        briefing: {
          ...user.preferences.notifications.briefing,
          ...(patch.notifications?.briefing ?? {}),
        },
        quietHours: {
          ...user.preferences.notifications.quietHours,
          ...(patch.notifications?.quietHours ?? {}),
        },
        channels: {
          ...user.preferences.notifications.channels,
          ...(patch.notifications?.channels ?? {}),
        },
      },
      version: user.preferences.version + 1,
      updatedAt: iso(Date.now()),
    };
    user.preferences = next;
    this.commit();
    return next;
  }

  // ---------- Watchlists ----------

  watchlists(): Watchlist[] {
    return [...this.requireUser().user.watchlists].sort((a, b) => a.position - b.position);
  }

  private ownedList(user: UserData, id: string): Watchlist {
    const list = user.watchlists.find((candidate) => candidate.id === id);
    if (!list) throw notFound('This watchlist');
    return list;
  }

  createWatchlist(name: string, idempotencyKey?: string): Watchlist {
    const { user } = this.requireVerified();
    return this.idempotent(
      idempotencyKey,
      { op: 'createWatchlist', name: normalizeName(name) },
      () => {
        const check = validateWatchlistName(name, user.watchlists);
        if (!check.ok) {
          throw new ApiError(check.duplicateOf ? 'duplicate' : 'validation', check.message, {
            fieldErrors: { name: check.message },
            details: check.duplicateOf ? { existingId: check.duplicateOf } : {},
          });
        }
        const now = iso(Date.now());
        const list: Watchlist = {
          id: newId('wl'),
          name: check.value,
          position: user.watchlists.length,
          version: 1,
          createdAt: now,
          updatedAt: now,
          members: [],
        };
        user.watchlists.push(list);
        this.commit();
        return list;
      },
    );
  }

  renameWatchlist(id: string, name: string, version: number): Watchlist {
    const { user } = this.requireVerified();
    const list = this.ownedList(user, id);
    if (list.version !== version) {
      throw new ApiError(
        'version_conflict',
        'This list changed on another device. Review both versions before saving.',
        { details: { latest: list } },
      );
    }
    const check = validateWatchlistName(name, user.watchlists, id);
    if (!check.ok) {
      throw new ApiError(check.duplicateOf ? 'duplicate' : 'validation', check.message, {
        fieldErrors: { name: check.message },
      });
    }
    list.name = check.value;
    list.version += 1;
    list.updatedAt = iso(Date.now());
    this.commit();
    return list;
  }

  deleteWatchlist(id: string): { deleted: true } {
    const { user } = this.requireVerified();
    this.ownedList(user, id);
    // Deleting a list keeps notes, alerts and other list memberships (spec page 26).
    user.watchlists = user.watchlists
      .filter((list) => list.id !== id)
      .map((list, position) => ({ ...list, position }));
    this.commit();
    return { deleted: true };
  }

  addMember(listId: string, instrumentId: string): Watchlist {
    const { user } = this.requireVerified();
    const list = this.ownedList(user, listId);
    this.resolveInstrument(instrumentId);
    if (!list.members.some((member) => member.instrumentId === instrumentId)) {
      list.members.push({
        instrumentId,
        symbol: INSTRUMENT_BY_ID.get(instrumentId)!.symbol,
        position: list.members.length,
        addedAt: iso(Date.now()),
      });
      list.version += 1;
      list.updatedAt = iso(Date.now());
      this.commit();
    }
    // Duplicate membership is an idempotent success (spec page 49).
    return list;
  }

  removeMember(listId: string, instrumentId: string): Watchlist {
    const { user } = this.requireVerified();
    const list = this.ownedList(user, listId);
    const before = list.members.length;
    list.members = list.members
      .filter((member) => member.instrumentId !== instrumentId)
      .map((member, position) => ({ ...member, position }));
    if (list.members.length !== before) {
      list.version += 1;
      list.updatedAt = iso(Date.now());
      this.commit();
    }
    return list;
  }

  // ---------- Saved research and scenarios ----------

  savedReports(): SavedReport[] {
    return this.requireUser().user.savedReports;
  }

  saveReport(reportId: string, version: number): SavedReport {
    const { user } = this.requireVerified();
    this.report(reportId, version);
    const existing = user.savedReports.find((saved) => saved.reportId === reportId);
    if (existing) {
      existing.version = version;
      existing.savedAt = iso(Date.now());
      this.commit();
      return existing;
    }
    const saved: SavedReport = { reportId, version, savedAt: iso(Date.now()), readingOffset: 0 };
    user.savedReports.unshift(saved);
    this.commit();
    return saved;
  }

  unsaveReport(reportId: string): { removed: true } {
    const { user } = this.requireVerified();
    user.savedReports = user.savedReports.filter((saved) => saved.reportId !== reportId);
    this.commit();
    return { removed: true };
  }

  scenarios(instrumentId: string): SavedScenario[] {
    return this.requireUser().user.scenarios.filter(
      (scenario) => scenario.instrumentId === instrumentId,
    );
  }

  saveScenario(
    input: Omit<SavedScenario, 'id' | 'version' | 'savedAt'>,
    idempotencyKey?: string,
  ): SavedScenario {
    const { user } = this.requireVerified();
    return this.idempotent(idempotencyKey, { op: 'saveScenario', input }, () => {
      const existing = user.scenarios.find(
        (scenario) =>
          scenario.instrumentId === input.instrumentId && scenario.scenario === input.scenario,
      );
      const saved: SavedScenario = {
        ...input,
        id: existing?.id ?? newId('scn'),
        version: (existing?.version ?? 0) + 1,
        savedAt: iso(Date.now()),
      };
      user.scenarios = [saved, ...user.scenarios.filter((scenario) => scenario.id !== saved.id)];
      this.commit();
      return saved;
    });
  }

  // ---------- Alerts ----------

  alerts(): AlertRule[] {
    this.tick();
    return this.requireUser().user.alertRules;
  }

  alert(id: string): AlertRule {
    const rule = this.requireUser().user.alertRules.find((candidate) => candidate.id === id);
    if (!rule) throw notFound('This alert');
    return rule;
  }

  private validateRule(
    user: UserData,
    input: AlertRuleInput,
    ignoreId?: string,
  ): { threshold: string | null } {
    const instrument = this.resolveInstrument(input.instrumentId);
    const fieldErrors: Record<string, string> = {};
    let threshold: string | null = null;
    if (input.type === 'price') {
      if (instrument.status !== 'listed')
        fieldErrors.threshold = 'Price alerts start once the company is listed and quoted.';
      const result = validateThreshold(input.threshold ?? '', instrument);
      if (!result.ok) fieldErrors.threshold = result.message;
      else threshold = result.value;
      if (!input.comparator) fieldErrors.comparator = 'Choose a condition.';
    }
    if (input.type === 'earnings' && !input.earningsId)
      fieldErrors.earningsId = 'Choose an earnings event.';
    if (input.channels.length === 0)
      fieldErrors.channels = 'Choose at least one way to be notified.';
    if (Object.keys(fieldErrors).length)
      throw new ApiError('validation', 'Check the highlighted fields.', { fieldErrors });
    if (input.type === 'price' && threshold && input.comparator) {
      const duplicate = user.alertRules.find(
        (rule) =>
          rule.id !== ignoreId &&
          rule.type === 'price' &&
          rule.state !== 'expired' &&
          rule.comparator != null &&
          rule.threshold != null &&
          isDuplicateRule(
            {
              instrumentId: rule.instrumentId,
              comparator: rule.comparator,
              threshold: rule.threshold,
              repeat: rule.repeat,
              channels: rule.channels,
            },
            {
              instrumentId: input.instrumentId,
              comparator: input.comparator!,
              threshold,
              repeat: input.repeat,
              channels: input.channels,
            },
          ),
      );
      if (duplicate) {
        throw new ApiError(
          'duplicate',
          'You already have this alert. Open it to edit or pause it instead.',
          {
            details: { existingId: duplicate.id },
          },
        );
      }
    }
    if (input.type !== 'price') {
      const duplicate = user.alertRules.find(
        (rule) =>
          rule.id !== ignoreId &&
          rule.type === input.type &&
          rule.instrumentId === input.instrumentId &&
          (rule.earningsId ?? null) === (input.earningsId ?? null) &&
          (rule.reportId ?? null) === (input.reportId ?? null) &&
          rule.state === 'armed',
      );
      if (duplicate) {
        throw new ApiError(
          'duplicate',
          'You already have this alert. Open it to edit or pause it instead.',
          {
            details: { existingId: duplicate.id },
          },
        );
      }
    }
    return { threshold };
  }

  /** Preview without persisting: arming state and the explanation shown before confirmation. */
  previewAlert(input: AlertRuleInput): { alreadyBeyond: boolean; message: string | null } {
    const { user } = this.requireUser();
    const { threshold } = this.validateRule(user, input);
    if (input.type === 'earnings' && input.earningsId) {
      const event = EARNINGS.find((candidate) => candidate.id === input.earningsId);
      if (!event) return { alreadyBeyond: false, message: null };
      const zone = user.preferences.regional.timeZone;
      const { at, timeConfirmed } = earningsReminderTime(event, zone);
      return {
        alreadyBeyond: false,
        message:
          at <= this.now()
            ? 'The release is less than a day away, so the reminder is sent as soon as you save.'
            : `The reminder arrives ${formatDateTime(at, zone)}${timeConfirmed ? ', 24 hours before the confirmed release.' : ', because the release time is not confirmed yet.'}`,
      };
    }
    if (input.type !== 'price' || !threshold || !input.comparator)
      return { alreadyBeyond: false, message: null };
    const quote = demoQuote(input.instrumentId, this.now(), this.db.feed);
    const latest =
      quote.price && quote.observationId && quote.asOf
        ? {
            id: quote.observationId,
            instrumentId: input.instrumentId,
            price: quote.price,
            observedAt: Date.parse(quote.asOf),
            fresh: quote.status === 'demo' || quote.status === 'delayed',
            inSession: true,
          }
        : null;
    const armed = armRule(
      {
        id: 'preview',
        instrumentId: input.instrumentId,
        comparator: input.comparator,
        threshold,
        repeat: input.repeat,
        cooldownMs: 5 * 60_000,
      },
      latest,
    );
    const instrument = INSTRUMENT_BY_ID.get(input.instrumentId)!;
    const money = formatMoney(threshold, instrument.currency);
    return {
      alreadyBeyond: armed.alreadyBeyond,
      message: armed.alreadyBeyond
        ? input.comparator === 'cross_above'
          ? `Price is already above ${money}. This alert will wait for a new crossing from below.`
          : `Price is already below ${money}. This alert will wait for a new crossing from above.`
        : null,
    };
  }

  createAlert(input: AlertRuleInput, idempotencyKey?: string): AlertRule {
    const { user } = this.requireVerified();
    return this.idempotent(idempotencyKey, { op: 'createAlert', input }, () => {
      const { threshold } = this.validateRule(user, input);
      const instrument = INSTRUMENT_BY_ID.get(input.instrumentId)!;
      const now = iso(Date.now());
      let rule: AlertRule = {
        id: newId('rule'),
        instrumentId: input.instrumentId,
        symbol: instrument.symbol,
        type: input.type,
        comparator: input.comparator ?? null,
        threshold,
        currency: instrument.currency,
        earningsId: input.earningsId ?? null,
        reportId: input.reportId ?? null,
        repeat: input.repeat,
        cooldownMinutes: 5,
        channels: input.channels,
        state: 'armed',
        lastSide: null,
        baselineObservationId: null,
        lastFiredAt: null,
        waitingForReset: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      if (input.type === 'price') rule = this.rearm(rule);
      user.alertRules.unshift(rule);
      if (input.type === 'earnings' && input.earningsId) {
        // Inside the reminder window the reminder goes out now, labelled as late.
        const event = EARNINGS.find((candidate) => candidate.id === input.earningsId);
        const authed = this.requireUser();
        if (
          event &&
          event.status === 'scheduled' &&
          earningsReminderTime(event, user.preferences.regional.timeZone).at <= this.now()
        ) {
          issueEarningsReminder(this.db, authed.account, user, 0, this.now(), true);
        }
      }
      this.commit();
      return user.alertRules[0]!;
    });
  }

  private rearm(rule: AlertRule): AlertRule {
    const quote = demoQuote(rule.instrumentId, this.now(), this.db.feed);
    const fresh = quote.status === 'demo' || quote.status === 'delayed';
    const latest =
      quote.price && quote.observationId && quote.asOf
        ? {
            id: quote.observationId,
            instrumentId: rule.instrumentId,
            price: quote.price,
            observedAt: Date.parse(quote.asOf),
            fresh,
            inSession: true,
          }
        : null;
    const armed = armRule(
      {
        id: rule.id,
        instrumentId: rule.instrumentId,
        comparator: rule.comparator!,
        threshold: rule.threshold!,
        repeat: rule.repeat,
        cooldownMs: rule.cooldownMinutes * 60_000,
      },
      latest,
    );
    return {
      ...rule,
      state: 'armed',
      lastSide: armed.rule.lastSide,
      baselineObservationId: armed.rule.baselineObservationId,
      lastFiredAt: null,
      waitingForReset: armed.alreadyBeyond,
    };
  }

  updateAlert(id: string, patch: Partial<AlertRuleInput>, version: number): AlertRule {
    const { user } = this.requireVerified();
    const index = user.alertRules.findIndex((rule) => rule.id === id);
    if (index < 0) throw notFound('This alert');
    const rule = user.alertRules[index]!;
    if (rule.version !== version) {
      throw new ApiError(
        'version_conflict',
        'This alert changed on another device. Review both versions before saving.',
        { details: { latest: rule } },
      );
    }
    const input: AlertRuleInput = {
      instrumentId: rule.instrumentId,
      type: rule.type,
      comparator: patch.comparator ?? rule.comparator ?? undefined,
      threshold: patch.threshold ?? rule.threshold ?? undefined,
      earningsId: rule.earningsId ?? undefined,
      reportId: rule.reportId ?? undefined,
      repeat: patch.repeat ?? rule.repeat,
      channels: patch.channels ?? rule.channels,
    };
    const { threshold } = this.validateRule(user, input, id);
    let next: AlertRule = {
      ...rule,
      comparator: input.comparator ?? null,
      threshold,
      repeat: input.repeat,
      channels: input.channels,
      version: rule.version + 1,
      updatedAt: iso(Date.now()),
    };
    // Editing the condition resets the baseline (spec page 52).
    if (rule.type === 'price') next = this.rearm(next);
    user.alertRules[index] = next;
    this.commit();
    return next;
  }

  setAlertPaused(id: string, paused: boolean, version: number): AlertRule {
    const { user } = this.requireVerified();
    const index = user.alertRules.findIndex((rule) => rule.id === id);
    if (index < 0) throw notFound('This alert');
    const rule = user.alertRules[index]!;
    if (rule.version !== version) {
      throw new ApiError(
        'version_conflict',
        'This alert changed on another device. Review both versions before saving.',
        { details: { latest: rule } },
      );
    }
    let next: AlertRule = { ...rule, version: rule.version + 1, updatedAt: iso(Date.now()) };
    if (paused) next = { ...next, state: 'paused' };
    else next = rule.type === 'price' ? this.rearm(next) : { ...next, state: 'armed' };
    // Pausing cancels unsent deliveries for this rule.
    if (paused) {
      for (const item of user.inbox) {
        if (item.ruleId !== id) continue;
        for (const delivery of item.deliveries) {
          if (delivery.status === 'deferred' || delivery.status === 'queued') {
            delivery.status = 'failed';
            delivery.detail = 'Cancelled because the alert was paused';
          }
        }
      }
    }
    user.alertRules[index] = next;
    this.commit();
    return next;
  }

  deleteAlert(id: string): { deleted: true } {
    const { user } = this.requireVerified();
    if (!user.alertRules.some((rule) => rule.id === id)) throw notFound('This alert');
    // Deletion prevents future evaluation; issued history stays in the inbox.
    user.alertRules = user.alertRules.filter((rule) => rule.id !== id);
    this.commit();
    return { deleted: true };
  }

  // ---------- Inbox ----------

  inbox(category: 'all' | InboxItem['category'] | 'prices'): InboxItem[] {
    this.tick();
    const { user } = this.requireUser();
    const items = user.inbox.filter((item) => !item.archivedAt);
    const wanted = category === 'prices' ? 'price' : category;
    return (wanted === 'all' ? items : items.filter((item) => item.category === wanted)).sort(
      (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
    );
  }

  inboxItem(id: string): InboxItem {
    const item = this.requireUser().user.inbox.find((candidate) => candidate.id === id);
    if (!item) throw notFound('This notification');
    return item;
  }

  markRead(ids: string[] | 'all'): { updated: number } {
    const { user } = this.requireUser();
    let updated = 0;
    for (const item of user.inbox) {
      if ((ids === 'all' || ids.includes(item.id)) && !item.readAt) {
        item.readAt = iso(Date.now());
        updated += 1;
      }
    }
    if (updated) this.commit();
    return { updated };
  }

  registerPushDevice(label: string): { deviceId: string } {
    const { user } = this.requireUser();
    const existing = user.pushDevices.find((device) => device.label === label);
    if (existing) return { deviceId: existing.id };
    const device = { id: newId('dev'), label, registeredAt: Date.now() };
    user.pushDevices.push(device);
    this.commit();
    return { deviceId: device.id };
  }

  unregisterPushDevices(): { removed: number } {
    const { user } = this.requireUser();
    const removed = user.pushDevices.length;
    user.pushDevices = [];
    this.commit();
    return { removed };
  }

  pushDeviceCount(): number {
    return this.currentSession()?.user.pushDevices.length ?? 0;
  }

  /** Deliveries the client should show as device notifications (demo push channel). */
  takeQueuedPush(): InboxItem[] {
    const authed = this.currentSession();
    if (!authed) return [];
    const out: InboxItem[] = [];
    for (const item of authed.user.inbox) {
      for (const delivery of item.deliveries) {
        if (delivery.channel === 'push' && delivery.status === 'queued') {
          delivery.status = 'shown_on_device';
          delivery.at = iso(Date.now());
          delivery.detail = 'Shown on this device (demo push)';
          out.push(item);
        }
      }
    }
    if (out.length) this.commit();
    return out;
  }

  // ---------- Paper portfolio ----------

  portfolio(period: PortfolioPeriod): PortfolioSummary {
    this.tick();
    const { user } = this.requireUser();
    return portfolioSummary(user.ledger, period, this.now(), this.db.feed);
  }

  position(instrumentId: string): PositionDetail {
    const { user } = this.requireUser();
    this.resolveInstrument(instrumentId);
    const summary = portfolioSummary(user.ledger, '1M', this.now(), this.db.feed);
    const position = summary.positions.find((candidate) => candidate.instrumentId === instrumentId);
    if (!position) {
      const quote = demoQuote(instrumentId, this.now(), this.db.feed);
      const instrument = INSTRUMENT_BY_ID.get(instrumentId)!;
      return {
        position: {
          instrumentId,
          symbol: instrument.symbol,
          name: instrument.shortName,
          units: '0',
          averageCost: null,
          costBasis: '0.00',
          price: quote.price,
          priceAsOf: quote.asOf,
          priceStatus: quote.status,
          currency: quote.currency,
          value: '0.00',
          unrealized: null,
          unrealizedPct: null,
          realized: '0.00',
          firstBoughtAt: null,
        },
        ledger: user.ledger.filter((record) => record.instrumentId === instrumentId),
        journal: user.journal.filter((entry) => entry.instrumentId === instrumentId),
        reviewTrigger:
          user.reviewTriggers.find((trigger) => trigger.instrumentId === instrumentId) ?? null,
        cash: summary.cash,
      };
    }
    return {
      position,
      ledger: user.ledger.filter((record) => record.instrumentId === instrumentId),
      journal: user.journal
        .filter((entry) => entry.instrumentId === instrumentId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      reviewTrigger:
        user.reviewTriggers.find((trigger) => trigger.instrumentId === instrumentId) ?? null,
      cash: summary.cash,
    };
  }

  fxRate(instrumentId: string): string | null {
    return fxRateFor(instrumentId, this.now(), this.db.feed);
  }

  postTransaction(input: TransactionInput, idempotencyKey: string): PositionDetail {
    const { user } = this.requireVerified();
    this.idempotent(idempotencyKey, { op: 'postTransaction', input }, () => {
      const instrument = this.resolveInstrument(input.instrumentId);
      if (instrument.status !== 'listed') {
        throw new ApiError('validation', 'Paper positions need a listed, quoted company.');
      }
      const fxRate = this.fxRate(input.instrumentId);
      if (!fxRate)
        throw new ApiError(
          'unavailable',
          'An FX rate is not available right now, so the simulation cannot be valued. Try again later.',
        );
      const state = ledgerState(user.ledger);
      const draft: TransactionDraft = {
        side: input.side,
        instrumentId: input.instrumentId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        fee: input.fee,
        currency: instrument.currency,
        fxRate,
      };
      const preview = previewTransaction(state, draft);
      if (preview.errors.form === 'insufficient_cash') {
        const needed = preview.cashEffect ? preview.cashEffect.abs() : null;
        throw new ApiError(
          'validation',
          `This simulation needs ${needed ? formatMoney(needed.toFixed(2), 'USD') : 'more cash'}; available cash is ${formatMoney(state.cash.toFixed(2), 'USD')}.`,
          { fieldErrors: { quantity: 'Reduce the units or price, or add a simulated deposit.' } },
        );
      }
      const fieldErrors = Object.fromEntries(
        Object.entries(preview.errors).filter(([key, value]) => key !== 'form' && value),
      ) as Record<string, string>;
      if (Object.keys(fieldErrors).length)
        throw new ApiError('validation', 'Check the highlighted fields.', { fieldErrors });
      const sequence = user.ledger.reduce((max, record) => Math.max(max, record.sequence), 0) + 1;
      const record: LedgerRecord = {
        id: newId('led'),
        type: input.side,
        effectiveAt: iso(this.now()),
        sequence,
        instrumentId: input.instrumentId,
        quantity: dec(input.quantity).toFixed(),
        unitPrice: dec(input.unitPrice).toFixed(),
        amount: null,
        ratio: null,
        fee: input.fee.trim() === '' ? '0' : dec(input.fee).toFixed(),
        currency: instrument.currency,
        fxRate,
        priceSource: input.priceSource,
        reversalOf: null,
        sourceEventId: null,
        idempotencyKey,
      };
      user.ledger.push(record);
      this.commit();
      return { recordId: record.id };
    });
    return this.position(input.instrumentId);
  }

  reverseTransaction(recordId: string, idempotencyKey: string): PositionDetail {
    const { user } = this.requireVerified();
    const original = user.ledger.find((record) => record.id === recordId);
    if (!original || original.type === 'reversal' || original.type === 'deposit')
      throw notFound('This ledger entry');
    this.idempotent(idempotencyKey, { op: 'reverse', recordId }, () => {
      if (user.ledger.some((record) => record.reversalOf === recordId)) {
        throw new ApiError('validation', 'This entry has already been reversed.');
      }
      const remaining = user.ledger.filter((record) => record.id !== recordId);
      const check = ledgerState([...remaining]);
      if (check.issues.length) {
        throw new ApiError(
          'validation',
          'Reversing this entry would leave a later sale without enough units. Reverse the later sale first.',
        );
      }
      const sequence = user.ledger.reduce((max, record) => Math.max(max, record.sequence), 0) + 1;
      user.ledger.push({
        ...original,
        id: newId('led'),
        type: 'reversal',
        effectiveAt: iso(this.now()),
        sequence,
        reversalOf: recordId,
        idempotencyKey,
      });
      this.commit();
      return { ok: true };
    });
    return this.position(original.instrumentId!);
  }

  addJournal(instrumentId: string, body: string, idempotencyKey: string): JournalEntry {
    const { user } = this.requireVerified();
    return this.idempotent(idempotencyKey, { op: 'journal', instrumentId, body }, () => {
      const error = validateNote(body);
      if (error)
        throw new ApiError('validation', 'Check the highlighted fields.', {
          fieldErrors: { body: error },
        });
      const now = iso(Date.now());
      const entry: JournalEntry = {
        id: newId('jnl'),
        instrumentId,
        body: body.trim(),
        kind: 'note',
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      user.journal.unshift(entry);
      this.commit();
      return entry;
    });
  }

  deleteJournal(id: string): { deleted: true } {
    const { user } = this.requireVerified();
    if (!user.journal.some((entry) => entry.id === id)) throw notFound('This note');
    // Deleting a note never alters trades.
    user.journal = user.journal.filter((entry) => entry.id !== id);
    this.commit();
    return { deleted: true };
  }

  setReviewTrigger(instrumentId: string, text: string, version: number | null): ReviewTrigger {
    const { user } = this.requireVerified();
    const existing = user.reviewTriggers.find((trigger) => trigger.instrumentId === instrumentId);
    if (existing && version !== existing.version) {
      throw new ApiError(
        'version_conflict',
        'This review trigger changed on another device. Review both versions before saving.',
        { details: { latest: existing } },
      );
    }
    const error = validateNote(text, 280);
    if (error)
      throw new ApiError('validation', 'Check the highlighted fields.', {
        fieldErrors: { text: error.replace('note', 'review trigger') },
      });
    const next: ReviewTrigger = {
      instrumentId,
      text: text.trim(),
      updatedAt: iso(Date.now()),
      version: (existing?.version ?? 0) + 1,
    };
    user.reviewTriggers = [
      next,
      ...user.reviewTriggers.filter((trigger) => trigger.instrumentId !== instrumentId),
    ];
    this.commit();
    return next;
  }

  // ---------- Data requests ----------

  dataRequests(): DataRequest[] {
    const { user } = this.requireUser();
    const now = Date.now();
    for (const request of user.dataRequests) {
      if (
        request.kind === 'export' &&
        request.status === 'preparing' &&
        now - Date.parse(request.requestedAt) > 2500
      ) {
        request.status = 'ready';
        request.finishedAt = iso(now);
        request.expiresAt = iso(now + 24 * 60 * 60_000);
      }
      if (
        request.kind === 'export' &&
        request.status === 'ready' &&
        request.expiresAt &&
        now > Date.parse(request.expiresAt)
      ) {
        request.status = 'expired';
      }
    }
    this.commit();
    return user.dataRequests;
  }

  requestExport(idempotencyKey: string): DataRequest {
    const { user } = this.requireUser();
    return this.idempotent(idempotencyKey, { op: 'export' }, () => {
      const request: DataRequest = {
        id: newId('req'),
        kind: 'export',
        status: 'preparing',
        requestedAt: iso(Date.now()),
        finishedAt: null,
        expiresAt: null,
        safeErrorCode: null,
      };
      user.dataRequests.unshift(request);
      this.commit();
      return request;
    });
  }

  downloadExport(requestId: string): { filename: string; json: string } {
    const authed = this.requireUser();
    this.requireFreshAuth(authed);
    const request = authed.user.dataRequests.find((candidate) => candidate.id === requestId);
    if (!request || request.kind !== 'export') throw notFound('This export');
    if (request.status !== 'ready')
      throw new ApiError('validation', 'This export is not ready to download.');
    const { account, user } = authed;
    const payload = {
      format: 'stock-picks-export/v1',
      demo: true,
      exportedAt: iso(Date.now()),
      account: {
        email: account.email,
        displayName: account.displayName,
        memberSince: iso(account.createdAt),
      },
      preferences: user.preferences,
      watchlists: user.watchlists,
      alertRules: user.alertRules,
      notifications: user.inbox,
      savedReports: user.savedReports,
      scenarios: user.scenarios,
      paperLedger: user.ledger,
      journal: user.journal,
      reviewTriggers: user.reviewTriggers,
    };
    return {
      filename: `stock-picks-export-${localDateKey(Date.now(), 'UTC')}.json`,
      json: JSON.stringify(payload, null, 2),
    };
  }

  deleteAccount(confirmation: string): { deleted: true } {
    const authed = this.requireUser();
    this.requireFreshAuth(authed);
    if (confirmation.trim().toUpperCase() !== 'DELETE') {
      throw new ApiError('validation', 'Type DELETE to confirm.', {
        fieldErrors: { confirmation: 'Type DELETE to confirm.' },
      });
    }
    const { account } = authed;
    account.deletedAt = Date.now();
    account.email = `deleted-${account.id}`;
    account.emailNormalized = `deleted-${account.id}`;
    account.passwordHash = '';
    delete this.db.users[account.id];
    for (const session of Object.values(this.db.sessions)) {
      if (session.accountId === account.id) session.revokedAt = session.revokedAt ?? Date.now();
    }
    writeSessionToken(null);
    this.commit();
    return { deleted: true };
  }
}

export const DEMO_DB_KEY = DB_KEY;
