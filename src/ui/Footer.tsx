import { CHART_DATUM, COMPANIES } from '../data/companies';
import { MARKET } from '../data/market';
import { formatDate, formatPct } from '../engine/format';
import { Link } from '../lib/router';
import { PlimsollMark } from './Mark';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.neatline} aria-hidden="true" />
      <div className={`page ${styles.grid}`}>
        <div className={styles.brand}>
          <PlimsollMark size={44} />
          <p className={styles.motto}>
            Know the line.
            <span>Company analysis and valuation, drawn as a chart.</span>
          </p>
        </div>

        <nav aria-label="Footer" className={styles.col}>
          <h2 className={styles.head}>Chart</h2>
          <ul role="list">
            <li>
              <Link to="/atlas">Atlas</Link>
            </li>
            <li>
              <Link to="/survey">Survey your own</Link>
            </li>
            <li>
              <Link to="/method">Method & sources</Link>
            </li>
          </ul>
        </nav>

        <div className={styles.col}>
          <h2 className={styles.head}>Chart datum</h2>
          <dl className={styles.datum}>
            <div>
              <dt>Prices</dt>
              <dd>Closes, {formatDate(CHART_DATUM)}</dd>
            </div>
            <div>
              <dt>Risk-free rate</dt>
              <dd>{formatPct(MARKET.riskFreeRate, 2)} (10-year Treasury)</dd>
            </div>
            <div>
              <dt>Surveyed</dt>
              <dd>{COMPANIES.length} companies, latest annual reports</dd>
            </div>
          </dl>
        </div>

        <div className={styles.col}>
          <h2 className={styles.head}>Fine print</h2>
          <p className={styles.fine}>
            Plimsoll is a modelling tool, not investment advice. Every chart is the output of assumptions you can see
            and change. Figures can contain errors; check them against the filings before you rely on them.
          </p>
        </div>
      </div>
      <div className={`page ${styles.base}`}>
        <span>© 2026 Plimsoll</span>
        <span>Set in Newsreader and Archivo. Charts drawn with WebGL.</span>
      </div>
    </footer>
  );
}
