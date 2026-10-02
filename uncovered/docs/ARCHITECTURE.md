# Uncovered: architecture

## Stack, and why

| Choice                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite 8, React 19, TypeScript 6**         | A small client app with one heavy interactive piece (the seal) and long documents. React 19's static prerender gives every page real HTML at build time without a server framework; Vite builds the client, the server bundle and the single-file preview from one config.                                                                                                                                                                                                                     |
| **Static prerender, then hydrate**         | Reports are documents: they should be readable without JavaScript, indexable, and fast on a phone. `scripts/prerender.mjs` renders each route with `prerenderToNodeStream` and writes flat HTML files; the client hydrates them.                                                                                                                                                                                                                                                               |
| **CSS modules on tokens**                  | No framework: the design is specific enough that utility classes would fight it. Tokens in one file, a module per component, container queries for page-like components.                                                                                                                                                                                                                                                                                                                       |
| **CSS first, GSAP where scroll drives it** | Most motion is CSS keyframes and transitions gated by reduced motion. GSAP's ScrollTrigger (free, plugins included) drives what the scroll position drives: the anatomy's deal and the lamp searching the register. Lenis gives inertial scrolling with a mouse or trackpad. All three load after the page is up, and not at all on touch screens (Lenis) or with reduced motion.                                                                                                              |
| **OGL for the two WebGL pieces**           | The inspected paper and the value landscape are each one small shader over real HTML, so text stays crisp, accessible and indexable. OGL (a few kilobytes, the API close to WebGL) rather than three.js, whose size buys nothing here. Both load on idle or when in view, and the page reads the same without them.                                                                                                                                                                            |
| **d3-geo for the engraved globe**          | The coverage globe is a 2D canvas (it needs no GPU) projected with d3-geo's orthographic projection from Natural Earth's public-domain 1:110m countries, cut and delta-encoded once by `scripts/geography.mjs` (10 kB compressed) and loaded only as the section approaches.                                                                                                                                                                                                                   |
| **Photographs rendered from the markup**   | The site's photography is of its own print: `scripts/plates` captures the built cover with Chromium at any magnification (type stays vector-sharp at 30×) and develops it through a physical model of intaglio ink, paper fibres, light and lens, in Node on worker threads, encoded by sharp. No licences, no stock, deterministic, and it works for any company the engine covers. The output is committed (`public/film`, `public/plates`, `public/social`), so builds and CI never run it. |
| **One Node server, or any static host**    | The site is static and runs on any static host (`vercel.json`). The engine needs a server: one Node process with no framework (`node:http`) serves the site, the API and engine reports, because a run lasts many minutes and streams its progress, which serverless functions handle badly.                                                                                                                                                                                                   |
| **Claude API, through the official SDK**   | `@anthropic-ai/sdk`: streamed requests, adaptive thinking, the web search server tool, strict client tools for recording evidence, and structured outputs (zod schemas) for the model and the prose.                                                                                                                                                                                                                                                                                           |
| **pdf.js and htmlparser2**                 | The engine reads documents itself, so it holds the exact text every quotation is checked against: Mozilla's pdf.js for PDFs, htmlparser2 for pages.                                                                                                                                                                                                                                                                                                                                            |

## Source layout

```
src/
  app/          App shell, routes and per-page metadata
  home/         Front-page sections; globe/ is the engraved coverage globe, closer/ the "Look closer" film
  pages/        Report, Initiate, Method, NotFound, Home (lazy except Home)
  report/       The report model: types, Krka data, valuation engine, prose bindings,
                footnotes, cover, football field, sensitivity, value landscape, reader figures and sources
  seal/         Guilloche geometry, canvas renderer, Seal component
  inspect/      The lamp (springs, sweep, tilt), the WebGL paper and the hook that makes a sheet inspectable
  motion/       Scroll choreography (GSAP ScrollTrigger, Lenis) and magnetic actions, loaded on demand
  ui/           Masthead, footer, serial, microtext
  lib/          Router, theme, motion, formatting (money in any currency), hooks, request plan, runs
  styles/       Tokens and base styles
  shell.ts      The HTML around a rendered page, shared by the prerender and the server
  entry-server.tsx  Server rendering entry
server/
  engine/       Research, the evidence ledger, the model, writing, the gate, the pipeline
    extract/    Text from PDFs and web pages
  http/         Configuration, API, progress stream, static site, rendered reports, limits, store
  fixtures/     The scripted test engine and a fictional company's annual report
  main.ts       Server entry
scripts/        prerender.mjs, package-artifact.mjs, wait-for.mjs, subset-fonts.py, geography.mjs;
                plates/ renders the photographs (capture, material, render, worker)
public/film/    The film's frames, versioned (look-closer/v1/{wide,tall}/NN.webp)
public/plates/  Single photographs (the cover under ultraviolet)
public/social/  The cards shown where a page is shared
e2e/            End-to-end and accessibility tests (Playwright, axe)
lab/            Development pages for tuning the seal (served by `vite`, not built)
```

## The content model

A report is data (`src/report/types.ts`), written by the research engine and rendered by the reader:

- **Kind and currency**: a hand-written sample or an engine report; the ISO currency every money figure is in.
- **Company**: names, sector, country, founding year, listing, ISIN, registration number, website.
- **Sources**: one per cited passage: document title, publisher, address, date, grade (`filed`, `reported`, `estimated`), the quoted sentence a figure rests on, its page, the document it belongs to, an English translation of a quotation in another language, whether the requester supplied it, and how the quotation was obtained (`verbatim`, checked by the engine; or `excerpt`, as in the hand-written sample).
- **Prose**: summary, thesis, sections, risks and catalysts. Reported figures carry footnote markers (`€2,041.0m[^r25]`). Model outputs are never written as numbers; prose quotes them as tokens (`{{implied.margin}}`), filled from the engine by `src/report/bindings.ts`.
- **Lines**: reported financial lines with a footnote per period.
- **Breakdowns**: regions and shareholders, each with its source.
- **Assumptions**: the valuation basis (per share for a listed company, the whole equity for one without traded shares), forecast years, growth, margins, investment, working capital, tax, the cost-of-capital build-up with a one-line reason for each input, net cash and shares with their sources, and the dividend, earnings and EV/EBITDA models where they apply.
- **Disclosures and question**: what this report's evidence does not cover, and the requester's question, answered in its own section.
- **Market data**: price, date and source, 52-week high.

`src/report/valuation.ts` computes everything else: free cash flow by year, the terminal value, enterprise and equity value, value per share, the dividend discount model, the earnings-multiple and EV/EBITDA ranges, the fair-value range (the average of the methods' lows, middles and highs), the sensitivity grid, what the price implies (the EBITDA margin and the terminal growth at which the cash-flow model equals the price, solved by bisection) and, without a price, the multiples the base case pays.

Tests (`src/report/valuation.test.ts`) check the engine against hand-worked cases, check that every footnote resolves to a source and every token to a value, and check that the claims in the sample's summary hold against the numbers it quotes.

## Routing and builds

One codebase, three targets:

- **Production** (`npm run build`): history routing; code split per page, each with its own CSS; fonts cut to the characters the site sets (`scripts/subset-fonts.py`) and preloaded; every route prerendered (`dist/index.html`, `dist/report/krka.html`, `dist/initiate.html`, `dist/method.html`, `dist/404.html`) with its own title, description, stylesheet and module preloads. Set `SITE_URL` to also emit `sitemap.xml` and its line in `robots.txt`.
- **Server** (`npm run build:server`): the engine and the server in one file, `dist-server/main.js`, serving `dist/` and rendering engine reports at `/report/:id` with the renderer in `dist-ssr/`. The server also renders the request page again at startup for its own engine, so the page's first paint already says whether requests run (the build renders it for a static host, which has none).
- **Preview** (`npm run build:preview`): one self-contained HTML file with hash routing (`#report.krka~valuation`), for embedded previews that pass only a plain `#anchor`. `scripts/package-artifact.mjs` strips the document skeleton the host supplies.

Pages are rendered whole: the renderer is told never to move large content out of line (React otherwise sends any Suspense content over about 12.8 kB hidden, to be revealed by a script), so every page reads without JavaScript and paints its content with the first HTML. A run's address is a page too: the server renders the slip as the run stands, with the run embedded, and the page follows the run on from the last event it was rendered with. The browser hydrates a page only at the address it was rendered for (path, plus the run on the request page; other parameters change nothing), and renders afresh anywhere else. Renders on the server take turns, because the address and what is given to a render are shared by the whole render.

The router moves focus to the new page's heading after navigation (waiting for lazy pages to render), or to the target section when following an anchor, and uses view transitions where supported.

## Performance

Measured with Lighthouse 13.5 (mobile, simulated slow 4G and 4× CPU), the median of three runs, against the production build as a static host serves it, after the photography round ("Look closer", the ultraviolet photograph, the notes, the resting lamp):

| Page     | Performance | Accessibility | Best practices | SEO | LCP  | TBT  | CLS |
| -------- | ----------- | ------------- | -------------- | --- | ---- | ---- | --- |
| Home     | 96          | 100           | 100            | 100 | 2.5s | 42ms | 0   |
| Report   | 95          | 100           | 100            | 100 | 2.6s | 21ms | 0   |
| Initiate | 97          | 100           | 100            | 100 | 2.4s | 18ms | 0   |
| Method   | 95          | 100           | 100            | 100 | 2.7s | 2ms  | 0   |

Against the build before the photography round, in alternating runs on the same machine, the front page went from 97 to 96 and its LCP from 2.4s to 2.5s; the report (2.6s), the request page (2.4s) and the method page (2.7–2.8s) measured the same in both. The container ran slower than when these pages were first measured (the report then measured 2.5s).

Total blocking time varies with the machine: the build before the last round of changes measured 4–20ms on the same container earlier in the day, before its processor slowed by about half (the method page's first layout went from 35ms to 70ms, with or without those changes). Before the redesign, served by the Node server running the scripted engine, the request page scored 96 (LCP 2.5s) and an engine-written report 96 (LCP 2.6s).

In the simulated profile, LCP lands when the app's script (110 kB) finishes downloading: Lighthouse cannot see when a module script runs, so it treats it as blocking the first paint, and every byte that shares the slow connection with it moves LCP. So the work went into bytes before the first paint:

- The front page's HTML arrives in the first round trip (under 14 kB compressed): CSS-module class names are short in builds (`_hero_87pk1_1` becomes `_k3Fz0`), and coordinates are rounded to what a screen can show. Add to the front page with that budget in mind: one more round trip costs about 150ms.
- The typefaces are cut to the characters the site sets (`scripts/subset-fonts.py`): 94 kB instead of 135 kB, with Slovenian letters in a 3–6 kB cut instead of a 20–28 kB Latin Extended file. Fonts are never inlined into the stylesheet, which also keeps one that was inlined before out of every page.
- The WebGL paper loads at the visitor's first move with the sheet in view, and bakes its fibres on the GPU; GSAP loads as its sections approach and Lenis at the first wheel; seals draw only when they come into view; every page is prerendered and loads its own CSS.
- "Look closer" costs the first paint nothing. Its code (3 kB) and styles (1 kB) load after the first scroll, touch or key, or 3s after load, and its frames only after that, once the stage is near: the three photographs first, then ever finer strides, one framing per screen (2.1 MB wide, 2.5 MB upright; every sixth frame with Save-Data). Anything requested before the first paint is counted in the simulation as competing with the app's script, which is why the contact sheet the page arrives with keeps its photographs in `<noscript>` until it is certain to stay. The register's seal rings are added after hydration, which keeps the front page's HTML inside the first round trip (14.3 kB compressed).
- WebGL and page transitions run only where a GPU draws them (`src/lib/gpu.ts`). Compositing in software, Chrome reads every changed WebGL frame back (650ms of read-back in one navigation here), and can stall capturing a page for a transition until its four-second limit, after which the test browser drew no further frames.

The method page is still over the 2.5s budget (it fetches Bodoni's 39 kB maths file for its formulas); see fix 5 in `docs/AWARD_AUDIT.md`.

## Testing

| Command                | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | TypeScript, strict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run lint`         | ESLint with the TypeScript, React hooks (compiler rules) and jsx-a11y rule sets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run format:check` | Prettier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm test`             | 91 Vitest tests: the film's camera path and scroll timeline, the valuation engine, bindings and footnotes, request validation, the evidence checks (normalising, quotation matching, numbers as printed), the fetcher's guards and robots.txt, PDF and HTML text, the ledger, the model's limits, the gate, a whole run with the scripted engine, run addresses and progress, and the server over HTTP (including the film's cached frames, compression, the pages it renders for itself and streams that resume)                                                                                                                                                                                                                        |
| `npm run test:e2e`     | Playwright tests on desktop and phone against the production build and the server running the scripted engine: the site, the design's interactions (the headline taking the company, the lamp making a source legible, the value landscape's assumptions, the register's seals, the lamp at rest under reduced motion; the film scrubbing from the cover to the source and its axe check, its contact sheet under reduced motion and without scripts, the resting lamp in the first paint, the ultraviolet switch, a share card on every page), the live request flow, the request page as each host renders it, engine reports with and without JavaScript, and axe WCAG 2.2 AA scans of every page in both themes and of the live slip |

## The research engine

One run turns a request into a checked report in four stages. Each stage reports what it is doing, and the request page shows it as it happens.

| Stage    | What happens                                                                                                                                                                                                                                                                                                                                                                 | Where                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Research | Claude (the model named in `claude.ts`, thinking at high effort) searches the web and reads documents through the engine's tools, recording the company's identity, figures, breakdowns and passages, each with its quotation. Up to 48 turns, 24 searches.                                                                                                                  | `research.ts`, `tools.ts`, `ledger.ts` |
| Model    | Code builds the reported history from the ledger (one scope; filed sources first, then the most recent). Claude proposes the forecast and cost-of-capital inputs with a reason for each, as structured output; code holds them inside limits, uses rates the research found, and chooses the basis: per share for a listed company with a price, the whole equity otherwise. | `history.ts`, `model.ts`               |
| Write    | Claude writes the report from a dossier of verified passages, reported figures and the model's tokens, as structured output. Code assembles the report and runs the gate; failures go back with reasons, up to twice. A sentence that still cannot be traced is withheld and the report says so.                                                                             | `write.ts`, `assemble.ts`, `gate.ts`   |
| Check    | The finished report is valued again, gated again and stored.                                                                                                                                                                                                                                                                                                                 | `pipeline.ts`                          |

### Evidence

The engine never lets the model's word stand for a fact. Claude finds documents with Anthropic's web search tool, called directly so the engine sees every result, but reads them only through the engine's own `read_document` tool:

- **Fetching** (`fetch.ts`): http and https on the standard ports only; public addresses only, checked on the address actually connected to, so a name cannot resolve to an internal host between check and connection; redirects held to the same rules; size and time limits; robots.txt honoured. Claude may read only addresses that appeared in search results, in the request or in a page already read, which stops a document from steering it to send data elsewhere.
- **Reading** (`extract/`): PDFs page by page with pdf.js, table rows kept as rows ("Revenue | 48.312.904 | 45.407.211"); web pages with htmlparser2, with their links. Long documents are read by page range, after `search_document` finds the statement.
- **Recording** (`ledger.ts`): a quotation is accepted only if it occurs in the text the engine read, word for word after normalising spacing, case, quotes, dashes, ligatures and hyphenation; a figure only if its number, exactly as printed, is in its own quotation. Code converts thousands to millions and percentages to fractions from the document's own decimal mark and scale. A document counts as filed (audited accounts, a registry or exchange filing) only with a quoted passage that shows it. A rejected record comes back with the reason and, where the number appears elsewhere in the document, the lines where it does.
- **Supplied documents**: files attached to a request are read the same way, kept in memory for the run and never written to disk.

### The gate

`gate.ts` runs over every sentence of the report: every note resolves to a passage; every token resolves to a computed value; every number in a sentence (other than years, dates and periods) agrees, at some scale and within the rounding shown, with a number printed in a passage that sentence cites; titles and notes carry no figures; nothing reads as a rating, a recommendation or a target price; no markup or links. The same checks run on the finished report as the last step.

### Server and API

`server/main.ts` runs one Node process: the built site (read and compressed once at startup, off the main thread, and kept in memory), the API, and engine reports rendered on request (each page rendered and compressed once, since a report never changes) with the same renderer and page shell the build uses for the sample, so an engine report is a document: it reads without JavaScript and hydrates from the report embedded in the page.

| Endpoint                          | What                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                 | Whether the engine runs, and whether requests need a code                                                                         |
| `POST /api/initiations`           | Start a run: a multipart form with the request and its files                                                                      |
| `GET /api/initiations/:id`        | A run's request and events                                                                                                        |
| `GET /api/initiations/:id/events` | The same events as server-sent events, replayed from the start (or after `?after=n`, or the browser's `Last-Event-ID`), then live |
| `GET /api/reports/:id`            | A finished report as JSON                                                                                                         |
| `GET /report/:id`                 | A finished report as a page                                                                                                       |
| `GET /initiate?run=:id`           | The request page following a run, rendered as the run stands (404 when there is no such run)                                      |

Each run spends money on the model, so a live engine requires access codes unless the operator opens it on purpose, limits runs per address per hour and runs at once, and stops a run at its time limit. Every run keeps an audit (`data/audits/`): documents read, passages and figures recorded, quotations sent back, drafts, tokens, searches and cost at list prices.

### What has and has not been run

The engine is tested end to end with a scripted model client (`server/fixtures/primer.ts`) that answers each stage as the real model is asked to, against a test annual report of a fictional company, including a first draft that the gate sends back. The API, the progress stream, the live request page and engine reports are tested in the browser against the server running that scripted engine. The engine has not yet been run against the live Claude API from this repository's development environment, which has no key and no open web access; the first live runs should be watched, and their audits read, before the engine is opened to customers.

### Limits

- Scanned PDFs without a text layer cannot be quoted, so the engine skips them and says so; spreadsheets and ZIP archives are not read.
- pdf.js runs in the server's main thread, yielding between pages; very large reports slow other requests while they are read.
- The fetcher connects directly; a host that requires an egress proxy needs one configured for Node.
- Runs live in one process: a restart marks running runs as failed, and they must be started again.
