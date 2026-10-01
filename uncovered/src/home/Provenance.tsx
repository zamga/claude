import { Fragment, useState } from 'react';
import { KRKA } from '../report/krka';
import { Cited, FootnoteProvider } from '../report/Footnotes';
import { GradeLegend, SourceCard } from '../report/reader/Sources';
import { href } from '../lib/router';
import styles from './Provenance.module.css';

const PARAGRAPHS = KRKA.sections.find((s) => s.id === 'financials')!.paragraphs.slice(0, 2);

const numberOf = (id: string) => KRKA.sources.findIndex((s) => s.id === id) + 1;

/** The paragraph a source is first cited in, where its card unfolds on narrow screens. */
function paragraphOf(id: string): number {
  return Math.max(
    0,
    PARAGRAPHS.findIndex((p) => p.includes(`[^${id}]`)),
  );
}

/**
 * Every number has a source. On wide screens the source card sits in a rail
 * and follows hover or focus; on phones a tapped note unfolds its card under
 * the paragraph it belongs to.
 */
export function Provenance() {
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState('r25');
  const id = focus ?? pinned;
  const source = KRKA.sources.find((s) => s.id === id)!;
  const at = paragraphOf(pinned);
  const pinnedSource = KRKA.sources.find((s) => s.id === pinned)!;

  return (
    <section className={styles.provenance} aria-labelledby="prov-title">
      <div className={`page ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Provenance</p>
          <h2 id="prov-title" className={styles.title}>
            Every number has a <em>source</em>.
          </h2>
          <FootnoteProvider
            sources={KRKA.sources}
            prefix="prov"
            scrollBlock="nearest"
            hrefFor={(sid) => href(`/report/krka#src-${sid}`)}
            onFocusSource={(s) => {
              setFocus(s);
              if (s) setPinned(s);
            }}
          >
            <div className={styles.excerpt}>
              <p className={styles.kicker}>From the Krka initiation, financial performance</p>
              {PARAGRAPHS.map((p, i) => (
                <Fragment key={p.slice(0, 24)}>
                  <p>
                    <Cited text={p} />
                  </p>
                  {i === at && (
                    <SourceCard
                      key={pinnedSource.id}
                      source={pinnedSource}
                      n={numberOf(pinnedSource.id)}
                      id={`prov-${pinnedSource.id}`}
                      className={styles.inlineCard}
                      titleAs="h3"
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </FootnoteProvider>
        </div>

        <aside className={styles.rail} aria-label="Source">
          <SourceCard source={source} n={numberOf(source.id)} className={styles.railCard} titleAs="h3" />
          <GradeLegend />
        </aside>
      </div>
    </section>
  );
}
