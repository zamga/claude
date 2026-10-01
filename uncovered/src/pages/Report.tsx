import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePageMeta } from '../app/routes';
import { Cover } from '../report/Cover';
import { FootballField } from '../report/FootballField';
import { CiteOrigin, Cited, FootnoteProvider } from '../report/Footnotes';
import { Sensitivity } from '../report/Sensitivity';
import { bindings } from '../report/bindings';
import { KRKA } from '../report/krka';
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
import { valueReport } from '../report/valuation';
import { eur, longDate } from '../lib/format';
import { currentAnchor, focusAnchor, href, Link } from '../lib/router';
import styles from './Report.module.css';

const REPORT = KRKA;
const VALUATION = valueReport(REPORT);
const VALUES = bindings(REPORT, VALUATION);
const COUNTS = citationCounts(REPORT);
const PATH = `/report/${REPORT.id}`;
const PRINTABLE = import.meta.env.MODE !== 'artifact';

const sectionTitle = (id: string, fallback: string) => REPORT.sections.find((s) => s.id === id)?.title ?? fallback;
const paragraphs = (id: string) => REPORT.sections.find((s) => s.id === id)?.paragraphs ?? [];

const CONTENTS = [
  { id: 'cover', title: 'Cover' },
  { id: 'summary', title: 'Investment summary' },
  { id: 'business', title: sectionTitle('business', 'The business') },
  { id: 'markets', title: sectionTitle('markets', 'Markets') },
  { id: 'financials', title: sectionTitle('financials', 'Financial performance') },
  { id: 'ownership', title: sectionTitle('ownership', 'Ownership') },
  { id: 'valuation', title: sectionTitle('valuation', 'Valuation') },
  { id: 'risks', title: 'Risks and catalysts' },
  { id: 'sources', title: 'Sources' },
  { id: 'disclosures', title: 'Disclosures' },
].map((s, i) => ({ ...s, no: String(i).padStart(2, '0') }));

const IDS = CONTENTS.map((c) => c.id);

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
  const { pin, close } = useContext(Reader);
  const source = pin?.origin === origin ? REPORT.sources.find((s) => s.id === pin.id) : undefined;
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
          n={REPORT.sources.indexOf(source) + 1}
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

function Section({ id, children, wide = false }: { id: string; children: ReactNode; wide?: boolean }) {
  const meta = CONTENTS.find((c) => c.id === id)!;
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
        {CONTENTS.map((c) => (
          <li key={c.id} data-id={c.id}>
            <Link to={`${PATH}#${c.id}`} aria-current={active === c.id ? 'location' : undefined}>
              <span className={styles.tocNo}>{c.no}</span>
              <span>{c.title}</span>
            </Link>
          </li>
        ))}
      </ol>
      {variant === 'side' && (
        <dl className={styles.tocValue}>
          <div>
            <dt>Fair value</dt>
            <dd>
              {eur(VALUATION.fair.low, 0)}–{eur(VALUATION.fair.high, 0)}
            </dd>
          </div>
          {VALUATION.price !== undefined && (
            <div>
              <dt>Price</dt>
              <dd>{eur(VALUATION.price)}</dd>
            </div>
          )}
        </dl>
      )}
    </nav>
  );
}

function SourceRail({ shown }: { shown: string | null }) {
  const source = shown ? REPORT.sources.find((s) => s.id === shown) : undefined;
  return (
    <aside className={styles.rail} aria-label="Source">
      {source ? (
        <SourceCard source={source} n={REPORT.sources.indexOf(source) + 1}>
          <p className={styles.railMeta}>
            Cited {COUNTS.get(source.id) ?? 0} {COUNTS.get(source.id) === 1 ? 'time' : 'times'} in this report ·{' '}
            <Link to={`${PATH}#src-${source.id}`}>In the source list</Link>
          </p>
        </SourceCard>
      ) : (
        <div className={styles.railIntro}>
          <p className={styles.railHead}>{REPORT.sources.length} sources</p>
          <p>Point at a note number to read its source here: the document, its date, and the sentence it rests on.</p>
        </div>
      )}
      <GradeLegend sources={REPORT.sources} />
    </aside>
  );
}

export function Report() {
  const [hover, setHover] = useState<string | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const active = useActiveSection(IDS);
  const c = REPORT.company;

  usePageMeta(PATH);
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
    <FootnoteProvider
      sources={REPORT.sources}
      values={VALUES}
      prefix="note"
      scrollBlock="nearest"
      hrefFor={(id) => href(`${PATH}#src-${id}`)}
      onFocusSource={(id, origin) => {
        setHover(id);
        if (id) setPin({ id, origin });
      }}
    >
      <Reader.Provider value={{ pin, close: () => setPin(null) }}>
        <article className={styles.report} aria-labelledby="report-title">
          <span className={styles.progress} aria-hidden="true" />
          <header className={`page ${styles.top}`}>
            <p className="eyebrow">Sample report · Initiation of coverage · {longDate(REPORT.date)}</p>
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
                <Cover report={REPORT} valuation={VALUATION} size="page" />
              </section>

              <Section id="summary">
                <p className={styles.headline}>{REPORT.headline}</p>
                <Para text={REPORT.summary} origin="summary" lead />
                <ol className={styles.thesis} role="list">
                  {REPORT.thesis.map((t, i) => (
                    <li key={t.title}>
                      <span className={styles.thesisNo}>{i + 1}</span>
                      <h3>{t.title}</h3>
                      <Para text={t.body} origin={`thesis-${i}`} />
                    </li>
                  ))}
                </ol>
                <ImpliedPanel report={REPORT} valuation={VALUATION} />
              </Section>

              <Section id="business">
                {paragraphs('business').map((p, i) => (
                  <Para key={i} text={p} origin={`business-${i}`} lead={i === 0} />
                ))}
                <KeyFacts report={REPORT} />
              </Section>

              <Section id="markets">
                {paragraphs('markets').map((p, i) => (
                  <Para key={i} text={p} origin={`markets-${i}`} />
                ))}
                <RegionsTable report={REPORT} no="1" />
              </Section>

              <Section id="financials" wide>
                {paragraphs('financials').map((p, i) => (
                  <Para key={i} text={p} origin={`financials-${i}`} />
                ))}
                <IncomeTable report={REPORT} no="2" />
              </Section>

              <Section id="ownership">
                {paragraphs('ownership').map((p, i) => (
                  <Para key={i} text={p} origin={`ownership-${i}`} />
                ))}
                <div className={styles.pair}>
                  <OwnershipBar report={REPORT} no="3" />
                  <DividendBars report={REPORT} no="4" />
                </div>
              </Section>

              <Section id="valuation" wide>
                {paragraphs('valuation').map((p, i) => (
                  <Para key={i} text={p} origin={`valuation-${i}`} />
                ))}
                <Exhibit no="5" title="Fair value per share by method">
                  <FootballField
                    valuation={VALUATION}
                    high={
                      REPORT.market?.high !== undefined
                        ? { value: REPORT.market.high, label: `High ${eur(REPORT.market.high, 0)}` }
                        : undefined
                    }
                  />
                </Exhibit>
                <CostOfCapital report={REPORT} no="6" />
                <DcfTable report={REPORT} valuation={VALUATION} no="7" />
                <Exhibit no="8" title="Sensitivity of the DCF value">
                  <Sensitivity report={REPORT} />
                </Exhibit>
                <MethodNotes report={REPORT} valuation={VALUATION} />
              </Section>

              <Section id="risks">
                <RiskList report={REPORT} />
                <h3 className={styles.subhead}>Catalysts</h3>
                <Catalysts report={REPORT} />
              </Section>

              <Section id="sources">
                <p className={styles.para}>
                  Every reported figure in this report links to one of these documents. Each is quoted at the sentence
                  the figure rests on and graded by how strong the evidence is.
                </p>
                <SourceList report={REPORT} active={hover ?? pin?.id} counts={COUNTS} />
              </Section>

              <Section id="disclosures">
                <div className={styles.disclosures}>
                  <p>
                    This report is research, not investment advice. It describes what the evidence shows and what the
                    share price implies under stated assumptions; it does not recommend buying, holding or selling any
                    security, and it gives a range of fair values rather than a rating or a target price.
                  </p>
                  <p>
                    Reported figures come from the documents listed under Sources, as gathered on{' '}
                    {longDate(REPORT.date)}. Figures for 2025 are from the unaudited statements the company released in
                    March 2026; the audited annual report, published in April, has not been reconciled for this sample.
                    Every valuation figure is computed by the Uncovered model from the assumptions shown in section 06
                    and is marked as an estimate. The share price is from{' '}
                    {REPORT.market?.priceDate ?? 'the date of the report'}.
                  </p>
                  <p>
                    Uncovered does not trade the securities it covers and accepts no payment from covered companies.
                    This sample was prepared to show the format of an initiation; it has not been reviewed by Krka.
                  </p>
                </div>
              </Section>
            </div>

            <SourceRail shown={hover ?? pin?.id ?? null} />
          </div>
        </article>
      </Reader.Provider>
    </FootnoteProvider>
  );
}
