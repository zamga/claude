import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { PriceChart } from '@/components/chart/PriceChart';
import { createInspectionStore } from '@/components/chart/inspectionStore';
import { QuoteHero } from '@/components/chart/QuoteHero';
import { RangeTabs } from '@/components/chart/RangeTabs';
import { Eyebrow, ScreenHeading, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Briefcase,
  Calendar,
  FileText,
  ICON_STROKE,
  Plus,
  RefreshCw,
  WifiOff,
} from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import {
  formatClockWithZone,
  formatDate,
  formatDateTime,
  formatMoney,
  formatWeekdayDate,
} from '@/domain/format';
import { evaluateScenario } from '@/domain/valuation';
import {
  useAlerts,
  useInstrument,
  useInstrumentEvents,
  usePickForInstrument,
  usePosition,
  useQuote,
  useReports,
  useSeries,
  useValuation,
} from '@/data/queries';
import type { Assessment, ChartRange, Instrument } from '@/data/types';
import { AssessmentSheet } from '@/features/Methodology';
import { QueryState, useCachedAt, useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AccountPrompt, useWatchlistMembership } from '@/features/watchlist';
import { WatchlistPickerSheet } from '@/features/WatchlistPicker';
import shared from '../shared.module.css';
import styles from './PickAnalysis.module.css';

function timingLabel(timing: string): string {
  switch (timing) {
    case 'before_open':
      return 'Before the open';
    case 'after_close':
      return 'After the close';
    case 'during_session':
      return 'During the session';
    default:
      return 'Time unconfirmed';
  }
}

function Analysis({ instrument }: { instrument: Instrument }) {
  const { push } = useAppNavigation();
  const { signedIn } = useSession();
  const userZone = useUserTimeZone();
  const offline = useOffline();
  const store = useMemo(() => createInspectionStore(), []);
  const [requested, setRequested] = useState<ChartRange>('1D');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const quote = useQuote(instrument.id);
  const series = useSeries(instrument.id, requested);
  const pick = usePickForInstrument(instrument.id);
  const valuation = useValuation(instrument.id);
  const events = useInstrumentEvents(instrument.id);
  const reports = useReports({ instrumentId: instrument.id });
  const alerts = useAlerts(signedIn);
  const position = usePosition(instrument.id, signedIn);
  const membership = useWatchlistMembership(instrument.id, instrument.symbol);
  const cachedAt = useCachedAt(quote);
  const seriesCachedAt = useCachedAt(series);
  useDocumentTitle(`${instrument.symbol} · ${pick.data ? 'Pick analysis' : instrument.shortName}`);

  const committed = (series.data?.range as ChartRange | undefined) ?? requested;
  // The sections below the chart appear together once their data has settled, so nothing above the
  // fold moves as individual answers arrive (layout stability, spec page 27).
  const settled = (query: { isPending: boolean; fetchStatus: string }) =>
    !query.isPending || query.fetchStatus !== 'fetching';
  const detailsReady =
    offline || [pick, valuation, events, reports, alerts, position].every(settled);
  const rangeLoading = series.isFetching && (series.isPlaceholderData || committed !== requested);
  const pending = instrument.status === 'pending';
  const upcoming = (events.data ?? [])
    .filter((event) => event.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const myAlerts = (alerts.data ?? []).filter((rule) => rule.instrumentId === instrument.id);
  const valuationSummary = useMemo(() => {
    if (!valuation.data) return null;
    const model = valuation.data;
    const base = {
      ...model.base,
      currency: model.currency,
      referencePrice: model.referencePrice,
      referenceAt: Date.parse(model.referenceAt),
    };
    const values = (['bear', 'base', 'bull'] as const).map((name) => {
      const result = evaluateScenario(base, model.scenarios[name]);
      return result.ok
        ? formatMoney(result.valuePerShare.round(0).toFixed(0), model.currency, 0)
        : '—';
    });
    return `Bear ${values[0]} · Base ${values[1]} · Bull ${values[2]}`;
  }, [valuation.data]);

  const saveAction = () => {
    if (membership.saved) setPickerOpen(true);
    else void membership.quickSave();
  };

  return (
    <ScreenBody>
      <TopBar
        title={pick.data ? 'Pick analysis' : 'Company'}
        ruled
        trailing={
          <IconButton
            icon={Bookmark}
            label={
              membership.saved
                ? `${instrument.symbol} is saved. Edit lists`
                : `Save ${instrument.symbol} to your watchlist`
            }
            active={membership.saved}
            busy={membership.pendingList != null}
            disabled={offline}
            onClick={saveAction}
          />
        }
      />
      <Content>
        {cachedAt != null && (
          <Notice tone="warning" icon={WifiOff} role="status" title="Offline · updates paused">
            The quote and chart below are the last copy saved on this device.
          </Notice>
        )}
        <div className={shared.eyebrowRow}>
          <Eyebrow tone="muted">
            {cachedAt != null
              ? `${instrument.shortName} / Last saved quote`
              : `${instrument.shortName} / ${instrument.exchange}`}
          </Eyebrow>
          <DemoTag label="Demo data" />
        </div>
        <div className={shared.headline}>
          <ScreenHeading size="none" className={shared.bigTicker}>
            <span data-anchor-target="ticker">{instrument.symbol}</span>
          </ScreenHeading>
        </div>
        <div className={shared.block} style={{ marginTop: 8 }}>
          {quote.data ? (
            <QuoteHero
              quote={quote.data}
              series={series.data ?? null}
              store={store}
              timeZone={instrument.timeZone}
              cachedAt={cachedAt}
              userTimeZone={userZone}
            />
          ) : quote.isError && !quote.data ? (
            <Notice
              tone="error"
              title="The quote could not be loaded."
              actions={
                <Button size="small" variant="quiet" onClick={() => void quote.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <Skeleton width={180} height={40} />
              <Skeleton width={220} height={14} />
            </div>
          )}
        </div>

        {pending ? (
          <div className={styles.notQuoted}>
            <Notice
              tone="neutral"
              title="Not listed yet"
              actions={
                <Button
                  size="small"
                  variant="quiet"
                  onClick={() => push(`/ipos/ipo_${instrument.symbol.toLowerCase()}`)}
                >
                  Open the IPO dossier
                </Button>
              }
            >
              Quotes and charts begin after the first trading session. The company keeps the same
              identity when it lists.
            </Notice>
          </div>
        ) : (
          <>
            <div className={shared.chartBlock}>
              {series.data ? (
                <PriceChart
                  series={series.data}
                  store={store}
                  label={`${instrument.symbol} price chart, ${series.data.range}`}
                  height={240}
                  loading={rangeLoading}
                  loadingLabel={`Loading ${requested}…`}
                />
              ) : series.isError ? (
                <Notice
                  tone="error"
                  title="The chart could not be loaded."
                  actions={
                    <Button size="small" variant="quiet" onClick={() => void series.refetch()}>
                      Try again
                    </Button>
                  }
                />
              ) : (
                <Skeleton height={240} />
              )}
              {seriesCachedAt != null && <span className={styles.cachedLabel}>Cached chart</span>}
            </div>
            <div className={shared.rangeRow}>
              <RangeTabs value={committed} requested={requested} onChange={setRequested} />
            </div>
          </>
        )}

        {cachedAt != null && (
          <div className={styles.offlineBlock}>
            <h2 className={styles.offlineTitle}>
              Reconnect
              <br />
              to refresh.
            </h2>
            <p className="t-body-sm t-muted" style={{ marginTop: 8 }}>
              You can still read saved research. Quotes and alerts may be delayed.
            </p>
            <div className={styles.offlineActions}>
              <Button
                full
                icon={RefreshCw}
                iconPosition="start"
                onClick={() => {
                  void quote.refetch();
                  void series.refetch();
                }}
              >
                Try again
              </Button>
              <Button full variant="secondary" onClick={() => push('/research?view=saved')}>
                Open saved research
              </Button>
            </div>
          </div>
        )}

        {detailsReady ? (
          <>
            {pick.data && (
              <section aria-labelledby="thesis-heading">
                <SectionHeader title="The thesis" id="thesis-heading" size="large" />
                <p className={styles.thesisLine}>{pick.data.thesisLine}</p>
                <div style={{ marginTop: 12 }}>
                  <List label="Thesis">
                    <Row
                      to={`/stocks/${instrument.symbol}/thesis`}
                      leading={
                        <ArrowUpRight
                          className={styles.rowIcon}
                          data-tone="positive"
                          size={18}
                          strokeWidth={ICON_STROKE}
                          aria-hidden
                        />
                      }
                      title={<span className={styles.rowLabel}>Catalyst</span>}
                      aside={<span className={styles.rowValue}>{pick.data.catalyst.label}</span>}
                      linkLabel={`Catalyst: ${pick.data.catalyst.label}. ${pick.data.catalyst.detail}`}
                      dense
                      reflow
                    />
                    <Row
                      to={`/stocks/${instrument.symbol}/thesis?tab=risks`}
                      leading={
                        <ArrowDownRight
                          className={styles.rowIcon}
                          data-tone="negative"
                          size={18}
                          strokeWidth={ICON_STROKE}
                          aria-hidden
                        />
                      }
                      title={<span className={styles.rowLabel}>Key risk</span>}
                      aside={<span className={styles.rowValue}>{pick.data.keyRisk.label}</span>}
                      linkLabel={`Key risk: ${pick.data.keyRisk.label}. ${pick.data.keyRisk.detail}`}
                      dense
                      reflow
                    />
                  </List>
                </div>
                <div className={shared.grid3} role="list" aria-label="Assessments">
                  {pick.data.assessments.map((item) => (
                    <div key={item.key} className={shared.stat} role="listitem">
                      <button
                        type="button"
                        className={shared.statButton}
                        onClick={() => setAssessment(item)}
                        aria-label={`${item.label}: ${item.value}. ${item.basis === 'rule' ? 'Rule-based' : 'Analyst assessment'}. Show definition`}
                      >
                        <span className={shared.statLabel} data-case="sentence">
                          {item.label}
                        </span>
                        <span
                          className={shared.statValue}
                          data-tone={item.tone === 'neutral' ? undefined : item.tone}
                          data-size="sm"
                        >
                          {item.value}
                        </span>
                        <span className={shared.statNote}>
                          {item.basis === 'rule' ? 'Rule' : 'Analyst'}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
                <p className={shared.footnote}>
                  Published{' '}
                  {formatWeekdayDate(Date.parse(pick.data.publishedAt), 'America/New_York')},{' '}
                  {formatClockWithZone(Date.parse(pick.data.publishedAt), 'America/New_York')} ·{' '}
                  {pick.data.analyst} · research note v{pick.data.reportVersion} · horizon:{' '}
                  {pick.data.horizon}
                </p>
              </section>
            )}

            {(valuationSummary || upcoming) && (
              <section aria-labelledby="next-heading">
                <SectionHeader title="Valuation and catalysts" id="next-heading" size="small" />
                <List label="Valuation and catalysts">
                  {valuationSummary && (
                    <Row
                      to={`/stocks/${instrument.symbol}/valuation`}
                      icon={FileText}
                      title="Price vs. expectations"
                      detail={<span className={styles.valuationSummary}>{valuationSummary}</span>}
                    />
                  )}
                  {upcoming && (
                    <Row
                      to={`/earnings/${upcoming.id}`}
                      icon={Calendar}
                      title={`${upcoming.fiscalPeriod} results`}
                      detail={`${formatWeekdayDate(Date.parse(`${upcoming.date}T12:00:00Z`), 'UTC')} · ${timingLabel(upcoming.timing)}${upcoming.dateConfirmed ? '' : ' · date not confirmed'}`}
                    />
                  )}
                </List>
              </section>
            )}

            {!pending && (
              <section aria-labelledby="alerts-heading">
                <SectionHeader title="Your alerts" id="alerts-heading" size="small" />
                <List label="Alerts">
                  {myAlerts.map((rule) => (
                    <Row
                      key={rule.id}
                      to={`/alerts/${rule.id}/edit`}
                      icon={Bell}
                      title={
                        rule.type === 'price'
                          ? `Price ${rule.comparator === 'cross_above' ? 'rises above' : 'falls below'} ${formatMoney(rule.threshold, rule.currency)}`
                          : rule.type === 'earnings'
                            ? 'Earnings reminder'
                            : 'Research updates'
                      }
                      detail={
                        rule.state === 'paused'
                          ? 'Paused'
                          : rule.state === 'fired'
                            ? `Triggered ${rule.lastFiredAt ? formatDateTime(rule.lastFiredAt, instrument.timeZone) : ''}`
                            : rule.waitingForReset
                              ? 'Waiting for a new crossing'
                              : 'Armed'
                      }
                    />
                  ))}
                  <Row
                    to={`/alerts/new?instrument=${instrument.symbol}`}
                    icon={Plus}
                    title="Create an alert"
                    detail="Price, earnings or research updates"
                  />
                </List>
              </section>
            )}

            {position.data && Number(position.data.position.units) > 0 && (
              <List label="Paper position">
                <Row
                  to={`/portfolio/${instrument.symbol}`}
                  icon={Briefcase}
                  title="Your paper position"
                  detail={`${position.data.position.units} shares (simulated)`}
                />
              </List>
            )}

            {reports.data && reports.data.length > 0 && (
              <section aria-labelledby="research-heading">
                <SectionHeader title="Research" id="research-heading" size="small" />
                <List label="Research">
                  {reports.data.slice(0, 4).map((report) => (
                    <Row
                      key={report.id}
                      to={`/research/${report.id}`}
                      title={report.title}
                      detail={`${report.label} · ${formatDate(Date.parse(report.latestPublishedAt), userZone)}`}
                    />
                  ))}
                </List>
              </section>
            )}
          </>
        ) : (
          <div
            className={styles.detailsSkeleton}
            aria-busy="true"
            aria-label="Loading the analysis"
          >
            <Skeleton height={22} width="40%" />
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={72} />
            <Skeleton height={22} width="55%" />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        )}

        <section aria-labelledby="company-heading">
          <SectionHeader title="Company" id="company-heading" size="small" />
          <p className={styles.description}>{instrument.description}</p>
          <KeyValueList label="Listing">
            <KeyValue label="Name" value={instrument.name} />
            <KeyValue label="Exchange" value={`${instrument.exchange} (${instrument.mic})`} />
            <KeyValue label="Quote currency" value={instrument.currency} />
            <KeyValue label="Sector" value={`${instrument.sector} · ${instrument.industry}`} />
            <KeyValue
              label="Status"
              value={
                instrument.status === 'listed'
                  ? 'Listed'
                  : instrument.status === 'pending'
                    ? 'Pending listing'
                    : 'Delisted'
              }
            />
          </KeyValueList>
        </section>
      </Content>
      {!pending && instrument.status !== 'delisted' && (
        <ActionBar note={offline ? 'Reconnect to save changes.' : undefined}>
          <Button
            full
            variant={membership.saved ? 'secondary' : 'primary'}
            icon={membership.saved ? Bookmark : Plus}
            iconPosition="start"
            pending={membership.pendingList != null}
            disabledReason={offline ? 'Saving needs a connection.' : undefined}
            onClick={saveAction}
          >
            {membership.saved
              ? `In ${membership.memberOf.map((list) => list.name).join(', ')}`
              : 'Add to watchlist'}
          </Button>
        </ActionBar>
      )}
      <AssessmentSheet assessment={assessment} onClose={() => setAssessment(null)} />
      <WatchlistPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        membership={membership}
        symbol={instrument.symbol}
      />
      <AccountPrompt
        intent={membership.intent}
        onClose={membership.clearIntent}
        what={`Create a free account or sign in to save ${instrument.symbol}, follow its catalysts and set alerts. Published research stays readable without an account.`}
      />
    </ScreenBody>
  );
}

export default function PickAnalysisScreen() {
  const { symbol = '' } = useParams();
  const instrument = useInstrument(symbol);
  const { back } = useAppNavigation();
  return (
    <QueryState
      query={instrument}
      offlineTitle="This company has not been saved on this device yet."
      notFound={
        <ScreenBody>
          <TopBar title="Company" ruled />
          <EmptyState
            title="We could not find that company."
            actions={
              <Button full onClick={() => back('/search')}>
                Search companies
              </Button>
            }
          >
            The ticker “{symbol.toUpperCase()}” is not in the covered universe of this build.
          </EmptyState>
        </ScreenBody>
      }
      skeleton={
        <ScreenBody>
          <TopBar title="Pick analysis" ruled />
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="50%" height={56} />
            <Skeleton width="45%" height={40} />
            <Skeleton height={240} />
          </div>
        </ScreenBody>
      }
    >
      {(data) => <Analysis key={data.id} instrument={data} />}
    </QueryState>
  );
}
