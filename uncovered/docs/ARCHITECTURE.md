# Uncovered: architecture

## Stack, and why

| Choice                             | Why                                                                                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite 8, React 19, TypeScript 6** | A small client app with one heavy interactive piece (the seal) and long documents. React 19's static prerender gives every page real HTML at build time without a server framework; Vite builds the client, the server bundle and the single-file preview from one config. |
| **Static prerender, then hydrate** | Reports are documents: they should be readable without JavaScript, indexable, and fast on a phone. `scripts/prerender.mjs` renders each route with `prerenderToNodeStream` and writes flat HTML files; the client hydrates them.                                           |
| **CSS modules on tokens**          | No framework: the design is specific enough that utility classes would fight it. Tokens in one file, a module per component, container queries for page-like components.                                                                                                   |
| **No animation library**           | Every motion in the storyboard is a CSS keyframe or transition gated by reduced motion. The seal engraving is a small incremental canvas renderer.                                                                                                                         |
| **No 3D**                          | The seal carries the signature moment at a fraction of a WebGL scene's cost on a mid-range phone.                                                                                                                                                                          |
| **Static hosting**                 | Vercel (`vercel.json`: clean URLs, immutable caching for hashed assets, a 404 page). Any static host works the same way.                                                                                                                                                   |

## Source layout

```
src/
  app/          App shell, routes and per-page metadata
  home/         Front-page sections
  pages/        Report, Initiate, Method, NotFound, Home (lazy except Home)
  report/       The report model: types, Krka data, valuation engine, prose bindings,
                footnotes, cover, football field, sensitivity, reader figures and sources
  seal/         Guilloche geometry, canvas renderer, Seal component
  ui/           Masthead, footer, serial, microtext
  lib/          Router, theme, motion, formatting, hooks, request plan
  styles/       Tokens and base styles
  entry-server.tsx  Prerender entry
scripts/        prerender.mjs, package-artifact.mjs
e2e/            End-to-end and accessibility tests (Playwright, axe)
lab/            Development pages for tuning the seal (served by `vite`, not built)
```

## The content model

A report is data (`src/report/types.ts`), written by the research engine and rendered by the reader:

- **Company**: names, sector, country, founding year, listing, ISIN, website.
- **Sources**: id, title, publisher, address, date, grade (`filed`, `reported`, `estimated`) and the quoted sentence a figure rests on.
- **Prose**: summary, thesis, sections, risks and catalysts. Reported figures carry footnote markers (`€2,041.0m[^r25]`). Model outputs are never written as numbers; prose quotes them as tokens (`{{implied.margin}}`), filled from the engine by `src/report/bindings.ts`.
- **Lines**: reported financial lines with a footnote per period.
- **Breakdowns**: regions and shareholders, each with its source.
- **Assumptions**: forecast years, growth, margins, investment, working capital, tax, the cost-of-capital build-up with a one-line reason for each input, net cash and shares with their sources, the dividend and earnings models.
- **Market data**: price, date and source, 52-week high.

`src/report/valuation.ts` computes everything else: free cash flow by year, the terminal value, enterprise and equity value, value per share, the dividend discount model, the earnings-multiple range, the fair-value range (the average of the methods' lows, middles and highs), the sensitivity grid, and what the price implies (the EBITDA margin and the terminal growth at which the cash-flow model equals the price, solved by bisection).

Tests (`src/report/valuation.test.ts`) check the engine against hand-worked cases, check that every footnote resolves to a source and every token to a value, and check that the claims in the sample's summary hold against the numbers it quotes.

## Routing and builds

One codebase, two targets:

- **Production** (`npm run build`): history routing; code split per page, each with its own CSS; fonts for the first screen preloaded; every route prerendered (`dist/index.html`, `dist/report/krka.html`, `dist/initiate.html`, `dist/method.html`, `dist/404.html`) with its own title, description, stylesheet and module preloads. Set `SITE_URL` to also emit `sitemap.xml` and its line in `robots.txt`.
- **Preview** (`npm run build:preview`): one self-contained HTML file with hash routing (`#report.krka~valuation`), for embedded previews that pass only a plain `#anchor`. `scripts/package-artifact.mjs` strips the document skeleton the host supplies.

The router moves focus to the new page's heading after navigation (waiting for lazy pages to render), or to the target section when following an anchor, and uses view transitions where supported.

## Performance

Measured with Lighthouse 13 (mobile, simulated slow 4G and 4× CPU) against the production build:

| Page     | Performance | Accessibility | Best practices | SEO | LCP  | TBT  | CLS |
| -------- | ----------- | ------------- | -------------- | --- | ---- | ---- | --- |
| Home     | 94          | 100           | 100            | 100 | 2.6s | 86ms | 0   |
| Report   | 93          | 100           | 100            | 100 | 2.8s | 70ms | 0   |
| Initiate | 96          | 100           | 100            | 100 | 2.6s | 76ms | 0   |
| Method   | 95          | 100           | 100            | 100 | 2.7s | 88ms | 0   |

What got it there: the seal's sheen no longer reads canvas pixels back (that alone was 7 seconds of blocking time under throttling); seals draw only when they come into view; critical fonts are preloaded; every page is prerendered; each page loads its own CSS.

LCP is still a little over the 2.5s budget in the simulated profile; see `docs/AWARD_AUDIT.md` for the remaining fix.

## Testing

| Command                | What it checks                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | TypeScript, strict                                                                                                                  |
| `npm run lint`         | ESLint with the TypeScript, React hooks (compiler rules) and jsx-a11y rule sets                                                     |
| `npm run format:check` | Prettier                                                                                                                            |
| `npm test`             | Valuation engine, bindings and footnotes, request validation and research plans (Vitest)                                            |
| `npm run test:e2e`     | 36 Playwright tests on desktop and phone against the production build, including axe WCAG 2.2 AA scans of every page in both themes |

## Next: the research engine

The interface is ready for an engine that writes `Report` objects. The plan:

1. **Gather**: a server function calls the Claude API (model `claude-opus-5-5`, adaptive thinking, streaming) with the web search and web fetch tools (`web_search_20260209`, `web_fetch_20260209`) to find filings, releases and press for the company, and the Files API for documents a user attaches (AJPES annual reports, statements).
2. **Extract**: financial statements are extracted with structured outputs into reported lines, each figure with its document, page and the sentence it rests on, graded by evidence.
3. **Model**: the valuation engine above, unchanged, computes every number; the language model proposes assumptions with reasons, and they are shown as such.
4. **Write**: the model drafts prose that cites sources with `[^id]` markers and quotes model outputs with `{{key}}` tokens; the build-time checks (every marker resolves, every token has a value) run on every report before it is shown.
5. **Review**: for institutional desks, a named reviewer approves each report.

Each step is short and resumable, so the pipeline fits serverless time limits; the client polls for progress and fills the request slip's plan as steps complete.
