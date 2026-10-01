import { useEffect } from 'react';
import { CHART_DATUM, COMPANIES } from '../data/companies';
import { INDUSTRIES, MARKET, MATURE_COST_OF_CAPITAL, costOfCapitalFor } from '../data/market';
import type { IndustryKey } from '../data/types';
import { formatDate, formatPct } from '../engine/format';
import { DRAWS, GRID_SIZE } from '../model/useAnalysis';
import { Link } from '../lib/router';
import styles from './Method.module.css';

const GLOSSARY: Array<[string, string, string]> = [
  ['Sea level', 'Share price', 'The price the chart is drawn against. Change it and the sea rises or falls.'],
  ['Elevation', 'Value against price', 'How much a story is worth relative to the price, on a log scale: +0.69 is worth twice the price.'],
  ['Coastline', 'Market-implied expectations', 'Every story worth exactly the price. A reverse DCF, drawn as a line instead of a single number.'],
  ['Bearing', 'Your base case', 'The growth and margin you believe. Drag it on the chart or set it in the log.'],
  ['Freeboard', 'Margin of safety', 'How far the price sits below your value, as a share of your value.'],
  ['Load line', 'Highest price you would pay', 'Your value less the margin of safety you insist on. The Plimsoll mark on the hull.'],
  ['Drying bank', 'Thin margin', 'Stories worth more than the price but by less than your margin of safety. Green on the chart.'],
  ['Soundings', 'Monte Carlo draws', 'Revaluations with inputs drawn from your ranges. The share worth more than the price is the odds on dry land.'],
  ['Survey', 'Reported figures', 'What the annual report says, before any story is told.'],
  ['Chart datum', 'As-of date', `The prices and rates the charts are drawn against: closes on ${formatDate(CHART_DATUM)}.`],
];

const SECTIONS = [
  ['idea', 'The idea'],
  ['model', 'The model'],
  ['coast', 'The coastline'],
  ['soundings', 'The soundings'],
  ['defaults', 'Starting assumptions'],
  ['data', 'Data'],
  ['limits', 'What the model leaves out'],
  ['glossary', 'Glossary'],
] as const;

export function Method() {
  useEffect(() => {
    document.title = 'Method · Plimsoll';
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start' });

  return (
    <div className={`page ${styles.method}`}>
      <header className={styles.head}>
        <p className="eyebrow">Method</p>
        <h1 data-page-focus tabIndex={-1} className={styles.title}>
          How the chart is drawn.
        </h1>
        <p className={styles.lede}>
          Plimsoll is a discounted-cash-flow model run {(GRID_SIZE * GRID_SIZE).toLocaleString('en-US')} times per chart, plus{' '}
          {DRAWS.toLocaleString('en-US')} more for the soundings. Nothing is hidden: every number on a chart comes from the
          formulas on this page and assumptions you can change.
        </p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="On this page">
          <ol role="list">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(id);
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.body}>
          <section id="idea" className={styles.section}>
            <h2>The idea</h2>
            <div className="prose">
              <p>
                Most valuation tools give you one number. One number hides the two things that matter: what you have to
                believe for it to be right, and what the market already believes. Plimsoll draws both.
              </p>
              <p>
                Each chart values a company for every combination of two drivers: revenue growth over the next five years
                (across) and the operating margin it settles at (up). The height of the terrain is the value per share of
                that story. Then the chart is flooded to today’s share price. What stays dry is worth more than the price.
                The coastline is every story worth exactly the price: the market’s story.
              </p>
            </div>
          </section>

          <section id="model" className={styles.section}>
            <h2>The model</h2>
            <div className="prose">
              <p>
                A free-cash-flow-to-the-firm model in the tradition of Aswath Damodaran, with a ten-year forecast and a
                terminal value.
              </p>
            </div>
            <ol className={styles.formulas}>
              <li>
                <span className={styles.f}>Revenue<sub>t</sub> = Revenue<sub>t−1</sub> × (1 + g<sub>t</sub>)</span>
                <span>Growth g holds for years 1–5, then fades in a straight line to the long-run rate by year 10.</span>
              </li>
              <li>
                <span className={styles.f}>Margin<sub>t</sub> → target margin</span>
                <span>Today’s operating margin moves in a straight line to the target over the years you choose.</span>
              </li>
              <li>
                <span className={styles.f}>After-tax income<sub>t</sub> = Operating income<sub>t</sub> × (1 − tax<sub>t</sub>)</span>
                <span>
                  The effective tax rate moves to a {formatPct(MARKET.marginalTaxRate, 0)} marginal rate over years 6–10.
                  Losses are not taxed.
                </span>
              </li>
              <li>
                <span className={styles.f}>Reinvestment<sub>t</sub> = ΔRevenue<sub>t</sub> ÷ (revenue per $1 of capital)</span>
                <span>Growth is not free: every dollar of new revenue needs capital.</span>
              </li>
              <li>
                <span className={styles.f}>Free cash flow<sub>t</sub> = After-tax income<sub>t</sub> − Reinvestment<sub>t</sub></span>
                <span>Discounted at the cost of capital, which moves toward a mature company’s rate over years 6–10.</span>
              </li>
              <li>
                <span className={styles.f}>Terminal value = FCF<sub>11</sub> ÷ (cost of capital − g<sub>∞</sub>)</span>
                <span>
                  With FCF<sub>11</sub> = after-tax income × (1 − g<sub>∞</sub> ÷ return on capital). The moat is the return
                  on capital above its cost; with no moat, growth after year 10 adds nothing.
                </span>
              </li>
              <li>
                <span className={styles.f}>
                  Equity = operating value + cash + stakes in other companies − debt − minority interests
                </span>
                <span>Divided by shares outstanding. Equity is never worth less than zero.</span>
              </li>
            </ol>
          </section>

          <section id="coast" className={styles.section}>
            <h2>The coastline</h2>
            <div className="prose">
              <p>
                Elevation is the natural log of value over price, so sea level is exactly the price and equal steps up or
                down are equal percentage moves. The terrain is sampled on a {GRID_SIZE} × {GRID_SIZE} grid and the coastline
                traced with marching squares where elevation crosses zero.
              </p>
              <p>
                The sentence above each chart solves the same equation directly: holding your margin, which growth rate
                makes the model worth the price? Holding your growth, which margin? It then compares that growth with what
                the company actually delivered in the years we surveyed.
              </p>
            </div>
          </section>

          <section id="soundings" className={styles.section}>
            <h2>The soundings</h2>
            <div className="prose">
              <p>
                No one knows next decade’s growth to a decimal place. Plimsoll revalues the company {DRAWS.toLocaleString('en-US')}{' '}
                times, drawing growth, margin, cost of capital and capital needs from triangular ranges around your
                bearing. The share of draws worth more than the price is the <em>odds on dry land</em>. The middle 80% of
                draws is the bracket on the hull.
              </p>
              <p>
                Draws use a fixed seed per company, so the same assumptions always give the same soundings and a shared link
                reproduces a chart exactly. “How sure are you?” widens or narrows every range at once.
              </p>
            </div>
          </section>

          <section id="defaults" className={styles.section}>
            <h2>Starting assumptions</h2>
            <div className="prose">
              <p>Every chart opens on the company as it is, so the first view is a reading, not a forecast:</p>
            </div>
            <dl className={styles.defaults}>
              <div>
                <dt>Growth, years 1–5</dt>
                <dd>Average of last year’s growth and the compound rate over the surveyed years, kept between −5% and 30%.</dd>
              </div>
              <div>
                <dt>Target margin</dt>
                <dd>Today’s operating margin, reached in five years.</dd>
              </div>
              <div>
                <dt>Risk-free rate</dt>
                <dd>
                  {formatPct(MARKET.riskFreeRate, 2)}, the 10-year US Treasury yield on {formatDate(MARKET.riskFreeAsOf)}.
                </dd>
              </div>
              <div>
                <dt>Equity risk premium</dt>
                <dd>{formatPct(MARKET.equityRiskPremium, 1)}, a Plimsoll default. Change the cost of capital to use your own.</dd>
              </div>
              <div>
                <dt>Cost of capital</dt>
                <dd>
                  Risk-free rate + industry beta × premium, moving to {formatPct(MATURE_COST_OF_CAPITAL, 2)} (a beta of one)
                  by year 10.
                </dd>
              </div>
              <div>
                <dt>Growth after year 10</dt>
                <dd>{formatPct(MARKET.terminalGrowthCap, 1)}, and never above the risk-free rate.</dd>
              </div>
              <div>
                <dt>Revenue per $1 of capital</dt>
                <dd>Revenue over invested capital (equity + minority interests + debt − cash − stakes), kept between 0.5 and 6.</dd>
              </div>
              <div>
                <dt>Moat</dt>
                <dd>Narrow (+3 points) where today’s return on capital clears the cost of capital by more than that; otherwise none.</dd>
              </div>
            </dl>
            <div className={styles.scroll} role="region" aria-label="Industry betas" tabIndex={0}>
              <table className={styles.table}>
                <caption>Industry betas and the starting cost of capital they give</caption>
                <thead>
                  <tr>
                    <th scope="col">Industry</th>
                    <th scope="col">Beta</th>
                    <th scope="col">Cost of capital</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(INDUSTRIES) as IndustryKey[]).map((k) => (
                    <tr key={k}>
                      <th scope="row">{INDUSTRIES[k].label}</th>
                      <td>{INDUSTRIES[k].beta.toFixed(2)}</td>
                      <td>{formatPct(costOfCapitalFor(INDUSTRIES[k].beta), 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="data" className={styles.section}>
            <h2>Data</h2>
            <div className="prose">
              <p>
                The atlas holds {COMPANIES.length} companies, each surveyed from its latest annual report as of{' '}
                {formatDate(CHART_DATUM)}. Figures were compiled from SEC XBRL filing data and checked against a second,
                independent dataset; where a company reports a line differently (Nike shows no operating-income line) we
                say how we derived it in the chart’s notes. Prices are closing prices on the chart datum.
              </p>
              <p>
                Each chart links to its filings. Figures can contain errors, and they age: check them against the filings
                before you rely on them. Production deployments refresh the survey from SEC EDGAR.
              </p>
            </div>
          </section>

          <section id="limits" className={styles.section}>
            <h2>What the model leaves out</h2>
            <ul className={styles.limits}>
              <li>One company, one margin. Conglomerates are treated as a single business.</li>
              <li>Operating leases are left out of debt and treated as operating costs.</li>
              <li>Tax losses carried forward are ignored, which understates young companies slightly.</li>
              <li>Future dilution from stock awards is not modelled beyond today’s share count.</li>
              <li>Cyclical companies are valued off one year’s margin; set the target margin to a mid-cycle level.</li>
              <li>Banks and insurers are not charted.</li>
              <li>Prices are a snapshot, not a feed.</li>
            </ul>
          </section>

          <section id="glossary" className={styles.section}>
            <h2>Glossary</h2>
            <dl className={styles.glossary}>
              {GLOSSARY.map(([term, plain, def]) => (
                <div key={term}>
                  <dt>
                    {term} <span>{plain}</span>
                  </dt>
                  <dd>{def}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className={styles.disclaimer}>
            <p>
              Plimsoll is a tool for thinking about value. It is not investment advice, and it does not know what you
              should buy. <Link to="/atlas">Open a chart</Link> and decide for yourself.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
