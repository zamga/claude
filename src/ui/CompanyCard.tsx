import { FlatChart, useNearViewport } from '../chart/FlatChart';
import type { CompanySnapshot } from '../data/types';
import { formatPct, formatPrice } from '../engine/format';
import { Link } from '../lib/router';
import { ATLAS_EXTENT, quickChart } from '../model/quickChart';
import { PlimsollGlyph } from './Mark';
import styles from './CompanyCard.module.css';

export function CompanyCard({ company, level = 3 }: { company: CompanySnapshot; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const q = quickChart(company, 64, ATLAS_EXTENT);
  const ratio = q.value > 0 ? q.price / q.value : Number.POSITIVE_INFINITY;
  const implied =
    q.marketGrowth.kind === 'solved'
      ? `${formatPct(q.marketGrowth.value, 0)} growth a year at a ${formatPct(q.bearing.margin, 0)} margin`
      : q.marketGrowth.kind === 'beyond'
        ? `more than any growth rate at a ${formatPct(q.bearing.margin, 0)} margin`
        : 'less than no growth at all';
  return (
    <Link to={`/chart/${company.ticker.toLowerCase()}`} className={styles.card}>
      <div ref={ref} className={styles.thumb}>
        {near && (
          <FlatChart
            grid={q.grid}
            field={q.field}
            price={q.price}
            bearing={q.bearing}
            className={styles.canvas}
            label={`Chart of ${company.shortName}`}
          />
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Heading className={styles.name}>{company.shortName}</Heading>
          <PlimsollGlyph
            ratio={ratio}
            size={30}
            label={
              ratio > 1
                ? `Price above the as-it-is value of ${formatPrice(q.value)}`
                : `Price below the as-it-is value of ${formatPrice(q.value)}`
            }
          />
        </div>
        <p className={styles.meta}>
          {company.ticker} · {company.industryLabel}
        </p>
        <p className={styles.market}>
          <em>
            {formatPrice(q.price)} prices in {implied}.
          </em>
        </p>
      </div>
    </Link>
  );
}
