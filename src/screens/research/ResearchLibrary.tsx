import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { usePane } from '@/app/pane';
import { useSession } from '@/app/session';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { Eyebrow, LargeTitle, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { ArrowRight, ArrowUpRight, Bookmark, History, ICON_STROKE } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { Tag } from '@/components/Market';
import { DemoTag, EmptyState, Skeleton } from '@/components/Status';
import { UnderlineTabs } from '@/components/Tabs';
import { formatDate } from '@/domain/format';
import { useReports, useSavedReports } from '@/data/queries';
import type { ReportSummary, SavedReport } from '@/data/types';
import { useSavedReport } from '@/features/research';
import { QueryState, useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AccountPrompt } from '@/features/watchlist';
import styles from './Research.module.css';

type View = 'latest' | 'sectors' | 'saved';

const VIEWS: { value: View; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'sectors', label: 'Sectors' },
  { value: 'saved', label: 'Saved' },
];

function ArticleCard({ report, saved }: { report: ReportSummary; saved?: SavedReport }) {
  const pane = usePane();
  const zone = useUserTimeZone();
  const offline = useOffline();
  const save = useSavedReport(report.id, report.latestVersion, report.title.replace(/\.$/, ''));
  const to =
    saved && saved.version !== report.latestVersion
      ? `/research/${report.id}?v=${saved.version}`
      : `/research/${report.id}`;
  const selected = pane.detailPath === `/research/${report.id}`;
  return (
    <article className={styles.card} data-selected={selected} aria-labelledby={`card-${report.id}`}>
      <AppLink
        to={to}
        className={styles.cardLink}
        aria-labelledby={`card-${report.id}`}
        aria-describedby={`dek-${report.id}`}
      />
      <div className={styles.cardMeta}>
        <Eyebrow tone={report.status === 'withdrawn' ? 'muted' : 'accent'}>
          {report.label} / {report.readingMinutes} min
        </Eyebrow>
        {report.status === 'withdrawn' && <Tag tone="warning">Withdrawn</Tag>}
        {report.latestVersion > 1 && report.status === 'published' && (
          <Tag tone="neutral">Updated</Tag>
        )}
      </div>
      <h2 className={styles.cardTitle} id={`card-${report.id}`}>
        {report.title}
      </h2>
      <p className={styles.cardDek} id={`dek-${report.id}`}>
        {report.dek}
      </p>
      {saved && (
        <p className={styles.savedNote}>
          Saved version {saved.version}, {formatDate(Date.parse(saved.savedAt), zone)}
          {saved.version < report.latestVersion
            ? ` · version ${report.latestVersion} is available`
            : ''}
        </p>
      )}
      <div className={styles.cardFoot}>
        <span className={styles.readLine} aria-hidden>
          <span className={styles.rule} />
          {report.status === 'withdrawn' ? 'Read the record' : 'Read analysis'}
        </span>
        <span className={styles.cardActions}>
          <IconButton
            icon={Bookmark}
            label={
              save.saved
                ? `Remove “${report.title}” from saved research`
                : `Save “${report.title}” without opening it`
            }
            active={save.saved}
            busy={save.pending}
            disabled={offline}
            onClick={() => void save.toggle()}
          />
          <ArrowRight size={20} strokeWidth={ICON_STROKE} aria-hidden />
        </span>
      </div>
      {save.intent && (
        <AccountPrompt
          intent={save.intent}
          onClose={save.clearIntent}
          what="Sign in to save research and keep the exact version you saved."
        />
      )}
    </article>
  );
}

function SavedFeed() {
  const { signedIn } = useSession();
  const saved = useSavedReports(signedIn);
  const reports = useReports({});
  const { push } = useAppNavigation();
  if (!signedIn) {
    return (
      <EmptyState
        icon={Bookmark}
        size="section"
        title="Keep research for later."
        actions={
          <>
            <Button full onClick={() => push('/auth/sign-in?returnTo=%2Fresearch%3Fview%3Dsaved')}>
              Sign in
            </Button>
            <Button
              full
              variant="quiet"
              onClick={() => push('/auth/register?returnTo=%2Fresearch%3Fview%3Dsaved')}
            >
              Create an account
            </Button>
          </>
        }
      >
        Saved reports keep the exact version you saved and stay readable offline on this device.
      </EmptyState>
    );
  }
  return (
    <QueryState query={saved} errorTitle="Saved research could not be loaded.">
      {(items) => {
        if (items.length === 0) {
          return (
            <EmptyState icon={Bookmark} size="section" title="Nothing saved yet.">
              Use the bookmark on any report to keep it here without opening it.
            </EmptyState>
          );
        }
        if (!reports.data) return <Skeleton height={120} />;
        return items.map((item) => {
          const report = reports.data.find((candidate) => candidate.id === item.reportId);
          return report ? <ArticleCard key={item.reportId} report={report} saved={item} /> : null;
        });
      }}
    </QueryState>
  );
}

export default function ResearchLibraryScreen() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((item) => item.value === params.get('view'))?.value ?? 'latest') as View;
  const reports = useReports({ kind: view === 'sectors' ? 'sector' : 'latest' });
  const { push } = useAppNavigation();
  const sentinel = useRef<HTMLDivElement>(null);
  useDocumentTitle('The reading room');

  return (
    <ScreenBody tabBar>
      <TopBar
        title="Research"
        compactTitle="The reading room"
        sentinel={sentinel}
        trailing={
          <>
            <IconButton icon={History} label="Every past pick" onClick={() => push('/archive')} />
            <IconButton
              icon={Bookmark}
              label="Saved research"
              active={view === 'saved'}
              onClick={() => setParams({ view: 'saved' }, { replace: true })}
            />
          </>
        }
      />
      <Content>
        <LargeTitle
          title={
            <>
              The reading
              <br />
              room.
            </>
          }
          meta={<DemoTag />}
          sentinelRef={sentinel}
        />
        <UnderlineTabs
          label="Research feed"
          value={view}
          controls="research-feed"
          onChange={(value) =>
            setParams(value === 'latest' ? {} : { view: value }, { replace: true })
          }
          items={VIEWS}
        />
        <div
          id="research-feed"
          role="tabpanel"
          aria-label={`${VIEWS.find((item) => item.value === view)?.label} research`}
          className={styles.feed}
        >
          {view === 'saved' ? (
            <SavedFeed />
          ) : (
            <QueryState
              query={reports}
              errorTitle="Research could not be loaded."
              skeleton={
                <div style={{ display: 'grid', gap: 24, padding: '16px 0' }}>
                  <Skeleton height={120} />
                  <Skeleton height={120} />
                </div>
              }
            >
              {(items) =>
                items.length === 0 ? (
                  <EmptyState size="section" title="No reports in this view yet." />
                ) : (
                  items.map((report) => <ArticleCard key={report.id} report={report} />)
                )
              }
            </QueryState>
          )}
        </div>
        {/* Secondary content waits for the feed so nothing on screen moves when it arrives. */}
        {(view === 'saved' || !reports.isPending) && (
          <>
            <AppLink to="/archive" className={styles.record}>
              <span>
                <span className={styles.recordTitle}>Every pick stays visible.</span>
                <span className={styles.recordText}>
                  Original theses, revisions and measured outcomes, including the losses.
                </span>
              </span>
              <ArrowUpRight size={20} strokeWidth={ICON_STROKE} aria-hidden />
            </AppLink>
            <Disclaimer>
              Sample research and editorial concept. Company names are real; figures and conclusions
              are illustrative.
            </Disclaimer>
          </>
        )}
      </Content>
    </ScreenBody>
  );
}
