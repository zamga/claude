import { KRKA } from '../report/krka';
import { FootballField } from '../report/FootballField';
import { Sensitivity } from '../report/Sensitivity';
import { valueReport } from '../report/valuation';
import { eur, signedPct } from '../lib/format';
import { Link } from '../lib/router';
import styles from './ValuationSection.module.css';

const V = valueReport(KRKA);

export function ValuationSection() {
  return (
    <section className={styles.valuation} aria-labelledby="val-title">
      <div className={`page ${styles.head}`}>
        <div>
          <p className="eyebrow">Valuation</p>
          <h2 id="val-title" className={styles.title}>
            Three methods. One range. <em>The price on the same line.</em>
          </h2>
        </div>
        <p className={styles.copy}>
          Uncovered values a company the way a research desk does, then shows where the methods agree. For Krka the
          range runs from {eur(V.fair.low, 0)} to {eur(V.fair.high, 0)} a share. The shares were {eur(V.price ?? 0)},{' '}
          {signedPct(V.premium ?? 0)} against the middle of the range.
        </p>
      </div>
      <div className={`page ${styles.body}`}>
        <div className={styles.chart}>
          <FootballField
            valuation={V}
            high={{ value: KRKA.market!.high!, label: `High ${eur(KRKA.market!.high!, 0)}` }}
          />
        </div>
        <div className={styles.side}>
          <Sensitivity report={KRKA} compact />
          <Link to="/report/krka#valuation" className={styles.more}>
            Open the full model in the sample report
          </Link>
        </div>
      </div>
    </section>
  );
}
