import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { Eyebrow, ScreenHeading, SectionHeader, TopBar } from '@/components/Header';
import { ArrowUpRight } from '@/components/icons';
import { ActionBar, Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList } from '@/components/List';
import { DemoTag, Skeleton } from '@/components/Status';
import { Segmented } from '@/components/Tabs';
import { dec } from '@/domain/decimal';
import { formatDayMonth, formatPercent, formatPoints } from '@/domain/format';
import { usePerformanceReview } from '@/data/queries';
import { outcomeTone } from '@/features/archive';
import { QueryState } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AppLink } from '@/components/AppLink';
import shared from '../shared.module.css';
import styles from './Research.module.css';

type Period = '30' | '90' | 'all';

function tone(value: string | null): 'positive' | 'negative' | undefined {
  if (value == null) return undefined;
  return Number(value) > 0 ? 'positive' : Number(value) < 0 ? 'negative' : undefined;
}

/**
 * S24: aggregates over one defined universe and window, with the sample size and the method
 * next to the numbers. Sample results are labelled; nothing is presented as audited.
 */
export default function PerformanceReviewScreen() {
  const [params, setParams] = useSearchParams();
  const period =
    (['30', '90', 'all'] as const).find((value) => value === params.get('period')) ?? 'all';
  const review = usePerformanceReview({ sinceDays: period === 'all' ? null : Number(period) });
  const zone = useUserTimeZone();
  const { push } = useAppNavigation();
  useDocumentTitle('Performance review');

  return (
    <ScreenBody>
      <TopBar title="Performance review" ruled />
      <Content>
        <div className={shared.eyebrowRow}>
          <Eyebrow tone="muted">Demo / Sample results</Eyebrow>
          <DemoTag label="Demo data" />
        </div>
        <div className={shared.headline}>
          <ScreenHeading>
            Measured
            <br />
            consistently.
          </ScreenHeading>
        </div>
        <div className={styles.periodRow}>
          <Segmented<Period>
            label="Publication period"
            variant="ghost"
            value={period}
            onChange={(value) =>
              setParams(value === 'all' ? {} : { period: value }, { replace: true })
            }
            items={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
        <QueryState
          query={review}
          errorTitle="The review could not be loaded."
          skeleton={
            <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 16 }}>
              <Skeleton height={72} />
              <Skeleton height={72} />
              <Skeleton height={200} />
            </div>
          }
        >
          {(data) => {
            const summary = data.summary;
            const complete = data.picks.filter((pick) => pick.outcome.status === 'complete');
            return (
              <>
                <div className={shared.grid3}>
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Average return</span>
                    <span
                      className={shared.statValue}
                      data-size="xl"
                      data-tone={tone(summary.meanPct)}
                    >
                      {formatPercent(summary.meanPct, 1)}
                    </span>
                  </div>
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Benchmark</span>
                    <span
                      className={shared.statValue}
                      data-size="xl"
                      data-tone={tone(summary.benchmarkMeanPct)}
                    >
                      {formatPercent(summary.benchmarkMeanPct, 1)}
                    </span>
                  </div>
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Difference</span>
                    <span
                      className={shared.statValue}
                      data-size="xl"
                      data-tone={tone(summary.differencePp)}
                    >
                      {formatPoints(summary.differencePp).replace(/ pp$/, '')}
                      {/ pp$/.test(formatPoints(summary.differencePp)) && (
                        <span className={shared.statUnit}> pp</span>
                      )}
                    </span>
                  </div>
                </div>
                <div
                  className={shared.grid3}
                  style={{
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    borderTop: 0,
                    marginTop: 0,
                  }}
                >
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Closed samples</span>
                    <span className={shared.statValue} data-size="xl">
                      {summary.complete}
                    </span>
                    {summary.pending > 0 && (
                      <span className={shared.statNote}>{summary.pending} pending, excluded</span>
                    )}
                  </div>
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Positive outcomes</span>
                    <span className={shared.statValue} data-size="xl">
                      {summary.positive} of {summary.complete}
                    </span>
                    {summary.medianPct != null && (
                      <span className={shared.statNote}>
                        Median {formatPercent(summary.medianPct, 1)}
                      </span>
                    )}
                  </div>
                </div>
                {summary.complete < 20 && (
                  <p className={shared.footnote}>
                    A small sample: {summary.complete} completed windows. Averages can move a lot
                    with one result.
                  </p>
                )}

                <section aria-labelledby="rules-heading">
                  <SectionHeader title="Measurement rules" size="large" id="rules-heading" />
                  <KeyValueList label="Measurement rules">
                    <KeyValue label="Start" value={data.method.entry} />
                    <KeyValue label="Window" value={data.method.window} />
                    <KeyValue label="Coverage" value={data.method.coverage} />
                    <KeyValue label="Return basis" value={data.method.returnBasis} />
                    <KeyValue label="Benchmark" value={data.method.benchmark} />
                    <KeyValue label="Costs" value={data.method.costs} />
                    <KeyValue label="Corporate actions" value={data.method.corporateActions} />
                    <KeyValue label="Universe" value={data.method.universe} />
                  </KeyValueList>
                  <p className={shared.footnote}>
                    Method {data.method.version}. Sample figures demonstrate the reporting design.
                    They are not audited results or a forecast.
                  </p>
                </section>

                <section aria-labelledby="results-heading" id="results">
                  <SectionHeader title="Every eligible result" id="results-heading" size="small" />
                  <div
                    className={styles.table}
                    role="table"
                    aria-label="Completed outcomes with benchmark"
                  >
                    <div className={styles.tableHead} role="row">
                      <span role="columnheader">Pick</span>
                      <span role="columnheader">Return</span>
                      <span role="columnheader">vs benchmark</span>
                    </div>
                    {complete.map((pick) => {
                      const difference =
                        pick.outcome.returnPct != null && pick.outcome.benchmark.returnPct != null
                          ? dec(pick.outcome.returnPct)
                              .minus(pick.outcome.benchmark.returnPct)
                              .toFixed(4)
                          : null;
                      return (
                        <div key={pick.id} className={styles.tableRow} role="row">
                          <span className={styles.tickerStack} role="cell">
                            <AppLink
                              to={`/archive/${pick.id}`}
                              className={styles.rowLink}
                              aria-label={`${pick.symbolAtPublication}, published ${formatDayMonth(Date.parse(pick.publishedAt), zone)}: ${formatPercent(pick.outcome.returnPct, 1)}, ${formatPoints(difference)} versus benchmark`}
                            />
                            <span className={styles.rowTicker}>{pick.symbolAtPublication}</span>
                            <span className={styles.rowDate}>
                              {formatDayMonth(Date.parse(pick.publishedAt), zone)}
                            </span>
                          </span>
                          <span
                            className={styles.rowReturn}
                            data-tone={outcomeTone(pick)}
                            role="cell"
                          >
                            {formatPercent(pick.outcome.returnPct, 1)}
                          </span>
                          <span className={styles.rowPending} role="cell">
                            {formatPoints(difference)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            );
          }}
        </QueryState>
        <Disclaimer>
          Outcomes use illustrative prices from a simulated dataset. Past outcomes, real or sample,
          do not predict future results. Not investment advice.
        </Disclaimer>
      </Content>
      <ActionBar>
        <Button full between icon={ArrowUpRight} onClick={() => push('/archive?period=all')}>
          Inspect every pick
        </Button>
      </ActionBar>
    </ScreenBody>
  );
}
