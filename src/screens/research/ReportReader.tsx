import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { Eyebrow, ScreenHeading, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import {
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  FileText,
  History,
  ICON_STROKE,
  Info,
  TriangleAlert,
} from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Ticker } from '@/components/Market';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import { formatDate } from '@/domain/format';
import { useInstrument, useReport } from '@/data/queries';
import type { Report, Source } from '@/data/types';
import { useSavedReport } from '@/features/research';
import { SourceSheet } from '@/features/SourceSheet';
import { QueryState, useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AccountPrompt } from '@/features/watchlist';
import { readJson, writeJson } from '@/lib/storage';
import shared from '../shared.module.css';
import styles from './Research.module.css';

const POSITION_KEY = 'stockpicks.reading.v1';

type Positions = Record<string, { ratio: number; at: number }>;

/** Reading position per report version, kept on this device (spec page 33). */
function useReadingPosition(
  id: string,
  version: number,
  element: React.RefObject<HTMLElement | null>,
) {
  const key = `${id}@${version}`;
  const [resume] = useState(() => readJson<Positions>('local', POSITION_KEY)?.[key]?.ratio ?? 0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const node = element.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const total = Math.max(rect.height - window.innerHeight * 0.6, 1);
      const ratio = Math.min(Math.max(-rect.top / total, 0), 1);
      setProgress(ratio);
      const positions = readJson<Positions>('local', POSITION_KEY) ?? {};
      positions[key] = { ratio, at: Date.now() };
      const keys = Object.keys(positions);
      if (keys.length > 60)
        delete positions[keys.sort((a, b) => positions[a]!.at - positions[b]!.at)[0]!];
      writeJson('local', POSITION_KEY, positions);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [key, element]);
  const jump = () => {
    const node = element.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const total = Math.max(rect.height - window.innerHeight * 0.6, 1);
    window.scrollTo({ top: window.scrollY + rect.top + resume * total, behavior: 'auto' });
  };
  return { resume: resume > 0.08 && resume < 0.97 ? resume : 0, progress, jump };
}

function MonitorList({ items }: { items: Report['current']['body']['monitor'] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ol className={styles.monitor}>
      {items.map((item, index) => (
        <li key={item.title} className={styles.monitorItem}>
          <button
            type="button"
            className={styles.monitorButton}
            aria-expanded={open === index}
            onClick={() => setOpen(open === index ? null : index)}
          >
            <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
            <span>{item.title}</span>
            <ChevronRight size={18} strokeWidth={ICON_STROKE} aria-hidden />
          </button>
          {open === index && <p className={styles.monitorDetail}>{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

function RelatedCompany({ id }: { id: string }) {
  const instrument = useInstrument(id);
  if (!instrument.data) return null;
  return (
    <Row
      to={`/stocks/${instrument.data.symbol}`}
      title={<Ticker symbol={instrument.data.symbol} />}
      detail={instrument.data.shortName}
      dense
    />
  );
}

function Reader({ report }: { report: Report }) {
  const [params, setParams] = useSearchParams();
  const zone = useUserTimeZone();
  const offline = useOffline();
  const article = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const viewing = report.current.version;
  const save = useSavedReport(report.id, viewing, report.title.replace(/\.$/, ''));
  const reading = useReadingPosition(report.id, viewing, article);
  const body = report.current.body;
  useDocumentTitle(report.title.replace(/\.$/, ''));
  const older = viewing < report.latestVersion;

  return (
    <>
      <TopBar
        title={report.label}
        ruled
        trailing={
          <IconButton
            icon={save.saved ? BookmarkCheck : Bookmark}
            label={save.saved ? 'Saved. Remove from saved research' : 'Save to research'}
            active={save.saved}
            busy={save.pending}
            disabled={offline}
            onClick={() => void save.toggle()}
          />
        }
      />
      <div
        className={styles.progress}
        aria-hidden
        style={{ ['--read' as string]: reading.progress }}
      >
        <span />
      </div>
      <Content>
        <div ref={article}>
          <div className={shared.eyebrowRow}>
            <Eyebrow tone="muted">{report.readingMinutes} min read / Sample research</Eyebrow>
            <DemoTag />
          </div>
          <div className={shared.headline}>
            <ScreenHeading>{report.title}</ScreenHeading>
          </div>
          <p className={styles.dek}>{report.dek}</p>
          <p className={styles.byline}>
            <span>By {report.current.author}</span>
            <span aria-hidden>·</span>
            <span>Reviewed by {report.current.reviewer}</span>
            <span aria-hidden>·</span>
            <span>
              Version {viewing}, {formatDate(Date.parse(report.current.publishedAt), zone)}
            </span>
            {report.firstPublishedAt !== report.current.publishedAt && (
              <>
                <span aria-hidden>·</span>
                <span>First published {formatDate(Date.parse(report.firstPublishedAt), zone)}</span>
              </>
            )}
          </p>

          {report.status === 'withdrawn' && (
            <Notice tone="warning" icon={TriangleAlert} title="This report was withdrawn.">
              {report.withdrawnReason}
            </Notice>
          )}
          {older && (
            <Notice
              tone="neutral"
              icon={History}
              title={`You are reading version ${viewing} of ${report.latestVersion}.`}
              actions={
                <Button
                  size="small"
                  variant="quiet"
                  onClick={() => setParams({}, { replace: true })}
                >
                  Read the latest version
                </Button>
              }
            >
              {save.record?.version === viewing ? 'This is the version you saved. ' : ''}Earlier
              versions stay exactly as published.
            </Notice>
          )}
          {!older && report.current.changeSummary && (
            <Notice tone="neutral" icon={Info} title={`Updated in version ${viewing}`}>
              {report.current.changeSummary}{' '}
              <button
                type="button"
                className="link"
                onClick={() => setParams({ v: String(viewing - 1) }, { replace: true })}
              >
                Read version {viewing - 1}
              </button>
            </Notice>
          )}
          {reading.resume > 0 && !params.get('v') && (
            <div className={styles.resume}>
              <Button size="small" variant="secondary" onClick={reading.jump}>
                Continue where you left off ({Math.round(reading.resume * 100)}%)
              </Button>
            </div>
          )}

          <div className={shared.takeaway}>
            <Eyebrow>The takeaway</Eyebrow>
            <p className={shared.takeawayText}>{body.takeaway}</p>
          </div>

          {body.sections.length > 0 && (
            <div className={shared.prose} style={{ marginTop: 24 }}>
              {body.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index} style={{ marginTop: 12 }}>
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          )}

          {body.monitor.length > 0 && (
            <section aria-labelledby="monitor-heading">
              <SectionHeader title="What to monitor" id="monitor-heading" size="large" />
              <MonitorList items={body.monitor} />
            </section>
          )}

          <section aria-labelledby="sources-heading">
            <SectionHeader
              title="Source checklist"
              id="sources-heading"
              aside={<Eyebrow tone="muted">Illustrative sources</Eyebrow>}
            />
            {report.sources.length === 0 ? (
              <p className={shared.footnote}>
                No source documents are attached to this sample report.
              </p>
            ) : (
              <List label="Sources">
                {report.sources.map((item) => (
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
            )}
          </section>

          {/* As photographed, saving follows the source checklist; the top bar keeps it in reach. */}
          <div className={shared.endAction}>
            <Button
              full
              variant="secondary"
              icon={save.saved ? BookmarkCheck : Bookmark}
              iconPosition="start"
              pending={save.pending}
              disabledReason={offline ? 'Needs a connection.' : undefined}
              onClick={() => void save.toggle()}
            >
              {save.saved
                ? `Saved (version ${save.record?.version ?? viewing})`
                : 'Save to research'}
            </Button>
            {offline && <p className="t-note t-muted">Reconnect to change saved research.</p>}
          </div>

          {report.instrumentIds.length > 0 && (
            <section aria-labelledby="companies-heading">
              <SectionHeader title="Companies in this report" id="companies-heading" size="small" />
              <List label="Companies in this report">
                {report.instrumentIds.map((id) => (
                  <RelatedCompany key={id} id={id} />
                ))}
              </List>
            </section>
          )}
          <Disclaimer>
            Sample research for an illustrative session, methodology{' '}
            {report.current.methodologyVersion}. Facts, estimates and interpretations are labelled
            in each note. Not personal advice.
          </Disclaimer>
        </div>
      </Content>
      <SourceSheet source={source} onClose={() => setSource(null)} timeZone={zone} />
      {save.intent && (
        <AccountPrompt
          intent={save.intent}
          onClose={save.clearIntent}
          what="Sign in to save research and keep the exact version you saved."
        />
      )}
    </>
  );
}

export default function ReportReaderScreen() {
  const { reportId } = useParams();
  const [params] = useSearchParams();
  const version = Number(params.get('v')) || undefined;
  const query = useReport(reportId, version);
  const { push } = useAppNavigation();
  return (
    <ScreenBody>
      <QueryState
        query={query}
        errorTitle="This report could not be loaded."
        offlineTitle="This report has not been saved on this device yet."
        notFound={
          <>
            <TopBar title="Report" ruled />
            <Content>
              <EmptyState
                icon={FileText}
                title="This report is not available."
                actions={
                  <Button full onClick={() => push('/research', { replace: true })}>
                    Open the reading room
                  </Button>
                }
              >
                The link may be wrong, or the version may not exist.
              </EmptyState>
            </Content>
          </>
        }
        skeleton={
          <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 72 }}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="85%" height={64} />
            <Skeleton height={240} />
          </div>
        }
      >
        {(report) => <Reader key={`${report.id}@${report.current.version}`} report={report} />}
      </QueryState>
    </ScreenBody>
  );
}
