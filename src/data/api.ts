import type { DemoServer } from './demo/server';
import { DEMO_START } from './demo/clock';
import { DB_KEY } from './demo/db';
import { call } from './transport';
import type {
  AlertRule,
  AlertRuleInput,
  ArchivedPick,
  ChartRange,
  DailyPicks,
  DataRequest,
  EarningsEvent,
  InboxItem,
  Instrument,
  InstrumentSearchResult,
  IpoIssuer,
  JournalEntry,
  MailMessage,
  MarketOverview,
  Me,
  MeasurementMethod,
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
} from './types';

/**
 * Typed application API. Each method mirrors a /api/v1 resource (spec page 49). In demo mode the
 * handlers run in this browser through `call`, which supplies latency, offline and failure
 * behaviour plus the response envelope.
 */

let server: DemoServer | null = null;
let loading: Promise<DemoServer> | null = null;

let releaseFirstPaint: () => void = () => undefined;
const firstPaint = new Promise<void>((resolve) => {
  releaseFirstPaint = resolve;
  // Never wait on the shell longer than this (tests, errors before the first commit).
  setTimeout(resolve, 1500);
});

/** Called once the shell has painted; the demo service then starts its (CPU-bound) work. */
export function markFirstPaint(): void {
  releaseFirstPaint();
}

/**
 * The in-browser demo service ships in its own chunk. The download starts with the app; the
 * service itself starts after the shell's first paint so its work never delays that paint, and
 * every request awaits it.
 */
export function loadDemoServer(): Promise<DemoServer> {
  loading ??= Promise.all([import('./demo/server'), firstPaint]).then(
    ([{ DemoServer: Server }]) => {
      server = new Server();
      return server;
    },
  );
  return loading;
}

/** The loaded demo service, or null while its chunk is still arriving. */
export function loadedDemoServer(): DemoServer | null {
  return server;
}

let storedOffset: number | null = null;

/** The demo market clock, readable before the service has loaded (from its stored offset). */
export function demoNow(): number {
  if (server) return server.now();
  if (storedOffset == null) {
    try {
      const raw = localStorage.getItem(DB_KEY);
      storedOffset = raw
        ? Number((JSON.parse(raw) as { clockOffsetMs?: number }).clockOffsetMs ?? 0)
        : 0;
    } catch {
      storedOffset = 0;
    }
  }
  return DEMO_START + storedOffset;
}

const asOf = () => demoNow();
const read = <T>(
  name: string,
  run: (service: DemoServer) => T | Promise<T>,
  signal?: AbortSignal,
) =>
  call(name, async () => run(await loadDemoServer()), { kind: 'read', signal, asOf }).then(
    (envelope) => envelope.data,
  );
const write = <T>(name: string, run: (service: DemoServer) => T | Promise<T>) =>
  call(name, async () => run(await loadDemoServer()), { kind: 'write', asOf }).then(
    (envelope) => envelope.data,
  );

export interface PerformanceReview {
  method: MeasurementMethod;
  summary: {
    complete: number;
    pending: number;
    meanPct: string | null;
    medianPct: string | null;
    positive: number;
    positiveSharePct: string | null;
    benchmarkMeanPct: string | null;
    differencePp: string | null;
  };
  picks: ArchivedPick[];
  demo: boolean;
}

export const api = {
  instruments: {
    get: (idOrSymbol: string, signal?: AbortSignal): Promise<Instrument> =>
      read(
        `GET /instruments/${idOrSymbol}`,
        (service) => service.resolveInstrument(idOrSymbol),
        signal,
      ),
    search: (query: SearchQuery, signal?: AbortSignal): Promise<InstrumentSearchResult[]> =>
      read('GET /instruments?q', (service) => service.search(query), signal),
    sectors: (): Promise<string[]> =>
      read('GET /instruments/sectors', (service) => service.sectorsList()),
    quote: (id: string, signal?: AbortSignal): Promise<Quote> =>
      read(`GET /instruments/${id}/quote`, (service) => service.quote(id), signal),
    quotes: (ids: string[], signal?: AbortSignal): Promise<Quote[]> =>
      read('GET /quotes', (service) => service.quotes(ids), signal),
    series: (id: string, range: ChartRange, signal?: AbortSignal): Promise<Series> =>
      read(
        `GET /instruments/${id}/bars?range=${range}`,
        (service) => service.series(id, range),
        signal,
      ),
    events: (id: string, signal?: AbortSignal): Promise<EarningsEvent[]> =>
      read(`GET /instruments/${id}/events`, (service) => service.earningsForInstrument(id), signal),
    valuation: (id: string, signal?: AbortSignal): Promise<ValuationModel> =>
      read(`GET /instruments/${id}/valuation`, (service) => service.valuationModel(id), signal),
  },
  market: {
    overview: (signal?: AbortSignal): Promise<MarketOverview> =>
      read('GET /market/overview', (service) => service.marketOverview(), signal),
  },
  picks: {
    today: (signal?: AbortSignal): Promise<DailyPicks> =>
      read('GET /picks', (service) => service.picksToday(), signal),
    get: (id: string, signal?: AbortSignal): Promise<Pick> =>
      read(`GET /picks/${id}`, (service) => service.pick(id), signal),
    forInstrument: (id: string, signal?: AbortSignal): Promise<Pick | null> =>
      read(`GET /picks?instrument=${id}`, (service) => service.pickForInstrument(id), signal),
  },
  reports: {
    list: (
      filter: { kind?: 'latest' | 'sector' | 'thesis'; instrumentId?: string },
      signal?: AbortSignal,
    ): Promise<ReportSummary[]> =>
      read('GET /reports', (service) => service.reports(filter), signal),
    get: (id: string, version?: number, signal?: AbortSignal): Promise<Report> =>
      read(
        `GET /reports/${id}${version ? `/versions/${version}` : ''}`,
        (service) => service.report(id, version),
        signal,
      ),
  },
  archive: {
    list: (
      filter: { status?: 'all' | 'active' | 'closed'; sinceDays?: number | null },
      signal?: AbortSignal,
    ): Promise<ArchivedPick[]> =>
      read('GET /archive', (service) => service.archive(filter), signal),
    get: (id: string, signal?: AbortSignal): Promise<ArchivedPick> =>
      read(`GET /archive/${id}`, (service) => service.archivedPick(id), signal),
    performance: (
      filter: { sinceDays?: number | null },
      signal?: AbortSignal,
    ): Promise<PerformanceReview> =>
      read('GET /archive/performance', (service) => service.performanceReview(filter), signal),
  },
  support: {
    submit: (
      input: {
        topic: string;
        message: string;
        email: string;
        diagnostics: { requestId: string; name: string; outcome: string }[] | null;
      },
      key: string,
    ): Promise<{ ref: string }> =>
      write('POST /support', (service) => service.submitSupportTicket(input, key)),
  },
  sources: {
    list: (ids: string[], signal?: AbortSignal): Promise<Source[]> =>
      read('GET /sources', (service) => service.sources(ids), signal),
  },
  earnings: {
    week: (weekStart: string, signal?: AbortSignal) =>
      read(`GET /earnings?week=${weekStart}`, (service) => service.earningsWeek(weekStart), signal),
    get: (id: string, signal?: AbortSignal): Promise<EarningsEvent> =>
      read(`GET /earnings/${id}`, (service) => service.earningsEvent(id), signal),
  },
  ipos: {
    list: (
      filter: { tab: 'upcoming' | 'listed' | 'saved'; region: 'US' | 'EU' | 'all' },
      signal?: AbortSignal,
    ): Promise<IpoIssuer[]> => read('GET /ipos', (service) => service.ipos(filter), signal),
    get: (id: string, signal?: AbortSignal): Promise<IpoIssuer> =>
      read(`GET /ipos/${id}`, (service) => service.ipo(id), signal),
  },
  me: {
    get: (signal?: AbortSignal): Promise<Me | null> =>
      read('GET /me', (service) => service.me(), signal),
    signIn: (email: string, password: string): Promise<Me> =>
      write('POST /auth/session', (service) => service.signIn(email, password, deviceLabel())),
    signOut: (): Promise<void> => write('DELETE /auth/session', (service) => service.signOut()),
    register: (input: {
      email: string;
      password: string;
      displayName: string;
      acceptedTerms: boolean;
    }): Promise<Me> =>
      write('POST /auth/register', (service) => service.register(input, deviceLabel())),
    resendVerification: () =>
      write('POST /auth/verify/resend', (service) => service.resendVerification()),
    verify: (token: string) => write('POST /auth/verify', (service) => service.verifyEmail(token)),
    forgot: (email: string) =>
      write('POST /auth/forgot', (service) => service.requestPasswordReset(email)),
    checkReset: (token: string) =>
      read('GET /auth/reset', (service) => service.checkResetToken(token)),
    reset: (token: string, password: string) =>
      write('POST /auth/reset', (service) => service.resetPassword(token, password)),
    reauthenticate: (password: string) =>
      write('POST /auth/reauthenticate', (service) => service.reauthenticate(password)),
    updateProfile: (displayName: string): Promise<Me> =>
      write('PATCH /me', (service) => service.updateProfile(displayName)),
    changeEmail: (email: string): Promise<Me> =>
      write('POST /me/email', (service) => service.changeEmail(email)),
    changePassword: (current: string, next: string) =>
      write('POST /me/password', (service) => service.changePassword(current, next)),
    sessions: (signal?: AbortSignal): Promise<SessionInfo[]> =>
      read('GET /me/sessions', (service) => service.sessions(), signal),
    revokeSession: (id: string): Promise<SessionInfo[]> =>
      write(`DELETE /me/sessions/${id}`, (service) => service.revokeSession(id)),
    preferences: (signal?: AbortSignal): Promise<Preferences> =>
      read('GET /me/preferences', (service) => service.preferences(), signal),
    updatePreferences: (
      patch: Partial<Omit<Preferences, 'version' | 'updatedAt'>>,
      version: number,
    ): Promise<Preferences> =>
      write('PATCH /me/preferences', (service) => service.updatePreferences(patch, version)),
    dataRequests: (signal?: AbortSignal): Promise<DataRequest[]> =>
      read('GET /me/exports', (service) => service.dataRequests(), signal),
    requestExport: (key: string): Promise<DataRequest> =>
      write('POST /me/exports', (service) => service.requestExport(key)),
    downloadExport: (id: string) =>
      read(`GET /me/exports/${id}/download`, (service) => service.downloadExport(id)),
    deleteAccount: (confirmation: string) =>
      write('POST /me/deletion', (service) => service.deleteAccount(confirmation)),
    mailbox: (signal?: AbortSignal): Promise<MailMessage[]> =>
      read('GET /demo/mailbox', (service) => service.mailbox(), signal),
  },
  watchlists: {
    list: (signal?: AbortSignal): Promise<Watchlist[]> =>
      read('GET /watchlists', (service) => service.watchlists(), signal),
    create: (name: string, key: string): Promise<Watchlist> =>
      write('POST /watchlists', (service) => service.createWatchlist(name, key)),
    rename: (id: string, name: string, version: number): Promise<Watchlist> =>
      write(`PATCH /watchlists/${id}`, (service) => service.renameWatchlist(id, name, version)),
    remove: (id: string) =>
      write(`DELETE /watchlists/${id}`, (service) => service.deleteWatchlist(id)),
    addMember: (listId: string, instrumentId: string): Promise<Watchlist> =>
      write(`POST /watchlists/${listId}/members`, (service) =>
        service.addMember(listId, instrumentId),
      ),
    removeMember: (listId: string, instrumentId: string): Promise<Watchlist> =>
      write(`DELETE /watchlists/${listId}/members/${instrumentId}`, (service) =>
        service.removeMember(listId, instrumentId),
      ),
  },
  savedReports: {
    list: (signal?: AbortSignal): Promise<SavedReport[]> =>
      read('GET /saved-reports', (service) => service.savedReports(), signal),
    save: (reportId: string, version: number): Promise<SavedReport> =>
      write('POST /saved-reports', (service) => service.saveReport(reportId, version)),
    remove: (reportId: string) =>
      write(`DELETE /saved-reports/${reportId}`, (service) => service.unsaveReport(reportId)),
  },
  scenarios: {
    list: (instrumentId: string, signal?: AbortSignal): Promise<SavedScenario[]> =>
      read('GET /scenarios', (service) => service.scenarios(instrumentId), signal),
    save: (
      input: Omit<SavedScenario, 'id' | 'version' | 'savedAt'>,
      key: string,
    ): Promise<SavedScenario> =>
      write('POST /scenarios', (service) => service.saveScenario(input, key)),
  },
  alerts: {
    list: (signal?: AbortSignal): Promise<AlertRule[]> =>
      read('GET /alerts', (service) => service.alerts(), signal),
    get: (id: string, signal?: AbortSignal): Promise<AlertRule> =>
      read(`GET /alerts/${id}`, (service) => service.alert(id), signal),
    preview: (input: AlertRuleInput) =>
      read('POST /alerts/preview', (service) => service.previewAlert(input)),
    create: (input: AlertRuleInput, key: string): Promise<AlertRule> =>
      write('POST /alerts', (service) => service.createAlert(input, key)),
    update: (id: string, patch: Partial<AlertRuleInput>, version: number): Promise<AlertRule> =>
      write(`PATCH /alerts/${id}`, (service) => service.updateAlert(id, patch, version)),
    setPaused: (id: string, paused: boolean, version: number): Promise<AlertRule> =>
      write(`PATCH /alerts/${id}/state`, (service) => service.setAlertPaused(id, paused, version)),
    remove: (id: string) => write(`DELETE /alerts/${id}`, (service) => service.deleteAlert(id)),
  },
  notifications: {
    list: (
      category: 'all' | 'prices' | 'earnings' | 'research',
      signal?: AbortSignal,
    ): Promise<InboxItem[]> =>
      read('GET /notifications', (service) => service.inbox(category), signal),
    get: (id: string, signal?: AbortSignal): Promise<InboxItem> =>
      read(`GET /notifications/${id}`, (service) => service.inboxItem(id), signal),
    markRead: (ids: string[] | 'all') =>
      write('POST /notifications/read', (service) => service.markRead(ids)),
    registerDevice: (label: string) =>
      write('POST /me/push-subscriptions', (service) => service.registerPushDevice(label)),
    unregisterDevices: () =>
      write('DELETE /me/push-subscriptions', (service) => service.unregisterPushDevices()),
  },
  portfolio: {
    summary: (period: PortfolioPeriod, signal?: AbortSignal): Promise<PortfolioSummary> =>
      read(
        `GET /portfolios/default/summary?period=${period}`,
        (service) => service.portfolio(period),
        signal,
      ),
    position: (instrumentId: string, signal?: AbortSignal): Promise<PositionDetail> =>
      read(
        `GET /portfolios/default/positions/${instrumentId}`,
        (service) => service.position(instrumentId),
        signal,
      ),
    fxRate: (instrumentId: string) => read('GET /fx', (service) => service.fxRate(instrumentId)),
    transact: (input: TransactionInput, key: string): Promise<PositionDetail> =>
      write('POST /portfolios/default/ledger', (service) => service.postTransaction(input, key)),
    reverse: (recordId: string, key: string): Promise<PositionDetail> =>
      write('POST /portfolios/default/ledger/reversal', (service) =>
        service.reverseTransaction(recordId, key),
      ),
    addNote: (instrumentId: string, body: string, key: string): Promise<JournalEntry> =>
      write('POST /journal', (service) => service.addJournal(instrumentId, body, key)),
    deleteNote: (id: string) =>
      write(`DELETE /journal/${id}`, (service) => service.deleteJournal(id)),
    setReviewTrigger: (
      instrumentId: string,
      text: string,
      version: number | null,
    ): Promise<ReviewTrigger> =>
      write('PUT /review-triggers', (service) =>
        service.setReviewTrigger(instrumentId, text, version),
      ),
  },
};

export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const platform = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'device';
  return `${browser} on ${platform}`;
}
