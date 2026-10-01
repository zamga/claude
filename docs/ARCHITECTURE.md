# Site architecture and production stack

## Sitemap

```
/                   Home: live chart hero, how to read a chart, the Plimsoll story, atlas teaser, manifesto
/chart/:ticker      The instrument for one company (13 surveyed; any SEC filer when the API is on)
/chart/custom       A company you surveyed yourself
/atlas              Every surveyed company on one shared chart window
/survey             Survey your own: seven figures to a chart
/method             The model, defaults, data, limits and glossary
*                   Here be dragons (404)
```

Static hosts without rewrites, and sandboxed previews, use hash addresses that survive as plain anchors: `#chart.nvda`, `#chart.nvda~<token>`.

## Journeys (two moves to anything)

| Visitor | Move 1 | Move 2 |
|---|---|---|
| Curious investor | Home hero: pick NVIDIA, read “the market is betting on 33% growth” | Open the chart; drag the bearing |
| Analyst | ⌘K, type a ticker | Set stories, cost of capital, moat; copy the link for a colleague |
| Startup employee | Survey your own | Enter seven figures; read the odds at the round price |
| Teacher | Method | Share a chart link with fixed assumptions to a class |

## Content model

| Entity | Fields | Owner |
|---|---|---|
| `CompanySnapshot` | ticker, names, industry, blurb, fiscal year, five years of revenue and operating income, balance sheet, shares, price and date, sources, notes | Data editors (review via pull request) |
| `MARKET` | risk-free rate and date, equity risk premium, marginal tax, terminal growth cap | Data editors |
| `INDUSTRIES` | label, beta | Data editors |
| `Narrative` | id, title, one-line story, how it sets the inputs | Product |
| `Scenario` (per visitor) | inputs, sea level, margin of safety, uncertainty, story | The visitor; stored locally and in share links |

Editors change figures without touching layout: every page derives copy, extents and defaults from these records, and the type checker rejects malformed entries.

## Stack, and why

| Choice | Why |
|---|---|
| **Vite 8 + React 19 + TypeScript 6** | The product is an instrument, not a content site: nearly all value is client-side computation and WebGL. Vite gives the smallest runtime, code splitting per route and a single-file build for previews. |
| **Three.js (WebGLRenderer, GLSL)** | Terrain displaced on the GPU from a float texture; contour, waterline and coastline lines drawn in the fragment shader with `fwidth` anti-aliasing. Loaded only when a chart needs relief. |
| **Canvas 2D** | The flat chart: first paint, reduced-motion view, WebGL fallback, thumbnails and the printable chart image all share one renderer. |
| **No GSAP, no smooth-scroll library** | Native scrolling, CSS scroll-driven arrivals where supported, View Transitions for page changes. Nothing hijacks the scroll or traps touch. |
| **Valuation engine in plain TypeScript** | 6,400 valuations for a terrain and 4,000 for the soundings run in a few milliseconds; deferred rendering keeps input responsive without a worker. |
| **Vercel (or any edge CDN) + two serverless functions** | `/api/company` surveys any SEC filer from EDGAR XBRL, cached at the edge for six hours; `/api/telemetry` collects field data. Security headers, including a hash-only Content-Security-Policy, live in `vercel.json` and are mirrored by `vite preview`. |

## Data flow

```
SEC EDGAR companyfacts ──► src/data/sec.ts (normalise) ──► /api/company (live)
                                    │
                                    └──► scripts/refresh-data.ts ──► review ──► src/data/companies.ts (snapshot)

companies.ts ─► survey() ─► baseInputs() ─► Scenario (visitor) ─► useAnalysis()
                                                         ├─ valueGrid 80×80 ─► terrain / flat chart / coastline
                                                         ├─ valueCompany ─► reading, model table
                                                         ├─ impliedGrowth / impliedMargin ─► the market’s story
                                                         ├─ runMonteCarlo 4,000 draws ─► odds, hull bracket
                                                         └─ sensitivityTable ─► cost of capital × growth table
```

## Rendering pipeline

1. **Prerender.** `npm run build` renders all 17 public routes to static HTML with React 19's `prerender` (`src/entry-server.tsx`, `scripts/prerender.mjs`). Each page gets its own title, description, canonical URL and Open Graph tags, and the build writes `sitemap.xml`, `robots.txt` and `llms.txt`. Suspense boundaries are never outlined (`progressiveChunkSize` is unlimited): React's default would paint an empty fallback and swap the content in with a throttled script, a layout shift of 0.25 waiting to happen.
2. **Paint, then hydrate.** The browser paints the prerendered HTML first; `hydrateRoot` runs in the task after the next frame (`src/main.tsx`), so React's work never holds the headline back.
3. **Upgrade when idle.** The flat Canvas 2D chart is drawn on hydration. Relief (Three.js, 140 KB) loads in idle time, and only after a worker has checked for real GPU WebGL (`src/lib/device.ts`); software rasterisers, Save-Data and low-memory devices keep the flat chart.
4. **Route chunks.** Chart, atlas, method and survey pages are separate chunks; client-side navigation runs inside a View Transition.

Hosts that cannot rewrite deep links get the same app with hash routing (`npm run build:artifact`, one self-contained HTML file).

## Observability

`src/lib/telemetry.ts` reports field data when `VITE_TELEMETRY_URL` is set at build time:

- **Core Web Vitals** (LCP, INP, CLS, FCP, TTFB) via `web-vitals` 6 with attribution: the LCP element, the slowest interaction's target, the largest shift's source.
- **Errors**: uncaught exceptions and unhandled rejections, including hydration errors, deduplicated and capped at 10 a page view.
- **Product actions**: story chosen, bearing moved, link copied, image made, search, survey, and whether relief rendered or fell back (and why).

Batches go out with `sendBeacon` when the page is hidden, as `text/plain` (no CORS preflight). Each is tagged with the deploy's short commit hash, so a regression points at a release. The collector, `api/telemetry.ts`, validates and trims every batch (`src/lib/telemetry-schema.ts`), adds the country from the edge header (the IP is never read), writes NDJSON lines to the function log for a log drain, and optionally forwards them to `TELEMETRY_FORWARD_URL`.

Privacy: no cookies, no storage, no fingerprinting. Global Privacy Control and Do Not Track switch it off. Paths are reduced to route templates, so share tokens and a surveyed company's figures never leave the browser. Sampling is set by `VITE_TELEMETRY_SAMPLE`. Without `VITE_TELEMETRY_URL` the code is removed from the bundle at build time.

## Quality gates (`.github/workflows/ci.yml`)

| Job | What must pass |
|---|---|
| **check** | `tsc` strict, ESLint (with jsx-a11y and React Hooks), 52 unit tests (engine, SEC normaliser, contours, both API functions, the CSP), production build, asset budgets (`scripts/budget.mjs`) |
| **e2e** | 16 Playwright tests, each run on desktop and a Pixel 7 (32 runs): journeys, keyboard paths, typed values, share links and images, forced-WebGL relief, theme persistence (header and phone menu), reduced motion, and axe-core WCAG 2.2 AA scans of six routes with zero violations |
| **lighthouse** | `@lhci/cli` 0.15.1, mobile, 3 runs × 5 routes: performance ≥ 0.9 (median run), accessibility 1, best practices ≥ 0.95, SEO 1, CLS ≤ 0.1, TBT ≤ 300 ms (lab headroom; the field target is INP ≤ 200 ms), LCP ≤ 2.5 s (warning) |
| **visual** | Full-page screenshots of six routes × two themes × two devices against committed baselines, inside the pinned `mcr.microsoft.com/playwright:v1.56.1-noble` image |

## Performance budget (production build)

Enforced by `npm run budget` in CI. Sizes are gzip; the CDN serves Brotli, which is smaller.

| Asset | Size | Budget | Loaded |
|---|---|---|---|
| Initial JavaScript (app shell, home, data, React) | 94.6 KB | 105 KB | First visit |
| CSS (one file) | 12.6 KB | 16 KB | First visit, render-blocking |
| Fonts (3 core faces, woff2) | 114 KB | 125 KB | Preloaded |
| Chart page chunk | 14.0 KB | 20 KB | On navigation |
| Three.js relief | 139.8 KB | 160 KB | Idle, only where relief can render |
| Telemetry (`web-vitals`) | 5.3 KB | 8 KB | Idle, only when enabled |

Lab results with the CI configuration (Lighthouse mobile: simulated slow 4G, 4× CPU slowdown), median of three runs:

| Route | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 96 | 100 | 100 | 100 | 2.50 s | 32 ms | 0 |
| `/chart/nvda` | 96 | 100 | 100 | 100 | 2.46 s | 82 ms | 0 |
| `/atlas` | 94 | 100 | 100 | 100 | 2.46 s | 180 ms | 0 |
| `/method` | 97 | 100 | 100 | 100 | 2.46 s | 0 ms | 0.001 |
| `/survey` | 97 | 100 | 100 | 100 | 2.46 s | 0 ms | 0 |

LCP is the headline text, which needs no image or script. The canvas reserves its space, so nothing shifts when the chart arrives.
