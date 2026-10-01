import { usePageMeta } from '../app/routes';
import { Link, useLocation } from '../lib/router';
import { Seal } from '../seal/Seal';
import styles from './NotFound.module.css';

/** 404: a page nobody has covered, with its seal engraved from the address. */
export function NotFound() {
  const { path } = useLocation();
  usePageMeta('/404');
  return (
    <section className={`page ${styles.lost}`} aria-labelledby="lost-title">
      <Seal seed={path} size={260} ring={`${path} · No coverage found · Error 404`} monogram="404" />
      <div className={styles.copy}>
        <p className="eyebrow">Error 404</p>
        <h1 id="lost-title" data-page-focus tabIndex={-1} className={styles.title}>
          This page is <em>uncovered</em>.
        </h1>
        <p>Nobody has written anything here yet, not even us. Its seal is engraved from the address you typed.</p>
        <p className={styles.links}>
          <Link to="/">Back to the front page</Link>
          <Link to="/report/krka">Read the sample report</Link>
        </p>
      </div>
    </section>
  );
}
