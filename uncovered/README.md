# Uncovered

**Initiating coverage on every company.** Name a company, listed or private, and Uncovered writes the initiation-of-coverage report a bank's research desk would publish: thesis, financials, forecasts, valuation and risks. Every reported figure is footnoted to a passage of its source, quoted word for word; every valuation figure is computed by a model whose assumptions are stated.

The design idea is a report you can check like a banknote: hold the cover to the light and the company's watermark and each figure's source appear, tilt it and the foil changes colour, switch on UV and the sources glow. See `docs/CREATIVE_DIRECTION.md`.

This repository holds the whole product:

- **The site**: the front page, a sample initiation on Krka, d. d., Novo mesto, the request page and the method.
- **The research engine** (`server/engine`): Claude searches for and reads the company's filings, records every figure with its quotation, sets the model's assumptions and writes the report. Code checks every quotation against the document it came from and every sentence of the report before anyone reads it.
- **The server** (`server/http`): serves the site, runs requests, streams their progress to the request page and renders engine reports as pages.

## Run it

Requires Node 22.13 or later.

```sh
npm install
npm run dev            # the site alone, at http://localhost:5173 (no engine)
```

To run the engine locally:

```sh
npm run build && npm run build:server
UNCOVERED_ENGINE=fixture npm start          # a scripted test run, no API key needed
ANTHROPIC_API_KEY=… UNCOVERED_ACCESS_CODES=my-code npm start   # the real engine
```

Then open http://localhost:8080/initiate. The fixture engine researches a fictional company, Primer d.o.o., from a test annual report, whatever is asked; it exists to show and test the whole flow without spending anything.

| Command                 | What it does                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run build`         | Typecheck, build the client and the prerender bundle, and write every page as static HTML to `dist/` |
| `npm run build:server`  | Bundle the server and engine to `dist-server/main.js`                                                |
| `npm start`             | Run the server (site, engine and API)                                                                |
| `npm run preview`       | Serve `dist/` as a static host would, without the engine                                             |
| `npm run build:preview` | Build the single-file preview (`dist-artifact/uncovered.html`, hash routing)                         |
| `npm run check`         | Typecheck, lint, formatting and unit tests                                                           |
| `npm run test:e2e`      | Build, start both servers and run the Playwright and axe suite on desktop and phone                  |
| `npm run format`        | Format with Prettier                                                                                 |

## Configuration

The server reads its environment (see `.env.example`):

| Variable                   | Default                       | What it does                                                                                                              |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`        | none                          | The engine's key. Without one the engine is off and the request page shows the plan it would follow.                      |
| `UNCOVERED_ACCESS_CODES`   | none                          | Comma-separated codes a request must carry. A live engine refuses to start without codes, because every run spends money. |
| `UNCOVERED_OPEN`           | off                           | `1` accepts requests from anyone instead.                                                                                 |
| `UNCOVERED_ENGINE`         | `live` with a key, else `off` | `fixture` runs the scripted test engine.                                                                                  |
| `UNCOVERED_MAX_CONCURRENT` | 2                             | Runs at once.                                                                                                             |
| `UNCOVERED_RATE_LIMIT`     | 3                             | Runs one address may start an hour (refused requests do not count).                                                       |
| `UNCOVERED_RUN_MINUTES`    | 30                            | Time limit for one run.                                                                                                   |
| `UNCOVERED_DATA_DIR`       | `data`                        | Where runs, reports and their audits are kept, as JSON. Uploaded documents are never written to disk.                     |
| `UNCOVERED_TRUST_PROXY`    | off                           | `1` behind a reverse proxy, so limits apply per visitor.                                                                  |
| `SITE_URL`                 | none                          | The public address: canonical links, `sitemap.xml`, and the engine's user agent.                                          |
| `PORT`, `HOST`             | 8080, 0.0.0.0                 | Where the server listens.                                                                                                 |

## Deploy

**With the engine**: the server is one Node process; `Dockerfile` builds it.

```sh
docker build -t uncovered --build-arg SITE_URL=https://uncovered.example .
docker run -p 8080:8080 -v uncovered-data:/data \
  -e ANTHROPIC_API_KEY=… -e UNCOVERED_ACCESS_CODES=… -e SITE_URL=https://uncovered.example uncovered
```

Give it a persistent volume for `/data`, a TLS-terminating proxy in front (with `UNCOVERED_TRUST_PROXY=1`), and direct outbound access to the web: the engine fetches documents itself. A run takes up to twenty minutes and its progress streams over one long-lived connection, so the proxy must not buffer `text/event-stream` responses or time them out early.

**Site only**: `dist/` is static. On Vercel, set the project's root directory to `uncovered`; `vercel.json` sets the build, clean URLs and long-lived caching for hashed assets. Without the server there is no engine, and the request page says so.

## Where things are

| Path                        | What                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/report/types.ts`       | The report as data: sources (passages with quotation, page and grade), lines, assumptions, prose         |
| `src/report/valuation.ts`   | DCF, dividend discount, earnings and EV/EBITDA multiples, fair-value range, sensitivity, implied values  |
| `src/report/bindings.ts`    | Model figures that prose quotes as `{{tokens}}`                                                          |
| `src/report/krka.ts`        | The hand-written sample report                                                                           |
| `src/pages/Report.tsx`      | The reader, for any report                                                                               |
| `src/pages/LiveRun.tsx`     | A run as it happens, on the request slip                                                                 |
| `src/inspect/`              | The cover as an object to inspect: the lamp, the WebGL paper (watermark, fibres, foil), the source marks |
| `src/report/landscape/`     | The value landscape: the DCF's value as an engraved block you can move                                   |
| `src/motion/`               | Scroll choreography (GSAP ScrollTrigger, Lenis) and magnetic actions, loaded on demand                   |
| `server/engine/research.ts` | The research loop: web search, document reading, recording evidence                                      |
| `server/engine/ledger.ts`   | The evidence ledger: what enters only with a verified quotation                                          |
| `server/engine/gate.ts`     | The checks every report passes before it is shown                                                        |
| `server/engine/pipeline.ts` | One run, from request to checked report                                                                  |
| `server/http/`              | The server: API, progress stream, static site, rendered reports                                          |
| `server/fixtures/`          | The scripted test engine and its fictional company's annual report                                       |
| `scripts/prerender.mjs`     | Static HTML for every route                                                                              |
| `scripts/subset-fonts.py`   | Cuts the typefaces to the characters the site sets (`src/styles/fonts/`); rerun after a font upgrade     |
| `docs/`                     | Creative direction, design system, storyboard, architecture, strategy, award audit                       |

## Principles

Figures come from filings, quoted word for word. Arithmetic is code. Estimates are labelled. A range, not a rating. Reports are research, not investment advice.
