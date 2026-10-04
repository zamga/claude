import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { Eyebrow, LargeTitle, SectionHeader, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { ArrowUpRight, Calendar, History, Search, Sparkles, TrendingUp } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Change, Price, RankBadge, Tag } from '@/components/Market';
import { Sparkline } from '@/components/Sparkline';
import { DemoTag, EmptyState, Skeleton } from '@/components/Status';
import { UnderlineTabs } from '@/components/Tabs';
import { computeChange } from '@/domain/change';
import { formatClockWithZone, formatWeekdayDate } from '@/domain/format';
import { usePicks, useQuotes, useSeries } from '@/data/queries';
import type { Assessment, Interest, Pick, Quote } from '@/data/types';
import { InstrumentRow } from '@/features/InstrumentRow';
import { AssessmentSheet, MethodologySheet } from '@/features/Methodology';
import { QueryState, useCachedAt } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import shared from '../shared.module.css';
import styles from './DailyPicks.module.css';

type Category = 'all' | Interest;

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'quality', label: 'Quality' },
  { value: 'ipo', label: 'IPOs' },
];

function HeroPick({
  pick,
  quote,
  onRating,
}: {
  pick: Pick;
  quote: Quote | undefined;
  onRating: (a: Assessment) => void;
}) {
  const series = useSeries(pick.instrumentId, '1D');
  const change = quote ? computeChange(quote.price, quote.previousClose) : null;
  return (
    <article className={styles.hero} aria-labelledby={`hero-${pick.id}`}>
      <AppLink
        to={`/stocks/${pick.symbol}`}
        className={styles.heroLink}
        anchorFor="ticker"
        aria-label={`Open ${pick.symbol} pick analysis`}
      />
      <span className={styles.heroRank}>
        <RankBadge rank={pick.order} />
      </span>
      <div className={styles.heroBody}>
        <span className={styles.heroName}>{pick.name}</span>
        <div className={styles.heroTickerRow}>
          <h2 className={styles.heroTicker} id={`hero-${pick.id}`} data-anchor="ticker">
            {pick.symbol}
          </h2>
          <span className={styles.heroSector}>
            {pick.category === 'ipo' ? `${pick.industry} · new listing` : pick.industry}
          </span>
        </div>
        {pick.ratingLabel && (
          <div className={[styles.heroTag, styles.raised].join(' ')}>
            <button
              type="button"
              className={styles.ratingButton}
              onClick={() => onRating(pick.ratingLabel!)}
              aria-label={`${pick.ratingLabel.value}: how this is measured`}
            >
              <Tag tone={pick.ratingLabel.tone === 'positive' ? 'positive' : 'neutral'}>
                {pick.ratingLabel.value}
              </Tag>
            </button>
          </div>
        )}
        <div className={styles.heroPriceRow}>
          <Price value={quote?.price ?? null} currency={quote?.currency ?? 'USD'} size="lg" />
          <Change value={change?.percent ?? null} size="figure" />
        </div>
      </div>
      <div className={styles.heroSpark} aria-hidden>
        {series.data && series.data.samples.length > 1 ? (
          <Sparkline
            samples={series.data.samples}
            reference={series.data.reference.value ? Number(series.data.reference.value) : null}
            window={series.data.window}
            width={342}
            height={64}
            fluid
          />
        ) : (
          <Skeleton height={64} />
        )}
      </div>
      <p className={styles.heroHeadline}>{pick.headline}</p>
      <p className={styles.heroWhy}>{pick.whyHere}</p>
      <div className={[styles.heroAction, styles.raised].join(' ')}>
        <ExploreButton symbol={pick.symbol} />
      </div>
    </article>
  );
}

function ExploreButton({ symbol }: { symbol: string }) {
  const { push } = useAppNavigation();
  return (
    <Button
      variant="secondary"
      full
      between
      icon={ArrowUpRight}
      onClick={() => push(`/stocks/${symbol}/thesis`)}
    >
      Explore thesis
    </Button>
  );
}

function RadarRow({ pick, quote }: { pick: Pick; quote: Quote | undefined }) {
  const series = useSeries(pick.instrumentId, '1D');
  return (
    <InstrumentRow
      symbol={pick.symbol}
      name={pick.name}
      to={`/stocks/${pick.symbol}`}
      quote={quote}
      sparkline={series.data?.samples}
      sparkWindow={series.data?.window}
      rank={pick.order}
      meta={pick.headline}
      variant="compact"
    />
  );
}

export default function DailyPicksScreen() {
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') as Category | null) ?? 'all';
  const picks = usePicks();
  const ids = useMemo(() => picks.data?.picks.map((pick) => pick.instrumentId) ?? [], [picks.data]);
  const quotes = useQuotes(ids);
  const cachedAt = useCachedAt(quotes);
  const sentinel = useRef<HTMLDivElement>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const { push } = useAppNavigation();
  useDocumentTitle('Today’s picks');

  const quoteFor = (id: string) => quotes.data?.find((quote) => quote.instrumentId === id);
  const filtered = (picks.data?.picks ?? []).filter(
    (pick) => category === 'all' || pick.category === category,
  );
  const counts = Object.fromEntries(
    CATEGORIES.map((item) => [
      item.value,
      (picks.data?.picks ?? []).filter(
        (pick) => item.value === 'all' || pick.category === item.value,
      ).length,
    ]),
  );

  const published = picks.data?.publishedAt ? Date.parse(picks.data.publishedAt) : null;
  return (
    <ScreenBody tabBar>
      <TopBar
        leading={<TopBarLabel>Stock picks</TopBarLabel>}
        compactTitle="Today’s picks"
        sentinel={sentinel}
        trailing={
          <IconButton icon={Search} label="Search companies" onClick={() => push('/search')} />
        }
      />
      <Content>
        <LargeTitle
          eyebrow="Daily selection"
          meta={<DemoTag />}
          title={
            <>
              Today’s
              <br />
              picks.
            </>
          }
          sentinelRef={sentinel}
        >
          {published ? (
            <p className={shared.meta}>
              <span>{formatWeekdayDate(published, 'America/New_York')}</span>
              <span aria-hidden>·</span>
              <span>Published {formatClockWithZone(published, 'America/New_York')}</span>
              <span aria-hidden>·</span>
              <button type="button" className={shared.metaLink} onClick={() => setMethodOpen(true)}>
                How picks are chosen
              </button>
              {cachedAt && (
                <>
                  <span aria-hidden>·</span>
                  <span>Offline copy</span>
                </>
              )}
            </p>
          ) : (
            <p className={shared.meta} aria-hidden>
              &nbsp;
            </p>
          )}
        </LargeTitle>
        <UnderlineTabs
          size="sm"
          label="Pick category"
          value={category}
          controls="pick-list"
          onChange={(value) =>
            setParams(value === 'all' ? {} : { category: value }, { replace: true })
          }
          items={CATEGORIES.map((item) => ({
            ...item,
            count: picks.data ? counts[item.value] : undefined,
          }))}
        />
        <div
          id="pick-list"
          role="tabpanel"
          aria-label={`${CATEGORIES.find((item) => item.value === category)?.label} picks`}
        >
          <QueryState
            query={picks}
            errorTitle="Today’s picks could not be loaded."
            skeleton={
              <div className={styles.skeleton}>
                <Skeleton height={14} width="35%" />
                <Skeleton height={44} width="45%" />
                <Skeleton height={28} width="55%" />
                <Skeleton height={64} />
                <Skeleton height={40} />
                <Skeleton height={48} />
                <div className={styles.skeletonRows}>
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                </div>
              </div>
            }
          >
            {(data) =>
              data.picks.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No new picks today."
                  actions={
                    <>
                      <Button full onClick={() => push('/research')}>
                        Explore recent research
                      </Button>
                      <Button full variant="quiet" onClick={() => push('/watchlist')}>
                        Open your watchlist
                      </Button>
                    </>
                  }
                >
                  The desk publishes fewer ideas, or none, when the evidence is not strong enough.
                </EmptyState>
              ) : filtered.length === 0 ? (
                <EmptyState
                  size="section"
                  title={`No ${CATEGORIES.find((item) => item.value === category)?.label.toLowerCase()} picks today.`}
                  actions={
                    <>
                      <Button
                        full
                        variant="secondary"
                        onClick={() => setParams({}, { replace: true })}
                      >
                        Show all picks
                      </Button>
                      {category === 'ipo' && (
                        <Button full variant="quiet" onClick={() => push('/ipos')}>
                          Open the IPO radar
                        </Button>
                      )}
                    </>
                  }
                />
              ) : (
                <>
                  <HeroPick
                    pick={filtered[0]!}
                    quote={quoteFor(filtered[0]!.instrumentId)}
                    onRating={setAssessment}
                  />
                  {filtered.length > 1 && (
                    <>
                      <SectionHeader
                        title="On the radar"
                        aside={<Eyebrow tone="muted">{filtered.length - 1} more</Eyebrow>}
                      />
                      <List label="More picks today">
                        {filtered.slice(1).map((pick) => (
                          <RadarRow key={pick.id} pick={pick} quote={quoteFor(pick.instrumentId)} />
                        ))}
                      </List>
                    </>
                  )}
                </>
              )
            }
          </QueryState>
        </div>
        <SectionHeader title="Discover" />
        <div className={styles.discover}>
          <List label="Discover">
            <Row
              to="/market"
              icon={TrendingUp}
              title="The market"
              detail="Indices, sectors and upcoming catalysts"
            />
            <Row
              to="/earnings"
              icon={Calendar}
              title="Earnings calendar"
              detail="This week’s reports and results"
            />
            <Row
              to="/ipos"
              icon={Sparkles}
              title="IPO radar"
              detail="Upcoming and newly listed companies"
            />
            <Row
              to="/archive"
              icon={History}
              title="Every past pick"
              detail="Outcomes, including the losses"
            />
          </List>
        </div>
        <Disclaimer>
          Demo build. Company names are real; prices, research and outcomes are illustrative sample
          data from a simulated session. Not investment advice.
        </Disclaimer>
      </Content>
      <MethodologySheet
        open={methodOpen}
        onClose={() => setMethodOpen(false)}
        summary={picks.data?.methodology.summary ?? ''}
        version={picks.data?.methodology.version ?? ''}
      />
      <AssessmentSheet assessment={assessment} onClose={() => setAssessment(null)} />
    </ScreenBody>
  );
}
