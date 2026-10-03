import type { ReactNode } from 'react';
import type { Location } from 'react-router';
import { EmptyState } from '@/components/Status';
import { ArrowLeft } from '@/components/icons';
import {
  useEarningsWeek,
  useIpos,
  usePicks,
  usePortfolio,
  useReports,
  useWatchlists,
} from '@/data/queries';
import { eventsForDay, resolveEarningsSelection } from '@/features/earnings';
import { useDemoNow } from '@/features/time';
import { useSession } from './session';
import type { RouteMeta } from './routeTable';
import styles from './Shell.module.css';

type PaneLocation = Pick<Location, 'pathname' | 'search' | 'hash' | 'state' | 'key'>;
type Render = (location: PaneLocation) => ReactNode;

function virtual(path: string): PaneLocation {
  const [pathname = '/', search = ''] = path.split('?');
  return {
    pathname,
    search: search ? `?${search}` : '',
    hash: '',
    state: null,
    key: `default:${path}`,
  };
}

function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.placeholder} data-surface="paper">
      <EmptyState icon={ArrowLeft} title={title} size="section">
        {children}
      </EmptyState>
    </div>
  );
}

function FirstPick({ render }: { render: Render }) {
  const picks = usePicks();
  const first = picks.data?.picks[0];
  if (!first) return <Placeholder title="Select a pick.">Its analysis opens here.</Placeholder>;
  return <>{render(virtual(`/stocks/${first.symbol}`))}</>;
}

function FirstMember({ render, search }: { render: Render; search: string }) {
  const { signedIn } = useSession();
  const lists = useWatchlists(signedIn);
  const params = new URLSearchParams(search);
  const list =
    lists.data?.find((candidate) => candidate.id === params.get('list')) ?? lists.data?.[0];
  const member = list?.members[0];
  if (!member)
    return (
      <Placeholder title="Select a company.">Its quote, chart and research open here.</Placeholder>
    );
  return <>{render(virtual(`/stocks/${member.symbol}`))}</>;
}

function FirstReport({ render }: { render: Render }) {
  const reports = useReports({ kind: 'latest' });
  const first = reports.data?.find((report) => report.status === 'published');
  if (!first) return <Placeholder title="Select a report.">It opens here for reading.</Placeholder>;
  return <>{render(virtual(`/research/${first.id}`))}</>;
}

function FirstEvent({ render, search }: { render: Render; search: string }) {
  const now = useDemoNow();
  const { week, day, view } = resolveEarningsSelection(new URLSearchParams(search), now);
  const events = useEarningsWeek(week);
  const first = eventsForDay(events.data?.events ?? [], day, view)[0];
  if (!first)
    return <Placeholder title="Select an event.">Results and timing open here.</Placeholder>;
  return <>{render(virtual(`/earnings/${first.id}`))}</>;
}

function FirstIpo({ render, search }: { render: Render; search: string }) {
  const params = new URLSearchParams(search);
  const tab = (params.get('tab') as 'upcoming' | 'listed' | 'saved' | null) ?? 'upcoming';
  const region = (params.get('region') as 'US' | 'EU' | null) ?? 'US';
  const ipos = useIpos({ tab, region });
  const first = ipos.data?.[0];
  if (!first)
    return <Placeholder title="Select a listing.">Offer terms and risks open here.</Placeholder>;
  return <>{render(virtual(`/ipos/${first.id}`))}</>;
}

function FirstPosition({ render }: { render: Render }) {
  const { signedIn } = useSession();
  const portfolio = usePortfolio('3M', signedIn);
  const first = portfolio.data?.positions[0];
  if (!first)
    return (
      <Placeholder title="Select a position.">Its model value and journal open here.</Placeholder>
    );
  return <>{render(virtual(`/portfolio/${first.symbol}`))}</>;
}

/** What opens beside a collection on wide screens before anything is selected. */
export function DefaultDetail({
  route,
  location,
  render,
}: {
  route: RouteMeta;
  location: Location;
  render: Render;
}) {
  switch (route.defaultDetail) {
    case 'first-pick':
      return <FirstPick render={render} />;
    case 'first-member':
      return <FirstMember render={render} search={location.search} />;
    case 'first-report':
      return <FirstReport render={render} />;
    case 'first-event':
      return <FirstEvent render={render} search={location.search} />;
    case 'first-ipo':
      return <FirstIpo render={render} search={location.search} />;
    case 'first-position':
      return <FirstPosition render={render} />;
    case 'performance':
      return <>{render(virtual('/archive/performance'))}</>;
    case 'settings':
      return <>{render(virtual('/settings'))}</>;
    default:
      return <Placeholder title="Select an item.">Details open here.</Placeholder>;
  }
}
