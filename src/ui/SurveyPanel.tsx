import { useState } from 'react';
import { formatMoney, formatMultiple, formatPct } from '../engine/format';
import type { CompanySnapshot } from '../data/types';
import type { Survey } from '../model/survey';
import { useWidth } from '../lib/useWidth';
import styles from './SurveyPanel.module.css';

const H = 160;
const PAD = { top: 22, right: 8, bottom: 26, left: 8 };

/** Two small multiples (one measure each, never two axes) plus the facts that feed the defaults. */
export function SurveyPanel({ company, survey }: { company: CompanySnapshot; survey: Survey }) {
  const h = company.history;
  const margins = h.map((y) => (y.revenue > 0 ? y.operatingIncome / y.revenue : 0));
  return (
    <div className={styles.panel}>
      <div className={styles.charts}>
        <Columns
          title="Revenue"
          values={h.map((y) => y.revenue)}
          labels={h.map((y) => y.fy.replace(/^FY20/, '’'))}
          format={formatMoney}
        />
        <Columns
          title="Operating margin"
          values={margins}
          labels={h.map((y) => y.fy.replace(/^FY20/, '’'))}
          format={(v) => formatPct(v, 1)}
        />
      </div>
      <dl className={styles.facts}>
        <Fact label="Revenue growth, last year" value={survey.lastGrowth === null ? '—' : formatPct(survey.lastGrowth, 1)} />
        <Fact
          label={`Compound growth, ${survey.historyYears - 1} years`}
          value={survey.historicalCagr === null ? '—' : formatPct(survey.historicalCagr, 1)}
        />
        <Fact label="Average operating margin" value={formatPct(survey.averageMargin, 1)} />
        <Fact label="Effective tax rate" value={survey.effectiveTaxRate === null ? '—' : formatPct(survey.effectiveTaxRate, 1)} />
        <Fact label="Return on invested capital" value={survey.roic === null ? 'n/m' : formatPct(survey.roic, 0)} />
        <Fact
          label="Revenue per $1 of capital"
          value={survey.salesToCapital === null ? 'n/m' : `$${survey.salesToCapital.toFixed(2)}`}
        />
        <Fact label="Market value of equity" value={formatMoney(survey.marketCap)} />
        <Fact label="Enterprise value" value={formatMoney(survey.enterpriseValue)} />
        <Fact label="EV / revenue" value={formatMultiple(survey.evToRevenue)} />
        <Fact label="EV / operating income" value={survey.evToEbit === null ? 'n/m' : formatMultiple(survey.evToEbit)} />
        <Fact label="Price / earnings" value={survey.priceToEarnings === null ? 'n/m' : formatMultiple(survey.priceToEarnings)} />
        <Fact label="Net cash (debt)" value={formatMoney(survey.cashAndInvestments - survey.debt)} />
      </dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Columns({
  title,
  values,
  labels,
  format,
}: {
  title: string;
  values: number[];
  labels: string[];
  format: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [ref, W] = useWidth<HTMLElement>(320, 200);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / (max - min || 1)) * ih;
  const slot = iw / values.length;
  const bw = Math.min(24, slot - 8);
  const zero = y(0);
  const last = values.length - 1;
  return (
    <figure className={styles.figure} ref={ref}>
      <figcaption className={styles.title}>
        {title}
        <span className={styles.latest}>{format(values[last] ?? 0)}</span>
      </figcaption>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${title}: ${labels.map((l, i) => `${l} ${format(values[i]!)}`).join(', ')}`}>
        <line x1={PAD.left} x2={W - PAD.right} y1={zero} y2={zero} className={styles.base} />
        {values.map((v, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = Math.min(y(v), zero);
          const h = Math.abs(y(v) - zero);
          const r = Math.min(4, h, bw / 2);
          const up = v >= 0;
          const d = up
            ? `M ${cx - bw / 2} ${zero} V ${top + r} Q ${cx - bw / 2} ${top} ${cx - bw / 2 + r} ${top} H ${cx + bw / 2 - r} Q ${cx + bw / 2} ${top} ${cx + bw / 2} ${top + r} V ${zero} Z`
            : `M ${cx - bw / 2} ${zero} V ${zero + h - r} Q ${cx - bw / 2} ${zero + h} ${cx - bw / 2 + r} ${zero + h} H ${cx + bw / 2 - r} Q ${cx + bw / 2} ${zero + h} ${cx + bw / 2} ${zero + h - r} V ${zero} Z`;
          return (
            <g key={i}>
              <path d={d} className={up ? styles.bar : styles.barNeg} data-active={active === i || (active === null && i === last) ? 'true' : undefined} />
              {(active === i || (active === null && i === last)) && (
                <text x={cx} y={up ? top - 6 : zero + h + 14} className={styles.value} textAnchor="middle">
                  {format(v)}
                </text>
              )}
              <text x={cx} y={H - 8} className={styles.label} textAnchor="middle">
                {labels[i]}
              </text>
              <rect
                x={PAD.left + slot * i}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
