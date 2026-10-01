import { useId } from 'react';
import { formatPrice } from '../engine/format';
import styles from './HullGauge.module.css';

export interface HullGaugeProps {
  price: number;
  value: number;
  loadLine: number;
  p10: number;
  p90: number;
  /** Lay the gauge on its side for narrow screens. */
  orientation?: 'vertical' | 'horizontal';
}

/** Nice round price levels for draft marks between lo and hi. */
function draftLevels(lo: number, hi: number, count = 6): number[] {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

/**
 * The hull: a ship's side, painted with draft marks in dollars. The sea
 * stands at the share price. The Plimsoll mark sits at your load line
 * (your value less your margin of safety). Water above the mark means the
 * price is asking you to carry too much.
 */
export function HullGauge({ price, value, loadLine, p10, p90, orientation = 'vertical' }: HullGaugeProps) {
  const id = useId();
  const H = 520;
  const W = 150;
  const top = 18;
  const bottom = H - 18;
  const hullX = 58;
  const hullW = 54;

  const points = [price, value, loadLine, p10, p90].filter((v) => v > 0 && Number.isFinite(v));
  const lo = Math.max(0.01, Math.min(...points) / 1.35);
  const hi = Math.max(...points) * 1.18;
  const y = (v: number) => {
    const t = (Math.log(Math.max(v, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
    return bottom - t * (bottom - top);
  };

  const sea = y(price);
  const mark = loadLine > 0 ? y(loadLine) : bottom;
  const val = value > 0 ? y(value) : bottom;
  const overloaded = price > loadLine;
  const levels = draftLevels(lo, hi);
  // Drawn at y = 0 and moved into place, so a new price glides instead of jumping.
  const wave = `M -40 0 q 9 -4 18 0 t 18 0 t 18 0 t 18 0 t 18 0 t 18 0 t 18 0 t 18 0 t 18 0 t 18 0 t 18 0 V ${H} H -40 Z`;

  const summary = `Share price ${formatPrice(price)}. Your value ${formatPrice(value)}. Load line ${formatPrice(loadLine)}. ${
    overloaded ? 'The price is above your load line.' : 'The price is below your load line.'
  } 80% of soundings fall between ${formatPrice(p10)} and ${formatPrice(p90)}.`;

  return (
    <figure className={styles.gauge} data-orientation={orientation} data-overloaded={overloaded ? 'true' : 'false'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{summary}</title>
        <defs>
          <clipPath id={`${id}-hull`}>
            <path d={`M ${hullX} ${top} H ${hullX + hullW} V ${bottom - 30} Q ${hullX + hullW} ${bottom} ${hullX + hullW / 2} ${bottom} Q ${hullX} ${bottom} ${hullX} ${bottom - 30} Z`} />
          </clipPath>
        </defs>

        {/* Hull plating */}
        <path
          className={styles.hull}
          d={`M ${hullX} ${top} H ${hullX + hullW} V ${bottom - 30} Q ${hullX + hullW} ${bottom} ${hullX + hullW / 2} ${bottom} Q ${hullX} ${bottom} ${hullX} ${bottom - 30} Z`}
        />
        <g clipPath={`url(#${id}-hull)`}>
          {levels.map((v) => (
            <line key={v} x1={hullX} x2={hullX + 12} y1={y(v)} y2={y(v)} className={styles.tick} />
          ))}
        </g>

        {/* Draft marks */}
        {levels.map((v) => (
          <text key={v} x={hullX - 6} y={y(v)} className={styles.draft} textAnchor="end" dominantBaseline="middle">
            {formatPrice(v).replace('.00', '')}
          </text>
        ))}

        {/* P10–P90 bracket: where four in five soundings land */}
        <g className={styles.range}>
          <line x1={hullX + hullW + 14} x2={hullX + hullW + 14} y1={y(p90)} y2={y(p10)} />
          <line x1={hullX + hullW + 10} x2={hullX + hullW + 18} y1={y(p90)} y2={y(p90)} />
          <line x1={hullX + hullW + 10} x2={hullX + hullW + 18} y1={y(p10)} y2={y(p10)} />
        </g>

        {/* Plimsoll mark at the load line */}
        <g className={styles.mark} style={{ transform: `translate(${hullX + hullW / 2}px, ${mark}px)` }}>
          <circle r="11" />
          <line x1="-19" x2="19" y1="0" y2="0" />
        </g>

        {/* Your value */}
        <g className={styles.value} style={{ transform: `translateY(${val}px)` }}>
          <line x1={hullX - 2} x2={hullX + hullW + 2} y1="0" y2="0" />
          <path d={`M ${hullX + hullW + 2} 0 l 6 -4 v 8 z`} />
        </g>

        {/* The sea, standing at the price */}
        <g className={styles.sea} style={{ transform: `translateY(${sea}px)` }}>
          <path d={wave} className={styles.water} />
          <line x1="0" x2={W} y1="0" y2="0" className={styles.surface} />
        </g>
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.lSea}>
          <em>Sea level</em> {formatPrice(price)}
        </span>
        <span className={styles.lValue}>Your value {formatPrice(value)}</span>
        <span className={styles.lMark}>Load line {formatPrice(loadLine)}</span>
        <span className={styles.lRange}>
          80% of soundings {formatPrice(p10)}–{formatPrice(p90)}
        </span>
      </figcaption>
    </figure>
  );
}
