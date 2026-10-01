import { useEffect } from 'react';
import { Link } from '../lib/router';
import styles from './NotFound.module.css';

/** Uncharted waters: the old map-maker's warning. */
export function NotFound() {
  useEffect(() => {
    document.title = 'Uncharted · Plimsoll';
  }, []);
  return (
    <section className={`page ${styles.lost}`} aria-labelledby="lost-title">
      <svg viewBox="0 0 420 160" className={styles.serpent} aria-hidden="true">
        {Array.from({ length: 7 }, (_, k) => (
          <path
            key={k}
            d={`M ${10 + k * 4} ${110 - k * 3} C 70 ${20 - k * 4}, 120 ${20 - k * 4}, 160 ${90 - k * 2} S 250 ${150 + k * 2}, 290 ${70 - k * 3} S 370 ${10 + k}, ${410 - k * 3} ${60 + k * 4}`}
          />
        ))}
      </svg>
      <p className="eyebrow">Error 404</p>
      <h1 id="lost-title" data-page-focus tabIndex={-1} className={styles.title}>
        <em>Here be dragons.</em>
      </h1>
      <p className={styles.text}>
        This part of the chart has not been surveyed. The address may be mistyped, or the company may not be in the atlas
        yet.
      </p>
      <div className={styles.actions}>
        <Link to="/atlas" className={styles.primary}>
          Back to the atlas
        </Link>
        <Link to="/survey">Survey a company yourself</Link>
      </div>
    </section>
  );
}
