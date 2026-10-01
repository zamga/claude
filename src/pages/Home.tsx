import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChartStage } from '../chart/ChartStage';
import { FlatChart } from '../chart/FlatChart';
import { COMPANIES, findCompany } from '../data/companies';
import { formatPct, formatPrice } from '../engine/format';
import { runMonteCarlo, defaultRanges } from '../engine/montecarlo';
import { seedFrom } from '../engine/random';
import { Link, navigate } from '../lib/router';
import { quickChart } from '../model/quickChart';
import { CompanyCard } from '../ui/CompanyCard';
import { PlimsollMark } from '../ui/Mark';
import { HullIllustration } from '../ui/HullIllustration';
import styles from './Home.module.css';

const FEATURED = ['NVDA', 'AAPL', 'KO', 'TSLA', 'COST', 'INTC'];
// Lift the block clear of the reading card on wide screens.
const heroShift =
  typeof window !== 'undefined' && window.matchMedia('(min-width: 60.01rem)').matches ? { x: 0.04, y: 0.12 } : undefined;

export function Home() {
  useEffect(() => {
    document.title = 'Plimsoll · The price is sea level';
  }, []);

  return (
    <>
      <Hero />
      <HowToRead />
      <Story />
      <AtlasTeaser />
      <Manifesto />
      <SurveyCta />
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  const [ticker, setTicker] = useState('NVDA');
  const company = findCompany(ticker)!;
  const q = useMemo(() => quickChart(company, 80), [company]);
  const [query, setQuery] = useState('');
  const [miss, setMiss] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q0 = query.trim().toLowerCase();
    if (!q0) return;
    const hit =
      COMPANIES.find((c) => c.ticker.toLowerCase() === q0) ??
      COMPANIES.find((c) => c.shortName.toLowerCase().startsWith(q0) || c.name.toLowerCase().includes(q0));
    if (hit) navigate(`/chart/${hit.ticker.toLowerCase()}`);
    else setMiss(query.trim());
  };

  const story =
    q.marketGrowth.kind === 'solved' ? (
      <>
        about <strong>{formatPct(q.marketGrowth.value, 0)}</strong> revenue growth a year for five years at today’s{' '}
        {formatPct(q.bearing.margin, 0)} margin
      </>
    ) : q.marketGrowth.kind === 'beyond' ? (
      <>margins far above today’s {formatPct(q.bearing.margin, 0)}: no growth rate is enough at today’s margin</>
    ) : (
      <>less than it earns today</>
    );

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`page ${styles.heroInner}`}>
        <div className={styles.heroText}>
          <p className="eyebrow">Company analysis &amp; valuation</p>
          <h1 id="hero-title" className={styles.h1}>
            <span>The price is</span>{' '}
            <span className={styles.waterline}>
              <span aria-hidden="true" className={styles.above}>
                sea level.
              </span>
              <span aria-hidden="true" className={styles.below}>
                sea level.
              </span>
              <span className="visually-hidden">sea level.</span>
            </span>
          </h1>
          <p className={styles.lede}>
            Plimsoll charts what a company is worth under every story you could tell about it, and draws the coastline the
            market is already betting on.
          </p>
          <form className={styles.search} onSubmit={onSubmit} role="search">
            <label htmlFor="hero-search" className="visually-hidden">
              Company or ticker
            </label>
            <input
              id="hero-search"
              type="text"
              placeholder="Company or ticker"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMiss(null);
              }}
              autoComplete="off"
              list="hero-companies"
            />
            <datalist id="hero-companies">
              {COMPANIES.map((c) => (
                <option key={c.ticker} value={c.shortName}>
                  {c.ticker}
                </option>
              ))}
            </datalist>
            <button type="submit">Chart it</button>
          </form>
          <p className={styles.miss} role="status">
            {miss && (
              <>
                “{miss}” is not surveyed yet. <Link to="/survey">Survey it yourself</Link> from its figures.
              </>
            )}
          </p>
          <div className={styles.chips} role="group" aria-label="Put a company on the chart">
            <span className={styles.chipsLabel}>On the chart:</span>
            {FEATURED.map((t) => {
              const c = findCompany(t)!;
              return (
                <button key={t} type="button" aria-pressed={t === ticker} onClick={() => setTicker(t)}>
                  {c.shortName}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.heroChart}>
          <ChartStage
            grid={q.grid}
            field={q.field}
            price={q.price}
            marginOfSafety={0.2}
            bearing={null}
            mode="3d"
            subject={ticker}
            ambient
            shift={heroShift}
            className={styles.heroStage}
            label={`Live chart of ${company.shortName}`}
            summary={`Value terrain for ${company.shortName}. Land is worth more than the ${formatPrice(q.price)} share price; water is worth less.`}
          />
          <aside className={styles.card} aria-live="polite">
            <p className={styles.cardHead}>
              <span className={styles.cardName}>{company.shortName}</span>
              <span className="water">sea level {formatPrice(q.price)}</span>
            </p>
            <p className={styles.cardStory}>
              <em>The market is betting on {story}.</em>
            </p>
            <Link to={`/chart/${ticker.toLowerCase()}`} className={styles.cardLink}>
              Open the chart <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- how to read */

const STEPS = [
  {
    title: 'Every point is a story.',
    body: 'Revenue growth runs left to right, operating margin bottom to top. Each point is one version of the next decade, and its height is what that version is worth per share.',
    layers: { sea: false, coast: 'none' as const },
  },
  {
    title: 'The price is sea level.',
    body: 'Flood the chart up to today’s share price. Land is every story worth more than the price. Water is every story worth less.',
    layers: { sea: true, coast: 'none' as const },
  },
  {
    title: 'The coastline is the market’s story.',
    body: 'Where land meets water, a story is worth exactly the price. That line is what the market is betting on, drawn in plain sight.',
    layers: { sea: true, coast: 'emphasis' as const },
  },
  {
    title: 'Your bearing, and its freeboard.',
    body: 'Plant your own story. Its height above the water is your margin of safety; the scatter of soundings shows how much of your range of belief stays dry.',
    layers: { sea: true, coast: 'normal' as const },
  },
];

function HowToRead() {
  const company = findCompany('META')!;
  const q = useMemo(() => quickChart(company, 80), [company]);
  const soundings = useMemo(
    () =>
      runMonteCarlo(q.inputs, defaultRanges(q.inputs), q.price, { draws: 1200, seed: seedFrom('how'), soundings: 260 })
        .soundings,
    [q],
  );
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const s = STEPS[step]!;
  return (
    <section className={`page ${styles.how}`} aria-labelledby="how-title">
      <div className={styles.howHead}>
        <p className="eyebrow">How to read a chart</p>
        <h2 id="how-title" className={styles.h2}>
          Four ideas, one picture.
        </h2>
      </div>
      <div className={styles.howBody}>
        <figure className={styles.howFigure}>
          <FlatChart
            grid={q.grid}
            field={q.field}
            price={q.price}
            layers={s.layers}
            today={q.today}
            bearing={step === 3 ? q.bearing : null}
            soundings={step === 3 ? soundings : null}
            axes
            spotSoundings={step >= 1}
            className={styles.howCanvas}
            label={`Example chart of ${company.shortName}, step ${step + 1}: ${s.title}`}
          />
          <figcaption>
            {company.shortName} at {formatPrice(q.price)}, on its as-it-is assumptions.
          </figcaption>
        </figure>
        <ol className={styles.steps} role="list">
          {STEPS.map((st, i) => (
            <li
              key={st.title}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-step={i}
              data-active={i === step ? 'true' : undefined}
              className={styles.step}
            >
              <span className={styles.stepNo} aria-hidden="true">
                {i + 1}
              </span>
              <h3>{st.title}</h3>
              <p>{st.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- the story */

function Story() {
  return (
    <section className={styles.story} aria-labelledby="story-title">
      <div className={`page ${styles.storyInner}`}>
        <div className={styles.storyArt}>
          <HullIllustration />
        </div>
        <div className={styles.storyText}>
          <p className="eyebrow">Why “Plimsoll”</p>
          <h2 id="story-title" className={styles.h2}>
            The line that stopped ships sinking.
          </h2>
          <div className="prose">
            <p>
              In the 1870s, overloaded and over-insured ships went down with their crews. Samuel Plimsoll, a member of
              Parliament, campaigned until the Merchant Shipping Act of 1876 made a load line on the hull compulsory. If the
              water rises above the mark, the ship is carrying too much.
            </p>
            <p>
              Investors overload too: they pay for a story without checking what it can carry. Plimsoll paints that line on
              every company. It sits at your value, less the margin of safety you insist on. Below it you have freeboard.
              Above it, you are overloaded.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- atlas */

function AtlasTeaser() {
  const picks = ['AAPL', 'NVDA', 'KO', 'COST', 'TSLA', 'NKE'].map((t) => findCompany(t)!);
  return (
    <section className={`page ${styles.atlas}`} aria-labelledby="atlas-title">
      <div className={styles.sectionHead}>
        <div>
          <p className="eyebrow">The atlas</p>
          <h2 id="atlas-title" className={styles.h2}>
            Thirteen companies, surveyed.
          </h2>
        </div>
        <Link to="/atlas" className={styles.more}>
          See every chart <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ul className={styles.grid} role="list">
        {picks.map((c) => (
          <li key={c.ticker}>
            <CompanyCard company={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- manifesto */

function Manifesto() {
  return (
    <section className={`page ${styles.manifesto}`} aria-labelledby="manifesto-title">
      <h2 id="manifesto-title" className={styles.h2}>
        What we left ashore, and what we carry.
      </h2>
      <div className={styles.columns}>
        <div>
          <h3 className={styles.colHead}>Left ashore</h3>
          <ul role="list" className={styles.ashore}>
            <li>Ticker tape and price alerts</li>
            <li>Buy, sell and hold ratings</li>
            <li>Scores, stars and grades</li>
            <li>A news feed</li>
            <li>Five hundred rows of ratios</li>
            <li>A fair value quoted to the cent</li>
          </ul>
        </div>
        <div>
          <h3 className={styles.colHead}>On board</h3>
          <ul role="list" className={styles.aboard}>
            <li>
              <em>The market’s story</em>, in one sentence
            </li>
            <li>Your story, in a handful of numbers</li>
            <li>Ranges and odds instead of verdicts</li>
            <li>Every assumption on show, and editable</li>
            <li>Private companies, too</li>
            <li>Charts you can share and reopen</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function SurveyCta() {
  return (
    <section className={`page ${styles.cta}`} aria-labelledby="cta-title">
      <PlimsollMark size={56} className={styles.ctaMark} />
      <div>
        <h2 id="cta-title" className={styles.h2}>
          Chart a company nobody has surveyed.
        </h2>
        <p className={styles.ctaText}>
          Your employer. A startup you are about to join. The business you own. Enter seven figures and see what it is worth
          under every story, and what a price implies.
        </p>
      </div>
      <Link to="/survey" className={styles.ctaButton}>
        Survey your own <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
