import { useState, type CSSProperties } from 'react';
import { Link } from '../lib/router';
import { setDraft } from '../lib/request';
import { Seal } from '../seal/Seal';
import { KRKA } from '../report/krka';
import { longDate } from '../lib/format';
import styles from './Register.module.css';

/*
 * The register: every company gets a seal, and a seal is finished only when
 * the company is covered. Krka's is. The others are Slovenian companies
 * Uncovered has not covered yet: their seals are barely begun, they engrave
 * when you point at them, and choosing one starts its initiation.
 */

const WAITING: { name: string; mark: string; listed: boolean }[] = [
  { name: 'Petrol d.d.', mark: 'PETG', listed: true },
  { name: 'Pipistrel d.o.o.', mark: 'P', listed: false },
  { name: 'Akrapovič d.d.', mark: 'A', listed: false },
  { name: 'Luka Koper d.d.', mark: 'LKPG', listed: true },
  { name: 'Gorenje d.o.o.', mark: 'G', listed: false },
  { name: 'Elan d.o.o.', mark: 'E', listed: false },
  { name: 'Telekom Slovenije d.d.', mark: 'TLSG', listed: true },
  { name: 'Hidria d.o.o.', mark: 'H', listed: false },
  { name: 'Cinkarna Celje d.d.', mark: 'CICG', listed: true },
  { name: 'Kolektor Group d.o.o.', mark: 'KG', listed: false },
  { name: 'Zavarovalnica Triglav d.d.', mark: 'ZVTG', listed: true },
];

const BEGUN = 0.12;

export function Register() {
  // Seals that have been pointed at stay engraved: the start of an initiation.
  const [engraved, setEngraved] = useState<ReadonlySet<string>>(new Set());
  const engrave = (name: string) => setEngraved((s) => (s.has(name) ? s : new Set(s).add(name)));

  return (
    <section className={styles.register} aria-labelledby="register-title">
      <div className={`page ${styles.head}`}>
        <div>
          <p className="eyebrow">The register</p>
          <h2 id="register-title" className={styles.title}>
            One seal finished. <em>293,999 to go.</em>
          </h2>
        </div>
        <p className={styles.copy}>
          A company’s seal is engraved from its name and finished when it is covered. Krka’s is. These are waiting:
          point at one to see its seal, and choose it to commission the initiation.
        </p>
      </div>

      <div className="page">
        <ul className={styles.grid} role="list">
          <li className={styles.covered}>
            <Link
              to="/report/krka"
              className={styles.card}
              aria-label={`${KRKA.company.legalName}: covered. Read the initiation.`}
            >
              <Seal
                seed={KRKA.company.legalName}
                size={152}
                monogram={KRKA.company.ticker}
                submark={`SI · ${KRKA.company.founded}`}
                ring={`${KRKA.company.legalName} · Initiation of coverage · ${longDate(KRKA.date)}`}
                draw="static"
                sheen
                className={styles.seal}
              />
              <span className={styles.name}>{KRKA.company.shortName}</span>
              <span className={styles.status}>
                <span className={styles.dot} aria-hidden="true" />
                Covered {longDate(KRKA.date)}
              </span>
            </Link>
          </li>
          {WAITING.map((c, i) => {
            const done = engraved.has(c.name);
            return (
              <li key={c.name} style={{ '--i': i } as CSSProperties}>
                <Link
                  to="/initiate"
                  className={styles.card}
                  data-engraved={done ? '' : undefined}
                  onPointerEnter={() => engrave(c.name)}
                  onFocus={() => engrave(c.name)}
                  onClick={() => setDraft({ company: c.name, country: 'Slovenia' })}
                  aria-label={`${c.name}: not yet covered. Initiate coverage.`}
                >
                  <Seal
                    seed={c.name}
                    size={152}
                    monogram={c.mark}
                    submark={c.listed ? 'SI · Listed' : 'SI · Private'}
                    ring={`${c.name} · Not yet covered`}
                    progress={done ? 1 : BEGUN}
                    duration={1700}
                    className={styles.seal}
                  />
                  <span className={styles.name}>{c.name.replace(/ (d\.d\.|d\.o\.o\.)$/, '')}</span>
                  <span className={styles.status}>
                    <span className={styles.dot} aria-hidden="true" />
                    {done ? 'Initiate coverage →' : 'Not yet covered'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
