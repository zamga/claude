import { useState } from 'react';
import { useParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { Eyebrow, ScreenHeading, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  FileText,
  History,
  Info,
  Sparkles,
} from '@/components/icons';
import { ActionBar, Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { Change, Price, Tag } from '@/components/Market';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import { computeChange } from '@/domain/change';
import { formatCompactNumber, formatDate, formatMoney, formatShare } from '@/domain/format';
import { useIpo, useQuote, useSources } from '@/data/queries';
import type { IpoIssuer, Source } from '@/data/types';
import { dayLabel } from '@/features/earnings';
import { IPO_STATUS_LABEL, priceTerms, SECTOR_DETAIL } from '@/features/ipo';
import { SourceSheet } from '@/features/SourceSheet';
import { QueryState, useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AccountPrompt, useWatchlistMembership } from '@/features/watchlist';
import { WatchlistPickerSheet } from '@/features/WatchlistPicker';
import shared from '../shared.module.css';
import styles from './IpoDossier.module.css';

function ListedQuote({ ipo }: { ipo: IpoIssuer }) {
  const quote = useQuote(ipo.instrumentId);
  const { push } = useAppNavigation();
  if (!quote.data) return <Skeleton height={48} />;
  const sinceOffer = ipo.finalPrice ? computeChange(quote.data.price, ipo.finalPrice) : null;
  return (
    <div className={styles.listed}>
      <div className={styles.listedRow}>
        <Price value={quote.data.price} currency={quote.data.currency} size="lg" />
        {sinceOffer && <Change value={sinceOffer.percent} size="md" suffix="vs offer price" />}
      </div>
      <Button
        variant="secondary"
        size="small"
        icon={ArrowUpRight}
        onClick={() => push(`/stocks/${ipo.proposedSymbol}`)}
      >
        Open quote and chart
      </Button>
    </div>
  );
}

function Dossier({ ipo }: { ipo: IpoIssuer }) {
  const { push } = useAppNavigation();
  const userZone = useUserTimeZone();
  const offline = useOffline();
  const membership = useWatchlistMembership(ipo.instrumentId, ipo.proposedSymbol);
  const sources = useSources(ipo.sourceIds);
  const [source, setSource] = useState<Source | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const terms = priceTerms(ipo);
  const listed = ipo.status === 'listed';
  useDocumentTitle(`${ipo.proposedSymbol} · IPO analysis`);

  const follow = () => {
    if (membership.saved) setPickerOpen(true);
    else void membership.quickSave();
  };

  const expected =
    ipo.status === 'listed' && ipo.listedAt
      ? `${formatDate(Date.parse(ipo.listedAt), 'America/New_York')} (listed)`
      : ipo.expectedDate
        ? `${dayLabel(ipo.expectedDate).replace(/^\w+ /, '')}${ipo.dateConfirmed ? '' : ' (unconfirmed)'}`
        : 'Date pending';

  return (
    <>
      <TopBar
        title="IPO analysis"
        ruled
        trailing={
          <IconButton
            icon={Bookmark}
            label={
              membership.saved
                ? `Following ${ipo.proposedSymbol}. Edit lists`
                : `Follow ${ipo.proposedSymbol}`
            }
            active={membership.saved}
            busy={membership.pendingList != null}
            disabled={offline}
            onClick={follow}
          />
        }
      />
      <Content>
        <div className={shared.eyebrowRow}>
          <Eyebrow tone="muted">{ipo.name} / Sample issuer</Eyebrow>
          <DemoTag label="Demo data" />
        </div>
        <div className={shared.headline}>
          <ScreenHeading size="none" className={shared.bigTicker}>
            <span data-anchor-target="ticker">{ipo.proposedSymbol}</span>
          </ScreenHeading>
          <p className={styles.sector}>{SECTOR_DETAIL[ipo.sector] ?? ipo.sector}</p>
        </div>

        <div className={styles.terms}>
          <span className={styles.termsValue}>{terms.value}</span>
          <span className={styles.termsLabel}>
            {terms.label}
            <Tag tone={terms.final ? 'positive' : 'outline'}>
              {terms.final ? 'Final' : 'Indicative'}
            </Tag>
          </span>
        </div>

        {listed && (
          <div className={shared.block} style={{ marginTop: 16 }}>
            <ListedQuote ipo={ipo} />
          </div>
        )}
        {ipo.status === 'postponed' && (
          <Notice tone="warning" icon={Info} title="Offering postponed.">
            {ipo.revisions[0]?.summary ?? 'The issuer has postponed the offering.'} Terms shown are
            the last indicative terms.
          </Notice>
        )}
        {ipo.status === 'withdrawn' && (
          <Notice tone="warning" icon={Info} title="Offering withdrawn.">
            The issuer withdrew its registration. The research history stays available.
          </Notice>
        )}

        <div className={shared.grid3} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className={shared.stat}>
            <span className={shared.statLabel}>
              {terms.final ? 'Valuation at offer' : 'Indicative valuation'}
            </span>
            <span className={shared.statValue}>
              {ipo.indicativeValuationB
                ? `${formatMoney(ipo.indicativeValuationB, ipo.currency, 1)}B`
                : '—'}
            </span>
            {!ipo.indicativeValuationB && <span className={shared.statNote}>Not disclosed</span>}
          </div>
          <div className={shared.stat}>
            <span className={shared.statLabel}>Shares offered</span>
            <span className={shared.statValue}>
              {ipo.sharesOfferedM
                ? `${formatCompactNumber(Number(ipo.sharesOfferedM) * 1_000_000)}`
                : '—'}
            </span>
            {!ipo.sharesOfferedM && <span className={shared.statNote}>Not disclosed</span>}
          </div>
        </div>

        <section aria-labelledby="setup-heading">
          <SectionHeader title="Listing setup" id="setup-heading" />
          <KeyValueList label="Listing setup">
            <KeyValue label={listed ? 'Listed' : 'Expected listing'} value={expected} />
            <KeyValue label="Exchange" value={ipo.exchange} />
            <KeyValue label="Status" value={IPO_STATUS_LABEL[ipo.status]} />
            <KeyValue
              label="Free float"
              value={ipo.freeFloatPct ? formatShare(ipo.freeFloatPct) : 'Not disclosed'}
              muted={!ipo.freeFloatPct}
            />
            <KeyValue
              label="Lock-up"
              value={ipo.lockupDays ? `${ipo.lockupDays} days` : 'Not disclosed'}
              muted={!ipo.lockupDays}
            />
            <KeyValue label="Primary proceeds" value={ipo.primaryProceeds} />
          </KeyValueList>
          <p className={shared.footnote}>Use of proceeds: {ipo.useOfProceeds}</p>
        </section>

        <section aria-labelledby="opportunity-heading" className={styles.case}>
          <h2 className={styles.caseTitle} id="opportunity-heading">
            The opportunity
          </h2>
          <p className={styles.caseText}>{ipo.opportunity}</p>
          <h2 className={styles.caseTitle}>Key risk</h2>
          <p className={styles.caseText}>{ipo.keyRisk}</p>
        </section>

        {ipo.revisions.length > 0 && (
          <section aria-labelledby="history-heading">
            <SectionHeader title="Revisions" id="history-heading" size="small" />
            <List label="Revisions">
              {ipo.revisions.map((revision) => (
                <Row
                  key={revision.at}
                  icon={History}
                  title={formatDate(Date.parse(revision.at), userZone)}
                  detail={revision.summary}
                  dense
                />
              ))}
            </List>
          </section>
        )}

        <section aria-labelledby="sources-heading">
          <SectionHeader title="Sources" id="sources-heading" size="small" />
          {sources.data ? (
            <List label="Sources">
              {sources.data.map((item) => (
                <Row
                  key={item.id}
                  icon={FileText}
                  title={item.title}
                  detail={`${item.publisher}${item.url ? '' : ' · no document attached'}`}
                  onPress={() => setSource(item)}
                  dense
                />
              ))}
              {ipo.reportId && (
                <Row
                  to={`/research/${ipo.reportId}`}
                  icon={Sparkles}
                  title="Read the IPO research"
                  detail="Questions to ask before a listing"
                  dense
                />
              )}
            </List>
          ) : (
            <div className={shared.block}>
              <Skeleton height={44} />
            </div>
          )}
        </section>

        <Disclaimer>
          Sample issuer with illustrative terms. Indicative ranges, dates and valuations can change
          until pricing. Not an offer or a recommendation to subscribe.
        </Disclaimer>
      </Content>
      <ActionBar columns={1} note={offline ? 'Reconnect to follow this issuer.' : undefined}>
        <Button
          full
          variant="secondary"
          icon={Bell}
          iconPosition="start"
          onClick={() => push(`/alerts/new?instrument=${ipo.proposedSymbol}&type=thesis`)}
        >
          {listed ? 'Alert me about research changes' : 'Watch after listing'}
        </Button>
        <Button
          full
          icon={membership.saved ? Bookmark : undefined}
          iconPosition="start"
          pending={membership.pendingList != null}
          disabledReason={offline ? 'Following needs a connection.' : undefined}
          onClick={follow}
        >
          {membership.saved ? 'Following · Edit lists' : 'Follow this IPO'}
        </Button>
      </ActionBar>
      <WatchlistPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        membership={membership}
        symbol={ipo.proposedSymbol}
      />
      <AccountPrompt
        intent={membership.intent}
        onClose={membership.clearIntent}
        what={`Sign in to follow ${ipo.name}. Followed issuers keep the same identity after they list.`}
      />
      <SourceSheet source={source} onClose={() => setSource(null)} timeZone={userZone} />
    </>
  );
}

export default function IpoDossierScreen() {
  const { ipoId } = useParams();
  const query = useIpo(ipoId);
  const { push } = useAppNavigation();
  return (
    <ScreenBody>
      <QueryState
        query={query}
        errorTitle="This listing could not be loaded."
        notFound={
          <>
            <TopBar title="IPO analysis" ruled />
            <Content>
              <EmptyState
                icon={Sparkles}
                title="This listing is not in the pipeline."
                actions={
                  <Button full onClick={() => push('/ipos')}>
                    Open the IPO radar
                  </Button>
                }
              >
                It may have been withdrawn, or the link may be wrong.
              </EmptyState>
            </Content>
          </>
        }
        skeleton={
          <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 72 }}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="50%" height={56} />
            <Skeleton height={120} />
          </div>
        }
      >
        {(ipo) => <Dossier ipo={ipo} />}
      </QueryState>
    </ScreenBody>
  );
}
