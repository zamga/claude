import { useQueries } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { useSession } from '@/app/session';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { Eyebrow, LargeTitle, SectionHeader, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import {
  ArrowUpDown,
  Bell,
  BellRing,
  Briefcase,
  Calendar,
  ChevronDown,
  ICON_STROKE,
  Inbox,
  ListChecks,
  Plus,
  Search,
  Star,
} from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { DemoTag, EmptyState, Skeleton } from '@/components/Status';
import { UnderlineTabs } from '@/components/Tabs';
import { computeChange } from '@/domain/change';
import { pluralize } from '@/domain/format';
import { api } from '@/data/api';
import {
  qk,
  useAlerts,
  useInbox,
  useInstrument,
  useQuotes,
  useSeries,
  useWatchlists,
} from '@/data/queries';
import type { AlertRule, EarningsEvent, Quote, Watchlist } from '@/data/types';
import { dayLabel, MARKET_ZONE, releaseTimingText } from '@/features/earnings';
import { InstrumentRow } from '@/features/InstrumentRow';
import { QueryState, useCachedAt } from '@/features/status';
import { useDemoNow } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { addDaysToKey, localDateKey } from '@/domain/time';
import styles from './Watchlists.module.css';

type Sort = 'custom' | 'change' | 'name';
type Show = 'all' | 'alerts' | 'reporting';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'custom', label: 'Your order' },
  { value: 'change', label: 'Daily change' },
  { value: 'name', label: 'Name' },
];

const SHOWS: { value: Show; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'alerts', label: 'With alerts' },
  { value: 'reporting', label: 'Reporting this week' },
];

function MemberRow({
  member,
  quote,
  rules,
}: {
  member: Watchlist['members'][number];
  quote: Quote | undefined;
  rules: AlertRule[];
}) {
  const instrument = useInstrument(member.instrumentId);
  const series = useSeries(
    instrument.data?.status === 'listed' ? member.instrumentId : undefined,
    '1D',
  );
  const { push } = useAppNavigation();
  const active = rules.filter(
    (rule) => rule.instrumentId === member.instrumentId && rule.state === 'armed',
  );
  return (
    <InstrumentRow
      symbol={member.symbol}
      name={
        instrument.data
          ? `${instrument.data.shortName}${instrument.data.status === 'pending' ? ' · not yet listed' : ''}`
          : member.symbol
      }
      to={`/stocks/${member.symbol}`}
      quote={quote}
      sparkline={series.data?.samples}
      sparkWindow={series.data?.window}
      action={
        <IconButton
          icon={active.length > 0 ? BellRing : Bell}
          active={active.length > 0 ? true : undefined}
          label={
            active.length > 0
              ? `${member.symbol}: ${pluralize(active.length, 'active alert')}. Create another`
              : `Create an alert for ${member.symbol}`
          }
          onClick={() => push(`/alerts/new?instrument=${member.symbol}`)}
        />
      }
    />
  );
}

function NextCatalyst({ list, rules }: { list: Watchlist; rules: AlertRule[] }) {
  const now = useDemoNow();
  const today = localDateKey(now, MARKET_ZONE);
  const results = useQueries({
    queries: list.members.map((member) => ({
      queryKey: qk.events(member.instrumentId),
      queryFn: () => api.instruments.events(member.instrumentId),
    })),
  });
  const next = results
    .flatMap((result) => result.data ?? [])
    .filter((event: EarningsEvent) => event.status === 'scheduled' && event.date >= today)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.expectedAt ?? '').localeCompare(b.expectedAt ?? ''),
    )[0];
  if (results.some((result) => result.isPending)) return <Skeleton height={64} />;
  if (!next) {
    return (
      <p className={styles.noCatalyst}>
        No scheduled earnings for this list in the sample calendar.
      </p>
    );
  }
  const symbol =
    list.members.find((member) => member.instrumentId === next.instrumentId)?.symbol ?? '';
  const reminder = rules.find((rule) => rule.type === 'earnings' && rule.earningsId === next.id);
  const status = reminder
    ? reminder.state === 'fired'
      ? 'Earnings reminder sent'
      : 'Earnings reminder active'
    : 'No reminder set';
  return (
    <AppLink to={`/earnings/${next.id}`} className={styles.catalyst}>
      <Calendar className={styles.catalystIcon} size={22} strokeWidth={ICON_STROKE} aria-hidden />
      <span className={styles.catalystBody}>
        <span className={styles.catalystTicker}>{symbol}</span>
        <span className={styles.catalystDetail}>
          {next.date === today ? 'Today' : dayLabel(next.date)} · {releaseTimingText(next)}
        </span>
        <span className={styles.catalystStatus} data-active={reminder != null}>
          {status}
        </span>
      </span>
    </AppLink>
  );
}

function ListView({ list, lists }: { list: Watchlist; lists: Watchlist[] }) {
  const [params, setParams] = useSearchParams();
  const sort = (params.get('sort') as Sort | null) ?? 'custom';
  const show = (params.get('show') as Show | null) ?? 'all';
  const { signedIn } = useSession();
  const { push } = useAppNavigation();
  const now = useDemoNow();
  const ids = useMemo(() => list.members.map((member) => member.instrumentId), [list.members]);
  const quotes = useQuotes(ids);
  const alerts = useAlerts(signedIn);
  const cachedAt = useCachedAt(quotes);
  const rules = alerts.data ?? [];
  const today = localDateKey(now, MARKET_ZONE);
  const weekEnd = addDaysToKey(today, 7);
  const events = useQueries({
    queries:
      show === 'reporting'
        ? ids.map((id) => ({ queryKey: qk.events(id), queryFn: () => api.instruments.events(id) }))
        : [],
  });
  const reporting = new Set(
    events
      .flatMap((result) => result.data ?? [])
      .filter(
        (event) => event.status === 'scheduled' && event.date >= today && event.date <= weekEnd,
      )
      .map((event) => event.instrumentId),
  );

  const quoteFor = (id: string) => quotes.data?.find((quote) => quote.instrumentId === id);
  const filtered = list.members.filter((member) => {
    if (show === 'alerts')
      return rules.some(
        (rule) => rule.instrumentId === member.instrumentId && rule.state === 'armed',
      );
    if (show === 'reporting') return reporting.has(member.instrumentId);
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.symbol.localeCompare(b.symbol);
    if (sort === 'change') {
      const ca = computeChange(
        quoteFor(a.instrumentId)?.price ?? null,
        quoteFor(a.instrumentId)?.previousClose ?? null,
      ).percent;
      const cb = computeChange(
        quoteFor(b.instrumentId)?.price ?? null,
        quoteFor(b.instrumentId)?.previousClose ?? null,
      ).percent;
      if (ca == null && cb == null) return a.position - b.position;
      if (ca == null) return 1;
      if (cb == null) return -1;
      return cb.cmp(ca);
    }
    return a.position - b.position;
  });

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <>
      {lists.length > 1 ? (
        <UnderlineTabs
          label="Collections"
          value={list.id}
          controls="watchlist-rows"
          onChange={(value) => {
            const next = new URLSearchParams(params);
            next.set('list', value);
            next.delete('show');
            setParams(next, { replace: true });
          }}
          items={lists.map((item) => ({ value: item.id, label: item.name }))}
        />
      ) : (
        <div className={styles.singleList}>
          <span className={styles.singleName}>{list.name}</span>
        </div>
      )}
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {pluralize(list.members.length, 'stock')}
          <AppLink to={`/watchlists/${list.id}/edit`} className={styles.edit}>
            Edit<span className="visually-hidden"> {list.name}</span>
          </AppLink>
        </span>
        {list.members.length > 1 && (
          <label className={styles.sort}>
            <ArrowUpDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="visually-hidden">Sort by</span>
            <select
              value={sort}
              onChange={(event) => setParam('sort', event.target.value, 'custom')}
            >
              {SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
          </label>
        )}
      </div>
      {list.members.length > 1 && (
        <div className={styles.filters} role="radiogroup" aria-label="Show">
          {SHOWS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={show === item.value}
              className={styles.filter}
              onClick={() => setParam('show', item.value, 'all')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div id="watchlist-rows">
        {list.members.length === 0 ? (
          <FirstUse listName={list.name} />
        ) : sorted.length === 0 ? (
          <EmptyState
            size="section"
            title={
              show === 'alerts'
                ? 'No company in this list has an active alert.'
                : 'No company in this list reports this week.'
            }
            actions={
              <Button full variant="secondary" onClick={() => setParam('show', 'all', 'all')}>
                Show all {pluralize(list.members.length, 'company', 'companies')}
              </Button>
            }
          />
        ) : !quotes.data && quotes.isPending ? (
          <div className={styles.skeleton}>
            {list.members.map((member) => (
              <Skeleton key={member.instrumentId} height={44} />
            ))}
          </div>
        ) : (
          <List label={`${list.name}, ${pluralize(sorted.length, 'company', 'companies')}`}>
            {sorted.map((member) => (
              <MemberRow
                key={member.instrumentId}
                member={member}
                quote={quoteFor(member.instrumentId)}
                rules={rules}
              />
            ))}
          </List>
        )}
        {cachedAt != null && (
          <p className={styles.cached}>Offline copy of quotes. Changes need a connection.</p>
        )}
      </div>
      {list.members.length > 0 && (
        <section aria-labelledby="catalyst-heading">
          <SectionHeader title="Next catalyst" id="catalyst-heading" />
          <div className={styles.catalystWrap}>
            <NextCatalyst list={list} rules={rules} />
          </div>
        </section>
      )}
      <div className={styles.create}>
        <Button
          variant="secondary"
          full
          icon={Plus}
          iconPosition="start"
          onClick={() => push('/watchlists/new')}
        >
          Create a new list
        </Button>
      </div>
    </>
  );
}

function FirstUse({ listName }: { listName?: string }) {
  const { push } = useAppNavigation();
  return (
    <div className={styles.firstUse}>
      <EmptyState
        illustration={
          <span className={styles.emptyMark} aria-hidden>
            <Star size={22} strokeWidth={ICON_STROKE} />
          </span>
        }
        title={
          <>
            Start with
            <br />
            one idea.
          </>
        }
        actions={
          <>
            <Button full onClick={() => push('/')}>
              Explore today’s picks
            </Button>
            <Button full variant="secondary" onClick={() => push('/search')}>
              Search for a company
            </Button>
          </>
        }
      >
        Save a stock to follow its research, catalysts and price{listName ? ` in ${listName}` : ''}.
      </EmptyState>
      <p className={styles.firstUseNote}>Your saved picks will appear here.</p>
    </div>
  );
}

function Tools() {
  const { signedIn } = useSession();
  const inbox = useInbox('all', signedIn);
  const alerts = useAlerts(signedIn);
  const unread = (inbox.data ?? []).filter((item) => !item.readAt).length;
  const armed = (alerts.data ?? []).filter((rule) => rule.state === 'armed').length;
  return (
    <section aria-labelledby="tools-heading">
      <SectionHeader title="Monitoring" id="tools-heading" size="small" />
      <List label="Monitoring">
        <Row
          to="/watchlist/alerts"
          icon={Inbox}
          title="Your alerts"
          detail={unread > 0 ? `${unread} unread` : 'Everything read'}
        />
        <Row
          to="/alerts"
          icon={ListChecks}
          title="Alert rules"
          detail={`${pluralize(armed, 'active rule')}`}
        />
        <Row
          to="/portfolio"
          icon={Briefcase}
          title="Paper portfolio"
          detail="Simulated positions and journal"
        />
      </List>
    </section>
  );
}

export default function WatchlistsScreen() {
  const [params] = useSearchParams();
  const { signedIn, loading } = useSession();
  const lists = useWatchlists(signedIn);
  const inbox = useInbox('all', signedIn);
  const { push } = useAppNavigation();
  const sentinel = useRef<HTMLDivElement>(null);
  const unread = (inbox.data ?? []).some((item) => !item.readAt);
  useDocumentTitle('Watchlist');
  const selected = lists.data?.find((list) => list.id === params.get('list')) ?? lists.data?.[0];

  return (
    <ScreenBody tabBar>
      <TopBar
        leading={<TopBarLabel>Your collections</TopBarLabel>}
        compactTitle="Watchlist"
        sentinel={sentinel}
        trailing={
          signedIn ? (
            <>
              <IconButton
                icon={Bell}
                label={unread ? 'Your alerts, unread items' : 'Your alerts'}
                badge={unread}
                onClick={() => push('/watchlist/alerts')}
              />
              <IconButton
                icon={Plus}
                label="Create a new list"
                onClick={() => push('/watchlists/new')}
              />
            </>
          ) : (
            <IconButton icon={Search} label="Search companies" onClick={() => push('/search')} />
          )
        }
      />
      <Content>
        <LargeTitle title="Watchlist." meta={<DemoTag />} sentinelRef={sentinel} />
        {!signedIn && !loading ? (
          <>
            <FirstUse />
            <p className={styles.guest}>
              Saving needs a free account so your lists follow you across devices.{' '}
              <AppLink to="/auth/sign-in?returnTo=%2Fwatchlist" className="link">
                Sign in
              </AppLink>{' '}
              or{' '}
              <AppLink to="/auth/register?returnTo=%2Fwatchlist" className="link">
                create an account
              </AppLink>
              .
            </p>
          </>
        ) : (
          <QueryState query={lists} errorTitle="Your watchlists could not be loaded.">
            {(data) =>
              data.length === 0 || !selected ? (
                <>
                  <div className={styles.singleList}>
                    <Eyebrow tone="muted">No lists yet · 0 stocks</Eyebrow>
                  </div>
                  <FirstUse />
                </>
              ) : (
                <ListView list={selected} lists={data} />
              )
            }
          </QueryState>
        )}
        {signedIn && <Tools />}
        <Disclaimer>
          Quotes are sample data from a simulated session. Alerts depend on quote availability.
        </Disclaimer>
      </Content>
    </ScreenBody>
  );
}
