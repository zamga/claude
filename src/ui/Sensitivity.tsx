import { formatPct, formatPrice } from '../engine/format';
import type { SensitivityRow } from '../engine/sensitivity';
import styles from './Tables.module.css';

/**
 * Value per share across cost of capital and growth in perpetuity, the
 * two inputs a valuation is most sensitive to. Cells at or above the price
 * are tinted land; below it, water. The centre cell is your bearing.
 */
export function Sensitivity({ rows, price }: { rows: SensitivityRow[]; price: number }) {
  const centreRow = Math.floor(rows.length / 2);
  const centreCol = Math.floor((rows[0]?.cells.length ?? 1) / 2);
  return (
    <div className={styles.scroll} role="region" aria-label="Sensitivity table" tabIndex={0}>
      <table className={`${styles.table} ${styles.grid}`}>
        <caption className="visually-hidden">
          Value per share by cost of capital (rows) and growth after year ten (columns). Price {formatPrice(price)}.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}>
              Cost of capital ↓ / growth after year 10 →
            </th>
            {rows[0]?.cells.map((c) => (
              <th key={c.terminalGrowth} scope="col">
                {formatPct(c.terminalGrowth, 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.costOfCapital}>
              <th scope="row">{formatPct(r.costOfCapital, 1)}</th>
              {r.cells.map((c, j) => (
                <td
                  key={c.terminalGrowth}
                  data-zone={c.value >= price ? 'land' : 'water'}
                  data-centre={i === centreRow && j === centreCol ? 'true' : undefined}
                >
                  {formatPrice(c.value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
