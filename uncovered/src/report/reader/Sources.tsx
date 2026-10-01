import type { ReactNode } from 'react';
import type { Grade, Report, Source } from '../types';
import styles from './Sources.module.css';

export const GRADES: { grade: Grade; name: string; text: string }[] = [
  { grade: 'filed', name: 'Filed', text: 'Audited statements and regulatory filings.' },
  { grade: 'reported', name: 'Reported', text: 'Company releases, unaudited results, the financial press.' },
  { grade: 'estimated', name: 'Estimated', text: 'Our model. Always labelled, always changeable.' },
];

export function gradeName(grade: Grade): string {
  return GRADES.find((g) => g.grade === grade)!.name;
}

/** A source address without its scheme, shortened for reading. */
export function shortUrl(url: string, max = 60): string {
  const bare = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

const MARKER = /\[\^([\w-]+)\]/g;

/** How many times each source is cited across a report: prose, tables and model inputs. */
export function citationCounts(report: Report): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (id?: string) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  const texts = [
    report.summary,
    ...report.thesis.map((t) => t.body),
    ...report.sections.flatMap((s) => s.paragraphs),
    ...report.catalysts,
    ...report.risks.map((r) => r.body),
    report.assumptions.epsBasis ?? '',
  ];
  for (const t of texts) for (const m of t.matchAll(MARKER)) add(m[1]);
  report.keyFacts.forEach((f) => add(f.sourceId));
  report.income.forEach((l) => Object.values(l.sources ?? {}).forEach(add));
  [...report.regions, ...report.ownership].forEach((b) => add(b.sourceId));
  report.dividends.forEach((d) => add(d.sourceId));
  add(report.assumptions.netCashSource);
  add(report.assumptions.sharesSource);
  add(report.market?.priceSource);
  add(report.market?.highSource);
  return counts;
}

interface CardProps {
  source: Source;
  n: number;
  id?: string;
  className?: string;
  /** The title is a heading where the card stands in a section, plain text in a rail. */
  titleAs?: 'h3' | 'p';
  children?: ReactNode;
}

/** One source: its number, grade, title, publisher, the quoted sentence and its address. */
export function SourceCard({ source, n, id, className = '', titleAs: Title = 'p', children }: CardProps) {
  return (
    <article
      className={`${styles.card} ${className}`}
      id={id}
      data-grade={source.grade}
      aria-label={`Source ${n}: ${source.title}`}
    >
      <p className={styles.cardNo}>
        <span>Source {n}</span>
        <span className={styles.grade}>{gradeName(source.grade)}</span>
      </p>
      <Title className={styles.cardTitle}>{source.title}</Title>
      <p className={styles.publisher}>
        {source.publisher}
        {source.date ? ` · ${source.date}` : ''}
      </p>
      {source.quote && <blockquote className={styles.quote}>“{source.quote}”</blockquote>}
      <a className={styles.url} href={source.url} target="_blank" rel="noreferrer">
        {shortUrl(source.url)}
        <span className="visually-hidden"> (opens in a new tab)</span>
      </a>
      {children}
    </article>
  );
}

/** The three evidence grades, with how many of a report's sources carry each. */
export function GradeLegend({ sources, className = '' }: { sources?: Source[]; className?: string }) {
  return (
    <dl className={`${styles.grades} ${className}`}>
      {GRADES.map((g) => (
        <div key={g.grade} data-grade={g.grade}>
          <dt>
            <span className={styles.dot} aria-hidden="true" />
            {g.name}
            {sources && g.grade !== 'estimated' && (
              <span className={styles.count}>{sources.filter((s) => s.grade === g.grade).length}</span>
            )}
          </dt>
          <dd>{g.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The report's numbered source list, each entry addressable as #src-{id}. */
export function SourceList({
  report,
  active,
  counts,
}: {
  report: Report;
  active?: string | null;
  counts: Map<string, number>;
}) {
  return (
    <ol className={styles.list} role="list">
      {report.sources.map((s, i) => (
        <li key={s.id} id={`src-${s.id}`} className={styles.entry} data-grade={s.grade} data-active={active === s.id}>
          <span className={styles.entryNo}>{i + 1}</span>
          <div className={styles.entryBody}>
            <p className={styles.entryTitle}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </p>
            <p className={styles.entryMeta}>
              {s.publisher}
              {s.date ? ` · ${s.date}` : ''} · <span className={styles.grade}>{gradeName(s.grade)}</span> · cited{' '}
              {counts.get(s.id) ?? 0} {counts.get(s.id) === 1 ? 'time' : 'times'}
            </p>
            {s.quote && <blockquote className={styles.entryQuote}>“{s.quote}”</blockquote>}
            <p className={styles.entryUrl}>{shortUrl(s.url, 90)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
