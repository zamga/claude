import { formatDate } from '@/domain/format';
import type { Sample } from '@/domain/series';
import type { ChartRange, DataStatus, MarketIndex, MarketSession, Quote, Series } from '../types';
import { nextTradingDay, sessionTimes, type CalendarId } from './calendar';
import { DEMO_SESSION_DATE } from './clock';
import { INDEX_BY_ID, INSTRUMENT_BY_ID } from './instruments';
import { anyPath, observationAt, type PricePath } from './prices';

/** Quotes and chart series derived from the deterministic paths for a given demo instant. */

export type FeedMode = 'normal' | 'delayed' | 'interrupted';

export interface FeedState {
  mode: FeedMode;
  /** When the interruption began; quotes freeze at this instant. */
  since: number | null;
}

export const FEED_DELAY_MS = 15 * 60_000;
export const DEMO_SOURCE = 'Demo feed — simulated prices, not market data';

const RANGE_SESSIONS: Record<Exclude<ChartRange, '1D' | '1W'>, number> = {
  '1M': 21,
  '3M': 63,
  '1Y': 252,
};

function visibleCutoff(now: number, feed: FeedState): number {
  if (feed.mode === 'delayed') return now - FEED_DELAY_MS;
  if (feed.mode === 'interrupted' && feed.since != null) return Math.min(now, feed.since);
  return now;
}

function statusFor(feed: FeedState): DataStatus {
  if (feed.mode === 'delayed') return 'delayed';
  if (feed.mode === 'interrupted') return 'stale';
  return 'demo';
}

function sessionAt(calendar: CalendarId, date: string, now: number): MarketSession {
  const times = sessionTimes(calendar, date);
  if (now < times.opensAt) return 'pre';
  if (now < times.closesAt) return 'regular';
  return 'closed';
}

function nextOpenAfter(calendar: CalendarId, now: number): number {
  const today = sessionTimes(calendar, DEMO_SESSION_DATE);
  if (now < today.opensAt) return today.opensAt;
  return sessionTimes(calendar, nextTradingDay(calendar, DEMO_SESSION_DATE)).opensAt;
}

interface Latest {
  sample: Sample;
  previousClose: number;
  session: MarketSession;
}

function latestFor(path: PricePath, now: number, feed: FeedState): Latest | null {
  if (path.lastSession) {
    const last = path.daily[path.daily.length - 1];
    if (!last) return null;
    const previous = path.daily[path.daily.length - 2];
    return {
      sample: { t: last.closesAt, v: last.close },
      previousClose: previous?.close ?? last.close,
      session: 'closed',
    };
  }
  const session = path.demoSession;
  if (!session) return null;
  const cutoff = visibleCutoff(now, feed);
  const observation = observationAt(session, cutoff);
  if (!observation) return null;
  return {
    sample: observation,
    previousClose: path.previousClose,
    session: sessionAt(path.calendar, session.date, now),
  };
}

export function demoQuote(instrumentId: string, now: number, feed: FeedState): Quote {
  const instrument = INSTRUMENT_BY_ID.get(instrumentId) ?? null;
  const index = INDEX_BY_ID.get(instrumentId) ?? null;
  const currency = instrument?.currency ?? (index?.region === 'EU' ? 'EUR' : 'USD');
  const path = anyPath(instrumentId);
  const base: Quote = {
    instrumentId,
    price: null,
    previousClose: null,
    currency,
    asOf: null,
    session: 'closed',
    source: DEMO_SOURCE,
    status: 'unavailable',
    delaySeconds: 0,
    adjustment: 'split-adjusted',
    observationId: null,
    nextOpen: null,
    unavailableReason: null,
  };
  if (instrument?.status === 'pending' || !path) {
    return {
      ...base,
      unavailableReason: 'Not yet listed. Quotes begin after the first trading session.',
    };
  }
  const latest = latestFor(path, now, feed);
  if (!latest) return { ...base, unavailableReason: 'No observation yet for this session.' };
  const delisted = instrument?.status === 'delisted';
  const status: DataStatus = delisted ? 'demo' : statusFor(feed);
  return {
    ...base,
    price: latest.sample.v!.toFixed(2),
    previousClose: latest.previousClose.toFixed(2),
    asOf: new Date(latest.sample.t).toISOString(),
    session: delisted ? 'closed' : latest.session,
    status,
    delaySeconds: feed.mode === 'delayed' && !delisted ? FEED_DELAY_MS / 1000 : 0,
    observationId: `${instrumentId}:${latest.sample.t}`,
    nextOpen:
      delisted || latest.session === 'regular'
        ? null
        : new Date(nextOpenAfter(path.calendar, now)).toISOString(),
    unavailableReason:
      delisted && instrument?.delistedOn
        ? `Delisted ${formatDate(Date.parse(`${instrument.delistedOn}T12:00:00Z`), 'UTC')} after a cash acquisition. Showing the final regular-session close.`
        : null,
  };
}

function every30(samples: Sample[], opensAt: number): Sample[] {
  return samples.filter((sample) => (sample.t - opensAt) % (30 * 60_000) === 0);
}

export function demoSeries(
  instrumentId: string,
  range: ChartRange,
  now: number,
  feed: FeedState,
): Series {
  const instrument = INSTRUMENT_BY_ID.get(instrumentId) ?? null;
  const path = anyPath(instrumentId);
  const quote = demoQuote(instrumentId, now, feed);
  const currency = quote.currency;
  const timeZone = path?.timeZone ?? instrument?.timeZone ?? 'America/New_York';
  const empty: Series = {
    instrumentId,
    range,
    interval: range === '1D' ? '5m' : range === '1W' ? '30m' : '1d',
    axis: range === '1D' ? 'time' : 'ordinal',
    samples: [],
    window: null,
    reference: {
      value: null,
      label: range === '1D' ? 'vs previous close' : `vs start of ${range}`,
      kind: range === '1D' ? 'previousClose' : 'firstInWindow',
    },
    currency,
    asOf: quote.asOf,
    status: quote.status,
    source: DEMO_SOURCE,
    adjustment: 'split-adjusted',
    timeZone,
  };
  if (!path || (instrument && instrument.status === 'pending'))
    return { ...empty, status: 'unavailable' };

  const cutoff = path.lastSession ? Number.POSITIVE_INFINITY : visibleCutoff(now, feed);
  const latestSample: Sample | null =
    quote.price && quote.asOf ? { t: Date.parse(quote.asOf), v: Number(quote.price) } : null;

  if (range === '1D') {
    const session = path.lastSession ? path.intraday[path.intraday.length - 1] : path.demoSession;
    if (!session) return empty;
    const samples = session.samples.filter((sample) => sample.t <= cutoff);
    const previousClose = path.lastSession
      ? (path.daily[path.daily.length - 2]?.close ?? null)
      : path.previousClose;
    return {
      ...empty,
      samples,
      window: { start: session.opensAt, end: session.closesAt },
      reference: {
        value: previousClose == null ? null : previousClose.toFixed(2),
        label: 'vs previous close',
        kind: 'previousClose',
      },
    };
  }

  if (range === '1W') {
    const samples: Sample[] = [];
    for (const session of path.intraday) {
      const visible = session.samples.filter((sample) => sample.t <= cutoff);
      samples.push(...every30(visible, session.opensAt));
      const last = visible[visible.length - 1];
      if (last && samples[samples.length - 1]?.t !== last.t) samples.push(last);
    }
    const first = samples.find((sample) => sample.v != null);
    return {
      ...empty,
      samples,
      reference: {
        value: first?.v == null ? null : first.v.toFixed(2),
        label: 'vs start of 1W',
        kind: 'firstInWindow',
      },
    };
  }

  const count = RANGE_SESSIONS[range];
  const completed = path.daily.filter((bar) => bar.closesAt <= cutoff || path.lastSession != null);
  const bars = completed.slice(
    -(latestSample && !path.lastSession && path.calendar === 'US' ? count - 1 : count),
  );
  const samples: Sample[] = bars.map((bar) => ({ t: bar.closesAt, v: bar.close }));
  if (
    latestSample &&
    !path.lastSession &&
    (samples.length === 0 || samples[samples.length - 1]!.t < latestSample.t)
  ) {
    samples.push(latestSample);
  }
  const first = samples.find((sample) => sample.v != null);
  return {
    ...empty,
    samples,
    reference: {
      value: first?.v == null ? null : first.v.toFixed(2),
      label: `vs start of ${range}`,
      kind: 'firstInWindow',
    },
  };
}

export function demoIndex(indexId: string, now: number, feed: FeedState): MarketIndex | null {
  const index = INDEX_BY_ID.get(indexId);
  const path = anyPath(indexId);
  if (!index || !path?.demoSession) return null;
  const quote = demoQuote(indexId, now, feed);
  const cutoff = visibleCutoff(now, feed);
  const session = path.demoSession;
  return {
    id: index.id,
    name: index.name,
    shortName: index.shortName,
    kind: index.kind,
    value: quote.price,
    previousClose: quote.previousClose,
    region: index.region,
    session: quote.session,
    asOf: quote.asOf,
    status: quote.status,
    series: session.samples.filter((sample) => sample.t <= cutoff),
    window: { start: session.opensAt, end: session.closesAt },
    timeZone: path.timeZone,
  };
}

/** Compact 1D series for list sparklines (same observations as the quote). */
export function demoSparkline(instrumentId: string, now: number, feed: FeedState): Sample[] {
  return demoSeries(instrumentId, '1D', now, feed).samples.filter(
    (_, i, all) => i % 3 === 0 || i === all.length - 1,
  );
}
