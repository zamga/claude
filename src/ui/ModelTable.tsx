import { formatMoney, formatPct, formatPrice } from '../engine/format';
import type { ValuationInputs, ValuationResult } from '../engine/types';
import styles from './Tables.module.css';

/** The forecast, year by year, and the bridge from operating value to a share price. */
export function ModelTable({ result, inputs }: { result: ValuationResult; inputs: ValuationInputs }) {
  const rows: Array<[string, (y: ValuationResult['years'][number]) => string]> = [
    ['Revenue growth', (y) => formatPct(y.growth, 1)],
    ['Revenue', (y) => formatMoney(y.revenue)],
    ['Operating margin', (y) => formatPct(y.margin, 1)],
    ['Operating income', (y) => formatMoney(y.ebit)],
    ['Tax rate', (y) => formatPct(y.taxRate, 0)],
    ['After-tax operating income', (y) => formatMoney(y.nopat)],
    ['Reinvestment', (y) => formatMoney(y.reinvestment)],
    ['Free cash flow', (y) => formatMoney(y.fcff)],
    ['Cost of capital', (y) => formatPct(y.costOfCapital, 1)],
    ['Present value', (y) => formatMoney(y.presentValue)],
  ];
  const t = result.terminal;
  return (
    <div className={styles.model}>
      <div className={styles.scroll} role="region" aria-label="Year-by-year forecast" tabIndex={0}>
        <table className={styles.table}>
          <caption className="visually-hidden">Ten-year forecast and terminal year, USD</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              {result.years.map((y) => (
                <th key={y.year} scope="col">
                  {y.year}
                </th>
              ))}
              <th scope="col">After 10</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f], k) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {result.years.map((y) => (
                  <td key={y.year}>{f(y)}</td>
                ))}
                <td className={styles.terminal}>
                  {
                    [
                      formatPct(inputs.terminalGrowth, 1),
                      formatMoney(t.revenue),
                      formatPct(inputs.targetMargin, 1),
                      formatMoney(t.ebit),
                      formatPct(inputs.marginalTaxRate, 0),
                      formatMoney(t.nopat),
                      `${formatPct(t.reinvestmentRate, 0)} of income`,
                      formatMoney(t.fcff),
                      formatPct(inputs.terminalCostOfCapital, 1),
                      formatMoney(t.presentValue),
                    ][k]
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className={styles.bridge} aria-label="From operating value to value per share">
        <div>
          <dt>Present value of years 1–10</dt>
          <dd>{formatMoney(result.pvCashFlows)}</dd>
        </div>
        <div>
          <dt>+ Present value after year 10</dt>
          <dd>{formatMoney(t.presentValue)}</dd>
        </div>
        <div className={styles.sum}>
          <dt>= Value of the operating business</dt>
          <dd>{formatMoney(result.operatingAssets)}</dd>
        </div>
        <div>
          <dt>+ Cash and investments</dt>
          <dd>{formatMoney(inputs.cash)}</dd>
        </div>
        {inputs.nonOperatingAssets > 0 && (
          <div>
            <dt>+ Stakes in other companies</dt>
            <dd>{formatMoney(inputs.nonOperatingAssets)}</dd>
          </div>
        )}
        <div>
          <dt>− Debt</dt>
          <dd>{formatMoney(inputs.debt)}</dd>
        </div>
        {inputs.minorityInterest > 0 && (
          <div>
            <dt>− Minority interests</dt>
            <dd>{formatMoney(inputs.minorityInterest)}</dd>
          </div>
        )}
        <div className={styles.sum}>
          <dt>= Value of the equity</dt>
          <dd>{formatMoney(result.equityValue)}</dd>
        </div>
        <div>
          <dt>÷ Shares</dt>
          <dd>{(inputs.shares / 1000).toFixed(2)}B</dd>
        </div>
        <div className={`${styles.sum} ${styles.total}`}>
          <dt>= Value per share</dt>
          <dd>{formatPrice(result.valuePerShare)}</dd>
        </div>
      </dl>
      <p className={styles.note}>
        {formatPct(result.terminalShare, 0)} of the operating value comes from beyond year ten.
      </p>
    </div>
  );
}
