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
| **Vercel (or any edge CDN) + one serverless function** | `/api/company` surveys any SEC filer from EDGAR XBRL, cached at the edge for six hours. |

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

## Performance budget (production build)

| Asset | Size (gzip) | Loaded |
|---|---|---|
| App shell, home, data | 91 KB JS + 7 KB CSS | First paint |
| Fonts (3 critical faces) | 159 KB woff2 | Preloaded |
| Chart page | 14 KB JS + 5 KB CSS | On navigation |
| Three.js terrain | 144 KB JS | After first paint, only for relief |

LCP is the headline text, which needs no image or script. The canvas reserves its space, so nothing shifts when the chart arrives.
