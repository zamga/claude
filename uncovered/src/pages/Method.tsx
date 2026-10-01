import type { ReactNode } from 'react';
import { usePageMeta } from '../app/routes';
import { Cited, FootnoteProvider } from '../report/Footnotes';
import { bindings } from '../report/bindings';
import { KRKA } from '../report/krka';
import { GRADES } from '../report/reader/Sources';
import { valueReport } from '../report/valuation';
import { Link, href } from '../lib/router';
import { eur, pct } from '../lib/format';
import styles from './Method.module.css';

const VALUATION = valueReport(KRKA);
const VALUES = bindings(KRKA, VALUATION);
const GRADE_COUNT = (g: string) => KRKA.sources.filter((s) => s.grade === g).length;

/** The sentence from the Krka summary that quotes the model, as written and as read. */
const BOUND = KRKA.summary.slice(KRKA.summary.indexOf('At €262.50'), KRKA.summary.indexOf(' We initiate'));

const SECTIONS = [
  { id: 'evidence', title: 'Every figure carries its evidence' },
  { id: 'bound', title: 'Words bound to the model' },
  { id: 'valuation', title: 'Three methods, one range' },
  { id: 'sources', title: 'Where the evidence comes from' },
  { id: 'limits', title: 'What an initiation is not' },
].map((s, i) => ({ ...s, no: String(i + 1).padStart(2, '0') }));

function Section({ id, children, lede }: { id: string; children: ReactNode; lede?: ReactNode }) {
  const meta = SECTIONS.find((s) => s.id === id)!;
  return (
    <section id={id} className={`page ${styles.section}`} aria-labelledby={`${id}-title`}>
      <header className={styles.sectionHead}>
        <span className={styles.no}>{meta.no}</span>
        <h2 id={`${id}-title`}>{meta.title}</h2>
        {lede && <p className={styles.lede}>{lede}</p>}
      </header>
      {children}
    </section>
  );
}

/** A formula set typographically, read aloud from its label. */
function Formula({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.formula} role="math" aria-label={label}>
      <span aria-hidden="true">{children}</span>
    </div>
  );
}

function Frac({ n, d }: { n: ReactNode; d: ReactNode }) {
  return (
    <span className={styles.frac}>
      <span>{n}</span>
      <span>{d}</span>
    </span>
  );
}

export function Method() {
  usePageMeta('/method');
  const dcf = VALUATION.methods.find((m) => m.id === 'dcf')!;

  return (
    <article className={styles.method} aria-labelledby="method-title">
      <header className={`page ${styles.head}`}>
        <p className="eyebrow">Method</p>
        <h1 id="method-title" className={styles.title} data-page-focus tabIndex={-1}>
          How Uncovered stays <em>honest</em>.
        </h1>
        <p className={styles.intro}>
          An initiation is only as good as what it rests on. These are the rules every Uncovered report follows, and the
          arithmetic behind its numbers, shown on the Krka sample.
        </p>
        <nav aria-label="On this page">
          <ol className={styles.contents} role="list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link to={`/method#${s.id}`}>
                  <span>{s.no}</span> {s.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <Section
        id="evidence"
        lede="Each reported number links to the document it came from, quoted at the sentence it rests on. Each is graded by how strong that evidence is, and the grade travels with the number wherever it appears."
      >
        <ul className={styles.grades} role="list">
          {GRADES.map((g) => (
            <li key={g.grade} data-grade={g.grade}>
              <p className={styles.gradeName}>
                <span className={styles.dot} aria-hidden="true" />
                {g.name}
              </p>
              <p className={styles.gradeText}>{g.text}</p>
              <p className={styles.gradeLook}>
                {g.grade === 'estimated' ? (
                  <>
                    Model figures are underlined: an implied margin of{' '}
                    <span className="bound">{VALUES['implied.margin']}</span>.
                  </>
                ) : (
                  <>
                    Notes are numbered in the grade’s colour: revenue of €2,041.0m
                    <sup className="fn" data-grade={g.grade}>
                      <span>1</span>
                    </sup>
                    .
                  </>
                )}
              </p>
              <p className={styles.gradeCount}>
                {g.grade === 'estimated'
                  ? 'Every value in the Krka model'
                  : `${GRADE_COUNT(g.grade)} of the Krka sample’s ${KRKA.sources.length} sources`}
              </p>
            </li>
          ))}
        </ul>
        <h3 className={styles.checksTitle}>How the engine holds a report to it</h3>
        <ol className={styles.checks} role="list">
          <li>
            <h4>Quoted word for word</h4>
            <p>
              The engine reads every document itself and keeps the text it read. A quotation that is not in that text,
              word for word, is sent back to be corrected.
            </p>
          </li>
          <li>
            <h4>The number is in its quotation</h4>
            <p>
              A figure enters the model only if it appears, exactly as printed, in the passage quoted for it. Code
              converts thousands to millions and percentages to fractions; the language model does no arithmetic.
            </p>
          </li>
          <li>
            <h4>Filed means shown</h4>
            <p>
              A document counts as an audited report or a filing only if a passage of it shows so: the auditor’s
              opinion, or the register’s or exchange’s filing details. Otherwise it is graded Reported.
            </p>
          </li>
          <li>
            <h4>Every sentence checked</h4>
            <p>
              Before a report is shown, code checks every sentence: each number must be printed in a passage that
              sentence cites, or be a figure the model computes. What fails goes back to be rewritten; a sentence that
              still cannot be traced is withheld, and the report says so.
            </p>
          </li>
        </ol>
        <p className={styles.note}>
          The Krka sample was written by hand before the engine, from search excerpts of its sources; its source list
          says so. Reports the engine writes quote each document exactly, with the page.
        </p>
      </Section>

      <Section
        id="bound"
        lede="A language model drafts the prose, but it never writes a number the model computes. It writes a reference, and the reader fills it in from the valuation engine. Change an assumption and the sentence changes with it."
      >
        <div className={styles.bound}>
          <figure className={styles.pane}>
            <figcaption>As written</figcaption>
            <p className={styles.source}>
              {BOUND.split(/(\{\{[\w.-]+\}\}|\[\^[\w-]+\])/).map((part, i) =>
                /^\{\{/.test(part) ? (
                  <mark key={i} className={styles.token}>
                    {part}
                  </mark>
                ) : /^\[\^/.test(part) ? (
                  <mark key={i} className={styles.marker}>
                    {part}
                  </mark>
                ) : (
                  part
                ),
              )}
            </p>
          </figure>
          <figure className={styles.pane}>
            <figcaption>As read</figcaption>
            <p className={styles.rendered}>
              <FootnoteProvider
                sources={KRKA.sources}
                values={VALUES}
                hrefFor={(id) => href(`/report/krka#src-${id}`)}
                scrollBlock={false}
              >
                <Cited text={BOUND} />
              </FootnoteProvider>
            </p>
          </figure>
        </div>
        <p className={styles.note}>
          From the Krka summary. Tokens in braces are model outputs; bracketed markers are footnotes to sources. A test
          fails the build if any token in a report has no value, or any marker has no source.
        </p>
      </Section>

      <Section
        id="valuation"
        lede="Every report values the company in up to three independent ways, then reads the market price back through the same models to show what it assumes."
      >
        <div className={styles.methods}>
          <section aria-labelledby="m-dcf">
            <h3 id="m-dcf">Discounted cash flow</h3>
            <p>
              Five years of free cash flow to the firm, from revenue, margin, investment and working capital, then a
              terminal value growing at a steady rate.
            </p>
            <Formula label="Free cash flow equals EBIT times one minus the tax rate, plus depreciation and amortisation, minus capital expenditure, minus the change in working capital.">
              <var>FCF</var> = <var>EBIT</var> × (1 − <var>t</var>) + <var>D&amp;A</var> − <var>Capex</var> − Δ
              <var>WC</var>
            </Formula>
            <Formula label="Terminal value equals the last year's free cash flow times one plus g, divided by WACC minus g.">
              <var>TV</var> ={' '}
              <Frac
                n={
                  <>
                    <var>FCF</var>
                    <sub>N</sub> × (1 + <var>g</var>)
                  </>
                }
                d={
                  <>
                    <var>WACC</var> − <var>g</var>
                  </>
                }
              />
            </Formula>
            <p className={styles.example}>
              Krka: {dcf.detail}, giving {eur(dcf.low, 0)} to {eur(dcf.high, 0)} a share.
            </p>
          </section>
          <section aria-labelledby="m-ddm">
            <h3 id="m-ddm">Dividend discount</h3>
            <p>
              For companies that pay a dependable dividend: an explicit run of growing dividends, then a perpetuity,
              discounted at the cost of equity.
            </p>
            <Formula label="Value equals the sum of each year's dividend discounted at the cost of equity, plus the discounted terminal value of the dividend stream.">
              <var>P</var> = Σ{' '}
              <Frac
                n={
                  <>
                    <var>D</var>
                    <sub>t</sub>
                  </>
                }
                d={
                  <>
                    (1 + <var>k</var>
                    <sub>e</sub>)<sup>t</sup>
                  </>
                }
              />{' '}
              +{' '}
              <Frac
                n={
                  <>
                    <var>D</var>
                    <sub>N</sub> (1 + <var>g</var>)
                  </>
                }
                d={
                  <>
                    (<var>k</var>
                    <sub>e</sub> − <var>g</var>)(1 + <var>k</var>
                    <sub>e</sub>)<sup>N</sup>
                  </>
                }
              />
            </Formula>
          </section>
          <section aria-labelledby="m-pe">
            <h3 id="m-pe">Earnings multiple</h3>
            <p>
              Next year’s earnings per share at a range of multiples, from comparable companies or the company’s own
              history. For private companies, peer multiples stand in for a market.
            </p>
            <Formula label="Value equals next year's earnings per share times a price to earnings multiple, low to high.">
              <var>P</var> = <var>EPS</var>
              <sub>t+1</sub> × <var>P/E</var>
              <sub>low…high</sub>
            </Formula>
          </section>
          <section aria-labelledby="m-cost">
            <h3 id="m-cost">Cost of capital</h3>
            <p>
              Built up from a risk-free rate, the equity risk premium scaled by beta, and a premium for country
              exposure. Each input is stated in the report and can be changed.
            </p>
            <Formula label="Cost of equity equals the risk-free rate plus beta times the equity risk premium, plus the country risk premium.">
              <var>k</var>
              <sub>e</sub> = <var>r</var>
              <sub>f</sub> + β × <var>ERP</var> + <var>CRP</var>
            </Formula>
            <p className={styles.example}>
              Krka: {VALUES.rf} + {VALUES.beta} × {VALUES.erp} + {VALUES.crp} = {VALUES.ke}.
            </p>
          </section>
        </div>

        <div className={styles.range}>
          <div>
            <h3>One range</h3>
            <p>
              The fair-value range is the average of the methods’ lows, middles and highs. Uncovered gives that range
              and what the price implies, never a rating or a target.
            </p>
          </div>
          <div>
            <h3>What the price implies</h3>
            <p>
              The engine solves for the EBITDA margin, and separately the terminal growth, at which the cash-flow model
              equals the share price. For Krka at {eur(VALUATION.price ?? 0)}: a margin of{' '}
              <span className="bound">{VALUES['implied.margin']}</span> every year to 2030, or growth of{' '}
              <span className="bound">{VALUES['implied.growth']}</span> for ever, against our{' '}
              {pct(KRKA.assumptions.terminalGrowth)}.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="sources"
        lede="Uncovered reads primary documents first and the press second. Where a register asks for a verified download, it asks you for the file instead."
      >
        <div className={styles.tableWrap} role="region" aria-label="Primary sources by jurisdiction" tabIndex={0}>
          <table className={styles.table}>
            <caption className="visually-hidden">Primary sources by jurisdiction</caption>
            <thead>
              <tr>
                <th scope="col">Where</th>
                <th scope="col">Register</th>
                <th scope="col">Listed companies</th>
                <th scope="col">Private companies</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Slovenia</th>
                <td>Business register of Slovenia, kept by AJPES</td>
                <td>Annual and interim reports and announcements through the Ljubljana Stock Exchange</td>
                <td>Annual reports filed with AJPES: free to view, downloaded after verification or supplied by you</td>
              </tr>
              <tr>
                <th scope="row">European Union</th>
                <td>National business registers and the global legal entity index</td>
                <td>Annual reports in the European single electronic format (XHTML) and exchange announcements</td>
                <td>Statements from the national register, or supplied by you where access is paid</td>
              </tr>
              <tr>
                <th scope="row">United States</th>
                <td>SEC EDGAR and state registers</td>
                <td>10-K, 10-Q and 8-K filings</td>
                <td>No public accounts: statements supplied by you</td>
              </tr>
              <tr>
                <th scope="row">Elsewhere</th>
                <td>Public registers where they exist</td>
                <td>Exchange filings and company reports, found by research</td>
                <td>Statements supplied by you; research fills in the business</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={styles.note}>
          Secondary sources, such as data aggregators and encyclopaedias, are graded Reported and used only for facts
          the company does not publish itself.
        </p>
      </Section>

      <Section id="limits">
        <ul className={styles.limits} role="list">
          <li>
            <h3>Not advice</h3>
            <p>
              Reports describe evidence and what a price implies under stated assumptions. They do not recommend buying,
              holding or selling anything.
            </p>
          </li>
          <li>
            <h3>No inside information</h3>
            <p>
              Only public documents and the files you supply. No management interviews, no channel checks, no non-public
              data.
            </p>
          </li>
          <li>
            <h3>Dated, not live</h3>
            <p>
              Every report states when its sources were gathered and the date of the price it uses. A report does not
              change after it is written; a new initiation reads the new filings.
            </p>
          </li>
          <li>
            <h3>Thin filings, plain gaps</h3>
            <p>
              Small companies file short accounts. When the evidence is thin, the report names what it could not find,
              and the model stays close to what the filings show rather than inventing precision.
            </p>
          </li>
          <li>
            <h3>Unaudited is labelled</h3>
            <p>
              Figures from unaudited releases, websites and the press are graded Reported, not Filed, wherever they
              appear.
            </p>
          </li>
          <li>
            <h3>Checked by code, not by an analyst</h3>
            <p>
              Every report passes the engine’s checks before anyone reads it. None is reviewed by a person, and each
              says so in its disclosures.
            </p>
          </li>
        </ul>
        <p className={styles.closing}>
          <Link to="/report/krka" className={styles.cta}>
            See the method at work in the Krka sample
          </Link>
        </p>
      </Section>
    </article>
  );
}
