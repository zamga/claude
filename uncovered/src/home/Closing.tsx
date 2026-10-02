import { useState } from 'react';
import { Link } from '../lib/router';
import { setThemePreference, useTheme } from '../lib/theme';
import type { Place } from './globe/engrave';
import { Globe } from './globe/Globe';
import styles from './Closing.module.css';

const COVERAGE: { region: string; place: Place; listed: string; private: string }[] = [
  {
    region: 'Slovenia',
    place: 'si',
    listed: 'Ljubljana Stock Exchange announcements and annual reports',
    private:
      'AJPES annual reports and the business register: upload the filing, or let Uncovered fetch it where the register allows',
  },
  {
    region: 'European Union',
    place: 'eu',
    listed: 'Annual reports in the European single electronic format, read as structured data',
    private: 'National business registers; upload annual reports in any EU language',
  },
  {
    region: 'United States',
    place: 'us',
    listed: 'SEC EDGAR filings',
    private: 'Upload financial statements',
  },
  {
    region: 'Anywhere else',
    place: 'world',
    listed: 'Exchange filings and company reports, found by research',
    private: 'Upload financial statements; Uncovered researches the rest',
  },
];

const PLANS = [
  {
    name: 'Single initiation',
    price: '€49',
    per: 'per report',
    points: ['One company, public or private', 'Web report, PDF and the model', 'Refreshed once when new filings land'],
    cta: 'Initiate coverage',
    to: '/initiate',
  },
  {
    name: 'Desk',
    price: '€390',
    per: 'a month',
    points: [
      'Twenty initiations a month',
      'Updates on every new filing',
      'A shared library for your team',
      'Model export to spreadsheets',
    ],
    cta: 'Start a desk',
    to: '/initiate',
    featured: true,
  },
  {
    name: 'Institution',
    price: 'Custom',
    per: 'annual',
    points: ['API and white label', 'Review workflow and sign-off', 'Single sign-on', 'Data kept in the EU'],
    cta: 'Read the method',
    to: '/method',
  },
];

const PRINCIPLES = [
  {
    title: 'Figures come from filings',
    body: 'Financial statements are extracted with their page numbers, and every reported number links to its document.',
  },
  {
    title: 'Arithmetic is code',
    body: 'Forecasts, discounting and multiples are computed by the model, never written by a language model.',
  },
  {
    title: 'Estimates are labelled',
    body: 'Anything that is ours, not the company’s, is marked as an estimate and can be changed.',
  },
  {
    title: 'A range, not a rating',
    body: 'Reports give a fair-value range and what the price implies. No buy, hold or sell calls, no incentives to make them.',
  },
];

export function Coverage() {
  // The place the reader points at in the table; the globe turns to it.
  const [focus, setFocus] = useState<Place | null>(null);
  return (
    <section className={styles.coverage} aria-labelledby="coverage-title">
      <div className={`page ${styles.head}`}>
        <p className="eyebrow">Coverage</p>
        <h2 id="coverage-title" className={styles.title}>
          Built for the companies <em>nobody covers</em>.
        </h2>
        <p className={styles.copy}>
          Start in Slovenia, where most companies are private and every annual report is public. Then anywhere.
        </p>
      </div>
      <div className={`page ${styles.atlas}`}>
        <Globe focus={focus} />
        {/* Roles are explicit because phones restack the rows as blocks, which drops implicit table semantics. */}
        <table
          className={styles.table}
          role="table"
          aria-label="What Uncovered reads"
          onPointerLeave={() => setFocus(null)}
        >
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                Where
              </th>
              <th scope="col" role="columnheader">
                Listed companies
              </th>
              <th scope="col" role="columnheader">
                Private companies
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {COVERAGE.map((c) => (
              <tr key={c.region} role="row" onPointerEnter={() => setFocus(c.place)}>
                <th scope="row" role="rowheader">
                  {c.region}
                </th>
                <td role="cell" data-label="Listed">
                  {c.listed}
                </td>
                <td role="cell" data-label="Private">
                  {c.private}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
      <div className={`page ${styles.head}`}>
        <p className="eyebrow">Pricing</p>
        <h2 id="pricing-title" className={styles.title}>
          The cost of an initiation, <em>not of an analyst</em>.
        </h2>
      </div>
      <ul className={`page ${styles.plans}`} role="list">
        {PLANS.map((p) => (
          <li
            key={p.name}
            className={styles.plan}
            data-featured={p.featured ? 'true' : undefined}
            // A note repeats its denomination in the corner; a price by arrangement has none to repeat.
            data-denomination={p.price.startsWith('€') ? p.price : undefined}
          >
            <h3 className={styles.planName}>{p.name}</h3>
            <p className={styles.price}>
              <span className="display-num">{p.price}</span> <span>{p.per}</span>
            </p>
            <ul role="list" className={styles.points}>
              {p.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
            <Link to={p.to} className={styles.planCta}>
              {p.cta}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const plate = (file: string) => `${import.meta.env.BASE_URL}plates/${file}`;

export function Principles() {
  const uv = useTheme() === 'dark';
  return (
    <section className={styles.principles} aria-labelledby="principles-title">
      {/*
       * The Krka cover under ultraviolet, photographed by scripts/plates: the figures go dark and the
       * microtext beneath each one, printed in ink that fluoresces, glows. The site's dark theme is the
       * same lamp, and the caption offers it.
       */}
      <figure className={styles.uvPlate}>
        <img
          src={plate('uv.webp')}
          width={2000}
          height={760}
          alt="The Krka cover’s key data under ultraviolet light: the figures go dark and the microtext beneath each glows."
          loading="lazy"
          decoding="async"
        />
        <figcaption className={`page ${styles.uvCaption}`}>
          <span>
            <strong>Under ultraviolet.</strong> The figures go dark; what says where they came from glows.
          </span>
          <button type="button" className={styles.uvSwitch} onClick={() => setThemePreference(uv ? 'light' : 'dark')}>
            {uv ? 'Back to daylight' : 'Switch the page to UV'}
          </button>
        </figcaption>
      </figure>
      <div className={`page ${styles.principlesGrid}`}>
        <div>
          <p className="eyebrow">Method</p>
          <h2 id="principles-title" className={styles.title}>
            How Uncovered <em>stays honest</em>.
          </h2>
          <Link to="/method" className={styles.more}>
            Read the method
          </Link>
        </div>
        <ol className={styles.principleList} role="list">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title}>
              <span className={styles.no}>{String(i + 1).padStart(2, '0')}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
