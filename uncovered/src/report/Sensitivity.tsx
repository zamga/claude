import type { CSSProperties } from 'react';
import { eur, pct } from '../lib/format';
import type { Report } from './types';
import { sensitivity, wacc as waccOf } from './valuation';
import styles from './Sensitivity.module.css';

/**
 * DCF value per share across the cost of capital (columns) and terminal
 * growth (rows). Cells are shaded by their distance from the market price.
 */
export function Sensitivity({ report, compact = false }: { report: Report; compact?: boolean }) {
  const a = report.assumptions;
  const w0 = waccOf(a);
  const g0 = a.terminalGrowth;
  const waccs = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => w0 + d);
  const growths = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => g0 + d);
  const grid = sensitivity(a, report.base.revenue, waccs, growths);
  const price = report.market?.price;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        DCF value per share: cost of capital across, terminal growth down
        {price !== undefined ? `. Shaded by distance from the ${eur(price)} price.` : '.'}
      </figcaption>
      <div className={styles.scroll} role="region" aria-label="Sensitivity table" tabIndex={0}>
        <table className={`${styles.table} ${compact ? styles.compact : ''}`}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Terminal growth by cost of capital</span>
              </th>
              {waccs.map((w) => (
                <th key={w} scope="col" data-base={Math.abs(w - w0) < 1e-9}>
                  {pct(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {growths.map((g, r) => (
              <tr key={g}>
                <th scope="row" data-base={Math.abs(g - g0) < 1e-9}>
                  {pct(g)}
                </th>
                {grid[r]!.map((v, c) => {
                  const rel = price && Number.isFinite(v) ? v / price - 1 : 0;
                  const isBase = r === 2 && c === 2;
                  return (
                    <td
                      key={c}
                      data-base={isBase}
                      data-side={rel >= 0 ? 'above' : 'below'}
                      style={{ '--strength': Math.min(1, Math.abs(rel) / 0.35).toFixed(3) } as CSSProperties}
                    >
                      {Number.isFinite(v) ? eur(v, 0) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
