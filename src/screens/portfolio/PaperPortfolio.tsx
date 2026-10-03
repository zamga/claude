import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { usePane } from '@/app/pane';
import { Button } from '@/components/Button';
import { PriceChart } from '@/components/chart/PriceChart';
import { createInspectionStore } from '@/components/chart/inspectionStore';
import { Eyebrow, LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Briefcase, Plus, TriangleAlert } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Change, Tag, Ticker } from '@/components/Market';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import { UnderlineTabs } from '@/components/Tabs';
import {
  formatDate,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSignedMoney,
  pluralize,
} from '@/domain/format';
import { usePortfolio } from '@/data/queries';
import type { PortfolioPeriod, PositionSummary } from '@/data/types';
import { performanceSeries } from '@/features/portfolio';
import { QueryState, useCachedAt } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import shared from '../shared.module.css';
import styles from './Portfolio.module.css';

const PERIODS: PortfolioPeriod[] = ['1M', '3M', '6M', '1Y'];
const VISIBLE_POSITIONS = 4;

function PositionRow({ position }: { position: PositionSummary }) {
  const pane = usePane();
  const to = `/portfolio/${position.symbol}`;
  return (
    <Row
      to={to}
      selected={pane.detailPath === to}
      linkLabel={`${position.symbol}, ${formatQuantity(position.units)} shares, ${
        position.unrealizedPct
          ? `${formatPercent(position.unrealizedPct)} unrealized`
          : 'value unavailable'
      }`}
      title={<Ticker symbol={position.symbol} className={styles.rowTicker} />}
      aside={
        <span className={styles.positionAside}>
          <span className={styles.shares}>{pluralize(Number(position.units), 'share')}</span>
          <Change value={position.unrealizedPct} />
        </span>
      }
      detail={
        position.value ? formatMoney(position.value, 'USD') : 'Quote unavailable · value partial'
      }
      dense
    />
  );
}

export default function PaperPortfolioScreen() {
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.find((value) => value === params.get('period')) ??
    '3M') as PortfolioPeriod;
  const portfolio = usePortfolio(period);
  const cachedAt = useCachedAt(portfolio);
  const zone = useUserTimeZone();
  const { push } = useAppNavigation();
  const store = useMemo(() => createInspectionStore(), []);
  const sentinel = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  useDocumentTitle('Paper portfolio');

  const committed = portfolio.data?.performance.period ?? period;
  const loadingPeriod =
    portfolio.isFetching && (portfolio.isPlaceholderData || committed !== period);
  const chart = useMemo(
    () => (portfolio.data ? performanceSeries(portfolio.data.performance) : null),
    [portfolio.data],
  );

  return (
    <ScreenBody tabBar>
      <TopBar
        back="/watchlist"
        title="Paper portfolio"
        compactTitle="Your ideas, tracked"
        sentinel={sentinel}
        trailing={
          <IconButton
            icon={Plus}
            label="Record a paper trade"
            onClick={() => push('/paper/transactions/new')}
          />
        }
      />
      <Content>
        <LargeTitle
          title={
            <>
              Your ideas,
              <br />
              tracked.
            </>
          }
          meta={<DemoTag />}
          sentinelRef={sentinel}
        />
        <QueryState
          query={portfolio}
          errorTitle="Your paper portfolio could not be loaded."
          skeleton={
            <div className={shared.block} style={{ display: 'grid', gap: 12 }}>
              <Skeleton width="30%" height={12} />
              <Skeleton width="70%" height={48} />
              <Skeleton height={200} />
            </div>
          }
        >
          {(data) => {
            const positions = data.positions;
            const visible = showAll ? positions : positions.slice(0, VISIBLE_POSITIONS);
            const performance = data.performance;
            return (
              <>
                {cachedAt != null && (
                  <Notice tone="warning" role="status" title="Offline copy">
                    Values were saved {formatDate(cachedAt, zone)} and are not updating.
                  </Notice>
                )}
                <div className={styles.valueBlock}>
                  <Eyebrow tone="muted" as="p">
                    Model value{data.incomplete ? ' · partial' : ''}
                  </Eyebrow>
                  <p className={styles.value}>
                    {formatMoney(data.equity ?? data.investedValue, 'USD')}
                  </p>
                  {data.totalGain != null ? (
                    <p
                      className={styles.gain}
                      data-direction={Number(data.totalGain) >= 0 ? 'up' : 'down'}
                    >
                      {formatSignedMoney(data.totalGain, 'USD')} ({formatPercent(data.totalGainPct)}
                      ) <span className={styles.gainNote}>since your first deposit</span>
                    </p>
                  ) : (
                    <p className={styles.gainMuted}>Gain unavailable while a quote is missing</p>
                  )}
                  <p className={styles.paperLabel}>
                    <Tag tone="outline">Paper</Tag> Simulated results · sample data · not real money
                  </p>
                  {data.incomplete && (
                    <Notice
                      tone="warning"
                      icon={TriangleAlert}
                      title="Some positions have no current quote."
                    >
                      The total covers cash and the positions with a price. Missing values are shown
                      as partial, never as zero.
                    </Notice>
                  )}
                </div>

                <UnderlineTabs
                  label="Performance period"
                  value={period}
                  pending={loadingPeriod ? period : null}
                  onChange={(value) =>
                    setParams(value === '3M' ? {} : { period: value }, { replace: true })
                  }
                  items={PERIODS.map((value) => ({ value, label: value }))}
                />
                <div className={shared.chartBlock}>
                  {chart && chart.series.samples.length > 1 ? (
                    <PriceChart
                      series={chart.series}
                      store={store}
                      label={`Paper portfolio return compared with the ${performance.benchmarkName}, ${committed}`}
                      height={200}
                      format="percent"
                      primaryLabel="Portfolio"
                      comparison={{ samples: chart.benchmark, label: 'Benchmark' }}
                      loading={loadingPeriod}
                      loadingLabel={`Loading ${period}…`}
                    />
                  ) : (
                    <p className={shared.footnote}>
                      Performance appears after the first full session.
                    </p>
                  )}
                </div>
                <div className={shared.grid3}>
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Return</span>
                    <span className={shared.statValue} data-tone={tone(performance.returnPct)}>
                      {formatPercent(performance.returnPct)}
                    </span>
                  </div>
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Benchmark</span>
                    <span className={shared.statValue} data-tone={tone(performance.benchmarkPct)}>
                      {formatPercent(performance.benchmarkPct)}
                    </span>
                  </div>
                  <div className={shared.stat}>
                    <span className={shared.statLabel}>Max drawdown</span>
                    <span
                      className={shared.statValue}
                      data-tone={
                        performance.maxDrawdownPct && Number(performance.maxDrawdownPct) < 0
                          ? 'negative'
                          : undefined
                      }
                    >
                      {formatPercent(performance.maxDrawdownPct)}
                    </span>
                  </div>
                </div>
                <p className={shared.footnote}>
                  {performance.basis} {performance.sampling};{' '}
                  {formatDate(Date.parse(performance.window.start), zone)} to{' '}
                  {formatDate(Date.parse(performance.window.end), zone)}. Benchmark:{' '}
                  {performance.benchmarkName}.
                </p>

                <SectionHeader
                  title="Positions"
                  aside={<span className={styles.cash}>Cash {formatMoney(data.cash, 'USD')}</span>}
                />
                {positions.length === 0 ? (
                  <EmptyState
                    icon={Briefcase}
                    size="section"
                    title="No paper positions yet."
                    actions={
                      <Button full onClick={() => push('/paper/transactions/new')}>
                        Record a paper trade
                      </Button>
                    }
                  >
                    Start with the simulated cash to follow an idea and its reasoning over time.
                    Nothing here is a real order.
                  </EmptyState>
                ) : (
                  <List label="Paper positions">
                    {visible.map((position) => (
                      <PositionRow key={position.instrumentId} position={position} />
                    ))}
                    {positions.length > VISIBLE_POSITIONS && (
                      <Row
                        onPress={() => setShowAll((value) => !value)}
                        title={
                          showAll
                            ? 'Show fewer positions'
                            : `View all ${positions.length} positions`
                        }
                        chevron
                        dense
                      />
                    )}
                  </List>
                )}
                <div className={shared.block} style={{ marginTop: 24 }}>
                  <Button
                    variant="secondary"
                    full
                    icon={Plus}
                    iconPosition="start"
                    onClick={() => push('/paper/transactions/new')}
                  >
                    Record a paper trade
                  </Button>
                </div>
              </>
            );
          }}
        </QueryState>
        <Disclaimer>
          A paper portfolio simulates trades with sample prices to track research ideas. No orders
          are placed, no money moves, and results exclude taxes and dividends. Not investment
          advice.
        </Disclaimer>
      </Content>
    </ScreenBody>
  );
}

function tone(value: string | null): 'positive' | 'negative' | undefined {
  if (value == null) return undefined;
  const number = Number(value);
  return number > 0 ? 'positive' : number < 0 ? 'negative' : undefined;
}
