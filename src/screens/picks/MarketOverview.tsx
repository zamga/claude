import { useMemo, useRef, useState } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { PriceChart } from '@/components/chart/PriceChart';
import { createInspectionStore, useInspection } from '@/components/chart/inspectionStore';
import { Eyebrow, LargeTitle, SectionHeader, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { ArrowUpRight, Search } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Change, StatusDot } from '@/components/Market';
import { Sheet } from '@/components/Sheet';
import { DataStatusLine, DemoTag, Skeleton } from '@/components/Status';
import { computeChange } from '@/domain/change';
import {
  direction,
  formatClock,
  formatNumber,
  formatPercent,
  formatWeekdayDate,
  zoneLabel,
} from '@/domain/format';
import { useMarketOverview } from '@/data/queries';
import type { Catalyst, MarketIndex } from '@/data/types';
import { indexToSeries } from '@/features/indexSeries';
import { QueryState, useCachedAt } from '@/features/status';
import { useDemoNow, useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import styles from './MarketOverview.module.css';

function IndexValue({
  index,
  store,
  selected,
}: {
  index: MarketIndex;
  store: ReturnType<typeof createInspectionStore>;
  selected: boolean;
}) {
  const inspection = useInspection(store);
  const inspected =
    selected && inspection.sample && !inspection.fading ? inspection.sample.v : null;
  const value = inspected != null ? String(inspected) : index.value;
  const change = computeChange(value, index.previousClose);
  if (index.kind === 'volatility') {
    return (
      <>
        <span className={styles.indexValue}>{formatNumber(value, 2)}</span>
        <span className={styles.indexSub}>Level · {formatPercent(change.percent)}</span>
      </>
    );
  }
  return (
    <>
      <span className={styles.indexValue} data-direction={direction(change.percent)}>
        {formatPercent(change.percent)}
      </span>
      <span className={styles.indexSub}>{formatNumber(value, 2)}</span>
    </>
  );
}

export default function MarketOverviewScreen() {
  const overview = useMarketOverview();
  const { push } = useAppNavigation();
  const zone = useUserTimeZone();
  const now = useDemoNow();
  const cachedAt = useCachedAt(overview);
  const sentinel = useRef<HTMLDivElement>(null);
  const store = useMemo(() => createInspectionStore(), []);
  const [selectedIndex, setSelectedIndex] = useState('idx_spx');
  const [catalyst, setCatalyst] = useState<Catalyst | null>(null);
  useDocumentTitle('The market');

  return (
    <ScreenBody tabBar>
      <TopBar
        back="/"
        leading={<TopBarLabel>Market overview</TopBarLabel>}
        compactTitle="The market"
        sentinel={sentinel}
        trailing={
          <IconButton icon={Search} label="Search companies" onClick={() => push('/search')} />
        }
      />
      <Content>
        <LargeTitle title="The market." meta={<DemoTag />} sentinelRef={sentinel}>
          {overview.data && (
            <p className={styles.session}>
              {overview.data.sessions
                .filter((session) => session.region === 'US')
                .map((session) => (
                  <span
                    key={session.region}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <StatusDot className={styles.sessionDot} />
                    <span>
                      {session.session === 'regular' ? 'US session open' : 'US market closed'}
                    </span>
                    <span className="t-muted">
                      · Demo session, {formatWeekdayDate(now, 'America/New_York')}
                    </span>
                  </span>
                ))}
            </p>
          )}
        </LargeTitle>
        <QueryState
          query={overview}
          errorTitle="Market data could not be loaded."
          skeleton={
            <div style={{ padding: '16px 24px', display: 'grid', gap: 12 }}>
              <Skeleton height={56} />
              <Skeleton height={200} />
            </div>
          }
        >
          {(data) => {
            const us = data.indices.filter((index) => index.region === 'US');
            const europe = data.indices.find((index) => index.region === 'EU');
            const chartIndex = data.indices.find((index) => index.id === selectedIndex) ?? us[0]!;
            const series = indexToSeries(chartIndex);
            const sectorMax = Math.max(
              ...data.sectors.map((sector) => Math.abs(Number(sector.changePct ?? 0))),
              0.5,
            );
            return (
              <>
                <div
                  className={styles.indices}
                  role="group"
                  aria-label="US indices: choose one to chart"
                >
                  {us.map((index) => (
                    <button
                      key={index.id}
                      type="button"
                      className={styles.index}
                      aria-pressed={index.id === chartIndex.id}
                      onClick={() => setSelectedIndex(index.id)}
                    >
                      <span className={styles.indexName}>{index.shortName}</span>
                      <IndexValue
                        index={index}
                        store={store}
                        selected={index.id === chartIndex.id}
                      />
                    </button>
                  ))}
                </div>
                <div style={{ padding: '16px var(--gutter) 0' }}>
                  <PriceChart
                    key={chartIndex.id}
                    series={series}
                    store={store}
                    label={`${chartIndex.name}, today`}
                    height={200}
                  />
                  <DataStatusLine
                    status={chartIndex.status}
                    asOf={chartIndex.asOf}
                    timeZone={chartIndex.timeZone}
                    session={chartIndex.session}
                    cachedAt={cachedAt}
                    userTimeZone={zone}
                  />
                </div>

                <SectionHeader
                  title="Leading sectors"
                  aside={<Eyebrow tone="muted">US · today</Eyebrow>}
                  size="small"
                />
                <List label="Sector performance">
                  {data.sectors.map((sector) => (
                    <Row
                      key={sector.id}
                      to={`/search?sector=${encodeURIComponent(sector.name)}`}
                      linkLabel={`${sector.name}, ${formatPercent(sector.changePct)}. Show companies`}
                      dense
                      chevron={false}
                    >
                      <div className={styles.sectorRow}>
                        <span className="t-body-sm">{sector.name}</span>
                        <span className={styles.bar} aria-hidden>
                          <span
                            className={styles.barFill}
                            data-direction={direction(sector.changePct)}
                            style={{
                              width: `${(Math.abs(Number(sector.changePct ?? 0)) / sectorMax) * 100}%`,
                            }}
                          />
                        </span>
                        <Change value={sector.changePct} />
                      </div>
                    </Row>
                  ))}
                </List>

                <SectionHeader
                  title="Upcoming catalysts"
                  aside={<Eyebrow tone="muted">Your time · {zoneLabel(now, zone)}</Eyebrow>}
                  size="small"
                />
                <List label="Upcoming catalysts">
                  {data.catalysts.map((item) => {
                    const at = Date.parse(item.at);
                    const sameDay = formatWeekdayDate(at, zone) === formatWeekdayDate(now, zone);
                    return (
                      <Row
                        key={item.id}
                        to={
                          item.targetEarningsId ? `/earnings/${item.targetEarningsId}` : undefined
                        }
                        onPress={item.targetEarningsId ? undefined : () => setCatalyst(item)}
                        leading={
                          <span className={styles.catalystTime}>{formatClock(at, zone)}</span>
                        }
                        title={item.title}
                        detail={`${sameDay ? 'Today' : formatWeekdayDate(at, zone)}${item.timeConfirmed ? '' : ' · time not confirmed'} · ${item.detail}`}
                        dense
                      />
                    );
                  })}
                </List>

                {europe && (
                  <div className={styles.europe}>
                    <List label="Europe">
                      <Row
                        to="/search?region=EU"
                        title={`${europe.name} · ${europe.session === 'regular' ? 'open' : 'closed'}`}
                        detail={`${formatNumber(europe.value, 2)} · last ${europe.asOf ? `${formatClock(Date.parse(europe.asOf), europe.timeZone)} ${zoneLabel(Date.parse(europe.asOf), europe.timeZone)}` : '—'}`}
                        aside={
                          <Change
                            value={computeChange(europe.value, europe.previousClose).percent}
                          />
                        }
                      />
                    </List>
                  </div>
                )}
              </>
            );
          }}
        </QueryState>
        {!overview.isPending && (
          <>
            <div style={{ padding: '24px var(--gutter) 0' }}>
              <Button
                variant="secondary"
                full
                between
                icon={ArrowUpRight}
                onClick={() => push('/')}
              >
                See today’s picks
              </Button>
            </div>
            <Disclaimer>
              Simulated index levels and sector moves for the demo session. Not market data.
            </Disclaimer>
          </>
        )}
      </Content>
      <Sheet
        open={catalyst != null}
        onClose={() => setCatalyst(null)}
        title={catalyst?.title ?? ''}
        size="auto"
      >
        {catalyst && (
          <div className="t-body" style={{ display: 'grid', gap: 8 }}>
            <p>{catalyst.detail}</p>
            <p className="t-label t-muted">
              {formatWeekdayDate(Date.parse(catalyst.at), zone)},{' '}
              {formatClock(Date.parse(catalyst.at), zone)}{' '}
              {zoneLabel(Date.parse(catalyst.at), zone)} (
              {formatClock(Date.parse(catalyst.at), 'America/New_York')} ET) ·{' '}
              {catalyst.timeConfirmed ? 'Time confirmed' : 'Time not confirmed'} · {catalyst.source}
            </p>
          </div>
        )}
      </Sheet>
    </ScreenBody>
  );
}
