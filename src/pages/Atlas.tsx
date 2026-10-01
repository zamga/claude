import { useEffect, useMemo, useState } from 'react';
import { COMPANIES, CHART_DATUM } from '../data/companies';
import { formatDate } from '../engine/format';
import { ATLAS_EXTENT, quickChart } from '../model/quickChart';
import { CompanyCard } from '../ui/CompanyCard';
import styles from './Atlas.module.css';

type Order = 'name' | 'expectations' | 'freeboard';

const ORDERS: { id: Order; label: string }[] = [
  { id: 'name', label: 'A to Z' },
  { id: 'expectations', label: 'Highest expectations' },
  { id: 'freeboard', label: 'Most freeboard' },
];

export function Atlas() {
  const [order, setOrder] = useState<Order>('name');
  useEffect(() => {
    document.title = 'Atlas of company valuations · Plimsoll';
  }, []);

  const sorted = useMemo(() => {
    const rows = COMPANIES.map((c) => {
      const q = quickChart(c, 64, ATLAS_EXTENT);
      return {
        c,
        implied: q.marketGrowth.kind === 'solved' ? q.marketGrowth.value : q.marketGrowth.kind === 'beyond' ? 9 : -9,
        freeboard: q.value > 0 ? (q.value - q.price) / q.value : -9,
      };
    });
    if (order === 'name') rows.sort((a, b) => a.c.shortName.localeCompare(b.c.shortName));
    if (order === 'expectations') rows.sort((a, b) => b.implied - a.implied);
    if (order === 'freeboard') rows.sort((a, b) => b.freeboard - a.freeboard);
    return rows.map((r) => r.c);
  }, [order]);

  return (
    <div className={`page ${styles.atlas}`}>
      <header className={styles.head}>
        <p className="eyebrow">Atlas</p>
        <h1 data-page-focus tabIndex={-1} className={styles.title}>
          Every surveyed company.
        </h1>
        <p className={styles.lede}>
          Every chart here shares one window, growth from −10% to 60% and margin from −10% to 70%, so coastlines compare
          at a glance. The cross marks the company as it is today; the italic line says what the price assumes instead.
          Prices are closes on {formatDate(CHART_DATUM)}.
        </p>
      </header>
      <div className={styles.controls} role="radiogroup" aria-label="Order">
        {ORDERS.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={order === o.id} onClick={() => setOrder(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      <ul className={styles.grid} role="list">
        {sorted.map((c) => (
          <li key={c.ticker}>
            <CompanyCard company={c} level={2} />
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Banks and insurers are not charted: their debt is raw material, not financing, so a free-cash-flow model does not fit
        them.
      </p>
    </div>
  );
}
