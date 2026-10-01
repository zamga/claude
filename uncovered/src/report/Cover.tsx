import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { Seal } from '../seal/Seal';
import { serialFor } from '../seal/guilloche';
import { Serial } from '../ui/Serial';
import { longDate, moneyFor, num, signedPct } from '../lib/format';
import { useReducedMotion } from '../lib/motion';
import { Cited } from './Footnotes';
import type { Report } from './types';
import { impliedMultiples, type Valuation } from './valuation';
import styles from './Cover.module.css';

interface CoverProps {
  /** The researched report, or null for a company not yet covered. */
  report: Report | null;
  valuation?: Valuation;
  /** The name to show when there is no report yet. */
  name?: string;
  /** The country of a company not yet covered, for its sector line and serial. */
  country?: { name: string; code: string };
  size?: 'hero' | 'page';
  /** Tilt towards the pointer like a sheet held to the light. */
  tilt?: boolean;
}

/**
 * The cover page of an initiation report. With a report it shows the real
 * cover; with only a name, the same cover waiting for research, its seal
 * already engraved.
 */
export function Cover({ report, valuation, name, country: pending, size = 'page', tilt = false }: CoverProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const title = report?.company.legalName ?? (name?.trim() || 'Your company');
  const seed = report?.company.legalName ?? title;
  const country = report?.company.countryCode ?? pending?.code ?? 'SI';
  const date = report ? longDate(report.date) : 'Pending research';
  const monogram = report?.company.ticker ?? initials(title);
  const sealSize = size === 'hero' ? 168 : 220;
  const money = moneyFor(valuation?.currency ?? report?.currency, valuation?.basis ?? 'share');
  const perShare = (valuation?.basis ?? 'share') === 'share';
  const company = report?.company;
  const legal = company
    ? company.listed && company.exchange
      ? `${company.legalName} · ${company.exchange}${company.ticker ? `: ${company.ticker}` : ''}`
      : `${company.legalName} · ${company.registration ? `Registration ${company.registration}` : 'Private company'}`
    : 'Awaiting research';
  const multiples = report && valuation && !perShare ? impliedMultiples(report, valuation) : undefined;
  const facts: { label: string; value: string }[] = perShare
    ? [
        { label: 'Base case', value: valuation ? money.value(valuation.fair.base, 0) : '—' },
        { label: 'Share price', value: valuation?.price !== undefined ? money.amount(valuation.price) : '—' },
        { label: 'Price vs base', value: valuation?.premium !== undefined ? signedPct(valuation.premium) : '—' },
      ]
    : [
        { label: 'Base case', value: valuation ? money.value(valuation.fair.base, 0) : '—' },
        {
          label: report && report.assumptions.netCash < 0 ? 'Net debt' : 'Net cash',
          value: report
            ? money.millions(Math.abs(report.assumptions.netCash), Math.abs(report.assumptions.netCash) < 100 ? 1 : 0)
            : '—',
        },
        {
          label: 'EV/EBITDA',
          value: multiples?.evEbitda !== undefined ? `${num(multiples.evEbitda, 1)}×` : '—',
        },
      ];
  const keyData = report
    ? report.keyFacts.filter((f) => !COVER_SKIP.has(f.label)).slice(0, size === 'hero' ? 5 : 8)
    : PENDING;

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!tilt || reduced || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--glare-x', `${((x + 0.5) * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty('--glare-y', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
  };

  return (
    <article
      ref={ref}
      className={`${styles.cover} ${styles[size]}`}
      data-tilt={tilt && !reduced ? 'on' : undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={`Cover of the initiation report on ${title}`}
      style={{ '--rx': '0deg', '--ry': '0deg' } as CSSProperties}
    >
      <div className={styles.sheet}>
        <header className={styles.head}>
          <span className={styles.house}>Uncovered Research</span>
          <span className={styles.kind}>Initiation of coverage</span>
          <span className={styles.date}>{date}</span>
        </header>

        <div className={styles.main}>
          <div className={styles.identity}>
            <p className={styles.sector}>
              {report
                ? `${report.company.sector} · ${report.company.country}`
                : `Sector · ${pending?.name ?? 'Country'}`}
            </p>
            <h2 className={styles.name}>{report?.company.shortName ?? title}</h2>
            <p className={styles.legal}>{legal}</p>
          </div>
          <Seal
            seed={seed}
            size={sealSize}
            monogram={monogram}
            submark={report?.company.founded ? `${country} · ${report.company.founded}` : country}
            ring={`${title} · Initiation of coverage · ${date}`}
            sheen
            duration={2200}
            className={styles.seal}
          />
        </div>

        {report ? (
          <p className={styles.headline}>{report.headline}</p>
        ) : (
          <p className={styles.headline}>
            <span className={styles.redact} style={{ width: '82%' }} />
            <span className={styles.redact} style={{ width: '54%' }} />
          </p>
        )}

        <div className={styles.value}>
          <div>
            <p className={styles.label}>{perShare ? 'Fair value per share' : 'Equity value'}</p>
            {valuation ? (
              <p className={styles.range}>
                {money.value(valuation.fair.low, 0)}
                <span>–</span>
                {money.value(valuation.fair.high, 0)}
              </p>
            ) : (
              <p className={styles.range}>
                <span className={styles.redact} style={{ width: '9rem', height: '1.6rem' }} />
              </p>
            )}
          </div>
          <dl className={styles.valueFacts}>
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.columns}>
          <section aria-label="Investment thesis">
            <h3 className={styles.colHead}>Thesis</h3>
            {report ? (
              <ol className={styles.thesis}>
                {report.thesis.map((t) => (
                  <li key={t.title}>
                    <strong>{t.title}.</strong> {size === 'page' ? <Cited text={t.body} /> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.waiting}>
                {[92, 70, 84, 60, 76].map((w, i) => (
                  <span key={i} className={styles.redact} style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </section>
          <section aria-label="Key data">
            <h3 className={styles.colHead}>Key data</h3>
            <dl className={styles.keyData}>
              {keyData.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd className="num">{f.value || <span className={styles.redact} style={{ width: '3.5rem' }} />}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className={styles.foot}>
          <Serial value={serialFor(seed, country)} />
          <span>{report ? `${report.sources.length} sources · every figure footnoted` : 'Sources pending'}</span>
        </footer>
      </div>
      <span className={styles.glare} aria-hidden="true" />
    </article>
  );
}

const PENDING = ['Share price', 'Revenue', 'EBITDA margin', 'Net profit', 'Employees'].map((label) => ({
  label,
  value: '',
}));

/** Identity facts the cover already shows elsewhere. */
const COVER_SKIP = new Set(['Ticker', 'ISIN', 'Founded', 'Registration', 'Website']);

function initials(name: string): string {
  const words = name
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(d|o|dd|doo|sp|ltd|plc|ag|gmbh|inc|sa|nv)$/i.test(w));
  return (
    words
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || 'U'
  ).slice(0, 3);
}
