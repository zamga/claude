import { useParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { Eyebrow, ScreenHeading, SectionHeader, TopBar } from '@/components/Header';
import { ArrowUpRight, FileText, History, Info } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { Tag } from '@/components/Market';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import { formatDate, formatMoney, formatPercent, formatPoints } from '@/domain/format';
import { dec } from '@/domain/decimal';
import { useArchivedPick } from '@/data/queries';
import type { ArchivedPick } from '@/data/types';
import { outcomeTone } from '@/features/archive';
import { QueryState } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import shared from '../shared.module.css';
import styles from './Research.module.css';

const CATEGORY: Record<ArchivedPick['category'], string> = {
  earnings: 'Earnings',
  ipo: 'New listing',
  quality: 'Quality',
};

function Detail({ pick }: { pick: ArchivedPick }) {
  const zone = useUserTimeZone();
  const { push } = useAppNavigation();
  const outcome = pick.outcome;
  const pending = outcome.status === 'pending';
  const difference =
    outcome.returnPct != null && outcome.benchmark.returnPct != null
      ? dec(outcome.returnPct).minus(outcome.benchmark.returnPct).toFixed(4)
      : null;
  useDocumentTitle(
    `${pick.symbolAtPublication} pick, ${formatDate(Date.parse(pick.publishedAt), zone)}`,
  );

  return (
    <>
      <TopBar title="Archived pick" ruled />
      <Content>
        <div className={shared.eyebrowRow}>
          <Eyebrow tone="muted">
            Published {formatDate(Date.parse(pick.publishedAt), zone)} / {CATEGORY[pick.category]}
          </Eyebrow>
          <DemoTag />
        </div>
        <div className={shared.headline}>
          <ScreenHeading size="none" className={shared.bigTicker}>
            {pick.symbolAtPublication}
          </ScreenHeading>
          <p className="t-label t-muted">{pick.nameAtPublication} at publication</p>
        </div>
        {pick.delisted && (
          <Notice
            tone="neutral"
            icon={Info}
            title={`Delisted on ${formatDate(Date.parse(pick.delisted.on), zone)}.`}
          >
            {pick.delisted.reason} The pick and its outcome stay in the record.
          </Notice>
        )}

        <section className={styles.outcome} aria-labelledby="outcome-heading">
          <Eyebrow as="p">20-session outcome</Eyebrow>
          <h2 id="outcome-heading" className="visually-hidden">
            Outcome
          </h2>
          {pending ? (
            <>
              <p className={styles.outcomeValue}>Pending</p>
              <p className="t-label t-muted">
                {outcome.sessionsElapsed} of {outcome.windowSessions} sessions elapsed. Not counted
                as a gain or a loss until the window completes.
              </p>
            </>
          ) : (
            <>
              <p className={styles.outcomeValue} data-tone={outcomeTone(pick)}>
                {formatPercent(outcome.returnPct, 1)}
              </p>
              <p className="t-label t-muted">
                {outcome.benchmark.name} {formatPercent(outcome.benchmark.returnPct, 1)} over the
                same sessions
                {difference ? ` · difference ${formatPoints(difference)}` : ''}
              </p>
            </>
          )}
        </section>

        <KeyValueList label="Measurement">
          <KeyValue
            label="Entry"
            value={
              outcome.entryAt
                ? `${formatDate(Date.parse(outcome.entryAt), zone)} · ${formatMoney(outcome.entryPrice, outcome.currency)}`
                : 'Next session open'
            }
          />
          <KeyValue
            label="Exit"
            value={
              outcome.exitAt
                ? `${formatDate(Date.parse(outcome.exitAt), zone)} · ${formatMoney(outcome.exitPrice, outcome.currency)}`
                : `After session ${outcome.windowSessions}`
            }
            muted={!outcome.exitAt}
          />
          <KeyValue label="Benchmark" value={outcome.benchmark.name} />
          <KeyValue label="Basis" value="Price return, before costs" />
        </KeyValueList>
        <p className={shared.footnote}>
          {outcome.basis}
          {outcome.note ? ` ${outcome.note}` : ''}
        </p>

        <section aria-labelledby="original-heading">
          <SectionHeader
            title="As published"
            id="original-heading"
            aside={<Tag tone="outline">Version {pick.reportVersionAtPublication}</Tag>}
          />
          <blockquote className={styles.quote}>
            <p className={styles.quoteTitle}>{pick.originalHeadline}</p>
            <p className={styles.quoteText}>{pick.originalThesis}</p>
          </blockquote>
        </section>

        <section aria-labelledby="revisions-heading">
          <SectionHeader title="Later changes" id="revisions-heading" size="small" />
          {pick.revisions.length === 0 ? (
            <p className={shared.footnote}>The thesis has not been revised since publication.</p>
          ) : (
            <List label="Later changes">
              {pick.revisions.map((revision) => (
                <Row
                  key={revision.version}
                  icon={History}
                  to={`/research/${pick.reportId}?v=${revision.version}`}
                  title={`Version ${revision.version}, ${formatDate(Date.parse(revision.at), zone)}`}
                  detail={revision.summary || 'Revised'}
                  dense
                />
              ))}
            </List>
          )}
        </section>

        <List label="Related">
          <Row
            to={`/research/${pick.reportId}?v=${pick.reportVersionAtPublication}`}
            icon={FileText}
            title="Read the research as published"
            detail={`Version ${pick.reportVersionAtPublication}${pick.latestVersion > pick.reportVersionAtPublication ? `; latest is version ${pick.latestVersion}` : ''}`}
          />
        </List>
        <Disclaimer>
          Sample archive record. The outcome uses the disclosed method regardless of later
          revisions, so a changed thesis never rewrites the published result.
        </Disclaimer>
      </Content>
      {!pick.delisted && (
        <div className={shared.block} style={{ paddingBottom: 24 }}>
          <Button
            variant="secondary"
            full
            between
            icon={ArrowUpRight}
            onClick={() => push(`/stocks/${pick.symbolAtPublication}`)}
          >
            Open {pick.symbolAtPublication} today
          </Button>
        </div>
      )}
    </>
  );
}

export default function ArchivedPickDetailScreen() {
  const { archiveId } = useParams();
  const query = useArchivedPick(archiveId);
  const { push } = useAppNavigation();
  return (
    <ScreenBody>
      <QueryState
        query={query}
        errorTitle="This archived pick could not be loaded."
        notFound={
          <>
            <TopBar title="Archived pick" ruled />
            <Content>
              <EmptyState
                icon={History}
                title="This record was not found."
                actions={
                  <Button full onClick={() => push('/archive', { replace: true })}>
                    Open the full record
                  </Button>
                }
              >
                Records are never removed; the link may be wrong.
              </EmptyState>
            </Content>
          </>
        }
        skeleton={
          <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 72 }}>
            <Skeleton width="50%" height={12} />
            <Skeleton width="40%" height={56} />
            <Skeleton height={160} />
          </div>
        }
      >
        {(pick) => <Detail pick={pick} />}
      </QueryState>
    </ScreenBody>
  );
}
