import type { CSSProperties } from 'react';
import { moneyFor } from '../lib/format';
import { useSeen, useWidth } from '../lib/hooks';
import type { Valuation } from './valuation';
import styles from './FootballField.module.css';

/*
 * The football field: each valuation method as a range on one money axis,
 * the fair-value band where they meet, and the market price on the same line.
 * One axis, direct labels, a table equivalent for assistive technology. Per
 * share for a company with traded shares; the whole equity, in millions, for
 * one without.
 */

interface Props {
  valuation: Valuation;
  high?: { value: number; label: string };
  title?: string;
}

const ROW = 46;
const COLORS: Record<string, string> = {
  dcf: 'var(--method-dcf)',
  ddm: 'var(--method-ddm)',
  pe: 'var(--method-multiple)',
  ev: 'var(--method-multiple)',
};

/** A round step that gives about eight ticks across a span. */
export function niceStep(span: number, ticks = 8): number {
  const rough = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  return ([1, 2, 2.5, 5, 10].find((m) => m * mag >= rough) ?? 10) * mag;
}

export function FootballField({ valuation, high, title = 'Fair value per share by method' }: Props) {
  const [box, width] = useWidth<HTMLDivElement>(720);
  const [seenRef, seen] = useSeen<HTMLDivElement>('0px 0px 15% 0px');
  const { methods, fair, price } = valuation;
  const money = moneyFor(valuation.currency, valuation.basis);
  const v = (x: number) => money.value(x, 0);
  const narrow = width < 560;
  const labelW = narrow ? 0 : 190;
  const padR = 24;
  const values = [...methods.flatMap((m) => [m.low, m.high]), price ?? fair.base, high?.value ?? fair.base];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(Math.max(max - min, Math.abs(max) * 0.05, 1e-6));
  const lo = Math.floor((min - step * 0.6) / step) * step;
  const hi = Math.ceil((max + step * 0.4) / step) * step;
  const tickDigits = step < 1 ? 2 : 0;
  const plotW = Math.max(120, width - labelW - padR);
  const x = (v: number) => labelW + ((v - lo) / (hi - lo)) * plotW;
  // A strip above the rows carries the price and high labels, so they never sit on a bar.
  const rowsTop = narrow ? 52 : 40;
  const rowH = narrow ? ROW + 18 : ROW;
  const fairRow = methods.length;
  const height = rowsTop + (methods.length + 1) * rowH + 40;
  const markerTop = rowsTop - 20;
  // Price and high are labelled away from each other: the lower one to its left, the higher to its right.
  const highFirst = high !== undefined && price !== undefined && high.value < price;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  return (
    <figure className={styles.figure} ref={seenRef} data-play={seen ? 'true' : undefined}>
      <figcaption className="visually-hidden">{title}</figcaption>
      <div ref={box} className={styles.box}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="ff-desc">
          <desc id="ff-desc">
            {methods.map((m) => `${m.label}: ${v(m.low)} to ${v(m.high)}, base ${v(m.base)}.`).join(' ')} Fair value
            range {v(fair.low)} to {v(fair.high)}.{price !== undefined ? ` Share price ${money.amount(price)}.` : ''}
          </desc>

          {/* Fair-value band, drawn across every row. */}
          <rect
            className={styles.band}
            x={x(fair.low)}
            y={rowsTop - 6}
            width={x(fair.high) - x(fair.low)}
            height={(methods.length + 1) * rowH + 4}
          />

          {ticks.map((t) => (
            <g key={t} className={styles.tick}>
              <line x1={x(t)} x2={x(t)} y1={rowsTop - 6} y2={height - 30} />
              <text x={x(t)} y={height - 12} textAnchor="middle">
                {money.value(t, tickDigits)}
              </text>
            </g>
          ))}

          {methods.map((m, i) => {
            const y = rowsTop + i * rowH + (narrow ? 18 : 0);
            return (
              <g key={m.id} className={styles.row} style={{ '--i': i } as CSSProperties}>
                {narrow ? (
                  <text className={styles.rowLabel} x={0} y={y - 6}>
                    {m.label}
                  </text>
                ) : (
                  <text className={styles.rowLabel} x={0} y={y + 18}>
                    {m.label}
                  </text>
                )}
                <rect
                  className={styles.bar}
                  x={x(m.low)}
                  y={y + 6}
                  width={x(m.high) - x(m.low)}
                  height={18}
                  rx={2}
                  fill={COLORS[m.id]}
                  style={{ transformOrigin: `${x(m.low)}px ${y + 15}px` }}
                />
                <line className={styles.baseTick} x1={x(m.base)} x2={x(m.base)} y1={y + 2} y2={y + 28} />
                <text className={styles.value} x={x(m.low) - 6} y={y + 19} textAnchor="end">
                  {v(m.low)}
                </text>
                <text className={styles.value} x={x(m.high) + 6} y={y + 19}>
                  {v(m.high)}
                </text>
              </g>
            );
          })}

          <g className={styles.fairRow} style={{ '--i': methods.length } as CSSProperties}>
            <text
              className={`${styles.rowLabel} ${styles.fairLabel}`}
              x={0}
              y={rowsTop + fairRow * rowH + (narrow ? 12 : 18)}
            >
              Fair value range
            </text>
            <rect
              className={styles.fairBar}
              x={x(fair.low)}
              y={rowsTop + fairRow * rowH + (narrow ? 22 : 6)}
              width={x(fair.high) - x(fair.low)}
              height={18}
            />
            <text
              className={styles.fairValue}
              x={(x(fair.low) + x(fair.high)) / 2}
              y={rowsTop + fairRow * rowH + (narrow ? 35 : 19)}
              textAnchor="middle"
            >
              {v(fair.low)} – {v(fair.high)}
            </text>
          </g>

          {high && (
            <g className={styles.high}>
              <line x1={x(high.value)} x2={x(high.value)} y1={markerTop} y2={height - 30} />
              <text x={x(high.value) + (highFirst ? -6 : 6)} y={markerTop - 2} textAnchor={highFirst ? 'end' : 'start'}>
                {high.label}
              </text>
            </g>
          )}
          {price !== undefined && (
            <g className={styles.price}>
              <line x1={x(price)} x2={x(price)} y1={markerTop - 12} y2={height - 30} />
              <text
                x={x(price) + (high && !highFirst ? -6 : 6)}
                y={markerTop - 2}
                textAnchor={high && !highFirst ? 'end' : 'start'}
              >
                Price {money.amount(price)}
              </text>
            </g>
          )}
        </svg>
      </div>
      <table className="visually-hidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Low</th>
            <th scope="col">Base</th>
            <th scope="col">High</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((m) => (
            <tr key={m.id}>
              <th scope="row">{m.label}</th>
              <td>{v(m.low)}</td>
              <td>{v(m.base)}</td>
              <td>{v(m.high)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Fair value range</th>
            <td>{v(fair.low)}</td>
            <td>{v(fair.base)}</td>
            <td>{v(fair.high)}</td>
          </tr>
        </tbody>
      </table>
      <ul className={styles.legend} role="list">
        {methods.map((m) => (
          <li key={m.id}>
            <span className={styles.swatch} style={{ background: COLORS[m.id] }} aria-hidden="true" />
            <strong>{m.label}</strong> <span>{m.detail}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
