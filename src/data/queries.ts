import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from './api';
import type { ChartRange, PortfolioPeriod, SearchQuery } from './types';

/** Query keys. Everything account-owned lives under "private" so sign-out can clear it at once. */
export const qk = {
  me: ['me'] as const,
  picks: ['picks', 'today'] as const,
  pickFor: (instrumentId: string) => ['picks', 'instrument', instrumentId] as const,
  instrument: (idOrSymbol: string) => ['instrument', idOrSymbol.toLowerCase()] as const,
  quote: (id: string) => ['quote', id] as const,
  quotes: (ids: readonly string[]) => ['quote', 'many', ...ids] as const,
  series: (id: string, range: ChartRange) => ['series', id, range] as const,
  search: (query: SearchQuery) => ['search', query] as const,
  sectors: ['instrument', 'sectors'] as const,
  market: ['market', 'overview'] as const,
  earningsWeek: (week: string) => ['earnings', 'week', week] as const,
  earning: (id: string) => ['earnings', 'event', id] as const,
  events: (instrumentId: string) => ['events', instrumentId] as const,
  ipos: (filter: object) => ['ipos', filter] as const,
  ipo: (id: string) => ['ipo', id] as const,
  reports: (filter: object) => ['reports', filter] as const,
  report: (id: string, version?: number) => ['report', id, version ?? 'latest'] as const,
  archive: (filter: object) => ['archive', 'list', filter] as const,
  archived: (id: string) => ['archive', 'item', id] as const,
  performance: (filter: object) => ['archive', 'performance', filter] as const,
  valuation: (id: string) => ['valuation', id] as const,
  sources: (ids: readonly string[]) => ['sources', ...ids] as const,
  watchlists: ['private', 'watchlists'] as const,
  preferences: ['private', 'preferences'] as const,
  alerts: ['private', 'alerts'] as const,
  alert: (id: string) => ['private', 'alerts', id] as const,
  inbox: (category: string) => ['private', 'inbox', category] as const,
  savedReports: ['private', 'savedReports'] as const,
  scenarios: (instrumentId: string) => ['private', 'scenarios', instrumentId] as const,
  portfolio: (period: PortfolioPeriod) => ['private', 'portfolio', period] as const,
  position: (instrumentId: string) => ['private', 'position', instrumentId] as const,
  sessions: ['private', 'sessions'] as const,
  dataRequests: ['private', 'dataRequests'] as const,
  mailbox: ['mailbox'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => api.me.get(signal),
    staleTime: 60_000,
  });
}

export function usePicks() {
  return useQuery({ queryKey: qk.picks, queryFn: ({ signal }) => api.picks.today(signal) });
}

export function usePickForInstrument(instrumentId: string | undefined) {
  return useQuery({
    queryKey: qk.pickFor(instrumentId ?? ''),
    queryFn: ({ signal }) => api.picks.forInstrument(instrumentId!, signal),
    enabled: Boolean(instrumentId),
  });
}

export function useInstrument(idOrSymbol: string | undefined) {
  return useQuery({
    queryKey: qk.instrument(idOrSymbol ?? ''),
    queryFn: ({ signal }) => api.instruments.get(idOrSymbol!, signal),
    enabled: Boolean(idOrSymbol),
    staleTime: Infinity,
    retry: false,
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: qk.quote(id ?? ''),
    queryFn: ({ signal }) => api.instruments.quote(id!, signal),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useQuotes(ids: readonly string[]) {
  return useQuery({
    queryKey: qk.quotes(ids),
    queryFn: ({ signal }) => api.instruments.quotes([...ids], signal),
    enabled: ids.length > 0,
    staleTime: 10_000,
  });
}

/** Range switching keeps the previous series until the requested one is ready (spec page 23). */
export function useSeries(id: string | undefined, range: ChartRange) {
  return useQuery({
    queryKey: qk.series(id ?? '', range),
    queryFn: ({ signal }) => api.instruments.series(id!, range, signal),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useSearch(query: SearchQuery, enabled = true) {
  return useQuery({
    queryKey: qk.search(query),
    queryFn: ({ signal }) => api.instruments.search(query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSectors() {
  return useQuery({
    queryKey: qk.sectors,
    queryFn: () => api.instruments.sectors(),
    staleTime: Infinity,
  });
}

export function useMarketOverview() {
  return useQuery({ queryKey: qk.market, queryFn: ({ signal }) => api.market.overview(signal) });
}

export function useEarningsWeek(weekStart: string) {
  return useQuery({
    queryKey: qk.earningsWeek(weekStart),
    queryFn: ({ signal }) => api.earnings.week(weekStart, signal),
    placeholderData: keepPreviousData,
  });
}

export function useEarning(id: string | undefined) {
  return useQuery({
    queryKey: qk.earning(id ?? ''),
    queryFn: ({ signal }) => api.earnings.get(id!, signal),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useInstrumentEvents(instrumentId: string | undefined) {
  return useQuery({
    queryKey: qk.events(instrumentId ?? ''),
    queryFn: ({ signal }) => api.instruments.events(instrumentId!, signal),
    enabled: Boolean(instrumentId),
  });
}

export function useIpos(filter: {
  tab: 'upcoming' | 'listed' | 'saved';
  region: 'US' | 'EU' | 'all';
}) {
  return useQuery({
    queryKey: qk.ipos(filter),
    queryFn: ({ signal }) => api.ipos.list(filter, signal),
    placeholderData: keepPreviousData,
  });
}

export function useIpo(id: string | undefined) {
  return useQuery({
    queryKey: qk.ipo(id ?? ''),
    queryFn: ({ signal }) => api.ipos.get(id!, signal),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useReports(filter: {
  kind?: 'latest' | 'sector' | 'thesis';
  instrumentId?: string;
}) {
  return useQuery({
    queryKey: qk.reports(filter),
    queryFn: ({ signal }) => api.reports.list(filter, signal),
    placeholderData: keepPreviousData,
  });
}

export function useReport(id: string | undefined, version?: number) {
  return useQuery({
    queryKey: qk.report(id ?? '', version),
    queryFn: ({ signal }) => api.reports.get(id!, version, signal),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useArchive(filter: {
  status: 'all' | 'active' | 'closed';
  sinceDays: number | null;
}) {
  return useQuery({
    queryKey: qk.archive(filter),
    queryFn: ({ signal }) => api.archive.list(filter, signal),
    placeholderData: keepPreviousData,
  });
}

export function useArchivedPick(id: string | undefined) {
  return useQuery({
    queryKey: qk.archived(id ?? ''),
    queryFn: ({ signal }) => api.archive.get(id!, signal),
    enabled: Boolean(id),
    retry: false,
  });
}

export function usePerformanceReview(filter: { sinceDays: number | null }) {
  return useQuery({
    queryKey: qk.performance(filter),
    queryFn: ({ signal }) => api.archive.performance(filter, signal),
    placeholderData: keepPreviousData,
  });
}

export function useValuation(instrumentId: string | undefined) {
  return useQuery({
    queryKey: qk.valuation(instrumentId ?? ''),
    queryFn: ({ signal }) => api.instruments.valuation(instrumentId!, signal),
    enabled: Boolean(instrumentId),
    retry: false,
  });
}

export function useSources(ids: readonly string[]) {
  return useQuery({
    queryKey: qk.sources(ids),
    queryFn: ({ signal }) => api.sources.list([...ids], signal),
    enabled: ids.length > 0,
    staleTime: Infinity,
  });
}

// ---------- Private (signed-in) ----------

export function useWatchlists(enabled = true) {
  return useQuery({
    queryKey: qk.watchlists,
    queryFn: ({ signal }) => api.watchlists.list(signal),
    enabled,
  });
}

export function usePreferences(enabled = true) {
  return useQuery({
    queryKey: qk.preferences,
    queryFn: ({ signal }) => api.me.preferences(signal),
    enabled,
  });
}

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: qk.alerts,
    queryFn: ({ signal }) => api.alerts.list(signal),
    enabled,
  });
}

export function useAlert(id: string | undefined) {
  return useQuery({
    queryKey: qk.alert(id ?? ''),
    queryFn: ({ signal }) => api.alerts.get(id!, signal),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useInbox(category: 'all' | 'prices' | 'earnings' | 'research', enabled = true) {
  return useQuery({
    queryKey: qk.inbox(category),
    queryFn: ({ signal }) => api.notifications.list(category, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSavedReports(enabled = true) {
  return useQuery({
    queryKey: qk.savedReports,
    queryFn: ({ signal }) => api.savedReports.list(signal),
    enabled,
  });
}

export function useScenarios(instrumentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.scenarios(instrumentId ?? ''),
    queryFn: ({ signal }) => api.scenarios.list(instrumentId!, signal),
    enabled: enabled && Boolean(instrumentId),
  });
}

export function usePortfolio(period: PortfolioPeriod, enabled = true) {
  return useQuery({
    queryKey: qk.portfolio(period),
    queryFn: ({ signal }) => api.portfolio.summary(period, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePosition(instrumentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.position(instrumentId ?? ''),
    queryFn: ({ signal }) => api.portfolio.position(instrumentId!, signal),
    enabled: enabled && Boolean(instrumentId),
  });
}

export function useSessions(enabled = true) {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: ({ signal }) => api.me.sessions(signal),
    enabled,
  });
}

export function useDataRequests(enabled = true) {
  return useQuery({
    queryKey: qk.dataRequests,
    queryFn: ({ signal }) => api.me.dataRequests(signal),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some((request) => request.status === 'preparing') ? 1500 : false,
  });
}

export function useMailbox() {
  return useQuery({
    queryKey: qk.mailbox,
    queryFn: ({ signal }) => api.me.mailbox(signal),
    refetchInterval: 4000,
  });
}

export type AnyQuery<T> = UseQueryResult<T, Error>;
