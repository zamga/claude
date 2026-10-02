import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { Cover } from '../report/Cover';
import { KRKA } from '../report/krka';
import { valueReport } from '../report/valuation';
import { FootnoteProvider } from '../report/Footnotes';
import { Link, navigate } from '../lib/router';
import { normaliseName } from '../lib/random';
import { COUNTRIES, setDraft } from '../lib/request';
import { askForTilt, tiltNeedsPermission } from '../inspect/tilt';
import styles from './Hero.module.css';

// The first example needs only the basic Latin font subset, so the first screen loads no extra font.
const EXAMPLES = [
  'Hidria d.o.o.',
  'Petrol d.d.',
  'Akrapovič d.d.',
  'Kolektor Group',
  'Gorenje d.o.o.',
  'Luka Koper d.d.',
];
const KRKA_VALUE = valueReport(KRKA);
const KRKA_KEY = normaliseName('Krka');

const never = () => () => {};

// Layout effects only run in the browser; the server render keeps the headline at its natural size.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The company the headline names once someone types one: the name as typed,
 * without a trailing legal form when it is long.
 */
function headlineName(typed: string): string | null {
  const name = typed.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const short = name.replace(/,?\s+(d\.?\s?d\.?|d\.?\s?o\.?\s?o\.?|s\.?p\.?|ltd|plc|ag|gmbh|inc|sa|nv)\.?$/i, '');
  return name.length > 16 && short.length >= 2 ? short : name;
}

export function Hero() {
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('Slovenia');
  const [example, setExample] = useState(0);
  const inputId = useId();
  const countryId = useId();
  const lastLineRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(1);
  // The cover and the headline follow typing a beat behind, so the seal is not re-engraved on every key.
  const shown = useDeferredValue(company);
  const isKrka = shown.trim() === '' || normaliseName(shown).startsWith(KRKA_KEY);
  const named = headlineName(shown);
  // Only a phone whose browser asks before reporting its tilt gets the offer, after hydration.
  const askTilt = useSyncExternalStore(
    never,
    () => tiltNeedsPermission() && window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );
  const [tiltAnswered, setTiltAnswered] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => window.clearInterval(t);
  }, []);

  // A long name is set smaller, never wider than its line, so nothing below it moves while you type.
  useBrowserLayoutEffect(() => {
    const line = lastLineRef.current;
    const typed = line?.querySelector<HTMLElement>('[data-typed]');
    if (!line || !typed) {
      setFit(1);
      return;
    }
    const measure = () => {
      const natural = typed.scrollWidth / (parseFloat(typed.style.getPropertyValue('--fit')) || 1);
      setFit(Math.max(0.3, Math.min(1, (line.clientWidth - 4) / Math.max(1, natural))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(line);
    return () => ro.disconnect();
  }, [named]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = company.trim();
    if (normaliseName(name).startsWith(KRKA_KEY)) {
      navigate('/report/krka');
      return;
    }
    setDraft({ company: name, country });
    navigate('/initiate');
  };

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`page ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={`eyebrow ${styles.eyebrow}`}>
            <span>Initiation of coverage</span>
            <span aria-hidden="true">·</span>
            <span>Listed or private</span>
            <span aria-hidden="true">·</span>
            <span>Slovenia and beyond</span>
          </p>
          {/*
           * Four lines, set explicitly. Typing a company puts its name on the last line in place of
           * "every company"; the sentence itself stays in the document for screen readers and search
           * engines, so the typed name is decoration.
           */}
          <h1 id="hero-title" className={styles.title} data-page-focus tabIndex={-1}>
            <span className={styles.line} style={{ '--i': 0 } as CSSProperties}>
              <span>Initiating</span>
            </span>{' '}
            <span className={styles.line} style={{ '--i': 1 } as CSSProperties}>
              <span>coverage</span>
            </span>{' '}
            <span className={styles.line} style={{ '--i': 2 } as CSSProperties}>
              <span>
                on{' '}
                <span className={styles.swap} data-out={named ? '' : undefined}>
                  <em>every</em>
                </span>
              </span>
            </span>{' '}
            <span ref={lastLineRef} className={`${styles.line} ${styles.last}`} style={{ '--i': 3 } as CSSProperties}>
              <span>
                <span className={styles.swap} data-out={named ? '' : undefined}>
                  company.
                </span>
                {named && (
                  <span
                    key={named}
                    className={styles.typed}
                    data-typed
                    aria-hidden="true"
                    style={{ '--fit': fit } as CSSProperties}
                  >
                    <em>{named}</em>.
                  </span>
                )}
              </span>
            </span>
          </h1>
          <p className={styles.lede}>
            Name a company. Uncovered researches it and writes the report a bank’s research desk would publish: thesis,
            financials, forecasts, valuation and risks, with every figure traced to its source.
          </p>

          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label htmlFor={inputId}>Company</label>
              <input
                id={inputId}
                name="company"
                type="text"
                autoComplete="organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={`e.g. ${EXAMPLES[example]}`}
                spellCheck={false}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={countryId}>Country</label>
              <select id={countryId} name="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <button type="submit" className={styles.submit} data-magnetic>
              <span>Initiate coverage</span>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </form>
          <p className={styles.sample}>
            Or read the sample: <Link to="/report/krka">Krka, d. d., Novo mesto</Link>, initiated 1 October 2026.
          </p>
        </div>

        <div className={styles.stage}>
          <FootnoteProvider sources={KRKA.sources}>
            <Cover
              report={isKrka ? KRKA : null}
              valuation={isKrka ? KRKA_VALUE : undefined}
              name={shown}
              size="hero"
              inspect
              tilt
              sweep
              carryWhenSeen
            />
          </FootnoteProvider>
          <p className={styles.caption} aria-live="polite">
            {isKrka ? (
              <>
                <span className={styles.forPointer}>Hold the cover to the light: every figure carries its source.</span>
                <span className={styles.forTouch}>Touch the cover to hold it to the light.</span>
              </>
            ) : (
              `Every company gets its own seal and paper. ${shown.trim()}’s are made from its name.`
            )}
          </p>
          {askTilt && !tiltAnswered && (
            <button
              type="button"
              className={styles.tilt}
              onClick={() => void askForTilt().then(() => setTiltAnswered(true))}
            >
              Tilt the phone to move the foil
            </button>
          )}
        </div>
      </div>

      <dl className={`page ${styles.stats}`}>
        <div>
          <dt>entities in Slovenia’s business register</dt>
          <dd className="display-num">294,000</dd>
        </div>
        <div>
          <dt>sources behind the sample report, each one footnoted</dt>
          <dd className="display-num">{KRKA.sources.length}</dd>
        </div>
        <div>
          <dt>valuation methods, computed in code, never typed in</dt>
          <dd className="display-num">3</dd>
        </div>
        <div>
          <dt>pages you can print, share and defend</dt>
          <dd className="display-num">A4</dd>
        </div>
      </dl>
    </section>
  );
}
