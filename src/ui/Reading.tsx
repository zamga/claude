import { formatOdds, formatPct, formatPrice, formatSignedPct } from '../engine/format';
import type { Solved } from '../engine/reverse';
import { STANDING_LABEL } from '../model/copy';
import type { Standing } from '../model/useAnalysis';
import styles from './Reading.module.css';

export interface ReadingProps {
  value: number;
  price: number;
  freeboard: number;
  standing: Standing;
  odds: number;
  draws: number;
  bearingMargin: number;
  marketGrowth: Solved;
  stale?: boolean;
}

/**
 * The four numbers that matter, in the order a reader needs them:
 * what you think it is worth, how much room that leaves, how sure you can
 * be, and what the market must believe.
 */
export function Reading({ value, price, freeboard, standing, odds, draws, bearingMargin, marketGrowth, stale }: ReadingProps) {
  return (
    <dl className={styles.reading} aria-label="Reading" data-stale={stale ? 'true' : undefined}>
      <div className={styles.cell}>
        <dt>Your value</dt>
        <dd>
          <span className={styles.big}>{value > 0 ? formatPrice(value) : '$0'}</span>
          <span className={styles.sub}>per share, on your bearing</span>
        </dd>
      </div>
      <div className={styles.cell}>
        <dt>
          Freeboard <span className={styles.gloss}>margin of safety</span>
        </dt>
        <dd>
          <span className={styles.big}>{Number.isFinite(freeboard) ? formatSignedPct(freeboard, 0) : '—'}</span>
          <span className={styles.chip} data-standing={standing}>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              {standing === 'under' ? (
                <path d="M2 9c2-2 4 2 6 0s4 2 6 0M2 13c2-2 4 2 6 0s4 2 6 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
              ) : standing === 'thin' ? (
                <path d="M2 11h12M5 7h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              ) : (
                <path d="M3 12l3-5 2 3 2-4 3 6z" fill="currentColor" />
              )}
            </svg>
            {STANDING_LABEL[standing]}
          </span>
        </dd>
      </div>
      <div className={styles.cell}>
        <dt>Odds on dry land</dt>
        <dd>
          <span className={styles.big}>{formatOdds(odds)}</span>
          <span className={styles.sub}>of {draws.toLocaleString('en-US')} soundings beat {formatPrice(price)}</span>
        </dd>
      </div>
      <div className={`${styles.cell} ${styles.market}`}>
        <dt>
          <em>The market’s story</em>
        </dt>
        <dd>
          {marketGrowth.kind === 'solved' ? (
            <>
              <span className={styles.bigWater}>{formatPct(marketGrowth.value, 0)}</span>
              <span className={styles.sub}>
                <em>growth a year for five years, at your {formatPct(bearingMargin, 0)} margin</em>
              </span>
            </>
          ) : (
            <>
              <span className={styles.bigWater}>{marketGrowth.kind === 'beyond' ? 'Off the chart' : 'Below zero'}</span>
              <span className={styles.sub}>
                <em>
                  {marketGrowth.kind === 'beyond'
                    ? `no growth rate reaches the price at a ${formatPct(bearingMargin, 0)} margin`
                    : 'the price holds even if revenue shrinks'}
                </em>
              </span>
            </>
          )}
        </dd>
      </div>
    </dl>
  );
}
