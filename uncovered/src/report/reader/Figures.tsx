import type { CSSProperties, ReactNode } from 'react';
import { eur, num, pct, signedPct } from '../../lib/format';
import { Cited, Ref } from '../Footnotes';
import type { Line, Period, Report } from '../types';
import { costOfEquity, ddm, implied, type Valuation } from '../valuation';
import styles from './Figures.module.css';

/*
 * The report's exhibits. Reported figures carry their footnote; derived and
 * modelled figures are computed here from the report's data and the valuation
 * engine, and are labelled as such.
 */

function formatLine(unit: Line['unit'], v: number): string {
  if (unit === 'eur') return num(v, 2);
  if (unit === 'pct') return pct(v);
  if (unit === 'x') return `${num(v, 1)}×`;
  return num(v, 1);
}

/** Exhibit heading and the note under it, shared by every figure. */
export function Exhibit({
  no,
  title,
  note,
  children,
  wide = false,
}: {
  no: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <figure className={styles.exhibit} data-wide={wide || undefined}>
      <figcaption className={styles.caption}>
        <span className={styles.exNo}>Exhibit {no}</span>
        <span className={styles.exTitle}>{title}</span>
      </figcaption>
      {children}
      {note && <p className={styles.note}>{note}</p>}
    </figure>
  );
}

/* ---------- Key facts ---------- */

export function KeyFacts({ report }: { report: Report }) {
  const c = report.company;
  const fact = (label: string) => report.keyFacts.find((f) => f.label === label);
  const rows: { label: string; value: string; sourceId?: string }[] = [
    { label: 'Founded', value: `${c.founded}, ${c.city}`, sourceId: 'hist' },
    { label: 'Employees', value: c.employees, sourceId: 'emp' },
    { label: 'Listing', value: c.listed ? `${c.exchange}: ${c.ticker}` : 'Private' },
    ...(c.isin ? [{ label: 'ISIN', value: c.isin }] : []),
    ...(['Revenue 2025', 'Net profit 2025', 'Shares'] as const).flatMap((l) => {
      const f = fact(l);
      return f ? [{ label: l, value: f.value, sourceId: f.sourceId }] : [];
    }),
    { label: 'Website', value: c.website.replace(/^https?:\/\//, '') },
  ];
  return (
    <dl className={styles.facts}>
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>
            {r.label === 'Website' ? (
              <a href={c.website} target="_blank" rel="noreferrer">
                {r.value}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            ) : (
              r.value
            )}
            {r.sourceId && <Ref id={r.sourceId} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Markets ---------- */

/** Sales by region as a table whose cells carry their own bars: readable as data, seen as a chart. */
export function RegionsTable({ report, no }: { report: Report; no: string }) {
  const total = report.regions.reduce((s, r) => s + r.value, 0);
  const rows = [...report.regions].sort((a, b) => b.value - a.value);
  const max = rows[0]?.value ?? 1;
  const sourceId = rows.find((r) => r.sourceId)?.sourceId;
  return (
    <Exhibit
      no={no}
      title="Sales by region, 2025"
      note={
        <>
          {report.regionsNote}
          {sourceId && <Ref id={sourceId} />} Shares of the regional total, which excludes other revenue.
        </>
      }
    >
      <table className={styles.regions}>
        <thead>
          <tr>
            <th scope="col">Region</th>
            <th scope="col">€ millions</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td style={{ '--w': r.value / max } as CSSProperties}>
                <span className={styles.bar} aria-hidden="true" />
                <span className={styles.barValue}>{num(r.value, 1)}</span>
              </td>
              <td>{pct(r.value / total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Exhibit>
  );
}

/* ---------- Financials ---------- */

const ANNUAL = /^\d{4}A$/;

export function IncomeTable({ report, no }: { report: Report; no: string }) {
  const periods: Period[] = [...new Set(report.income.flatMap((l) => Object.keys(l.values)))];
  const byLabel = (label: string) => report.income.find((l) => l.label === label);
  const revenue = byLabel('Revenue');
  const ebitda = byLabel('EBITDA');
  const profit = byLabel('Net profit');

  type Row =
    | { kind: 'line'; line: Line }
    | { kind: 'derived'; label: string; value: (p: Period, i: number) => number | undefined };
  const ratio = (a?: Line, b?: Line) => (p: Period) => {
    const x = a?.values[p];
    const y = b?.values[p];
    return x !== undefined && y ? x / y : undefined;
  };
  const rows: Row[] = [];
  for (const line of report.income) {
    rows.push({ kind: 'line', line });
    if (line === revenue)
      rows.push({
        kind: 'derived',
        label: 'Growth',
        value: (p, i) => {
          const prev = periods[i - 1];
          if (!prev || !ANNUAL.test(p) || !ANNUAL.test(prev)) return undefined;
          const a = revenue.values[p];
          const b = revenue.values[prev];
          return a !== undefined && b ? a / b - 1 : undefined;
        },
      });
    if (line === ebitda) rows.push({ kind: 'derived', label: 'EBITDA margin', value: ratio(ebitda, revenue) });
    if (line === profit) rows.push({ kind: 'derived', label: 'Net margin', value: ratio(profit, revenue) });
  }

  return (
    <Exhibit
      no={no}
      title="Income statement highlights"
      note="€ millions unless stated. Reported figures as released by the company; 2025 is unaudited. Growth and margins are derived from the reported figures."
      wide
    >
      <div className={styles.scroll} role="region" aria-label="Income statement highlights" tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Line</span>
              </th>
              {periods.map((p) => (
                <th key={p} scope="col">
                  {p.replace(/A$/, '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              row.kind === 'line' ? (
                <tr key={row.line.label} data-emphasis={row.line.emphasis || undefined}>
                  <th scope="row">{row.line.label}</th>
                  {periods.map((p) => {
                    const v = row.line.values[p];
                    const src = row.line.sources?.[p];
                    return (
                      <td key={p}>
                        {v === undefined ? '' : formatLine(row.line.unit, v)}
                        {v !== undefined && src && <Ref id={src} />}
                      </td>
                    );
                  })}
                </tr>
              ) : (
                <tr key={row.label} data-derived="true">
                  <th scope="row">{row.label}</th>
                  {periods.map((p, i) => {
                    const v = row.value(p, i);
                    return <td key={p}>{v === undefined ? '' : pct(v)}</td>;
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Exhibit>
  );
}

/* ---------- Ownership and dividends ---------- */

export function OwnershipBar({ report, no }: { report: Report; no: string }) {
  // Each holder's segment starts where the ones before it end.
  const starts = report.ownership.map((_, i) => report.ownership.slice(0, i).reduce((sum, o) => sum + o.value, 0));
  return (
    <Exhibit no={no} title="Shareholders" note={report.ownershipNote}>
      <div className={styles.stack} aria-hidden="true">
        {report.ownership.map((o, i) => (
          <span
            key={o.label}
            className={styles.segment}
            data-i={i}
            style={{ left: `${starts[i]}%`, width: `${o.value}%` } as CSSProperties}
          />
        ))}
      </div>
      <ul className={styles.stackLegend} role="list">
        {report.ownership.map((o, i) => (
          <li key={o.label} data-i={i}>
            <span className={styles.swatch} aria-hidden="true" />
            <span className={styles.holder}>{o.label}</span>
            <span className={styles.share}>
              {num(o.value, 2)}%{o.sourceId && <Ref id={o.sourceId} />}
            </span>
          </li>
        ))}
      </ul>
    </Exhibit>
  );
}

export function DividendBars({ report, no }: { report: Report; no: string }) {
  const a = report.assumptions;
  const next = a.periods[0]?.replace(/E$/, '');
  const bars = [
    ...report.dividends.map((d) => ({ year: d.year, dps: d.dps, sourceId: d.sourceId, estimate: false })),
    ...(next ? [{ year: `${next}E`, dps: a.dpsNext, sourceId: undefined, estimate: true }] : []),
  ];
  const max = Math.max(...bars.map((b) => b.dps)) * 1.12;
  return (
    <Exhibit
      no={no}
      title="Dividend per share, €"
      note={`For the year shown, paid the following year. ${next ?? ''}E is our estimate: +${pct(a.dpsNext / (report.dividends.at(-1)?.dps ?? a.dpsNext) - 1)} on the last dividend.`}
    >
      <ol className={styles.columns} role="list">
        {bars.map((b) => (
          <li key={b.year} data-estimate={b.estimate || undefined} style={{ '--h': b.dps / max } as CSSProperties}>
            <span className={styles.colValue}>
              €{num(b.dps, 2)}
              {b.sourceId && <Ref id={b.sourceId} />}
            </span>
            <span className={styles.colBar} aria-hidden="true" />
            <span className={styles.colLabel}>{b.year}</span>
          </li>
        ))}
      </ol>
    </Exhibit>
  );
}

/* ---------- Valuation ---------- */

/** The cost of equity, set as the sum it is. */
export function CostOfCapital({ report, no }: { report: Report; no: string }) {
  const a = report.assumptions;
  const ke = costOfEquity(a);
  const why = a.rationale ?? {};
  // Each operator belongs to the term after it, so a line never ends on "+" or "=".
  const terms: { op?: string; value: string; label: string; note?: string; result?: boolean }[] = [
    { value: pct(a.riskFree), label: 'Risk-free rate', note: why.riskFree },
    {
      op: '+',
      value: `${num(a.beta, 1)} × ${pct(a.equityRiskPremium)}`,
      label: 'Beta × equity risk premium',
      note: why.beta,
    },
    { op: '+', value: pct(a.countryRisk), label: 'Country premium', note: why.countryRisk },
    {
      op: '=',
      value: pct(ke),
      label: 'Cost of equity',
      note: a.debtWeight === 0 ? 'Also the cost of capital: no debt' : undefined,
      result: true,
    },
  ];
  return (
    <Exhibit
      no={no}
      title="Cost of capital"
      note="Our assumptions, not reported figures. Change any of them and every value in this report follows."
    >
      <div className={styles.equation}>
        {terms.map((t) => (
          <div key={t.label} className={styles.term} data-result={t.result || undefined}>
            {t.op && (
              <span className={styles.op} aria-hidden="true">
                {t.op}
              </span>
            )}
            <span className={styles.termValue}>{t.value}</span>
            <span className={styles.termLabel}>{t.label}</span>
            {t.note && <span className={styles.termNote}>{t.note}</span>}
          </div>
        ))}
      </div>
    </Exhibit>
  );
}

export function DcfTable({ report, valuation, no }: { report: Report; valuation: Valuation; no: string }) {
  const d = valuation.dcf;
  const a = report.assumptions;
  const rows: { label: string; value: (y: (typeof d.years)[number]) => string; emphasis?: boolean; sub?: boolean }[] = [
    { label: 'Revenue', value: (y) => num(y.revenue, 1), emphasis: true },
    { label: 'Growth', value: (y) => pct(y.growth), sub: true },
    { label: 'EBITDA', value: (y) => num(y.ebitda, 1) },
    { label: 'Margin', value: (y) => pct(y.margin), sub: true },
    { label: 'Depreciation and amortisation', value: (y) => num(-y.da, 1) },
    { label: 'EBIT', value: (y) => num(y.ebit, 1) },
    { label: `Tax at ${pct(a.taxRate, 0)}`, value: (y) => num(-(y.ebit - y.nopat), 1) },
    { label: 'Add back depreciation', value: (y) => num(y.da, 1) },
    { label: 'Capital expenditure', value: (y) => num(-y.capex, 1) },
    { label: 'Working capital', value: (y) => num(-y.nwc, 1) },
    { label: 'Free cash flow', value: (y) => num(y.fcf, 1), emphasis: true },
    { label: 'Discount factor', value: (y) => num(y.discount, 2), sub: true },
    { label: 'Present value', value: (y) => num(y.pv, 1), emphasis: true },
  ];
  const last = d.years.at(-1);
  return (
    <Exhibit
      no={no}
      title="Discounted cash flow"
      note={`€ millions. Our estimates, discounted at ${pct(d.wacc)} to the start of ${a.periods[0]?.slice(0, 4)}; the terminal value grows the ${last?.period.slice(0, 4)} cash flow at ${pct(d.terminalGrowth)} a year.`}
      wide
    >
      <div className={styles.scroll} role="region" aria-label="Discounted cash flow" tabIndex={0}>
        <table className={styles.table} data-estimate="true">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Line</span>
              </th>
              {d.years.map((y) => (
                <th key={y.period} scope="col">
                  {y.period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} data-emphasis={r.emphasis || undefined} data-derived={r.sub || undefined}>
                <th scope="row">{r.label}</th>
                {d.years.map((y) => (
                  <td key={y.period}>{r.value(y)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className={styles.bridge}>
        <div>
          <dt>Present value of {a.periods.length} years of cash flow</dt>
          <dd>{num(d.pvExplicit, 1)}</dd>
        </div>
        <div>
          <dt>
            Present value of the terminal value <span>({pct(d.terminalShare, 0)} of the total)</span>
          </dt>
          <dd>{num(d.pvTerminal, 1)}</dd>
        </div>
        <div data-total="true">
          <dt>Enterprise value</dt>
          <dd>{num(d.enterpriseValue, 1)}</dd>
        </div>
        <div>
          <dt>Net cash{a.netCashSource && <Ref id={a.netCashSource} />}</dt>
          <dd>{num(a.netCash, 1)}</dd>
        </div>
        <div data-total="true">
          <dt>Equity value</dt>
          <dd>{num(d.equityValue, 1)}</dd>
        </div>
        <div>
          <dt>Shares, millions{a.sharesSource && <Ref id={a.sharesSource} />}</dt>
          <dd>{num(a.sharesM, 2)}</dd>
        </div>
        <div data-total="true" data-result="true">
          <dt>Value per share</dt>
          <dd>{eur(d.perShare)}</dd>
        </div>
      </dl>
    </Exhibit>
  );
}

/** How the other two methods arrive at their ranges. */
export function MethodNotes({ report, valuation }: { report: Report; valuation: Valuation }) {
  const a = report.assumptions;
  const ke = costOfEquity(a);
  const dividends = ddm(a, ke).dividends;
  const ddmRange = valuation.methods.find((m) => m.id === 'ddm')!;
  const peRange = valuation.methods.find((m) => m.id === 'pe')!;
  const first = a.periods[0] ?? '';
  return (
    <div className={styles.methods}>
      <section aria-labelledby="m-ddm">
        <h3 id="m-ddm">Dividend discount</h3>
        <p>
          Dividends of {dividends.map((v) => eur(v)).join(', ')} over the next {a.dpsYears} years, then growth of{' '}
          {pct(a.dpsTerminalGrowth)} a year, discounted at {pct(ke)}: {eur(ddmRange.base, 0)} a share, and{' '}
          {eur(ddmRange.low, 0)} to {eur(ddmRange.high, 0)} with the cost of equity half a point either side.
        </p>
      </section>
      <section aria-labelledby="m-pe">
        <h3 id="m-pe">Earnings multiple</h3>
        <p>
          Earnings per share of {eur(a.epsNext)} for {first.slice(0, 4)}
          {a.epsBasis ? (
            <>
              , from <Cited text={a.epsBasis} />
            </>
          ) : null}
          , at {a.peLow} to {a.peHigh} times: {eur(peRange.low, 0)} to {eur(peRange.high, 0)} a share.
        </p>
      </section>
    </div>
  );
}

/** EBITDA margins from the reported lines: the last full year and the latest interim period. */
function reportedMargins(report: Report): { label: string; value: number; sourceId?: string }[] {
  const revenue = report.income.find((l) => l.label === 'Revenue');
  const ebitda = report.income.find((l) => l.label === 'EBITDA');
  if (!revenue || !ebitda) return [];
  const periods = Object.keys(ebitda.values).filter((p) => revenue.values[p]);
  const annual = periods.filter((p) => ANNUAL.test(p)).at(-1);
  const interim = periods.filter((p) => !ANNUAL.test(p) && !/E$/.test(p)).at(-1);
  return [annual, interim]
    .filter((p): p is string => p !== undefined)
    .map((p) => ({
      label: ANNUAL.test(p) ? p.slice(0, 4) : p,
      value: ebitda.values[p]! / revenue.values[p]!,
      sourceId: ebitda.sources?.[p],
    }));
}

/** What the price implies, read back through the same models. */
export function ImpliedPanel({ report, valuation }: { report: Report; valuation: Valuation }) {
  const price = valuation.price;
  if (price === undefined) return null;
  const im = implied(report, price);
  const a = report.assumptions;
  const first = a.periods[0] ?? '';
  const last = a.periods.at(-1)?.slice(0, 4);
  const margins = reportedMargins(report)
    .map((m) => `${m.label}: ${pct(m.value)}${m.sourceId ? `[^${m.sourceId}]` : ''}`)
    .join('; ');
  const paid = report.dividends.at(-1);
  const items = [
    {
      label: 'EBITDA margin the price implies',
      value: im.margin === undefined ? '—' : pct(im.margin),
      context: `Held in every year to ${last}. ${margins ? `${margins}; ` : ''}our model: {{margin.${first}}}.`,
    },
    {
      label: 'Terminal growth the price implies',
      value: im.terminalGrowth === undefined ? '—' : pct(im.terminalGrowth, 2),
      context: `A year, for ever, after ${last}. Our model: {{g}}.`,
    },
    {
      label: `Price to ${first.slice(0, 4)} earnings`,
      value: `${num(im.pe, 1)}×`,
      context: `Our range: {{pe.low}} to {{pe.high}}.`,
    },
    {
      label: 'Dividend yield',
      value: im.dividendYield === undefined ? '—' : pct(im.dividendYield),
      context: `${paid ? `On the €${num(paid.dps, 2)} paid for ${paid.year}${paid.sourceId ? `[^${paid.sourceId}]` : ''}; ` : ''}${pct(im.forwardYield)} on our {{dps.next}} for ${first.slice(0, 4)}.`,
    },
  ];
  return (
    <section className={styles.implied} aria-labelledby="implied-title">
      <header className={styles.impliedHead}>
        <h3 id="implied-title">What the price implies</h3>
        <p>
          At {eur(price)}
          <Ref id={report.market!.priceSource} />, {signedPct(valuation.premium!)} against our base case of{' '}
          {eur(valuation.fair.base, 0)}.
        </p>
      </header>
      <dl className={styles.impliedGrid}>
        {items.map((it) => (
          <div key={it.label}>
            <dt>{it.label}</dt>
            <dd className={styles.impliedValue}>{it.value}</dd>
            <dd className={styles.impliedContext}>
              <Cited text={it.context} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- Risks and catalysts ---------- */

const IMPACT = { high: 3, medium: 2, low: 1 } as const;

export function RiskList({ report }: { report: Report }) {
  const risks = [...report.risks].sort((x, y) => IMPACT[y.impact] - IMPACT[x.impact]);
  return (
    <ol className={styles.risks} role="list">
      {risks.map((r) => (
        <li key={r.title} data-impact={r.impact}>
          <p className={styles.impact}>
            <span className={styles.meter} aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span key={i} data-on={i <= IMPACT[r.impact] || undefined} />
              ))}
            </span>
            {r.impact[0]!.toUpperCase() + r.impact.slice(1)} impact
          </p>
          <h3 className={styles.riskTitle}>{r.title}</h3>
          <p className={styles.riskBody}>
            <Cited text={r.body} />
          </p>
        </li>
      ))}
    </ol>
  );
}

export function Catalysts({ report }: { report: Report }) {
  return (
    <ol className={styles.catalysts} role="list">
      {report.catalysts.map((c, i) => (
        <li key={i}>
          <span className={styles.catNo}>{String(i + 1).padStart(2, '0')}</span>
          <p>
            <Cited text={c} />
          </p>
        </li>
      ))}
    </ol>
  );
}
