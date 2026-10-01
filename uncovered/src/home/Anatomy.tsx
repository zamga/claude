import type { CSSProperties, ReactNode } from 'react';
import { Link } from '../lib/router';
import { useSeen } from '../lib/hooks';
import { Seal } from '../seal/Seal';
import styles from './Anatomy.module.css';

type Kind = 'cover' | 'summary' | 'business' | 'markets' | 'financials' | 'valuation' | 'risks' | 'sources';

const PAGES: { id: Kind; title: string; note: string }[] = [
  { id: 'cover', title: 'Cover', note: 'Fair-value range, key data, thesis, serial and seal' },
  { id: 'summary', title: 'Investment summary', note: 'Three-part thesis, what the price implies' },
  { id: 'business', title: 'The business', note: 'History, products, plants, people' },
  { id: 'markets', title: 'Markets', note: 'Sales by region and how each grew' },
  { id: 'financials', title: 'Financials', note: 'Three years and the latest half, footnoted' },
  { id: 'valuation', title: 'Valuation', note: 'DCF, dividends, multiples, the football field' },
  { id: 'risks', title: 'Risks and catalysts', note: 'Graded by impact, with what would change our view' },
  { id: 'sources', title: 'Sources', note: 'Every document, quoted, with its evidence grade' },
];

/** The report laid out as a contact sheet of its pages, each a link into the sample. */
export function Anatomy() {
  const [ref, seen] = useSeen<HTMLOListElement>('0px 0px 10% 0px');
  return (
    <section className={styles.anatomy} aria-labelledby="anatomy-title">
      <div className={`page ${styles.head}`}>
        <p className="eyebrow">Anatomy of an initiation</p>
        <h2 id="anatomy-title" className={styles.title}>
          Everything a bank would write. <em>Nothing it would not show.</em>
        </h2>
      </div>
      <ol ref={ref} className={`page ${styles.pages}`} role="list" data-play={seen ? 'true' : undefined}>
        {PAGES.map((p, i) => (
          <li key={p.id} style={{ '--i': i, '--n': PAGES.length } as CSSProperties}>
            <Link to={`/report/krka#${p.id}`} className={styles.page}>
              <span className={styles.sheet} aria-hidden="true">
                <span className={styles.runningHead}>
                  <span />
                  <span />
                </span>
                {p.id !== 'cover' && <span className={styles.pageTitle}>{p.title}</span>}
                <Miniature kind={p.id} />
                <span className={styles.folio}>
                  <span>Krka, d. d.</span>
                  <span>{i + 1}</span>
                </span>
              </span>
              <span className={styles.meta}>
                <span className={styles.no}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.metaTitle}>{p.title}</span>
                <span className={styles.note}>{p.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Lines({ n = 3, short = [] as number[] }: { n?: number; short?: number[] }) {
  return (
    <span className={styles.lines}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={short.includes(i) ? { width: `${55 + ((i * 17) % 30)}%` } : undefined} />
      ))}
    </span>
  );
}

function Miniature({ kind }: { kind: Kind }): ReactNode {
  switch (kind) {
    case 'cover':
      return (
        <>
          <span className={styles.coverId}>
            <span className={styles.coverName}>Krka</span>
            <Seal seed="Krka, d. d., Novo mesto" size={112} detail="full" draw="static" className={styles.coverSeal} />
          </span>
          <span className={styles.headline} />
          <span className={styles.valueBox}>
            <span className={styles.range} />
            <span className={styles.facts}>
              <span />
              <span />
              <span />
            </span>
          </span>
          <span className={styles.twoCol}>
            <Lines n={5} short={[4]} />
            <span className={styles.keyData}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} />
              ))}
            </span>
          </span>
        </>
      );
    case 'summary':
      return (
        <>
          <span className={styles.thesis}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={styles.point}>
                <span className={styles.numeral}>{n}</span>
                <Lines n={3} short={[2]} />
              </span>
            ))}
          </span>
          <span className={styles.implied}>
            <span className={styles.impliedBand}>
              <i />
            </span>
            <Lines n={2} short={[1]} />
          </span>
        </>
      );
    case 'business':
      return (
        <>
          <Lines n={5} short={[4]} />
          <span className={styles.plate}>
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} style={{ '--x': (i * 37) % 100, '--y': (i * 61) % 100 } as CSSProperties} />
            ))}
          </span>
          <Lines n={4} short={[3]} />
        </>
      );
    case 'markets':
      return (
        <>
          <span className={styles.bars}>
            {[100, 64, 51, 41, 18, 11].map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </span>
          <Lines n={5} short={[4]} />
        </>
      );
    case 'financials':
      return (
        <>
          <span className={styles.table}>
            {Array.from({ length: 30 }, (_, i) => (
              <span key={i} />
            ))}
          </span>
          <Lines n={4} short={[3]} />
        </>
      );
    case 'valuation':
      return (
        <>
          <span className={styles.field}>
            <span style={{ marginLeft: '24%', width: '50%' }} />
            <span style={{ marginLeft: '12%', width: '30%' }} />
            <span style={{ marginLeft: '20%', width: '42%' }} />
            <span style={{ marginLeft: '20%', width: '38%' }} />
            <i />
          </span>
          <span className={styles.grid}>
            {Array.from({ length: 25 }, (_, i) => (
              <span key={i} style={{ '--v': ((i % 5) - Math.floor(i / 5)) / 4 } as CSSProperties} />
            ))}
          </span>
          <Lines n={2} short={[1]} />
        </>
      );
    case 'risks':
      return (
        <span className={styles.list}>
          {[3, 3, 2, 2, 1].map((impact, i) => (
            <span key={i} className={styles.item}>
              <span className={styles.impact} data-level={impact} />
              <Lines n={2} short={[1]} />
            </span>
          ))}
        </span>
      );
    case 'sources':
      return (
        <span className={styles.list}>
          {['filed', 'reported', 'reported', 'filed', 'reported', 'estimated', 'filed'].map((grade, i) => (
            <span key={i} className={styles.item}>
              <span className={styles.ref} data-grade={grade}>
                {i + 1}
              </span>
              <Lines n={2} short={[1]} />
            </span>
          ))}
        </span>
      );
  }
}
