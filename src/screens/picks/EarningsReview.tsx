import { useState } from 'react';
import { useParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { Eyebrow, ScreenHeading, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  CalendarDays,
  FileText,
  ICON_STROKE,
  Info,
} from '@/components/icons';
import { ActionBar, Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { Change, Tag } from '@/components/Market';
import { Sheet } from '@/components/Sheet';
import { Sparkline } from '@/components/Sparkline';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import {
  formatClockWithZone,
  formatDate,
  formatDuration,
  formatMoney,
  formatPercent,
  zoneLabel,
} from '@/domain/format';
import { useEarning, useInstrument, useReport, useSources } from '@/data/queries';
import type { EarningsEvent, Instrument, Source } from '@/data/types';
import {
  dayLabel,
  GUIDANCE_LABEL,
  GUIDANCE_TONE,
  isReported,
  releaseTimingText,
  surprisePct,
  TIMING_LABEL,
} from '@/features/earnings';
import { useSavedReport } from '@/features/research';
import { SourceSheet } from '@/features/SourceSheet';
import { QueryState } from '@/features/status';
import { useDemoNow, useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AccountPrompt } from '@/features/watchlist';
import shared from '../shared.module.css';
import styles from './EarningsReview.module.css';

type MetricKey = 'revenue' | 'eps';

const METRIC_NAME: Record<MetricKey, string> = { revenue: 'Revenue', eps: 'Diluted EPS' };

function metricText(
  event: EarningsEvent,
  key: MetricKey,
  value: string | null | undefined,
): string {
  if (value == null) return '—';
  return key === 'revenue'
    ? `${formatMoney(value, event.currency, value.includes('.') && value.split('.')[1]!.length > 1 ? 2 : 1)}B`
    : formatMoney(value, event.currency);
}

function ReadThroughIcon({ tone }: { tone: 'positive' | 'neutral' | 'negative' }) {
  const Icon =
    tone === 'positive' ? ArrowUpRight : tone === 'negative' ? ArrowDownRight : ArrowRight;
  return (
    <Icon
      className={styles.readIcon}
      data-tone={tone}
      size={18}
      strokeWidth={ICON_STROKE}
      aria-hidden
    />
  );
}

function MetricSheet({
  metric,
  event,
  sources,
  onClose,
  timeZone,
}: {
  metric: MetricKey | null;
  event: EarningsEvent;
  sources: Source[];
  onClose: () => void;
  timeZone: string;
}) {
  const actual = metric === 'revenue' ? event.actual?.revenueB : event.actual?.eps;
  const estimate = metric === 'revenue' ? event.consensus.revenueB : event.consensus.eps;
  const surprise = surprisePct(actual, estimate);
  const release = sources.find((source) => source.kind === 'release') ?? sources[0] ?? null;
  return (
    <Sheet
      open={metric != null}
      onClose={onClose}
      title={metric ? `${METRIC_NAME[metric]}, ${event.fiscalPeriod}` : ''}
      size="auto"
    >
      {metric && (
        <div className={styles.sheetBody}>
          <KeyValueList label={`${METRIC_NAME[metric]} details`}>
            <KeyValue label="Period" value={event.fiscalPeriod} />
            <KeyValue
              label={
                <span className={styles.kvLabel}>
                  Actual <Tag tone="positive">Reported</Tag>
                </span>
              }
              value={metricText(event, metric, actual)}
            />
            <KeyValue
              label={
                <span className={styles.kvLabel}>
                  Estimate <Tag tone="outline">Consensus</Tag>
                </span>
              }
              value={metricText(event, metric, estimate)}
            />
            <KeyValue
              label="Surprise"
              value={surprise == null ? 'Not calculated' : formatPercent(surprise, 1)}
            />
          </KeyValueList>
          <p className="t-label t-muted">
            {surprise == null
              ? 'There is no estimate for this metric, so no surprise is shown. Nothing is filled in.'
              : 'Surprise = (actual − estimate) ÷ estimate. Units match the company’s reporting currency.'}
          </p>
          <p className="t-label t-muted">
            Actual: {release ? `${release.title}, ${release.publisher}` : 'company results release'}
            {event.actual ? `, ${formatDate(Date.parse(event.actual.reportedAt), timeZone)}` : ''}.
            Estimate: {event.consensus.source}, as of{' '}
            {formatDate(Date.parse(event.consensus.asOf), timeZone)}.
          </p>
        </div>
      )}
    </Sheet>
  );
}

function ReportedView({ event, instrument }: { event: EarningsEvent; instrument: Instrument }) {
  const userZone = useUserTimeZone();
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const sources = useSources(event.sourceIds);
  const actual = event.actual!;
  const revenueSurprise = surprisePct(actual.revenueB, event.consensus.revenueB);
  const epsSurprise = surprisePct(actual.eps, event.consensus.eps);
  const guidance = event.guidance;
  const reaction = event.reaction;
  const reportedAt = Date.parse(actual.reportedAt);
  const reactionSamples = reaction?.series ?? [];

  return (
    <>
      <p className={styles.period}>
        <strong>{event.fiscalPeriod}</strong> results
        <span className={styles.periodDetail}>
          Reported {dayLabel(event.date, event.timeZone)},{' '}
          {TIMING_LABEL[event.timing].toLowerCase()} ·{' '}
          {formatClockWithZone(reportedAt, event.timeZone)}
        </span>
      </p>

      <section aria-labelledby="glance-heading">
        <SectionHeader
          title="Results at a glance"
          id="glance-heading"
          aside={<Tag tone="positive">Reported</Tag>}
        />
        <div className={styles.tableWrap}>
          <table className={styles.results}>
            <caption className="visually-hidden">
              {event.fiscalPeriod} reported results compared with consensus estimates
            </caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Actual</th>
                <th scope="col">Est.</th>
              </tr>
            </thead>
            <tbody>
              {(['revenue', 'eps'] as const).map((key) => {
                const value = key === 'revenue' ? actual.revenueB : actual.eps;
                const estimate = key === 'revenue' ? event.consensus.revenueB : event.consensus.eps;
                const beat =
                  value != null && estimate != null ? Number(value) >= Number(estimate) : null;
                return (
                  <tr key={key}>
                    <th scope="row">
                      <button
                        type="button"
                        className={styles.metricButton}
                        onClick={() => setMetric(key)}
                      >
                        {key === 'revenue' ? 'Revenue' : 'EPS'}
                        <Info size={14} strokeWidth={ICON_STROKE} aria-hidden />
                        <span className="visually-hidden">: period and source details</span>
                      </button>
                    </th>
                    <td className={styles.actual} data-beat={beat}>
                      {metricText(event, key, value)}
                    </td>
                    <td className={styles.estimate}>
                      {estimate == null ? (
                        <span title="No estimate available">n/a</span>
                      ) : (
                        metricText(event, key, estimate)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={shared.footnote}>
          Illustrative quarterly results. Estimates: {event.consensus.source}, as of{' '}
          {formatDate(Date.parse(event.consensus.asOf), userZone)}.
        </p>
      </section>

      <div className={shared.grid3} role="group" aria-label="Surprises and guidance">
        <div className={shared.stat}>
          <span className={shared.statLabel}>Revenue surprise</span>
          <span
            className={shared.statValue}
            data-tone={
              revenueSurprise == null
                ? undefined
                : Number(revenueSurprise) >= 0
                  ? 'positive'
                  : 'negative'
            }
          >
            {revenueSurprise == null ? '—' : formatPercent(revenueSurprise, 1)}
          </span>
          {revenueSurprise == null && <span className={shared.statNote}>No estimate</span>}
        </div>
        <div className={shared.stat}>
          <span className={shared.statLabel}>EPS surprise</span>
          <span
            className={shared.statValue}
            data-tone={
              epsSurprise == null ? undefined : Number(epsSurprise) >= 0 ? 'positive' : 'negative'
            }
          >
            {epsSurprise == null ? '—' : formatPercent(epsSurprise, 1)}
          </span>
          {epsSurprise == null && (
            <span className={shared.statNote}>No EPS estimate, so no surprise</span>
          )}
        </div>
        <div className={shared.stat}>
          <span className={shared.statLabel}>Guidance</span>
          <span
            className={shared.statValue}
            data-tone={
              guidance
                ? GUIDANCE_TONE[guidance.direction] === 'neutral'
                  ? undefined
                  : GUIDANCE_TONE[guidance.direction]
                : undefined
            }
          >
            {guidance ? GUIDANCE_LABEL[guidance.direction] : '—'}
          </span>
          <span className={shared.statNote}>Management outlook</span>
        </div>
      </div>
      {guidance && <p className={shared.footnote}>{guidance.detail}</p>}

      <section aria-labelledby="reaction-heading">
        <SectionHeader
          title="Market reaction"
          id="reaction-heading"
          aside={<Tag tone="outline">Price data</Tag>}
        />
        <div className={styles.reaction}>
          {reaction?.changePct != null ? (
            <Change value={reaction.changePct} size="lg" className={styles.reactionValue} />
          ) : (
            <span className={styles.reactionPending}>Not yet measurable</span>
          )}
          {reactionSamples.length > 1 && (
            <span className={styles.reactionSpark} aria-hidden>
              <Sparkline samples={reactionSamples} width={200} height={56} fluid />
            </span>
          )}
        </div>
        <p className={shared.footnote}>
          {(reaction?.basis ?? 'Measured from the close before the release').replace(/\.$/, '')}.
          Sample price path, split-adjusted; separate from the reported results above.
        </p>
      </section>

      {event.readThrough.length > 0 && (
        <section aria-labelledby="read-heading">
          <SectionHeader
            title="Read-through"
            id="read-heading"
            aside={<Tag tone="neutral">Analyst view</Tag>}
          />
          <List label="Read-through">
            {event.readThrough.map((item) => (
              <Row
                key={item.label}
                to={event.reportId ? `/stocks/${instrument.symbol}/thesis` : undefined}
                leading={<ReadThroughIcon tone={item.tone} />}
                title={item.label}
                detail={item.detail}
                aside={
                  <span className={styles.assessment} data-tone={item.tone}>
                    {item.assessment}
                  </span>
                }
                linkLabel={`${item.label}: ${item.assessment}. ${item.detail}`}
                dense
              />
            ))}
          </List>
        </section>
      )}

      <section aria-labelledby="sources-heading">
        <SectionHeader title="Sources" id="sources-heading" size="small" />
        {event.sourceIds.length === 0 ? (
          <p className={shared.footnote}>No source documents are attached to this sample event.</p>
        ) : sources.data ? (
          <List label="Sources">
            {sources.data.map((item) => (
              <Row
                key={item.id}
                icon={FileText}
                title={item.title}
                detail={`${item.publisher}${item.period ? ` · ${item.period}` : ''}${item.url ? '' : ' · no document attached'}`}
                onPress={() => setSource(item)}
                dense
              />
            ))}
          </List>
        ) : (
          <div className={shared.block}>
            <Skeleton height={44} />
          </div>
        )}
      </section>

      {event.previousEventId && (
        <List label="Earlier results">
          <Row
            to={`/earnings/${event.previousEventId}`}
            icon={CalendarDays}
            title="Previous quarter"
            detail="Results, guidance and reaction"
          />
        </List>
      )}

      <MetricSheet
        metric={metric}
        event={event}
        sources={sources.data ?? []}
        onClose={() => setMetric(null)}
        timeZone={userZone}
      />
      <SourceSheet source={source} onClose={() => setSource(null)} timeZone={userZone} />
    </>
  );
}

function UpcomingView({ event, instrument }: { event: EarningsEvent; instrument: Instrument }) {
  const now = useDemoNow();
  const userZone = useUserTimeZone();
  const report = useReport(event.reportId ?? undefined);
  const expected = event.expectedAt ? Date.parse(event.expectedAt) : null;
  const due = expected != null && event.timeConfirmed ? expected - now : null;
  const monitor = report.data?.current.body.monitor.slice(0, 3) ?? [];

  return (
    <>
      <p className={styles.period}>
        <strong>{event.fiscalPeriod}</strong>{' '}
        {event.status === 'postponed' ? 'release postponed' : 'release scheduled'}
      </p>

      {event.status === 'postponed' && (
        <Notice tone="warning" title="This release was postponed.">
          The company has not confirmed a new date. The calendar will show it once it does.
        </Notice>
      )}
      {due != null && due <= 0 && event.status === 'scheduled' && (
        <Notice tone="neutral" icon={Info} role="status" title="Results are due.">
          The release time has passed and this demo feed has not received the results yet. Nothing
          is estimated in their place.
        </Notice>
      )}

      <section aria-labelledby="release-heading">
        <SectionHeader title="The release" id="release-heading" />
        <KeyValueList label="Release timing">
          <KeyValue
            label="Date"
            value={`${dayLabel(event.date, event.timeZone)}${event.dateConfirmed ? '' : ' (unconfirmed)'}`}
          />
          <KeyValue label="Timing" value={releaseTimingText(event)} />
          {expected != null && event.timeConfirmed && (
            <KeyValue
              label="Your time"
              value={`${formatClockWithZone(expected, userZone)}${zoneLabel(expected, userZone) === zoneLabel(expected, event.timeZone) ? '' : ` (${userZone.split('/').pop()?.replace('_', ' ')})`}`}
            />
          )}
          {due != null && due > 0 && <KeyValue label="Due in" value={formatDuration(due / 1000)} />}
        </KeyValueList>
      </section>

      <section aria-labelledby="consensus-heading">
        <SectionHeader
          title="Consensus"
          id="consensus-heading"
          aside={<Tag tone="outline">Estimate</Tag>}
        />
        <div className={shared.grid3} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className={shared.stat}>
            <span className={shared.statLabel}>EPS estimate</span>
            <span className={shared.statValue}>
              {event.consensus.eps == null ? '—' : formatMoney(event.consensus.eps, event.currency)}
            </span>
          </div>
          <div className={shared.stat}>
            <span className={shared.statLabel}>Revenue estimate</span>
            <span className={shared.statValue}>
              {metricText(event, 'revenue', event.consensus.revenueB)}
            </span>
          </div>
        </div>
        <p className={shared.footnote}>
          {event.consensus.source}, as of {formatDate(Date.parse(event.consensus.asOf), userZone)}.
          Estimates are not results; the review fills in once the company reports.
        </p>
      </section>

      {monitor.length > 0 && (
        <section aria-labelledby="watch-heading">
          <SectionHeader
            title="What we’ll watch"
            id="watch-heading"
            aside={<Tag tone="neutral">From the research note</Tag>}
          />
          <ol className={shared.numbered}>
            {monitor.map((item, index) => (
              <li key={item.title} className={shared.numberedItem}>
                <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                <div className={shared.numberedBody}>
                  <div className={shared.numberedTitle}>{item.title}</div>
                  <p className={shared.numberedText}>{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <List label="Related">
        {event.reportId && (
          <Row
            to={`/stocks/${instrument.symbol}/thesis`}
            icon={FileText}
            title="Read the research note"
            detail="The thesis, evidence and risks"
          />
        )}
        {event.previousEventId && (
          <Row
            to={`/earnings/${event.previousEventId}`}
            icon={CalendarDays}
            title="Last quarter’s results"
            detail="Surprises, guidance and reaction"
          />
        )}
        <Row
          to={`/stocks/${instrument.symbol}`}
          icon={ArrowUpRight}
          title={`Open ${instrument.symbol}`}
          detail="Quote, chart and pick analysis"
        />
      </List>
    </>
  );
}

function Review({ event }: { event: EarningsEvent }) {
  const instrument = useInstrument(event.instrumentId);
  const { push } = useAppNavigation();
  const reported = isReported(event);
  const report = useReport(event.reportId ?? undefined);
  const savedReport = useSavedReport(
    event.reportId ?? undefined,
    report.data?.latestVersion,
    report.data?.title ?? 'Research note',
  );
  useDocumentTitle(
    instrument.data
      ? `${instrument.data.symbol} ${event.fiscalPeriod} ${reported ? 'results' : 'earnings'}`
      : 'Earnings review',
  );

  if (!instrument.data) {
    return (
      <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 24 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="50%" height={56} />
        <Skeleton height={160} />
      </div>
    );
  }
  const company = instrument.data;
  return (
    <>
      <TopBar
        title="Earnings review"
        ruled
        trailing={
          event.reportId ? (
            <IconButton
              icon={Bookmark}
              label={
                savedReport.saved
                  ? 'Research note saved. Remove from saved research'
                  : 'Save the research note'
              }
              active={savedReport.saved}
              busy={savedReport.pending}
              onClick={() => void savedReport.toggle()}
            />
          ) : undefined
        }
      />
      <Content>
        <div className={shared.eyebrowRow}>
          <Eyebrow tone="muted">
            {company.shortName} / {company.exchange}
          </Eyebrow>
          <DemoTag label="Demo data" />
        </div>
        <div className={shared.headline}>
          <ScreenHeading size="none" className={shared.bigTicker}>
            <span data-anchor-target="ticker">{company.symbol}</span>
          </ScreenHeading>
        </div>
        {reported ? (
          <ReportedView event={event} instrument={company} />
        ) : (
          <UpcomingView event={event} instrument={company} />
        )}
        <Disclaimer>
          Illustrative results and estimates for a sample session. Reported figures, estimates,
          management guidance and price reaction are labelled separately. Not investment advice.
        </Disclaimer>
      </Content>
      <ActionBar>
        {reported ? (
          <Button
            full
            between
            icon={ArrowUpRight}
            onClick={() =>
              push(
                event.reportId ? `/stocks/${company.symbol}/thesis` : `/stocks/${company.symbol}`,
              )
            }
          >
            {event.reportId ? 'Read full analysis' : `Open ${company.symbol}`}
          </Button>
        ) : (
          <Button
            full
            icon={Bell}
            iconPosition="start"
            disabledReason={
              event.status !== 'scheduled' ? 'Reminders need a scheduled release.' : undefined
            }
            onClick={() =>
              push(`/alerts/new?instrument=${company.symbol}&type=earnings&event=${event.id}`)
            }
          >
            Remind me before the release
          </Button>
        )}
      </ActionBar>
      <AccountPrompt
        intent={savedReport.intent}
        onClose={savedReport.clearIntent}
        what="Sign in to save research notes and read them later, including offline."
      />
    </>
  );
}

export default function EarningsReviewScreen() {
  const { eventId } = useParams();
  const query = useEarning(eventId);
  const { push } = useAppNavigation();
  return (
    <ScreenBody>
      <QueryState
        query={query}
        errorTitle="This earnings event could not be loaded."
        notFound={
          <>
            <TopBar title="Earnings review" ruled />
            <Content>
              <EmptyState
                icon={CalendarDays}
                title="This event is not in the calendar."
                actions={
                  <Button full onClick={() => push('/earnings')}>
                    Open the earnings calendar
                  </Button>
                }
              >
                It may have been rescheduled or the link may be wrong.
              </EmptyState>
            </Content>
          </>
        }
        skeleton={
          <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 72 }}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="50%" height={56} />
            <Skeleton height={160} />
          </div>
        }
      >
        {(event) => <Review event={event} />}
      </QueryState>
    </ScreenBody>
  );
}
