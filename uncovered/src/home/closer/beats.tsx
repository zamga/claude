import type { ReactNode } from 'react';
import { KRKA } from '../../report/krka';
import { FILM } from './film';
import styles from './Closer.module.css';

/*
 * What "Look closer" says at each of its three photographs, shared by the
 * film and the contact sheet that stands in for it.
 */

const FACT = KRKA.keyFacts.find((f) => f.label === 'Revenue 2025')!;
export const SOURCE = KRKA.sources.find((s) => s.id === FACT.sourceId)!;
export const SOURCE_NUMBER = KRKA.sources.indexOf(SOURCE) + 1;
const PUBLISHED = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
  new Date(`${SOURCE.date!.slice(0, 7)}-15T12:00:00Z`),
);
export const LAST = FILM.frames - 1;
export const STOPS = [0, LAST / 2, LAST];
export const MM_PER_PX_OF_COVER = FILM.mmPerCss;

export interface Beat {
  kicker: string;
  /** One line of a sentence that runs across the three photographs. */
  title: string;
  /** The source, set legibly: the words the microtext prints. */
  line?: string;
  body: ReactNode;
  alt: string;
  /** What the contact sheet says under this photograph. */
  caption: string;
}

export const BEATS: Beat[] = [
  {
    kicker: 'Under the lens',
    title: 'Look closer.',
    body: 'Every figure on an Uncovered cover can be checked. Follow one down to its source.',
    alt: 'The Krka cover on a desk.',
    caption: 'The cover of the Krka initiation, as printed.',
  },
  {
    kicker: `${FACT.label.replace(/ (\d{4})$/, ', $1')} · ${FACT.value}`,
    title: 'One figure,',
    body: 'As the cover prints it, with a line of type beneath it too small to read at arm’s length.',
    alt: `Its revenue figure, ${FACT.value}, magnified.`,
    caption: 'Closer: the revenue figure in the cover’s key data.',
  },
  {
    kicker: 'Printed beneath it',
    title: 'and its source.',
    line: `Reported · ${SOURCE.publisher} · ${PUBLISHED}`,
    body: (
      <>
        Who published the figure, and when. In the report it is source {SOURCE_NUMBER}, “{SOURCE.title}”, quoted.
      </>
    ),
    alt: `The microtext beneath it: Reported, ${SOURCE.publisher}, ${PUBLISHED}.`,
    caption: 'Closer still: the microtext printed beneath it.',
  },
];

export function Heading({ id }: { id?: string }) {
  return (
    <h2 id={id} className={styles.title}>
      {BEATS[0]!.title}
    </h2>
  );
}
