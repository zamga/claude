import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/Button';
import { Eyebrow, LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  History,
  ICON_STROKE,
} from '@/components/icons';
import { Content, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { RankBadge, Tag } from '@/components/Market';
import { DemoTag, EmptyState, Notice, SkeletonRows } from '@/components/Status';
import { UnderlineTabs } from '@/components/Tabs';
import { formatDate, formatWeekdayDate, keepFilingCodesWhole } from '@/domain/format';
import { useInstrument, usePickForInstrument, useReport, useReports } from '@/data/queries';
import type { Instrument, Report, Source, ThesisPoint } from '@/data/types';
import { EVIDENCE_LABEL, EVIDENCE_TONE, useSavedReport } from '@/features/research';
import { SourceSheet } from '@/features/SourceSheet';
import { QueryState } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AccountPrompt } from '@/features/watchlist';
import shared from '../shared.module.css';
import styles from './InvestmentThesis.module.css';

type Tab = 'thesis' | 'financials' | 'risks';

function Point({
  point,
  index,
  tone,
  sources,
  onSource,
  defaultOpen = false,
}: {
  point: ThesisPoint;
  index: number;
  tone: 'argument' | 'risk';
  sources: Source[];
  onSource: (source: Source) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `point-${point.id}`;
  return (
    <li className={styles.point}>
      <button
        type="button"
        className={styles.pointButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {tone === 'argument' ? (
          <RankBadge rank={index + 1} />
        ) : (
          <ArrowDownRight
            className={styles.riskIcon}
            size={18}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
        )}
        {/* Arguments set a serif title over a summary; risks are one sans line, as photographed. */}
        <span>
          <span className={styles.pointTitle} data-tone={tone}>
            {point.title}
          </span>
          {tone === 'argument' && (
            <span className={styles.pointSummary} style={{ display: 'block' }}>
              {point.summary}
            </span>
          )}
        </span>
        <ChevronDown className={styles.chevron} size={18} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
      {open && (
        <div className={styles.panel} id={panelId}>
          {tone === 'risk' && <p className={styles.pointSummary}>{point.summary}</p>}
          <ul className={styles.evidence} aria-label={`Evidence for ${point.title}`}>
            {point.evidence.map((item, i) => {
              const source = item.sourceId
                ? sources.find((candidate) => candidate.id === item.sourceId)
                : null;
              return (
                <li key={i} className={styles.evidenceItem}>
                  <span>
                    <Tag tone={EVIDENCE_TONE[item.kind]}>{EVIDENCE_LABEL[item.kind]}</Tag>
                  </span>
                  <span>{item.statement}</span>
                  {source ? (
                    <button
                      type="button"
                      className={styles.sourceButton}
                      onClick={() => onSource(source)}
                    >
                      Source: {keepFilingCodesWhole(source.title)}
                    </button>
                  ) : (
                    <span className={styles.noSource}>
                      {item.sourceId
                        ? 'Source record unavailable'
                        : 'No source: analyst judgement or model input'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

function Thesis({ instrument, report }: { instrument: Instrument; report: Report }) {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'thesis';
  const zone = useUserTimeZone();
  const [source, setSource] = useState<Source | null>(null);
  const [showChange, setShowChange] = useState(false);
  const save = useSavedReport(report.id, report.current.version, report.title);
  const body = report.current.body;
  const latest = report.latestVersion;
  const viewing = report.current.version;
  useDocumentTitle(`${instrument.symbol} · ${report.title.replace(/\.$/, '')}`);

  const setTab = (value: Tab) => {
    const next = new URLSearchParams(params);
    if (value === 'thesis') next.delete('tab');
    else next.set('tab', value);
    setParams(next, { replace: true });
  };

  return (
    <ScreenBody>
      <TopBar
        title="Research note"
        ruled
        trailing={
          <IconButton
            icon={Bookmark}
            label={save.saved ? 'Remove from saved research' : 'Save research'}
            active={save.saved}
            busy={save.pending}
            onClick={save.toggle}
          />
        }
      />
      <Content>
        <LargeTitle
          eyebrow={`${instrument.symbol} / ${instrument.shortName}`}
          eyebrowTone="default"
          meta={<DemoTag />}
          title={report.title}
          size="display"
        >
          <p className={shared.meta}>
            <span>Version {viewing}</span>
            <span aria-hidden>·</span>
            <span>
              {viewing > 1 ? 'Revised' : 'Published'}{' '}
              {formatWeekdayDate(Date.parse(report.current.publishedAt), zone)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {report.current.author}, reviewed by {report.current.reviewer}
            </span>
          </p>
        </LargeTitle>

        {viewing < latest && (
          <Notice
            tone="neutral"
            icon={History}
            title={`You are reading version ${viewing}.`}
            actions={
              <Button size="small" variant="quiet" onClick={() => setParams({}, { replace: true })}>
                Read version {latest}
              </Button>
            }
          >
            Published {formatDate(Date.parse(report.current.publishedAt), zone)}. Earlier versions
            are kept unchanged.
          </Notice>
        )}
        {report.current.changeSummary && (
          <div className={styles.revision}>
            <Button
              variant="text"
              size="small"
              aria-expanded={showChange}
              onClick={() => setShowChange((value) => !value)}
            >
              {showChange ? 'Hide what changed' : 'What changed in this version'}
            </Button>
            {showChange && (
              <Notice
                tone="neutral"
                title={`Version ${viewing}, ${formatDate(Date.parse(report.current.publishedAt), zone)}`}
              >
                {report.current.changeSummary}
                <div className={shared.inlineActions}>
                  {report.versions
                    .filter((version) => version.version !== viewing)
                    .map((version) => (
                      <Button
                        key={version.version}
                        size="small"
                        variant="quiet"
                        onClick={() => setParams({ v: String(version.version) }, { replace: true })}
                      >
                        Read version {version.version}
                      </Button>
                    ))}
                </div>
              </Notice>
            )}
          </div>
        )}

        <div className={shared.tabsSpacer}>
          <UnderlineTabs<Tab>
            label="Research note sections"
            value={tab}
            onChange={setTab}
            controls="thesis-panel"
            items={[
              { value: 'thesis', label: 'Thesis' },
              { value: 'financials', label: 'Financials' },
              { value: 'risks', label: 'Risks' },
            ]}
          />
        </div>

        <div id="thesis-panel" role="tabpanel">
          {tab === 'thesis' && (
            <>
              <div className={shared.takeaway}>
                <Eyebrow>The takeaway</Eyebrow>
                <p className={shared.takeawayText}>{body.takeaway}</p>
              </div>
              {body.arguments.length > 0 && (
                <>
                  <SectionHeader title="The case" />
                  <ul className={styles.list} aria-label="Numbered investment arguments">
                    {body.arguments.map((point, index) => (
                      <Point
                        key={point.id}
                        point={point}
                        index={index}
                        tone="argument"
                        sources={report.sources}
                        onSource={setSource}
                      />
                    ))}
                  </ul>
                </>
              )}
              {body.risks.length > 0 && (
                <>
                  <SectionHeader title="What could change the view?" />
                  <ul className={styles.list} aria-label="Conditions that weaken the thesis">
                    {body.risks.slice(0, 2).map((point, index) => (
                      <Point
                        key={point.id}
                        point={point}
                        index={index}
                        tone="risk"
                        sources={report.sources}
                        onSource={setSource}
                      />
                    ))}
                  </ul>
                  {body.risks.length > 2 && (
                    <div className={shared.block} style={{ marginTop: 8 }}>
                      <Button variant="text" size="small" onClick={() => setTab('risks')}>
                        All {body.risks.length} risks
                      </Button>
                    </div>
                  )}
                </>
              )}
              <div className={shared.prose} style={{ marginTop: 24 }}>
                {body.sections.map((section) => (
                  <section key={section.heading}>
                    <h2>{section.heading}</h2>
                    {section.paragraphs.map((paragraph, i) => (
                      <p key={i} style={{ marginTop: 8 }}>
                        {paragraph}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
              {body.monitor.length > 0 && (
                <>
                  <SectionHeader title="What to monitor" />
                  <ol className={shared.numbered}>
                    {body.monitor.map((item, index) => (
                      <li key={item.title} className={shared.numberedItem}>
                        <RankBadge rank={index + 1} />
                        <div className={shared.numberedBody}>
                          <div className={shared.numberedTitle}>{item.title}</div>
                          <div className={shared.numberedText}>{item.detail}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}

          {tab === 'financials' &&
            (body.financials ? (
              <>
                <div className={styles.legend}>
                  <Tag tone="positive">Reported</Tag>
                  <Tag tone="outline">Estimate (E)</Tag>
                </div>
                <div
                  className={shared.tableScroll}
                  tabIndex={0}
                  role="region"
                  aria-label="Financial summary table"
                >
                  <table className={shared.dataTable}>
                    <caption className="visually-hidden">
                      Financial summary; the last column is a consensus estimate.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Metric</th>
                        {body.financials.periods.map((period) => (
                          <th
                            scope="col"
                            key={period}
                            className={period.endsWith('E') ? styles.estimate : undefined}
                          >
                            {period}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {body.financials.rows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">
                            {row.label} <span className="t-muted">({row.unit})</span>
                          </th>
                          {row.values.map((value, index) => (
                            <td
                              key={index}
                              className={
                                body.financials!.periods[index]?.endsWith('E')
                                  ? styles.estimate
                                  : undefined
                              }
                            >
                              {value ?? <span aria-label="not available">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={shared.footnote}>{body.financials.note}</p>
              </>
            ) : (
              <EmptyState size="section" title="No financial summary in this note.">
                This research note does not include a financial table.
              </EmptyState>
            ))}

          {tab === 'risks' && (
            <>
              <SectionHeader title="Risks and invalidation" />
              <ul className={styles.list} aria-label="Risks">
                {body.risks.map((point, index) => (
                  <Point
                    key={point.id}
                    point={point}
                    index={index}
                    tone="risk"
                    sources={report.sources}
                    onSource={setSource}
                    defaultOpen
                  />
                ))}
              </ul>
              {body.risks.length === 0 && (
                <p className={shared.lede}>No risks are recorded in this version.</p>
              )}
            </>
          )}
        </div>

        {report.sources.length > 0 && (
          <>
            <SectionHeader
              title="Source documents"
              aside={<Eyebrow tone="muted">Illustrative sources</Eyebrow>}
            />
            <List label="Source documents">
              {report.sources.map((item) => (
                <Row
                  key={item.id}
                  onPress={() => setSource(item)}
                  title={keepFilingCodesWhole(item.title)}
                  detail={`${item.publisher} · ${formatDate(Date.parse(item.publishedAt), zone)}`}
                  leading={<ArrowUpRight size={18} strokeWidth={ICON_STROKE} aria-hidden />}
                  chevron={false}
                  linkLabel={`Source: ${item.title}`}
                />
              ))}
            </List>
          </>
        )}
        {/* As photographed, saving closes the note in the flow; the top bar keeps it in reach. */}
        <div className={shared.endAction}>
          <Button
            full
            variant="secondary"
            icon={Bookmark}
            iconPosition="start"
            pending={save.pending}
            onClick={save.toggle}
          >
            {save.saved
              ? save.record && save.record.version !== viewing
                ? `Saved version ${save.record.version} · save this version`
                : 'Saved to research'
              : 'Save research'}
          </Button>
        </div>
        <p className={shared.footnote}>
          Sample research for the demo build. Reported facts, estimates, management statements and
          model assumptions are labelled separately. Not investment advice.
        </p>
      </Content>
      <SourceSheet source={source} onClose={() => setSource(null)} timeZone={zone} />
      <AccountPrompt
        intent={save.intent}
        onClose={save.clearIntent}
        what="Create a free account or sign in to keep research, with the exact version you saved."
      />
    </ScreenBody>
  );
}

function ThesisLoader({ instrument }: { instrument: Instrument }) {
  const [params] = useSearchParams();
  const pick = usePickForInstrument(instrument.id);
  const reports = useReports({ instrumentId: instrument.id, kind: 'thesis' });
  const reportId = pick.data?.reportId ?? reports.data?.[0]?.id;
  const version = params.get('v') ? Number(params.get('v')) : undefined;
  const report = useReport(reportId, version);
  if (!pick.isPending && !reports.isPending && !reportId) {
    return (
      <ScreenBody>
        <TopBar title="Research note" ruled />
        <EmptyState title="No thesis is published for this company." size="section">
          Research mentioning {instrument.symbol} appears in the reading room.
        </EmptyState>
      </ScreenBody>
    );
  }
  return (
    <QueryState
      query={report}
      skeleton={<SkeletonRows rows={5} />}
      errorTitle="The research note could not be loaded."
    >
      {(data) => <Thesis instrument={instrument} report={data} />}
    </QueryState>
  );
}

export default function InvestmentThesisScreen() {
  const { symbol = '' } = useParams();
  const instrument = useInstrument(symbol);
  return <QueryState query={instrument}>{(data) => <ThesisLoader instrument={data} />}</QueryState>;
}
