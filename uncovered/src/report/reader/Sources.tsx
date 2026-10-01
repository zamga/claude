import type { ReactNode } from 'react';
import { proseOf } from '../bindings';
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

/** How a quotation was obtained, in words. */
export function quoteProvenance(source: Source): string | undefined {
  if (source.quoted === 'verbatim')
    return `Quoted word for word${source.page ? ` from page ${source.page}` : ''} and checked against the document as read.`;
  if (source.quoted === 'excerpt') return 'An excerpt found by search, condensed; not checked word for word.';
  return source.page ? `Page ${source.page}.` : undefined;
}

const MARKER = /\[\^([\w-]+)\]/g;

/** How many times each source is cited across a report: prose, tables and model inputs. */
export function citationCounts(report: Report): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (id?: string) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  for (const t of proseOf(report)) for (const m of t.matchAll(MARKER)) add(m[1]);
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

function Quotation({ source, className, noteClass }: { source: Source; className?: string; noteClass?: string }) {
  const provenance = quoteProvenance(source);
  if (!source.quote) return null;
  return (
    <>
      <blockquote className={className}>“{source.quote}”</blockquote>
      {source.translation && (
        <p className={styles.translation}>
          <span>Our translation</span> {source.translation}
        </p>
      )}
      {provenance && <p className={noteClass}>{provenance}</p>}
    </>
  );
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
        {source.supplied ? ' · supplied by the requester' : ''}
      </p>
      <Quotation source={source} className={styles.quote} noteClass={styles.provenance} />
      {source.url && (
        <a className={styles.url} href={source.url} target="_blank" rel="noreferrer">
          {shortUrl(source.url)}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      )}
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

interface Group {
  key: string;
  passages: { source: Source; n: number }[];
}

/** Consecutive passages from one document, together. */
function groupsOf(sources: Source[]): Group[] {
  const groups: Group[] = [];
  sources.forEach((source, i) => {
    const key = source.document ?? `source:${source.id}`;
    const last = groups.at(-1);
    if (last && last.key === key) last.passages.push({ source, n: i + 1 });
    else groups.push({ key, passages: [{ source, n: i + 1 }] });
  });
  return groups;
}

const cited = (counts: Map<string, number>, id: string) =>
  `cited ${counts.get(id) ?? 0} ${counts.get(id) === 1 ? 'time' : 'times'}`;

/** A document's title, linked to the document when it has an address (supplied documents have none). */
function DocumentTitle({ source }: { source: Source }) {
  return (
    <p className={styles.entryTitle}>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.title}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      ) : (
        source.title
      )}
    </p>
  );
}

/**
 * The report's numbered source list, each passage addressable as #src-{id}.
 * Passages quoted from the same document sit under that document's title.
 */
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
      {groupsOf(report.sources).map((group) => {
        const head = group.passages[0]!.source;
        if (group.passages.length === 1) {
          const { source: s, n } = group.passages[0]!;
          return (
            <li
              key={s.id}
              id={`src-${s.id}`}
              className={styles.entry}
              data-grade={s.grade}
              data-active={active === s.id}
            >
              <span className={styles.entryNo}>{n}</span>
              <div className={styles.entryBody}>
                <DocumentTitle source={s} />
                <p className={styles.entryMeta}>
                  {s.publisher}
                  {s.date ? ` · ${s.date}` : ''} · <span className={styles.grade}>{gradeName(s.grade)}</span>
                  {s.supplied ? ' · supplied by the requester' : ''} · {cited(counts, s.id)}
                </p>
                <Quotation source={s} className={styles.entryQuote} noteClass={styles.entryProvenance} />
                {s.url && <p className={styles.entryUrl}>{shortUrl(s.url, 90)}</p>}
              </div>
            </li>
          );
        }
        return (
          <li key={group.key} className={styles.document} data-grade={head.grade}>
            <div className={styles.documentHead}>
              <DocumentTitle source={head} />
              <p className={styles.entryMeta}>
                {head.publisher}
                {head.date ? ` · ${head.date}` : ''} · <span className={styles.grade}>{gradeName(head.grade)}</span>
                {head.supplied ? ' · supplied by the requester' : ''} · {group.passages.length} passages
              </p>
              {head.url && <p className={styles.entryUrl}>{shortUrl(head.url, 90)}</p>}
            </div>
            <ol className={styles.passages} role="list">
              {group.passages.map(({ source: s, n }) => (
                <li
                  key={s.id}
                  id={`src-${s.id}`}
                  className={styles.entry}
                  data-grade={s.grade}
                  data-active={active === s.id}
                >
                  <span className={styles.entryNo}>{n}</span>
                  <div className={styles.entryBody}>
                    <p className={styles.entryMeta}>
                      {s.page ? `Page ${s.page} · ` : ''}
                      {cited(counts, s.id)}
                    </p>
                    <Quotation source={s} className={styles.entryQuote} noteClass={styles.entryProvenance} />
                  </div>
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}
