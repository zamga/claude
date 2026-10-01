import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { reportMeta, usePageMeta } from '../app/routes';
import { Cover } from '../report/Cover';
import { FootballField } from '../report/FootballField';
import { CiteOrigin, Cited, FootnoteProvider } from '../report/Footnotes';
import { Sensitivity } from '../report/Sensitivity';
import { bindings } from '../report/bindings';
import {
  Catalysts,
  CostOfCapital,
  DcfTable,
  DividendBars,
  Exhibit,
  ImpliedPanel,
  IncomeTable,
  KeyFacts,
  MethodNotes,
  OwnershipBar,
  RegionsTable,
  RiskList,
} from '../report/reader/Figures';
import { GradeLegend, SourceCard, SourceList, citationCounts } from '../report/reader/Sources';
import type { Report as ReportData } from '../report/types';
import { valueReport, type Valuation } from '../report/valuation';
import { longDate, moneyFor, type Money } from '../lib/format';
import { currentAnchor, focusAnchor, href, Link } from '../lib/router';
import styles from './Report.module.css';

const PRINTABLE = import.meta.env.MODE !== 'artifact';

interface Entry {
  id: string;
  title: string;
  no: string;
}

/** Everything the reader derives from one report, computed once. */
interface Doc {
  report: ReportData;
  valuation: Valuation;
  values: Record<string, string>;
  counts: Map<string, number>;
  money: Money;
  path: string;
  contents: Entry[];
}

const DocContext = createContext<Doc | null>(null);

function useDoc(): Doc {
  const doc = useContext(DocContext);
  if (!doc) throw new Error('useDoc outside a report');
  return doc;
}

const paragraphsOf = (report: ReportData, id: string) => report.sections.find((s) => s.id === id)?.paragraphs ?? [];

/** The report's sections, numbered: only those its evidence fills. */
function contentsOf(report: ReportData): Entry[] {
  const title = (id: string, fallback: string) => report.sections.find((s) => s.id === id)?.title ?? fallback;
  const has = (id: string) => paragraphsOf(report, id).length > 0;
  const entries = [
    { id: 'cover', title: 'Cover', show: true },
    { id: 'summary', title: 'Investment summary', show: true },
    { id: 'business', title: title('business', 'The business'), show: has('business') || report.keyFacts.length > 0 },
    { id: 'markets', title: title('markets', 'Markets'), show: has('markets') || report.regions.length > 0 },
    { id: 'financials', title: title('financials', 'Financial performance'), show: true },
    {
      id: 'ownership',
      title: title('ownership', 'Ownership'),
      show: has('ownership') || report.ownership.length > 0 || report.dividends.length > 0,
    },
    { id: 'valuation', title: title('valuation', 'Valuation'), show: true },
    { id: 'question', title: title('question', 'Your question'), show: has('question') },
    { id: 'risks', title: 'Risks and catalysts', show: true },
    { id: 'sources', title: 'Sources', show: true },
    { id: 'disclosures', title: 'Disclosures', show: true },
  ];
  return entries.filter((e) => e.show).map((e, i) => ({ id: e.id, title: e.title, no: String(i).padStart(2, '0') }));
}

interface Pin {
  id: string;
  origin?: string;
}

/** The source a reader last pointed at, and the passage it was cited from. */
const Reader = createContext<{ pin: Pin | null; close: () => void }>({ pin: null, close: () => {} });

/** The section being read: the last one whose top has passed the upper third of the screen. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]!);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.32;
      let current = ids[0]!;
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) current = id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // The first reading does not wait for a frame, for the same reason as above.
    queueMicrotask(update);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

/** A paragraph of the report. On narrow screens a tapped note unfolds its source right below it. */
function Para({ text, origin, lead = false }: { text: string; origin: string; lead?: boolean }) {
  const { report } = useDoc();
  const { pin, close } = useContext(Reader);
  const source = pin?.origin === origin ? report.sources.find((s) => s.id === pin.id) : undefined;
  return (
    <>
      <CiteOrigin value={origin}>
        <p className={lead ? styles.lead : styles.para}>
          <Cited text={text} />
        </p>
      </CiteOrigin>
      {source && (
        <SourceCard
          key={source.id}
          source={source}
          n={report.sources.indexOf(source) + 1}
          id={`note-${source.id}`}
          className={styles.unfold}
        >
          <button type="button" className={styles.close} onClick={close}>
            Close source
          </button>
        </SourceCard>
      )}
    </>
  );
}

function Paragraphs({ id, leadFirst = false }: { id: string; leadFirst?: boolean }) {
  const { report } = useDoc();
  return (
    <>
      {paragraphsOf(report, id).map((p, i) => (
        <Para key={i} text={p} origin={`${id}-${i}`} lead={leadFirst && i === 0} />
      ))}
    </>
  );
}

function Section({ id, children, wide = false }: { id: string; children: ReactNode; wide?: boolean }) {
  const { contents } = useDoc();
  const meta = contents.find((c) => c.id === id);
  if (!meta) return null;
  return (
    <section id={id} className={styles.section} data-wide={wide || undefined} aria-labelledby={`${id}-title`}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionNo}>{meta.no}</span>
        <h2 id={`${id}-title`}>{meta.title}</h2>
      </header>
      {children}
    </section>
  );
}

/** Contents as a vertical list beside the report, or a bar across it on narrower screens. */
function Contents({ active, variant }: { active: string; variant: 'side' | 'bar' }) {
  const { contents, path, valuation, money } = useDoc();
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (variant !== 'bar') return;
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!list || !item) return;
    // Keep the current section's chip in view without moving the page.
    list.scrollTo({ left: item.offsetLeft - list.clientWidth / 2 + item.clientWidth / 2, behavior: 'smooth' });
  }, [active, variant]);
  return (
    <nav className={variant === 'side' ? styles.toc : styles.tocBar} aria-label="Report contents">
      {variant === 'side' && <p className={styles.tocHead}>Contents</p>}
      <ol ref={listRef} role="list">
        {contents.map((c) => (
          <li key={c.id} data-id={c.id}>
            <Link to={`${path}#${c.id}`} aria-current={active === c.id ? 'location' : undefined}>
              <span className={styles.tocNo}>{c.no}</span>
              <span>{c.title}</span>
            </Link>
          </li>
        ))}
      </ol>
      {variant === 'side' && (
        <dl className={styles.tocValue}>
          <div>
            <dt>{valuation.basis === 'share' ? 'Fair value' : 'Equity value'}</dt>
            <dd>
              {money.value(valuation.fair.low, 0)}–{money.value(valuation.fair.high, 0)}
            </dd>
          </div>
          {valuation.price !== undefined && (
            <div>
              <dt>Price</dt>
              <dd>{money.amount(valuation.price)}</dd>
            </div>
          )}
        </dl>
      )}
    </nav>
  );
}

function SourceRail({ shown }: { shown: string | null }) {
  const { report, counts, path } = useDoc();
  const source = shown ? report.sources.find((s) => s.id === shown) : undefined;
  return (
    <aside className={styles.rail} aria-label="Source">
      {source ? (
        <SourceCard source={source} n={report.sources.indexOf(source) + 1}>
          <p className={styles.railMeta}>
            Cited {counts.get(source.id) ?? 0} {counts.get(source.id) === 1 ? 'time' : 'times'} in this report ·{' '}
            <Link to={`${path}#src-${source.id}`}>In the source list</Link>
          </p>
        </SourceCard>
      ) : (
        <div className={styles.railIntro}>
          <p className={styles.railHead}>{report.sources.length} sources</p>
          <p>Point at a note number to read its source here: the document, its date, and the sentence it rests on.</p>
        </div>
      )}
      <GradeLegend sources={report.sources} />
    </aside>
  );
}

function Disclosures() {
  const { report } = useDoc();
  const c = report.company;
  const listed = report.market !== undefined;
  return (
    <div className={styles.disclosures}>
      <p>
        This report is research, not investment advice. It describes what the evidence shows
        {listed ? ' and what the share price implies' : ''} under stated assumptions; it does not recommend buying,
        holding or selling any security, and it gives a range of fair values rather than a rating or a target price.
      </p>
      <p>
        Reported figures come from the documents listed under Sources, as gathered on {longDate(report.date)}. Every
        valuation figure is computed by the Uncovered model from the assumptions shown under Valuation and is marked as
        an estimate.{report.market ? ` The share price is from ${report.market.priceDate}.` : ''}
      </p>
      {(report.disclosures ?? []).map((d, i) => (
        <p key={i}>{d}</p>
      ))}
      <p>
        Uncovered does not trade the securities it covers and accepts no payment from covered companies.{' '}
        {report.kind === 'engine'
          ? `This report was researched and written by the Uncovered engine and checked by code before publication: every note resolves to a quoted passage, every model figure is computed, and no number stands without one or the other. It has not been reviewed by ${c.shortName} or by an analyst.`
          : `This sample was prepared to show the format of an initiation; it has not been reviewed by ${c.shortName}.`}
      </p>
    </div>
  );
}

export function Report({ report }: { report: ReportData }) {
  const doc = useMemo<Doc>(() => {
    const valuation = valueReport(report);
    return {
      report,
      valuation,
      values: bindings(report, valuation),
      counts: citationCounts(report),
      money: moneyFor(valuation.currency, valuation.basis),
      path: `/report/${report.id}`,
      contents: contentsOf(report),
    };
  }, [report]);
  const { valuation, money, path, contents } = doc;
  const ids = useMemo(() => contents.map((c) => c.id), [contents]);
  const [hover, setHover] = useState<string | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const active = useActiveSection(ids);
  const c = report.company;
  const has = (id: string) => contents.some((e) => e.id === id);
  const valueTitle = valuation.basis === 'share' ? 'Fair value per share by method' : 'Equity value by method';

  usePageMeta(path, reportMeta(report));
  useEffect(() => {
    // Arriving on an anchor (a contents link from another page, or a shared address): go to it once rendered.
    const anchor = currentAnchor();
    if (!anchor) return;
    let cancelled = false;
    // The page is committed when this runs, so go straight there: waiting for a frame
    // would stall in a background tab, where frames do not run.
    focusAnchor(anchor);
    // Fonts arriving late can move the section; settle on it again once they have.
    void document.fonts?.ready.then(() => {
      const el = document.getElementById(anchor);
      const top = el?.getBoundingClientRect().top ?? 0;
      if (!cancelled && el && (top < 0 || top > window.innerHeight / 2)) el.scrollIntoView({ block: 'start' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DocContext.Provider value={doc}>
      <FootnoteProvider
        sources={report.sources}
        values={doc.values}
        prefix="note"
        scrollBlock="nearest"
        hrefFor={(id) => href(`${path}#src-${id}`)}
        onFocusSource={(id, origin) => {
          setHover(id);
          if (id) setPin({ id, origin });
        }}
      >
        <Reader.Provider value={{ pin, close: () => setPin(null) }}>
          <article className={styles.report} aria-labelledby="report-title">
            <span className={styles.progress} aria-hidden="true" />
            <header className={`page ${styles.top}`}>
              <p className="eyebrow">
                {report.kind === 'sample' ? 'Sample report · ' : ''}Initiation of coverage · {longDate(report.date)}
              </p>
              <h1 id="report-title" className={styles.title} data-page-focus tabIndex={-1}>
                {c.legalName}
              </h1>
              <div className={styles.actions}>
                {PRINTABLE && (
                  <button type="button" className={styles.action} onClick={() => window.print()}>
                    Print or save as PDF
                  </button>
                )}
                <Link to="/initiate" className={`${styles.action} ${styles.primary}`}>
                  Initiate your own
                </Link>
              </div>
            </header>

            <Contents active={active} variant="bar" />

            <div className={`page ${styles.layout}`}>
              <Contents active={active} variant="side" />

              <div className={styles.body}>
                <section id="cover" className={styles.coverSection} aria-label="Cover">
                  <Cover report={report} valuation={valuation} size="page" />
                </section>

                <Section id="summary">
                  <p className={styles.headline}>{report.headline}</p>
                  <Para text={report.summary} origin="summary" lead />
                  <ol className={styles.thesis} role="list">
                    {report.thesis.map((t, i) => (
                      <li key={t.title}>
                        <span className={styles.thesisNo}>{i + 1}</span>
                        <h3>{t.title}</h3>
                        <Para text={t.body} origin={`thesis-${i}`} />
                      </li>
                    ))}
                  </ol>
                  <ImpliedPanel report={report} valuation={valuation} />
                </Section>

                <Section id="business">
                  <Paragraphs id="business" leadFirst />
                  <KeyFacts report={report} />
                </Section>

                <Section id="markets">
                  <Paragraphs id="markets" />
                  <RegionsTable report={report} no="1" />
                </Section>

                <Section id="financials" wide>
                  <Paragraphs id="financials" />
                  <IncomeTable report={report} no="2" />
                </Section>

                <Section id="ownership">
                  <Paragraphs id="ownership" />
                  {(report.ownership.length > 0 || report.dividends.length > 0) && (
                    <div className={styles.pair}>
                      <OwnershipBar report={report} no="3" />
                      <DividendBars report={report} no="4" />
                    </div>
                  )}
                </Section>

                <Section id="valuation" wide>
                  <Paragraphs id="valuation" />
                  <Exhibit no="5" title={valueTitle}>
                    <FootballField
                      valuation={valuation}
                      title={valueTitle}
                      high={
                        report.market?.high !== undefined
                          ? { value: report.market.high, label: `High ${money.amount(report.market.high, 0)}` }
                          : undefined
                      }
                    />
                  </Exhibit>
                  <CostOfCapital report={report} no="6" />
                  <DcfTable report={report} valuation={valuation} no="7" />
                  <Exhibit no="8" title="Sensitivity of the DCF value">
                    <Sensitivity report={report} />
                  </Exhibit>
                  <MethodNotes report={report} valuation={valuation} />
                </Section>

                {has('question') && (
                  <Section id="question">
                    {report.question && <p className={styles.question}>“{report.question}”</p>}
                    <Paragraphs id="question" />
                  </Section>
                )}

                <Section id="risks">
                  <RiskList report={report} />
                  <h3 className={styles.subhead}>Catalysts</h3>
                  <Catalysts report={report} />
                </Section>

                <Section id="sources">
                  <p className={styles.para}>
                    {report.kind === 'engine'
                      ? 'Every reported figure in this report links to one of these passages. Each is quoted word for word from the document, with its page where the document has pages, and graded by how strong the evidence is.'
                      : 'Every reported figure in this report links to one of these documents. Each carries the passage the figure rests on and is graded by how strong the evidence is.'}
                  </p>
                  <SourceList report={report} active={hover ?? pin?.id} counts={doc.counts} />
                </Section>

                <Section id="disclosures">
                  <Disclosures />
                </Section>
              </div>

              <SourceRail shown={hover ?? pin?.id ?? null} />
            </div>
          </article>
        </Reader.Provider>
      </FootnoteProvider>
    </DocContext.Provider>
  );
}
