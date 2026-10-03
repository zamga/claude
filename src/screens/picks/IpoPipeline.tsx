import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { usePane } from '@/app/pane';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { Eyebrow, LargeTitle, SectionHeader, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Bookmark, CircleCheck, Search, Sparkles } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { RankBadge, Tag, Ticker } from '@/components/Market';
import { Sheet } from '@/components/Sheet';
import { DemoTag, EmptyState, Skeleton } from '@/components/Status';
import { Segmented, UnderlineTabs } from '@/components/Tabs';
import { useIpos } from '@/data/queries';
import type { IpoIssuer } from '@/data/types';
import { expectedDateText, IPO_CHECKLIST, priceTerms } from '@/features/ipo';
import { SaveToggle } from '@/features/SaveToggle';
import { QueryState, useCachedAt } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import shared from '../shared.module.css';
import styles from './IpoPipeline.module.css';

type Tab = 'upcoming' | 'listed' | 'saved';
type Region = 'US' | 'EU';

const TABS: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'listed', label: 'Newly listed' },
  { value: 'saved', label: 'Saved' },
];

function IssuerRow({ ipo, rank }: { ipo: IpoIssuer; rank: number }) {
  const pane = usePane();
  const to = `/ipos/${ipo.id}`;
  const terms = priceTerms(ipo);
  const date = expectedDateText(ipo);
  const spoken = `${ipo.proposedSymbol}, ${ipo.name}, ${ipo.sector}. ${terms.value === '—' ? 'Terms not disclosed' : `${terms.label} ${terms.value}`}. ${date.spoken}.`;
  return (
    <Row
      to={to}
      linkLabel={spoken}
      selected={pane.detailPath === to}
      chevron={false}
      anchorFor="ticker"
      align="start"
      leading={
        <span className={styles.rank}>
          <RankBadge rank={rank} />
        </span>
      }
      action={<SaveToggle instrumentId={ipo.instrumentId} symbol={ipo.proposedSymbol} />}
    >
      <div className={styles.identity}>
        <Ticker symbol={ipo.proposedSymbol} anchor="ticker" className={styles.ticker} />
        {ipo.status === 'postponed' && <Tag tone="warning">Postponed</Tag>}
        {ipo.status === 'listed' && <Tag tone="positive">Listed</Tag>}
      </div>
      <span className={styles.name}>{ipo.name}</span>
      <div className={styles.facts}>
        <span className={styles.fact}>{ipo.sector}</span>
        <span className={styles.fact}>
          <span className={styles.factValue}>{terms.value}</span>
          <span className={styles.factNote}>
            {terms.final ? 'Final price' : terms.value === '—' ? terms.label : 'Indicative'}
          </span>
        </span>
        <span className={styles.fact}>
          <span className={styles.factNote}>{date.note}</span>
          <span
            className={styles.factValue}
            data-pending={!ipo.dateConfirmed && ipo.status !== 'listed'}
          >
            {date.value}
          </span>
        </span>
      </div>
    </Row>
  );
}

export default function IpoPipelineScreen() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'upcoming';
  const region = (params.get('region') as Region | null) === 'EU' ? 'EU' : 'US';
  const { signedIn } = useSession();
  const { push } = useAppNavigation();
  const query = useIpos({ tab, region });
  const cachedAt = useCachedAt(query);
  const sentinel = useRef<HTMLDivElement>(null);
  const [checklist, setChecklist] = useState<(typeof IPO_CHECKLIST)[number] | null>(null);
  useDocumentTitle('IPO radar');

  const update = (patch: Partial<Record<'tab' | 'region', string>>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if ((key === 'tab' && value === 'upcoming') || (key === 'region' && value === 'US'))
        next.delete(key);
      else if (value) next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const regionName = region === 'US' ? 'United States' : 'Europe';

  return (
    <ScreenBody tabBar>
      <TopBar
        back="/"
        leading={<TopBarLabel>New listings</TopBarLabel>}
        compactTitle="IPO radar"
        sentinel={sentinel}
        trailing={
          <IconButton
            icon={Search}
            label="Search companies"
            onClick={() => push('/search?setup=ipo')}
          />
        }
      />
      <Content>
        <LargeTitle title="IPO radar." meta={<DemoTag />} sentinelRef={sentinel} />
        <UnderlineTabs
          label="Listing status"
          value={tab}
          controls="ipo-list"
          onChange={(value) => update({ tab: value })}
          items={TABS}
        />
        <div className={styles.regions}>
          <Segmented
            label="Market"
            variant="accent"
            value={region}
            onChange={(value) => update({ region: value })}
            items={[
              { value: 'US', label: 'United States' },
              { value: 'EU', label: 'Europe' },
            ]}
          />
        </div>
        <div className={shared.eyebrowRow} style={{ paddingTop: 16 }}>
          <Eyebrow tone="muted">Illustrative listings</Eyebrow>
          {cachedAt != null && <Eyebrow tone="muted">Offline copy</Eyebrow>}
        </div>
        <div
          id="ipo-list"
          role="tabpanel"
          aria-label={`${TABS.find((item) => item.value === tab)?.label}, ${regionName}`}
        >
          {tab === 'saved' && !signedIn ? (
            <EmptyState
              icon={Bookmark}
              size="section"
              title="Follow listings with an account."
              actions={
                <>
                  <Button full onClick={() => push('/auth/sign-in?returnTo=%2Fipos%3Ftab%3Dsaved')}>
                    Sign in
                  </Button>
                  <Button
                    full
                    variant="quiet"
                    onClick={() => push('/auth/register?returnTo=%2Fipos%3Ftab%3Dsaved')}
                  >
                    Create an account
                  </Button>
                </>
              }
            >
              Saved issuers stay with you after they list, under the same identity.
            </EmptyState>
          ) : (
            <QueryState
              query={query}
              errorTitle="Listings could not be loaded."
              skeleton={
                <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 12 }}>
                  <Skeleton height={64} />
                  <Skeleton height={64} />
                </div>
              }
            >
              {(ipos) =>
                ipos.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    size="section"
                    title={
                      tab === 'saved'
                        ? `No saved ${regionName === 'Europe' ? 'European' : 'US'} listings.`
                        : tab === 'listed'
                          ? `No recent ${regionName === 'Europe' ? 'European' : 'US'} listings.`
                          : `No upcoming ${regionName === 'Europe' ? 'European' : 'US'} listings.`
                    }
                    actions={
                      <Button
                        full
                        variant="secondary"
                        onClick={() => update({ region: region === 'US' ? 'EU' : 'US' })}
                      >
                        Show {region === 'US' ? 'Europe' : 'United States'}
                      </Button>
                    }
                  >
                    {tab === 'saved'
                      ? 'Use the bookmark on any issuer to follow it here.'
                      : 'The sample pipeline has nothing in this view.'}
                  </EmptyState>
                ) : (
                  <List
                    label={`${TABS.find((item) => item.value === tab)?.label} listings`}
                    flushTop
                  >
                    {ipos.map((ipo, index) => (
                      <IssuerRow key={ipo.id} ipo={ipo} rank={index + 1} />
                    ))}
                  </List>
                )
              }
            </QueryState>
          )}
        </div>
        {!query.isPending && (
          <>
            <SectionHeader title="Your IPO checklist" />
            <List label="IPO checklist">
              {IPO_CHECKLIST.map((item) => (
                <Row
                  key={item.id}
                  icon={CircleCheck}
                  title={item.title}
                  onPress={() => setChecklist(item)}
                  dense
                />
              ))}
            </List>
            <Disclaimer>
              Illustrative issuers and terms. Expected dates and indicative ranges can change until
              the offer is priced; unconfirmed dates are labelled as such. Not an offer or a
              recommendation to subscribe.
            </Disclaimer>
          </>
        )}
      </Content>
      <Sheet
        open={checklist != null}
        onClose={() => setChecklist(null)}
        title={checklist?.title ?? ''}
        size="auto"
        footer={
          <Button
            full
            variant="secondary"
            onClick={() => {
              setChecklist(null);
              push('/research/rep_ipo_offer');
            }}
          >
            Read: Reading beyond the offer price
          </Button>
        }
      >
        <p className="t-body">{checklist?.detail}</p>
      </Sheet>
    </ScreenBody>
  );
}
