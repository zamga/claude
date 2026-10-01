import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartStage, type ChartMode } from '../chart/ChartStage';
import { readPalette } from '../chart/palette';
import { renderPoster } from '../chart/poster';
import { findCompany } from '../data/companies';
import { INDUSTRIES, MARKET } from '../data/market';
import type { CompanySnapshot } from '../data/types';
import { formatDate, formatPct, formatPrice } from '../engine/format';
import { clamp } from '../engine/stats';
import { announce } from '../lib/announce';
import { usePrefersReducedMotion } from '../lib/device';
import { absoluteUrl, Link, navigate } from '../lib/router';
import { readStored, writeStored } from '../lib/storage';
import { track } from '../lib/telemetry';
import { useHydrated } from '../lib/hydration';
import { historyCheck, marketGrowthLine, marketMarginLine, standingLine } from '../model/copy';
import { customSnapshot, decodeCustom, encodeCustom, loadCustom, saveCustom } from '../model/custom';
import { NARRATIVES } from '../model/narratives';
import { encodeScenario } from '../model/scenario';
import { MOATS } from '../model/survey';
import { useAnalysis } from '../model/useAnalysis';
import { useScenario } from '../model/useScenario';
import { HullGauge } from '../ui/HullGauge';
import { Loader } from '../ui/Loader';
import { Instrument } from '../ui/Instrument';
import { ModelTable } from '../ui/ModelTable';
import { Reading } from '../ui/Reading';
import { Sensitivity } from '../ui/Sensitivity';
import { Soundings } from '../ui/Soundings';
import { SurveyPanel } from '../ui/SurveyPanel';
import { NotFound } from './NotFound';
import styles from './ChartPage.module.css';

const SCENARIO_TOKEN_LENGTH = 70;

/** Production builds with the API deployed can survey any SEC filer on demand. */
export const LIVE_SURVEY = import.meta.env.VITE_LIVE_API === '1';

type LiveSnapshot = Omit<CompanySnapshot, 'price'> & { price: CompanySnapshot['price'] | null };

export function ChartPage({ ticker, token }: { ticker: string; token: string | null }) {
  const hydrated = useHydrated();
  // Decided once per company, when the page becomes interactive: is there a
  // shared link, a saved chart or a preference to restore? Then remount once.
  // Later address changes (copying a link) must not remount the chart.
  const personal = useMemo(
    () =>
      hydrated &&
      (!!token ||
        readStored(`chart:${ticker}`) !== null ||
        readStored(MODE_KEY) !== null ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, ticker],
  );
  const resolved = useMemo(() => {
    if (ticker !== 'custom') {
      const company = findCompany(ticker);
      return company ? { company, scenarioToken: token } : null;
    }
    // Custom companies carry their own figures in the link after the scenario.
    if (!hydrated) return null;
    const fromLink = token && token.length > SCENARIO_TOKEN_LENGTH ? decodeCustom(token.slice(SCENARIO_TOKEN_LENGTH)) : null;
    if (fromLink) saveCustom(fromLink);
    const entry = fromLink ?? loadCustom();
    if (!entry) return null;
    return {
      company: customSnapshot(entry),
      scenarioToken: token ? token.slice(0, SCENARIO_TOKEN_LENGTH) : null,
      entry,
    };
  }, [ticker, token, hydrated]);

  useEffect(() => {
    if (resolved) {
      const c = resolved.company;
      document.title = c.custom
        ? `${c.shortName} · Plimsoll`
        : `${c.shortName} valuation: what ${formatPrice(c.price.value)} assumes · Plimsoll`;
    }
  }, [resolved]);

  if (!resolved) {
    if (ticker === 'custom') return hydrated ? <NoCustom /> : <Loader label="Opening your survey…" />;
    return LIVE_SURVEY && /^[a-z][a-z0-9.-]{0,9}$/.test(ticker) ? (
      <LiveCompany key={ticker} ticker={ticker} token={token} />
    ) : (
      <NotFound />
    );
  }
  const customToken = 'entry' in resolved && resolved.entry ? encodeCustom(resolved.entry) : null;
  return (
    <ChartView
      key={`${resolved.company.ticker}:${resolved.company.name}:${personal ? 'personal' : 'default'}`}
      company={resolved.company}
      sharedToken={resolved.scenarioToken}
      customToken={customToken}
      restore={hydrated}
    />
  );
}

type LiveState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; company: LiveSnapshot };

/** A company outside the atlas, surveyed from SEC filings through /api/company. */
function LiveCompany({ ticker, token }: { ticker: string; token: string | null }) {
  const [state, setState] = useState<LiveState>({ status: 'loading' });
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/company?ticker=${encodeURIComponent(ticker)}`)
      .then(async (res) => {
        const body = (await res.json()) as { company?: LiveSnapshot; error?: string };
        if (cancelled) return;
        if (res.ok && body.company) setState({ status: 'ready', company: body.company });
        else setState({ status: 'error', message: body.error ?? 'The survey failed.' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'The survey service could not be reached.' });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    if (state.status === 'ready') document.title = `${state.company.shortName} · Plimsoll`;
  }, [state]);

  if (state.status === 'loading') return <Loader label={`Surveying ${ticker.toUpperCase()} from its SEC filings…`} />;
  if (state.status === 'error') {
    return (
      <section className={`page ${styles.empty}`}>
        <h1 data-page-focus tabIndex={-1}>Could not survey {ticker.toUpperCase()}</h1>
        <p>{state.message}</p>
        <Link to="/survey" className={styles.button}>
          Enter its figures yourself
        </Link>
      </section>
    );
  }
  const known = state.company.price ?? (price ? { value: price, asOf: new Date().toISOString().slice(0, 10), source: 'Entered by you' } : null);
  if (!known) {
    return (
      <section className={`page ${styles.empty}`}>
        <h1 data-page-focus tabIndex={-1}>{state.company.shortName}</h1>
        <p>Surveyed from its filings. Set sea level: what is the share price?</p>
        <form
          className={styles.priceForm}
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(new FormData(e.currentTarget).get('price'));
            if (v > 0) setPrice(v);
          }}
        >
          <label htmlFor="live-price">Share price, USD</label>
          <input id="live-price" name="price" inputMode="decimal" required />
          <button type="submit" className={styles.button}>
            Draw the chart
          </button>
        </form>
      </section>
    );
  }
  return <ChartView company={{ ...state.company, price: known }} sharedToken={token} customToken={null} />;
}

function NoCustom() {
  return (
    <section className={`page ${styles.empty}`}>
      <h1 data-page-focus tabIndex={-1}>No company surveyed yet</h1>
      <p>Enter a few figures and Plimsoll will chart it.</p>
      <Link to="/survey" className={styles.button}>
        Survey your own company
      </Link>
    </section>
  );
}

const MODE_KEY = 'chart-mode';
// The single-file preview runs in a sandbox that ignores downloads; the image itself can still be saved.
const CAN_DOWNLOAD = import.meta.env.MODE !== 'artifact';

function ChartView({
  company,
  sharedToken,
  customToken,
  restore = true,
}: {
  company: CompanySnapshot;
  sharedToken: string | null;
  customToken: string | null;
  restore?: boolean;
}) {
  const controls = useScenario(company, sharedToken, restore);
  const { scenario, base } = controls;
  const a = useAnalysis(company, scenario);
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<ChartMode>(() =>
    restore ? (readStored<ChartMode>(MODE_KEY) ?? (reduced ? '2d' : '3d')) : '3d',
  );
  const stageApi = useRef<{ home: () => void; topDown: () => void; snapshot: () => string } | null>(null);
  const [has3d, setHas3d] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<{ url: string; token: string } | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const posterRef = useRef<HTMLDialogElement>(null);
  const { inputs, price } = scenario;
  const e = a.extent;
  const name = company.shortName;

  const bearing = useMemo(() => ({ growth: inputs.growth, margin: inputs.targetMargin }), [inputs.growth, inputs.targetMargin]);
  const today = useMemo(
    () => ({ growth: clamp(a.facts.lastGrowth ?? 0, e.growthMin, e.growthMax), margin: a.facts.operatingMargin }),
    [a.facts.lastGrowth, a.facts.operatingMargin, e.growthMin, e.growthMax],
  );

  const onBearing = useCallback(
    (g: number, m: number) => {
      controls.setBearing(clamp(Number(g.toFixed(4)), -0.4, 1.2), clamp(Number(m.toFixed(4)), -0.5, 0.95));
      track('bearing', undefined, { once: true });
    },
    [controls],
  );

  // Announce the settled reading for screen-reader users.
  useEffect(() => {
    announce(
      `Bearing ${formatPct(inputs.growth, 1)} growth, ${formatPct(inputs.targetMargin, 1)} margin. Value ${formatPrice(a.value)}, ${
        a.standing === 'under' ? 'under water' : a.standing === 'thin' ? 'thin freeboard' : 'above the load line'
      }.`,
      900,
    );
  }, [inputs.growth, inputs.targetMargin, a.value, a.standing]);

  const setChartMode = (m: ChartMode) => {
    setMode(m);
    writeStored(MODE_KEY, m);
  };

  const shareToken = encodeScenario(scenario) + (customToken ?? '');

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const copyLink = async () => {
    const path = `/chart/${company.ticker.toLowerCase()}`;
    navigate(path, { replace: true, state: shareToken, quiet: true });
    track('share');
    const url = absoluteUrl(path, shareToken);
    try {
      await navigator.clipboard.writeText(url);
      setShareLink(null);
      flash('Link copied. It opens this exact chart.');
    } catch {
      // The clipboard can be refused (permissions, embedded viewers): offer the link as text to copy.
      setShareLink({ url, token: shareToken });
      flash('Copy the link below. It opens this exact chart.');
    }
  };
  // A link shown for copying goes stale as soon as the chart changes.
  const pendingLink = shareLink && shareLink.token === shareToken ? shareLink.url : null;

  const makePoster = async () => {
    track('image');
    const canvas = await renderPoster({
      name,
      ticker: company.ticker,
      industry: company.industryLabel,
      priceDate: company.price.asOf,
      price,
      grid: a.grid,
      field: a.field,
      palette: readPalette(),
      marginOfSafety: scenario.marginOfSafety,
      bearing,
      today,
      soundings: a.monteCarlo.soundings,
      value: a.value,
      freeboard: a.freeboard,
      odds: a.monteCarlo.probAbovePrice,
      marketGrowth: a.marketGrowth,
      bearingMargin: inputs.targetMargin,
    });
    setPoster(canvas.toDataURL('image/png'));
    requestAnimationFrame(() => posterRef.current?.showModal());
  };

  const moat = inputs.terminalRoic - inputs.terminalCostOfCapital;
  const beta = INDUSTRIES[company.industry].beta;
  const story = NARRATIVES.find((n) => n.id === scenario.storyId);
  const marketG = a.marketGrowth.kind === 'solved' ? a.marketGrowth.value : null;
  const marketM = a.marketMargin.kind === 'solved' ? a.marketMargin.value : null;
  const fyEnd = formatDate(company.fiscalYearEnd);

  const summary = `Chart of ${name}'s value per share for every combination of revenue growth (left to right, ${formatPct(
    e.growthMin,
    0,
  )} to ${formatPct(e.growthMax, 0)}) and operating margin (bottom to top, ${formatPct(e.marginMin, 0)} to ${formatPct(
    e.marginMax,
    0,
  )}). Land is worth more than the price of ${formatPrice(price)}; water is worth less. ${marketGrowthLine(
    name,
    price,
    inputs.targetMargin,
    a.marketGrowth,
  )} Your bearing is ${formatPct(inputs.growth, 1)} growth at a ${formatPct(inputs.targetMargin, 1)} margin, worth ${formatPrice(
    a.value,
  )}.`;

  return (
    <article className={styles.page}>
      <header className={`page ${styles.cartouche}`}>
        <div className={styles.titleBlock}>
          <p className="eyebrow">
            {company.custom ? 'Surveyed by you' : company.ticker} · {company.industryLabel}
          </p>
          <h1 className={styles.title} data-page-focus tabIndex={-1}>
            {name}
          </h1>
          <p className={styles.blurb}>{company.blurb}</p>
        </div>
        <div className={styles.datum}>
          <div className={styles.seaField}>
            <label htmlFor="sea-level" className={styles.seaLabel}>
              <em>Sea level</em> · share price
            </label>
            <span className={styles.seaInput}>
              <span aria-hidden="true">$</span>
              <PriceInput id="sea-level" value={price} onCommit={controls.setPrice} />
            </span>
          </div>
          <p className={styles.datumNote}>
            {company.custom ? 'Your reference price' : `Close on ${formatDate(company.price.asOf)}`}
            {price !== company.price.value && (
              <>
                {' · '}
                <button type="button" className={styles.linkButton} onClick={() => controls.setPrice(company.price.value)}>
                  Back to {formatPrice(company.price.value)}
                </button>
              </>
            )}
          </p>
          <p className={styles.datumNote}>
            Surveyed from the {company.fiscalYearLabel} annual figures, year ended {fyEnd}
          </p>
        </div>
      </header>

      <section className="page" aria-label="Reading">
        <Reading
          value={a.value}
          price={price}
          freeboard={a.freeboard}
          standing={a.standing}
          odds={a.monteCarlo.probAbovePrice}
          draws={a.monteCarlo.draws}
          bearingMargin={inputs.targetMargin}
          marketGrowth={a.marketGrowth}
          stale={a.stale}
        />
        <div className={styles.lines}>
          <p className={styles.market}>
            {marketGrowthLine(name, price, inputs.targetMargin, a.marketGrowth)}{' '}
            {marketMarginLine(inputs.growth, a.marketMargin)}{' '}
            {historyCheck(name, a.marketGrowth, a.facts.historicalCagr, a.facts.historyYears)}
          </p>
          <p className={styles.yours}>{standingLine(a.standing, a.value, price, scenario.marginOfSafety)}</p>
        </div>
      </section>

      <section className={`page ${styles.bench}`} aria-label="Chart and assumptions">
        <div className={styles.stageCol}>
          <div className={styles.toolbar}>
            <div className={styles.segment} role="radiogroup" aria-label="Chart view">
              <button type="button" role="radio" aria-checked={mode === '3d' && has3d} disabled={!has3d} onClick={() => setChartMode('3d')}>
                Relief
              </button>
              <button type="button" role="radio" aria-checked={mode === '2d' || !has3d} onClick={() => setChartMode('2d')}>
                Flat chart
              </button>
            </div>
            {mode === '3d' && has3d && (
              <div className={styles.viewTools}>
                <button type="button" onClick={() => stageApi.current?.home()}>
                  Reset view
                </button>
                <button type="button" onClick={() => stageApi.current?.topDown()}>
                  Look down
                </button>
              </div>
            )}
            <div className={styles.share}>
              <button type="button" onClick={copyLink}>
                Copy link
              </button>
              <button type="button" onClick={makePoster}>
                Chart image
              </button>
            </div>
            {pendingLink && <ShareField id="share-link" url={pendingLink} />}
          </div>
          <div className={styles.stage}>
            <ChartStage
              grid={a.grid}
              field={a.field}
              price={price}
              marginOfSafety={scenario.marginOfSafety}
              bearing={bearing}
              today={today}
              soundings={a.monteCarlo.soundings}
              mode={mode}
              subject={company.ticker}
              onBearing={onBearing}
              label={`Value chart for ${name}`}
              summary={summary}
              onReady={(api) => {
                stageApi.current = api;
                if (!api && mode === '3d') setHas3d(false);
              }}
            />
          </div>
          <ul className={styles.key} role="list" aria-label="Chart key">
            <li className={styles.kLand}>Land: worth more than the price</li>
            <li className={styles.kBank}>Drying bank: inside your margin of safety</li>
            <li className={styles.kWater}>Water: worth less than the price</li>
            <li className={styles.kCoast}>
              <em>Coastline: the market’s story</em>
            </li>
            <li className={styles.kBearing}>Your bearing (drag it)</li>
            <li className={styles.kToday}>Today</li>
          </ul>
        </div>

        <aside className={styles.log} aria-label="Assumptions">
          <h2 className={styles.logTitle}>Your story</h2>
          <div className={styles.stories} role="radiogroup" aria-label="Story presets">
            {NARRATIVES.map((n) => (
              <button
                key={n.id}
                type="button"
                role="radio"
                aria-checked={scenario.storyId === n.id}
                onClick={() => {
                  controls.applyStory(n.id);
                  track('story', n.id);
                }}
              >
                {n.title}
              </button>
            ))}
          </div>
          <p className={styles.storyLine} aria-live="polite">
            {story ? story.line : 'Your own story. Drag the bearing or adjust any assumption.'}
          </p>

          <Instrument
            label="Revenue growth, years 1–5"
            hint="Then fades to the long-run rate by year 10. Left to right on the chart."
            value={inputs.growth}
            onChange={(v) => controls.setInput('growth', v)}
            min={-0.2}
            max={Math.max(0.6, e.growthMax)}
            step={0.5}
            unit="pct"
            markers={[
              ...(a.facts.historicalCagr !== null
                ? [{ value: a.facts.historicalCagr, label: `Past ${formatPct(a.facts.historicalCagr, 0)}`, kind: 'today' as const }]
                : []),
              ...(marketG !== null ? [{ value: marketG, label: `Market ${formatPct(marketG, 0)}`, kind: 'market' as const }] : []),
            ]}
          />
          <Instrument
            label="Operating margin, target"
            hint="Operating income as a share of revenue. Bottom to top on the chart."
            value={inputs.targetMargin}
            onChange={(v) => controls.setInput('targetMargin', v)}
            min={-0.3}
            max={0.9}
            step={0.5}
            unit="pct"
            markers={[
              { value: a.facts.operatingMargin, label: `Today ${formatPct(a.facts.operatingMargin, 0)}`, kind: 'today' },
              ...(marketM !== null ? [{ value: marketM, label: `Market ${formatPct(marketM, 0)}`, kind: 'market' as const }] : []),
            ]}
          />
          <Instrument
            label="Years to reach that margin"
            value={inputs.convergenceYears}
            onChange={(v) => controls.setInput('convergenceYears', Math.round(v))}
            min={1}
            max={10}
            step={1}
            unit="years"
          />
          <Instrument
            label="Cost of capital"
            hint={
              <>
                The return investors demand. Default: {formatPct(MARKET.riskFreeRate, 2)} risk-free + {beta.toFixed(2)} ×{' '}
                {formatPct(MARKET.equityRiskPremium, 1)} equity premium = {formatPct(base.costOfCapital, 1)}.
              </>
            }
            value={inputs.costOfCapital}
            onChange={controls.setCostOfCapital}
            min={0.05}
            max={0.16}
            step={0.1}
            unit="pct"
            markers={[{ value: base.costOfCapital, label: 'Default', kind: 'today' }]}
          />
          <Instrument
            label="Revenue per $1 reinvested"
            hint="How much new revenue each dollar of investment buys. Higher means growth is cheaper."
            value={inputs.salesToCapital}
            onChange={(v) => controls.setInput('salesToCapital', v)}
            min={0.3}
            max={8}
            step={0.05}
            unit="x"
            markers={[{ value: base.salesToCapital, label: 'Survey', kind: 'today' }]}
          />
          <fieldset className={styles.moat}>
            <legend>Moat after year 10</legend>
            <p className={styles.hint}>Extra return on new capital the business keeps forever.</p>
            <div className={styles.segment} role="radiogroup" aria-label="Moat">
              {MOATS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={Math.abs(moat - m.spread) < 0.0005}
                  onClick={() => controls.setMoat(m.spread)}
                >
                  {m.label}
                  <span>+{formatPct(m.spread, 0)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Instrument
            label="Growth after year 10"
            hint={`Forever. Kept at or below the ${formatPct(MARKET.riskFreeRate, 2)} risk-free rate.`}
            value={inputs.terminalGrowth}
            onChange={(v) => controls.setInput('terminalGrowth', v)}
            min={0}
            max={MARKET.riskFreeRate}
            step={0.1}
            unit="pct"
          />
          <Instrument
            label="Tax rate, next five years"
            hint={`Moves to the ${formatPct(MARKET.marginalTaxRate, 0)} marginal rate by year 10.`}
            value={inputs.taxRate}
            onChange={(v) => controls.setInput('taxRate', v)}
            min={0}
            max={0.35}
            step={0.5}
            unit="pct"
          />

          <h2 className={styles.logTitle}>Your terms</h2>
          <Instrument
            label="Margin of safety"
            hint="How far below your value the price must sit before you would buy. Sets the load line."
            value={scenario.marginOfSafety}
            onChange={controls.setMarginOfSafety}
            min={0}
            max={0.5}
            step={1}
            unit="pct"
          />
          <Instrument
            label="How sure are you?"
            hint="Widens or narrows the ranges the soundings are drawn from. 1× is the default spread."
            value={scenario.uncertainty}
            onChange={controls.setUncertainty}
            min={0.25}
            max={2}
            step={0.05}
            unit="x"
          />
          <button type="button" className={styles.reset} onClick={controls.reset}>
            Reset to the survey
          </button>
        </aside>

        <div className={styles.gaugeCol}>
          <h2 className="visually-hidden">Hull</h2>
          <HullGauge
            price={price}
            value={a.value}
            loadLine={a.loadLine}
            p10={a.monteCarlo.p10}
            p90={a.monteCarlo.p90}
          />
        </div>
      </section>

      <section className={`page ${styles.section}`} aria-labelledby="soundings-h">
        <header className={styles.sectionHead}>
          <h2 id="soundings-h">Soundings</h2>
          <p>
            {a.monteCarlo.draws.toLocaleString('en-US')} revaluations with growth, margin, cost of capital and capital needs
            drawn from your ranges. Four in five land between {formatPrice(a.monteCarlo.p10)} and{' '}
            {formatPrice(a.monteCarlo.p90)}.
          </p>
        </header>
        <Soundings mc={a.monteCarlo} price={price} value={a.value} loadLine={a.loadLine} />
      </section>

      <section className={`page ${styles.section}`} aria-labelledby="sensitivity-h">
        <header className={styles.sectionHead}>
          <h2 id="sensitivity-h">Sensitivity</h2>
          <p>
            Value per share as the two quietest inputs move. Small changes in the cost of capital and in growth after year
            ten move value more than most stories do.
          </p>
        </header>
        <Sensitivity rows={a.sensitivity} price={price} />
      </section>

      <section className={`page ${styles.section}`} aria-labelledby="survey-h">
        <header className={styles.sectionHead}>
          <h2 id="survey-h">Survey</h2>
          <p>What the filings say, before any story. These figures set the starting assumptions.</p>
        </header>
        <SurveyPanel company={company} survey={a.facts} />
      </section>

      <section className={`page ${styles.section}`} aria-labelledby="model-h">
        <header className={styles.sectionHead}>
          <h2 id="model-h">The model</h2>
          <p>Every number behind your value, year by year. USD.</p>
        </header>
        <ModelTable result={a.result} inputs={inputs} />
      </section>

      <section className={`page ${styles.section}`} aria-labelledby="sources-h">
        <header className={styles.sectionHead}>
          <h2 id="sources-h">Sources and notes</h2>
        </header>
        <div className={styles.sources}>
          {company.sources.length > 0 ? (
            <ul>
              {company.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>Figures entered by you.</p>
          )}
          {company.notes && <p>{company.notes}</p>}
          <p>
            Prices are closing prices on {formatDate(company.price.asOf)}. Figures are in US dollars. A model is a way to
            think, not a forecast or advice. <Link to="/method">How the chart is drawn</Link>.
          </p>
        </div>
      </section>

      <div className={styles.toast} role="status" aria-live="polite">
        {toast}
      </div>

      <dialog ref={posterRef} className={styles.posterDialog} aria-label="Chart image" onClose={() => setPoster(null)}>
        {poster && (
          <div className={styles.posterBody}>
            <img src={poster} alt={`Chart of ${name} with your reading`} />
            <div className={styles.posterActions}>
              {CAN_DOWNLOAD && (
                <a href={poster} download={`plimsoll-${company.ticker.toLowerCase()}.png`} className={styles.button}>
                  Download PNG
                </a>
              )}
              <button type="button" onClick={copyLink}>
                Copy link
              </button>
              <button type="button" onClick={() => posterRef.current?.close()}>
                Close
              </button>
            </div>
            {pendingLink && <ShareField id="share-link-image" url={pendingLink} />}
            <p className={styles.posterHint}>
              {CAN_DOWNLOAD
                ? 'If the download is blocked, right-click or long-press the image to save it.'
                : 'Right-click or long-press the image to save it.'}
            </p>
          </div>
        )}
      </dialog>
    </article>
  );
}

/** The share link as selectable text, for when the clipboard is refused. */
function ShareField({ id, url }: { id: string; url: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [url]);
  return (
    <div className={styles.shareField}>
      <label htmlFor={id}>Link to this chart</label>
      <input ref={ref} id={id} type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}

/** Price entry that commits on blur or Enter, so typing does not redraw the sea mid-number. */
function PriceInput({ id, value, onCommit }: { id: string; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) {
      const n = Number(draft.replace(/[^\d.]/g, ''));
      if (n > 0 && Number.isFinite(n)) onCommit(n);
    }
    setDraft(null);
  };
  const text = draft ?? value.toFixed(2);
  return (
    <input
      id={id}
      inputMode="decimal"
      value={text}
      style={{ width: `${Math.max(4, text.length) + 0.6}ch` }}
      onFocus={(e) => {
        setDraft(value.toFixed(2));
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
