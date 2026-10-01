# Award audit

Scored as a jury would score the build at commit time, then as a developer-award jury would. The evidence is measured, not estimated: the numbers come from the CI configuration in this repository. **Verdict: ship.** This is a Site of the Day and Developer Award contender now. Year-level awards need the P0 and P1 fixes below.

## Evidence

| Check | Result |
|---|---|
| Lighthouse, mobile (CI config, median of 3 runs, 5 routes) | Performance 94–97 · Accessibility 100 · Best practices 100 · SEO 100 |
| Core Web Vitals, lab | LCP 2.46–2.50 s on simulated slow 4G · TBT ≤ 180 ms · CLS 0–0.001 |
| Accessibility | axe-core WCAG 2.2 A/AA: zero violations on 6 routes × desktop and Pixel 7; keyboard-operable chart; full reduced-motion experience; all text pairs ≥ 4.5 : 1 in both themes |
| Tests | 52 unit tests, 16 end-to-end tests × 2 devices, all green; production CSP enforced during the end-to-end run |
| Weight | 94.6 KB JS + 12.6 KB CSS + 114 KB fonts before first paint; Three.js (140 KB) only where relief can render |
| Security | CSP with no inline or evaluated script, HSTS, COOP, frame-ancestors none, no cookies |

## Jury scorecard (Awwwards weighting)

| Criterion | Weight | Score | Why it scores | What loses points |
|---|---|---|---|---|
| **Design** | 40% | 8.4 | A complete visual system from one source: Admiralty chart paper, hypsometric tints, italic hydrography, one magenta signal, draft-mark numerals, a neat-line footer, a designed Night watch. Editorial type with two optical sizes. | The restraint is deliberate, but jurors who expect a cinematic hero may read it as quiet. On a phone the chart page runs to eight blocks. |
| **Usability** | 30% | 8.6 | Two moves to anything, ⌘K everywhere, plain-language readings ("the market is betting on 33% growth"), every term with its plain name, a flat chart that never fails. | First-time readers meet new vocabulary (bearing, freeboard, soundings). The survey asks for seven figures with no import. |
| **Creativity** | 20% | 8.8 | A singular, ownable idea whose picture *is* the analysis: the coastline is a reverse DCF, freeboard is margin of safety, soundings are a Monte Carlo. A brand story that is literally true (Plimsoll, 1876). | The signature moment, the sea rising as the price changes, is dramatic in relief but only a redraw on the flat chart. |
| **Content** | 10% | 8.0 | Thirteen companies surveyed from SEC filings with sources and notes, a full method page, honest limits, and any SEC filer live when the API is on. | Prices are a snapshot (30 September 2026) unless the live API is configured. There is no editorial story per company yet. English only. |
| **Weighted** | | **8.50** | | |

## Developer award scorecard

| Criterion | Score | Notes |
|---|---|---|
| Semantics and SEO | 9.2 | Prerendered HTML for 17 routes, per-route title, description, canonical and Open Graph tags, sitemap, JSON-LD, `llms.txt`, `<dl>` readings, real tables, native dialogs. *Loses:* one shared social image for every route. |
| Animation and transitions | 8.6 | View Transitions between pages, render-on-demand WebGL, compositor-only CSS, scroll-driven arrivals with fallbacks, tidal easing throughout. *Loses:* the flat chart does not animate level changes. |
| Accessibility | 9.4 | Zero automated violations, keyboard bearing control, `aria-describedby` chart summaries, polite announcements, measured contrast, reduced motion as a full experience. *Loses:* no human screen-reader pass recorded yet. |
| Performance | 9.0 | Lighthouse 94–97 on mobile, CLS 0, hydration after first paint, fonts split by `unicode-range`, budgets enforced in CI. *Loses:* LCP sits right at the 2.5 s lab threshold; React is 62 KB of the initial 95 KB. |
| Responsive design | 9.0 | A phone layout of its own, touch semantics (one finger scrolls, two turn the relief), intrinsic grids, tablet header fixed. *Loses:* landscape phones and foldables not yet checked on hardware. |
| Markup and metadata | 9.0 | Manifest, icons, theme colours per scheme, security headers including CSP. *Loses:* no per-chart preview image or per-chart structured data. |
| **Average** | **9.03** | |

**CSSDA** (UI, UX, Innovation): 8.6, 8.6, 8.9. **FWA:** the shader terrain and the concept qualify; the spectacle is calm, which FWA juries reward less than Awwwards does. **Webbys:** strongest fit is *Best Data Visualization*, then *Financial Services* websites.

## Prioritised fixes

| # | Priority | Fix | Impact | Effort |
|---|---|---|---|---|
| 1 | P0 | **Real-device pass**: iPhone (Safari), a mid-range Android (Chrome), an iPad. Relief at 60 fps, INP while dragging, the View Transition fallback, touch gestures. | Usability, Performance; a juror on a phone sees what CI cannot | 1 day |
| 2 | P0 | **Screen-reader pass**: VoiceOver (iOS, macOS), NVDA with Firefox, TalkBack. Chart summary order, slider announcements, combobox. | Accessibility score and the Developer Award | 1 day |
| 3 | P0 | **Fresh data**: set `ALPHAVANTAGE_API_KEY` for live prices, and schedule `npm run data:refresh` as a monthly pull request. | Content; a stale datum reads as abandoned | ½ day |
| 4 | P0 | **Per-chart social images**: render each company's poster at build (Playwright in CI) to `/og/<ticker>.png` and point that route's `og:image` at it. | Sharing is the growth loop; today every link previews the same hero | 1 day |
| 5 | P1 | **Tide on the flat chart**: animate the sea between levels (700 ms, tide easing) so the signature moment survives on low-power devices; instant under reduced motion. | Creativity on phones | ½ day |
| 6 | P1 | **Shorter chart page on phones**: sensitivity, model and sources become disclosure sections below the bench. | Design and usability on phones | ½ day |
| 7 | P1 | **Record visual baselines** with the workflow's `update_baselines` input and commit them. | Regression safety for every later polish pass | 1 hour |
| 8 | P1 | **A case file per company**: two editorial paragraphs in the cartouche on what the market's story means for that business. | Content | Editorial |
| 9 | P2 | **Lighter runtime**: Preact with `preact/compat`, or islands for the home page, to free about 45 KB of initial JavaScript. | LCP headroom on slow networks | 2 days |
| 10 | P2 | **Structured data per chart**: schema.org `Dataset` with the SEC filings as `isBasedOn`. | Search | ½ day |

## Award submission

**Plimsoll. The price is sea level.**

**Challenge.** Valuation tools compete on data volume and verdicts: terminals for professionals, star ratings and a single "fair value" for everyone else. Neither answers the question that matters before you pay a price: what does this price assume, and how sure can anyone be? We set out to make valuation legible to non-experts without dumbing it down for analysts. It had to be honest about uncertainty and good enough to share, on any device.

**Idea.** Value as terrain, the price as sea level. Every point on the chart is a story about a company: revenue growth across, operating margin up. Its height is what that story is worth per share. Flood the landscape to today's share price: dry land is every story worth more, water every story worth less. The coastline is the market's own story, solved by a reverse DCF and drawn as a line. Plant your bearing on the chart and read your freeboard, how far you stand above the water. The name is Samuel Plimsoll's: in 1876 his load line made overloading a ship visible. Plimsoll paints the line for prices.

**Craft.**

- *A terrain computed per visitor.* 6,400 discounted-cash-flow valuations per chart, displaced on the GPU from a float texture. Contours, waterline and coastline are drawn per pixel with `fwidth` anti-aliasing. It renders only when something changes, and picking is ray-marched against the true surface.
- *A cartographic system, not a theme.* Italic for water (the market), upright for land (the company), magenta reserved for what you act on. A Night watch palette that preserves night vision, and data marks validated for colour-vision deficiency.
- *A flat chart as a first-class citizen.* One Canvas renderer draws the first paint, the reduced-motion view, the low-power fallback, the thumbnails and the printable chart image.
- *Odds instead of verdicts.* 4,000 seeded Monte Carlo revaluations become "odds on dry land" and a bracket on the hull gauge.
- *Shareable, reproducible, private.* A 70-character link reproduces any chart exactly. Private companies are surveyed from seven figures and never leave the browser.
- *Engineering to match.* Prerendered routes that paint before hydration, Lighthouse 94–97 on mobile, CLS 0, zero automated accessibility violations on two devices, a CSP with no inline script, and field telemetry that respects Global Privacy Control.

**Results.** Pre-launch. Lab results are above. Launch targets are measured by the built-in telemetry: p75 LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 per route, plus the share of chart visits that move the bearing, links copied per chart view, and companies surveyed.
