import { useId, useMemo, useState } from 'react';
import { formatOdds, formatPrice } from '../engine/format';
import { histogram, percentile } from '../engine/stats';
import { useWidth } from '../lib/useWidth';
import type { MonteCarloResult } from '../engine/types';
import styles from './Soundings.module.css';

interface SoundingsProps {
  mc: MonteCarloResult;
  price: number;
  value: number;
  loadLine: number;
}

const H = 250;
const PAD = { top: 30, right: 12, bottom: 40, left: 12 };

/**
 * Value distribution from the Monte Carlo soundings. Columns above the
 * price are land, below it water; the sea level, load line and your value
 * are marked. Every bin is a focusable target with its count.
 */
export function Soundings({ mc, price, value, loadLine }: SoundingsProps) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, W] = useWidth<HTMLDivElement>(720, 280);
  // About one bin per 26px, so columns stay thin at any width.
  const BINS = Math.max(16, Math.min(44, Math.round(W / 26)));
  const { bins, lo, hi, max } = useMemo(() => {
    const lo0 = percentile(mc.values, 0.01);
    const hi0 = percentile(mc.values, 0.99);
    const lo = Math.max(0, Math.min(lo0, price * 0.8, value * 0.9));
    const hi = Math.max(hi0, price * 1.15, value * 1.1);
    const bins = histogram(mc.values, lo, hi, BINS);
    return { bins, lo, hi, max: Math.max(1, ...bins.map((b) => b.count)) };
  }, [mc, price, value, BINS]);

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (v: number) => PAD.left + ((v - lo) / (hi - lo)) * iw;
  const bw = iw / BINS;
  const barW = Math.min(24, bw - 2);
  const yBase = PAD.top + ih;
  const ticks = [mc.p10, mc.p50, mc.p90];
  const hovered = hover !== null ? bins[hover] : null;

  return (
    <figure className={styles.figure}>
      <div className={styles.svgWrap} ref={wrapRef}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-labelledby={`${id}-desc`}>
          <desc id={`${id}-desc`}>
            Histogram of {mc.draws.toLocaleString('en-US')} values. Middle value {formatPrice(mc.p50)}; four in five fall between{' '}
            {formatPrice(mc.p10)} and {formatPrice(mc.p90)}. {formatOdds(mc.probAbovePrice)} are worth more than the price
            of {formatPrice(price)}.
          </desc>
          <line x1={PAD.left} x2={W - PAD.right} y1={yBase} y2={yBase} className={styles.axis} />
          {bins.map((b, i) => {
            const h = (b.count / max) * ih;
            const cx = PAD.left + bw * i + bw / 2;
            const land = (b.x0 + b.x1) / 2 >= price;
            const r = Math.min(4, barW / 2, h);
            const path =
              h <= 0
                ? ''
                : `M ${cx - barW / 2} ${yBase} V ${yBase - h + r} Q ${cx - barW / 2} ${yBase - h} ${cx - barW / 2 + r} ${yBase - h} H ${cx + barW / 2 - r} Q ${cx + barW / 2} ${yBase - h} ${cx + barW / 2} ${yBase - h + r} V ${yBase} Z`;
            return (
              <g key={i}>
                <path d={path} className={land ? styles.land : styles.water} data-active={hover === i ? 'true' : undefined} />
                <rect
                  x={PAD.left + bw * i}
                  y={PAD.top}
                  width={bw}
                  height={ih}
                  className={styles.hit}
                  tabIndex={b.count > 0 ? 0 : -1}
                  role="img"
                  aria-label={`${b.count} soundings between ${formatPrice(b.x0)} and ${formatPrice(b.x1)}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}

          {/* Sea level */}
          <line x1={x(price)} x2={x(price)} y1={PAD.top - 14} y2={yBase} className={styles.sea} />
          <text x={x(price)} y={PAD.top - 18} className={styles.seaLabel} textAnchor="middle">
            Sea level {formatPrice(price)}
          </text>
          {/* Load line */}
          {loadLine > lo && loadLine < hi && (
            <line x1={x(loadLine)} x2={x(loadLine)} y1={PAD.top} y2={yBase} className={styles.load} />
          )}
          {/* Your value */}
          {value > lo && value < hi && (
            <g>
              <line x1={x(value)} x2={x(value)} y1={PAD.top + 6} y2={yBase} className={styles.value} />
              <circle cx={x(value)} cy={PAD.top + 6} r={4} className={styles.valueDot} />
            </g>
          )}

          {ticks.map((t, k) => (
            <g key={k}>
              <line x1={x(t)} x2={x(t)} y1={yBase} y2={yBase + 5} className={styles.axis} />
              <text x={x(t)} y={yBase + 18} className={styles.tick} textAnchor="middle">
                {['P10', 'Median', 'P90'][k]} {formatPrice(t)}
              </text>
            </g>
          ))}
        </svg>
        {hovered && (
          <div
            className={styles.tip}
            style={{ left: `${PAD.left + bw * hover! + bw / 2}px` }}
            aria-hidden="true"
          >
            <strong>{hovered.count}</strong> soundings
            <span>
              {formatPrice(hovered.x0)}–{formatPrice(hovered.x1)}
            </span>
          </div>
        )}
      </div>
      <figcaption className={styles.legend}>
        <span className={styles.kLand}>Worth more than the price</span>
        <span className={styles.kWater}>Worth less</span>
        <span className={styles.kValue}>Your value</span>
        <span className={styles.kLoad}>Load line</span>
      </figcaption>
    </figure>
  );
}
