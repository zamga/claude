# Uncovered: architecture

## Stack, and why

| Choice                                   | Why                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite 8, React 19, TypeScript 6**       | A small client app with one heavy interactive piece (the seal) and long documents. React 19's static prerender gives every page real HTML at build time without a server framework; Vite builds the client, the server bundle and the single-file preview from one config.                   |
| **Static prerender, then hydrate**       | Reports are documents: they should be readable without JavaScript, indexable, and fast on a phone. `scripts/prerender.mjs` renders each route with `prerenderToNodeStream` and writes flat HTML files; the client hydrates them.                                                             |
| **CSS modules on tokens**                | No framework: the design is specific enough that utility classes would fight it. Tokens in one file, a module per component, container queries for page-like components.                                                                                                                     |
| **No animation library**                 | Every motion in the storyboard is a CSS keyframe or transition gated by reduced motion. The seal engraving is a small incremental canvas renderer.                                                                                                                                           |
| **No 3D**                                | The seal carries the signature moment at a fraction of a WebGL scene's cost on a mid-range phone.                                                                                                                                                                                            |
| **One Node server, or any static host**  | The site is static and runs on any static host (`vercel.json`). The engine needs a server: one Node process with no framework (`node:http`) serves the site, the API and engine reports, because a run lasts many minutes and streams its progress, which serverless functions handle badly. |
| **Claude API, through the official SDK** | `@anthropic-ai/sdk`: streamed requests, adaptive thinking, the web search server tool, strict client tools for recording evidence, and structured outputs (zod schemas) for the model and the prose.                                                                                         |
| **pdf.js and htmlparser2**               | The engine reads documents itself, so it holds the exact text every quotation is checked against: Mozilla's pdf.js for PDFs, htmlparser2 for pages.                                                                                                                                          |

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
scripts/        prerender.mjs, package-artifact.mjs, wait-for.mjs
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

- **Production** (`npm run build`): history routing; code split per page, each with its own CSS; fonts for the first screen preloaded; every route prerendered (`dist/index.html`, `dist/report/krka.html`, `dist/initiate.html`, `dist/method.html`, `dist/404.html`) with its own title, description, stylesheet and module preloads. Set `SITE_URL` to also emit `sitemap.xml` and its line in `robots.txt`.
- **Server** (`npm run build:server`): the engine and the server in one file, `dist-server/main.js`, serving `dist/` and rendering engine reports at `/report/:id` with the renderer in `dist-ssr/`. The server also renders the request page again at startup for its own engine, so the page's first paint already says whether requests run (the build renders it for a static host, which has none).
- **Preview** (`npm run build:preview`): one self-contained HTML file with hash routing (`#report.krka~valuation`), for embedded previews that pass only a plain `#anchor`. `scripts/package-artifact.mjs` strips the document skeleton the host supplies.

Pages are rendered whole: the renderer is told never to move large content out of line (React otherwise sends any Suspense content over about 12.8 kB hidden, to be revealed by a script), so every page reads without JavaScript and paints its content with the first HTML. A run's address is a page too: the server renders the slip as the run stands, with the run embedded, and the page follows the run on from the last event it was rendered with. The browser hydrates a page only at the address it was rendered for (path, plus the run on the request page; other parameters change nothing), and renders afresh anywhere else. Renders on the server take turns, because the address and what is given to a render are shared by the whole render.

The router moves focus to the new page's heading after navigation (waiting for lazy pages to render), or to the target section when following an anchor, and uses view transitions where supported.

## Performance

Measured with Lighthouse 13.5 (mobile, simulated slow 4G and 4× CPU), the median of three runs, against the production build as a static host serves it:

| Page     | Performance | Accessibility | Best practices | SEO | LCP  | TBT  | CLS |
| -------- | ----------- | ------------- | -------------- | --- | ---- | ---- | --- |
| Home     | 98          | 100           | 100            | 100 | 2.3s | 14ms | 0   |
| Report   | 94          | 100           | 100            | 100 | 2.9s | 55ms | 0   |
| Initiate | 96          | 100           | 100            | 100 | 2.6s | 6ms  | 0   |
| Method   | 95          | 100           | 100            | 100 | 2.8s | 4ms  | 0   |

Served by the Node server running the scripted engine, the request page scores 96 (LCP 2.5s, CLS 0) and an engine-written report 96 (LCP 2.6s, TBT 84ms, CLS 0).

What got it there: the seal's sheen no longer reads canvas pixels back (that alone was 7 seconds of blocking time under throttling); seals draw only when they come into view; critical fonts are preloaded; every page is prerendered; each page loads its own CSS. On the server: the site is compressed once at startup, off the main thread (compressing each file on its first request had held the first visitor's scripts back by 300ms and blocked every other request meanwhile), and the request page is rendered for the server's own engine, so nothing moves when the page learns the engine runs (that shift measured 0.067).

LCP is still over the 2.5s budget on three pages in the simulated profile; see fix 4 in `docs/AWARD_AUDIT.md`.

## Testing

| Command                | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | TypeScript, strict                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run lint`         | ESLint with the TypeScript, React hooks (compiler rules) and jsx-a11y rule sets                                                                                                                                                                                                                                                                                                                                                             |
| `npm run format:check` | Prettier                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm test`             | 83 Vitest tests: the valuation engine, bindings and footnotes, request validation, the evidence checks (normalising, quotation matching, numbers as printed), the fetcher's guards and robots.txt, PDF and HTML text, the ledger, the model's limits, the gate, a whole run with the scripted engine, run addresses and progress, and the server over HTTP (including compression, the pages it renders for itself and streams that resume) |
| `npm run test:e2e`     | Playwright tests on desktop and phone against the production build and the server running the scripted engine: the site, the live request flow, the request page as each host renders it, engine reports with and without JavaScript, and axe WCAG 2.2 AA scans of every page in both themes and of the live slip                                                                                                                           |

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
