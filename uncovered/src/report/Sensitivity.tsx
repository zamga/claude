import type { CSSProperties } from 'react';
import { moneyFor, pct } from '../lib/format';
import type { Report } from './types';
import { basisOf, sensitivity, wacc as waccOf } from './valuation';
import styles from './Sensitivity.module.css';

/**
 * DCF value across the cost of capital (columns) and terminal growth (rows):
 * per share, or for the whole equity of a company without traded shares.
 * With a market price, cells are shaded by their distance from it; without
 * one, by their distance from the base case.
 */
export function Sensitivity({ report, compact = false }: { report: Report; compact?: boolean }) {
  const a = report.assumptions;
  const basis = basisOf(a);
  const money = moneyFor(report.currency, basis);
  const w0 = waccOf(a);
  const g0 = a.terminalGrowth;
  const waccs = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => w0 + d);
  const growths = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => g0 + d);
  const grid = sensitivity(a, report.base.revenue, waccs, growths);
  const price = basis === 'share' ? report.market?.price : undefined;
  const anchor = price ?? grid[2]?.[2];

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        {basis === 'share' ? 'DCF value per share' : `DCF equity value, ${money.symbol} millions`}: cost of capital
        across, terminal growth down
        {price !== undefined
          ? `. Shaded by distance from the ${money.amount(price)} price.`
          : '. Shaded by distance from the base case.'}
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
                  const rel = anchor && Number.isFinite(v) ? v / anchor - 1 : 0;
                  const isBase = r === 2 && c === 2;
                  return (
                    <td
                      key={c}
                      data-base={isBase}
                      data-side={rel >= 0 ? 'above' : 'below'}
                      style={{ '--strength': Math.min(1, Math.abs(rel) / 0.35).toFixed(3) } as CSSProperties}
                    >
                      {Number.isFinite(v) ? money.value(v, 0) : '—'}
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
