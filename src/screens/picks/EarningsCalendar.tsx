import { useRef, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { usePane } from '@/app/pane';
import { Button } from '@/components/Button';
import { Eyebrow, LargeTitle, SectionHeader, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Search } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Tag, Ticker } from '@/components/Market';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import { UnderlineTabs } from '@/components/Tabs';
import { formatMoney, formatWeekdayShort, pluralize } from '@/domain/format';
import { addDaysToKey } from '@/domain/time';
import { useEarningsWeek, useInstrument } from '@/data/queries';
import type { EarningsEvent } from '@/data/types';
import {
  dayInstant,
  dayLabel,
  eventsForDay,
  isReported,
  MARKET_ZONE,
  releaseTimingText,
  resolveEarningsSelection,
  surprisePct,
  weekStartOf,
  type EarningsView,
} from '@/features/earnings';
import { SaveToggle } from '@/features/SaveToggle';
import { QueryState, useCachedAt } from '@/features/status';
import { useDemoNow } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import shared from '../shared.module.css';
import styles from './EarningsCalendar.module.css';

/** The demo covers the weeks around the sample session; navigation stays inside them. */
const WEEK_SPAN = 2;

const WATCH_ITEMS = [
  {
    title: 'Guidance changes',
    detail: 'How management’s outlook moves estimates after the release.',
    to: '/research/rep_guidance',
  },
  {
    title: 'Revenue acceleration',
    detail: 'NVIDIA reports after today’s close: what would confirm the thesis.',
    to: '/stocks/NVDA/thesis',
  },
];

function EventRow({ event }: { event: EarningsEvent }) {
  const instrument = useInstrument(event.instrumentId);
  const pane = usePane();
  const to = `/earnings/${event.id}`;
  const symbol = instrument.data?.symbol ?? '';
  const reported = isReported(event);
  const eps = reported ? (event.actual?.eps ?? null) : event.consensus.eps;
  const surprise = reported ? surprisePct(event.actual?.eps, event.consensus.eps) : null;
  const metricLabel = reported ? 'Reported EPS' : 'Consensus EPS';
  const selected = pane.detailPath === to;
  const timing = releaseTimingText(event);
  const spoken = [
    instrument.data ? `${symbol}, ${instrument.data.shortName}` : 'Company',
    event.fiscalPeriod,
    timing,
    `${metricLabel} ${eps == null ? 'unavailable' : formatMoney(eps, event.currency)}`,
  ].join(', ');

  if (!instrument.data) {
    return (
      <li className={styles.rowSkeleton} aria-hidden>
        <Skeleton width="40%" height={28} />
        <Skeleton width="30%" height={28} />
      </li>
    );
  }
  return (
    <Row
      to={to}
      linkLabel={spoken}
      selected={selected}
      chevron={false}
      anchorFor="ticker"
      aside={
        <span className={styles.metric}>
          <span className={styles.metricLabel}>{metricLabel}</span>
          <span className={styles.metricValue}>
            {eps == null ? '—' : formatMoney(eps, event.currency)}
          </span>
          {reported && (
            <span className={styles.metricNote}>
              {surprise == null
                ? 'No EPS estimate'
                : `vs ${formatMoney(event.consensus.eps!, event.currency)} est.`}
            </span>
          )}
        </span>
      }
      action={<SaveToggle instrumentId={event.instrumentId} symbol={symbol} showLabel />}
    >
      <Ticker symbol={symbol} anchor="ticker" className={styles.ticker} />
      <span className={styles.name}>{instrument.data.shortName}</span>
      <span className={styles.chips}>
        <Tag tone={event.dateConfirmed && event.timeConfirmed ? 'neutral' : 'outline'}>
          {timing}
        </Tag>
        {event.status === 'postponed' && <Tag tone="warning">Postponed</Tag>}
      </span>
    </Row>
  );
}

function DateStrip({
  days,
  selected,
  today,
  counts,
  onSelect,
}: {
  days: string[];
  selected: string;
  today: string;
  counts: Record<string, number>;
  onSelect: (day: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = days.indexOf(selected);
    let next = -1;
    if (event.key === 'ArrowRight') next = Math.min(index + 1, days.length - 1);
    if (event.key === 'ArrowLeft') next = Math.max(index - 1, 0);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = days.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const day = days[next]!;
    onSelect(day);
    requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.focus(),
    );
  };
  return (
    <div
      ref={ref}
      className={styles.strip}
      role="radiogroup"
      aria-label="Report date"
      onKeyDown={onKeyDown}
    >
      {days.map((day) => {
        const checked = day === selected;
        const instant = dayInstant(day);
        const count = counts[day] ?? 0;
        return (
          <button
            key={day}
            type="button"
            role="radio"
            data-day={day}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={styles.day}
            data-today={day === today}
            aria-label={`${dayLabel(day)}${day === today ? ', today' : ''}, ${count === 0 ? 'no reports' : pluralize(count, 'report')}`}
            onClick={() => {
              if (!checked) haptics.selection();
              onSelect(day);
            }}
          >
            <span className={styles.dayName} aria-hidden>
              {formatWeekdayShort(instant, MARKET_ZONE)}
            </span>
            <span className={styles.dayNumber} aria-hidden>
              {day.slice(8).replace(/^0/, '')}
            </span>
            <span className={styles.dayDots} aria-hidden>
              {Array.from({ length: Math.min(count, 3) }, (_, index) => (
                <span key={index} className={styles.dayDot} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function EarningsCalendarScreen() {
  const [params, setParams] = useSearchParams();
  const now = useDemoNow();
  const selection = resolveEarningsSelection(params, now);
  const { week, day, view, today } = selection;
  const currentWeek = weekStartOf(today);
  const query = useEarningsWeek(week);
  const cachedAt = useCachedAt(query);
  const { push } = useAppNavigation();
  const sentinel = useRef<HTMLDivElement>(null);
  useDocumentTitle('Earnings calendar');

  const days = [0, 1, 2, 3, 4].map((offset) => addDaysToKey(week, offset));
  const events = query.data?.events ?? [];
  const counts = Object.fromEntries(
    days.map((key) => [key, events.filter((event) => event.date === key).length]),
  );
  const visible = eventsForDay(events, day, view);
  const other = eventsForDay(events, day, view === 'upcoming' ? 'reported' : 'upcoming');
  const weekOffset = Math.round((Date.parse(week) - Date.parse(currentWeek)) / (7 * 86_400_000));

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const nextDayWithEvents = days.find(
    (key) => key > day && eventsForDay(events, key, view).length > 0,
  );

  return (
    <ScreenBody tabBar>
      <TopBar
        back="/"
        leading={<TopBarLabel>Stock picks</TopBarLabel>}
        compactTitle="Earnings"
        sentinel={sentinel}
        trailing={
          <IconButton icon={Search} label="Search companies" onClick={() => push('/search')} />
        }
      />
      <Content>
        <LargeTitle
          title="Earnings."
          meta={<DemoTag />}
          subtitle="This week’s catalysts"
          sentinelRef={sentinel}
        />
        <div className={styles.weekRow}>
          <Eyebrow tone="muted">
            {weekOffset === 0 ? 'Sample week' : `Week of ${dayLabel(week).replace(/^\w+ /, '')}`}
          </Eyebrow>
          <div className={styles.weekNav}>
            {weekOffset !== 0 && (
              <Button
                variant="text"
                size="small"
                onClick={() => update({ week: null, day: null, view: null })}
              >
                This week
              </Button>
            )}
            <IconButton
              icon={ChevronLeft}
              label="Previous week"
              disabled={weekOffset <= -WEEK_SPAN}
              onClick={() => update({ week: addDaysToKey(week, -7), day: null, view: null })}
            />
            <IconButton
              icon={ChevronRight}
              label="Next week"
              disabled={weekOffset >= WEEK_SPAN}
              onClick={() => update({ week: addDaysToKey(week, 7), day: null, view: null })}
            />
          </div>
        </div>
        <DateStrip
          days={days}
          selected={day}
          today={today}
          counts={counts}
          onSelect={(key) => update({ day: key, view: null })}
        />
        <div className={shared.tabsSpacer}>
          <UnderlineTabs
            label="Report status"
            value={view}
            controls="earnings-list"
            onChange={(value: EarningsView) => update({ view: value })}
            items={[
              {
                value: 'upcoming',
                label: 'Upcoming',
                count: query.data ? eventsForDay(events, day, 'upcoming').length : undefined,
              },
              {
                value: 'reported',
                label: 'Reported',
                count: query.data ? eventsForDay(events, day, 'reported').length : undefined,
              },
            ]}
          />
        </div>
        <div
          id="earnings-list"
          role="tabpanel"
          aria-label={`${view === 'upcoming' ? 'Upcoming' : 'Reported'} on ${dayLabel(day)}`}
        >
          {cachedAt != null && (
            <Notice tone="warning" role="status" title="Offline copy">
              Times and estimates may have changed since this calendar was saved.
            </Notice>
          )}
          <QueryState
            query={query}
            errorTitle="The calendar could not be loaded."
            skeleton={
              <div className={styles.skeleton}>
                <Skeleton height={56} />
                <Skeleton height={56} />
                <Skeleton height={56} />
              </div>
            }
          >
            {() =>
              visible.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  size="section"
                  title={`No ${view === 'upcoming' ? 'upcoming' : 'reported'} results on ${dayLabel(day)}.`}
                  actions={
                    <>
                      {other.length > 0 && (
                        <Button
                          full
                          variant="secondary"
                          onClick={() =>
                            update({ view: view === 'upcoming' ? 'reported' : 'upcoming' })
                          }
                        >
                          {view === 'upcoming'
                            ? `Show ${pluralize(other.length, 'reported result')}`
                            : `Show ${pluralize(other.length, 'upcoming report')}`}
                        </Button>
                      )}
                      {nextDayWithEvents && (
                        <Button
                          full
                          variant="quiet"
                          onClick={() => update({ day: nextDayWithEvents, view })}
                        >
                          Go to {dayLabel(nextDayWithEvents)}
                        </Button>
                      )}
                    </>
                  }
                >
                  {other.length === 0
                    ? 'No company in this sample calendar reports on this date.'
                    : null}
                </EmptyState>
              ) : (
                <List
                  label={`${view === 'upcoming' ? 'Upcoming' : 'Reported'} on ${dayLabel(day)}`}
                >
                  {visible.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </List>
              )
            }
          </QueryState>
        </div>
        {!query.isPending && (
          <>
            <SectionHeader
              title="What to watch"
              aside={<Eyebrow tone="muted">Sample calendar</Eyebrow>}
            />
            <List label="What to watch">
              {WATCH_ITEMS.map((item, index) => (
                <Row
                  key={item.title}
                  to={item.to}
                  leading={
                    <span className={styles.watchNumber}>{String(index + 1).padStart(2, '0')}</span>
                  }
                  title={item.title}
                  detail={item.detail}
                  dense
                />
              ))}
            </List>
            <div className={styles.reminder}>
              <Button
                variant="secondary"
                full
                between
                icon={ArrowUpRight}
                onClick={() => push('/alerts/new?type=earnings')}
              >
                Set earnings reminders
              </Button>
            </div>
            <Disclaimer>
              Sample calendar. Dates, release times and consensus figures are illustrative; times
              show the company’s exchange time zone. Unconfirmed dates and times are labelled until
              the company confirms them.
            </Disclaimer>
          </>
        )}
      </Content>
    </ScreenBody>
  );
}
