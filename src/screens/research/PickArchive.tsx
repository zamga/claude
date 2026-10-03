import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { usePane } from '@/app/pane';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { LargeTitle, TopBar, TopBarLabel } from '@/components/Header';
import { ArrowUpRight, History } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { Tag } from '@/components/Market';
import { DemoTag, EmptyState, Skeleton } from '@/components/Status';
import { SelectField } from '@/components/Form';
import { UnderlineTabs } from '@/components/Tabs';
import { formatDayMonth, formatPercent } from '@/domain/format';
import { useArchive } from '@/data/queries';
import type { ArchivedPick } from '@/data/types';
import { outcomeTone } from '@/features/archive';
import { QueryState } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import styles from './Research.module.css';

type Status = 'all' | 'active' | 'closed';
type Outcome = 'all' | 'positive' | 'negative' | 'pending';

const PERIODS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'all', label: 'All outcomes' },
  { value: 'positive', label: 'Gains' },
  { value: 'negative', label: 'Losses' },
  { value: 'pending', label: 'Pending' },
];

function ArchiveRow({ pick }: { pick: ArchivedPick }) {
  const zone = useUserTimeZone();
  const pane = usePane();
  const to = `/archive/${pick.id}`;
  const published = Date.parse(pick.publishedAt);
  const pending = pick.outcome.status === 'pending';
  const spoken = `${pick.symbolAtPublication}, published ${formatDayMonth(published, zone)}, ${
    pending
      ? `pending, ${pick.outcome.sessionsElapsed} of ${pick.outcome.windowSessions} sessions`
      : `${formatPercent(pick.outcome.returnPct, 1)} over 20 sessions`
  }${pick.delisted ? ', delisted' : ''}`;
  return (
    <div className={styles.tableRow} role="row" data-selected={pane.detailPath === to}>
      <span className={styles.rowTicker} role="cell">
        <AppLink to={to} className={styles.rowLink} aria-label={spoken} />
        {pick.symbolAtPublication}
        {pick.delisted && <Tag tone="neutral">Delisted</Tag>}
      </span>
      <span className={styles.rowDate} role="cell">
        {formatDayMonth(published, zone)}
      </span>
      <span role="cell">
        {pending ? (
          <span className={styles.rowPending}>
            Pending · {pick.outcome.sessionsElapsed} of {pick.outcome.windowSessions}
          </span>
        ) : (
          <span className={styles.rowReturn} data-tone={outcomeTone(pick)}>
            {formatPercent(pick.outcome.returnPct, 1)}
          </span>
        )}
      </span>
    </div>
  );
}

/** S23: every published pick, including losses and delistings, with a consistent outcome window. */
export default function PickArchiveScreen() {
  const [params, setParams] = useSearchParams();
  const status =
    (['all', 'active', 'closed'] as const).find((value) => value === params.get('status')) ?? 'all';
  const period = PERIODS.find((item) => item.value === params.get('period'))?.value ?? '30';
  const outcome = OUTCOMES.find((item) => item.value === params.get('outcome'))?.value ?? 'all';
  const archive = useArchive({ status, sinceDays: period === 'all' ? null : Number(period) });
  const { push } = useAppNavigation();
  const sentinel = useRef<HTMLDivElement>(null);
  useDocumentTitle('The full record');

  const update = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <ScreenBody tabBar>
      <TopBar
        back="/research"
        leading={<TopBarLabel>Research history</TopBarLabel>}
        compactTitle="The full record"
        sentinel={sentinel}
      />
      <Content>
        <LargeTitle
          title={
            <>
              The full
              <br />
              record.
            </>
          }
          meta={<DemoTag />}
          sentinelRef={sentinel}
        />
        <UnderlineTabs<Status>
          label="Pick status"
          value={status}
          controls="archive-table"
          onChange={(value) => update('status', value, 'all')}
          items={[
            { value: 'all', label: 'All picks' },
            { value: 'active', label: 'Active' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <div className={styles.filters}>
          <SelectField
            label="Period"
            hideLabel
            value={period}
            onChange={(event) => update('period', event.target.value, '30')}
            options={PERIODS}
          />
          <SelectField
            label="Outcome"
            hideLabel
            value={outcome}
            onChange={(event) => update('outcome', event.target.value, 'all')}
            options={OUTCOMES.map((item) => ({ value: item.value, label: item.label }))}
          />
        </div>
        <div id="archive-table">
          <QueryState
            query={archive}
            errorTitle="The archive could not be loaded."
            skeleton={
              <div style={{ display: 'grid', gap: 8, padding: '12px var(--gutter)' }}>
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </div>
            }
          >
            {(picks) => {
              const filtered = picks.filter((pick) => {
                if (outcome === 'pending') return pick.outcome.status === 'pending';
                if (outcome === 'positive') return outcomeTone(pick) === 'positive';
                if (outcome === 'negative') return outcomeTone(pick) === 'negative';
                return true;
              });
              if (filtered.length === 0) {
                return (
                  <EmptyState
                    icon={History}
                    size="section"
                    title="No picks match these filters."
                    actions={
                      <Button
                        full
                        variant="secondary"
                        onClick={() => setParams({ period: 'all' }, { replace: true })}
                      >
                        Show every pick
                      </Button>
                    }
                  >
                    Nothing is hidden: widen the period or outcome to see the rest of the record.
                  </EmptyState>
                );
              }
              return (
                <>
                  <div
                    className={styles.table}
                    role="table"
                    aria-label="Archived picks with 20-session outcomes"
                  >
                    <div className={styles.tableHead} role="row">
                      <span role="columnheader">Pick</span>
                      <span role="columnheader">Published</span>
                      <span role="columnheader">20-day return</span>
                    </div>
                    {filtered.map((pick) => (
                      <ArchiveRow key={pick.id} pick={pick} />
                    ))}
                  </div>
                  <p className={styles.countLine}>
                    Illustrative sample · {filtered.length} of {picks.length} picks in this period
                    {picks.some((pick) => pick.outcome.status === 'pending')
                      ? ' · pending windows are not counted as gains or losses'
                      : ''}
                  </p>
                </>
              );
            }}
          </QueryState>
        </div>
        {!archive.isPending && (
          <>
            <div className={styles.visible}>
              <h2 className={styles.visibleTitle}>Every pick stays visible.</h2>
              <p className="t-label t-muted">
                Review the original thesis and subsequent changes; losses and delistings stay in the
                record.
              </p>
              <Button
                variant="secondary"
                full
                between
                icon={ArrowUpRight}
                onClick={() => push('/archive/performance')}
              >
                View measurement method
              </Button>
            </div>
            <Disclaimer>
              Sample outcomes from illustrative prices. Returns start at the next regular-session
              open after publication and run 20 sessions, before costs. Not audited and not a
              forecast.
            </Disclaimer>
          </>
        )}
      </Content>
    </ScreenBody>
  );
}
