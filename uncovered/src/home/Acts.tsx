import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { KRKA } from '../report/krka';
import { Cited, FootnoteProvider, citations } from '../report/Footnotes';
import { bindings } from '../report/bindings';
import { dcf } from '../report/valuation';
import { pct } from '../lib/format';
import styles from './Acts.module.css';

const ACTS = [
  {
    no: '01',
    title: 'Research',
    body: 'Uncovered reads what an analyst would: the business register, annual reports, exchange announcements, the company’s own site and the trade press, in Slovenian, English or German.',
  },
  {
    no: '02',
    title: 'Extract',
    body: 'Financial statements come out of the filings with their page numbers attached. Nothing is paraphrased, nothing is rounded twice.',
  },
  {
    no: '03',
    title: 'Model',
    body: 'Forecasts, a discounted-cash-flow model, dividends and multiples, built as a model you can open and change. The arithmetic is code, not prose.',
  },
  {
    no: '04',
    title: 'Write',
    body: 'Thesis, risks and catalysts, written in the register of a senior analyst and footnoted line by line.',
  },
];

const FOUND = [
  ['Business register', 'ePRS · AJPES'],
  ['Annual report 2025', 'Unaudited statements · krka.biz'],
  ['Results presentation', 'FY25 · 6 regions'],
  ['Half-year results', 'H1 2026'],
  ['Dividend proposal', 'AGM 2026'],
  ['Market data', 'LJSE: KRKG'],
];

// The modelled revenue path, straight from the engine: last actual year, then the forecasts.
const PATH = [
  { label: KRKA.base.year.replace(/^20/, ''), revenue: KRKA.base.revenue, forecast: false },
  ...dcf(KRKA.assumptions, KRKA.base.revenue).years.map((y) => ({
    label: y.period.replace(/^20/, ''),
    revenue: y.revenue,
    forecast: true,
  })),
];
const PEAK = Math.max(...PATH.map((p) => p.revenue)) * 1.03;
const LATER_GROWTH = KRKA.assumptions.revenueGrowth
  .slice(1)
  .map((g) => pct(g))
  .join(', ');

const VALUES = bindings(KRKA);
const WRITE = [KRKA.thesis[1]!.body, KRKA.thesis[2]!.body];
const NOTES = citations(...WRITE).map((id) => {
  const index = KRKA.sources.findIndex((s) => s.id === id);
  return { id, n: index + 1, source: KRKA.sources[index]! };
});

/** The work of one act, as it would appear on the report page. */
function Pane({ act }: { act: number }) {
  if (act === 0)
    return (
      <>
        <ul role="list" className={styles.found}>
          {FOUND.map(([t, d], i) => (
            <li key={t} style={{ '--i': i } as CSSProperties}>
              <span className={styles.check} />
              <strong>{t}</strong>
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <p className={styles.provenance}>
          <span>Six documents found</span> in two languages, each kept with its date and address.
        </p>
      </>
    );
  if (act === 1)
    return (
      <>
        <table className={styles.extract}>
          <thead>
            <tr>
              <th scope="col">€ millions</th>
              <th scope="col">2023</th>
              <th scope="col">2024</th>
              <th scope="col">2025</th>
            </tr>
          </thead>
          <tbody>
            {KRKA.income.slice(0, 3).map((line) => (
              <tr key={line.label}>
                <th scope="row">{line.label}</th>
                {(['2023A', '2024A', '2025A'] as const).map((p) => (
                  <td key={p}>{line.values[p]?.toFixed(1)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.provenance}>
          <span>Lifted from</span> Krka releases 2025 unaudited financial statements · 2024 · 2023
        </p>
      </>
    );
  if (act === 2)
    return (
      <>
        <div className={styles.model}>
          {PATH.map((p, i) => (
            <div key={p.label} className={styles.col} style={{ '--h': p.revenue / PEAK, '--i': i } as CSSProperties}>
              <span className={styles.bar} data-forecast={p.forecast} />
              <span className={styles.year}>{p.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.provenance}>
          <span>Revenue, € m.</span> 2026 matches the company’s €2,144m target; then {LATER_GROWTH}.
        </p>
      </>
    );
  return (
    <FootnoteProvider sources={KRKA.sources} interactive={false} values={VALUES}>
      {WRITE.map((text) => (
        <p key={text} className={styles.prose}>
          <Cited text={text} />
        </p>
      ))}
      <ol role="list" className={styles.notes}>
        {NOTES.map(({ id, n, source }) => (
          <li key={id}>
            <span data-grade={source.grade}>{n}</span>
            {source.publisher}, {source.title}
          </li>
        ))}
      </ol>
    </FootnoteProvider>
  );
}

/**
 * How it works: four acts beside a sheet that shows the work of each act.
 * On wide screens the sheet stays in view and follows the act being read;
 * on phones each act carries its own sheet, so nothing is out of sight.
 */
export function Acts() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="how" className={styles.acts} aria-labelledby="acts-title">
      <div className="page">
        <p className="eyebrow">How it works</p>
        <h2 id="acts-title" className={styles.title}>
          From a name to an initiation, in <em>four acts</em>.
        </h2>
      </div>
      <div className={`page ${styles.grid}`}>
        <div className={styles.stickyCol}>
          <div className={styles.sheet} data-act={active} aria-hidden="true">
            <div className={styles.sheetHead}>
              <span>Krka, d. d.</span>
              <span>
                Act {ACTS[active]!.no} · {ACTS[active]!.title}
              </span>
            </div>
            {ACTS.map((a, i) => (
              <div key={a.no} className={styles.pane} data-on={active === i}>
                <Pane act={i} />
              </div>
            ))}
            <div className={styles.sheetFoot}>
              <span>Uncovered Research</span>
              <span>Initiation of coverage</span>
            </div>
          </div>
        </div>

        <ol className={styles.list} role="list">
          {ACTS.map((a, i) => (
            <li
              key={a.no}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-index={i}
              data-active={active === i}
              className={styles.act}
            >
              <span className={styles.no}>{a.no}</span>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
              <div className={styles.inline} aria-hidden="true">
                <div className={styles.sheetHead}>
                  <span>Krka, d. d.</span>
                  <span>
                    Act {a.no} · {a.title}
                  </span>
                </div>
                <Pane act={i} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
