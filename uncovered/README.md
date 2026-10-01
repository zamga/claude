# Uncovered

**Initiating coverage on every company.** Name a company, listed or private, and Uncovered writes the initiation-of-coverage report a bank's research desk would publish: thesis, financials, forecasts, valuation and risks, with every reported figure footnoted to its source and every valuation figure computed by a model whose assumptions are stated.

This repository holds the product's front end and its valuation engine: the front page, a complete sample initiation on Krka, d. d., Novo mesto, the request flow and the method. The research engine that will write reports for any company is the next phase (see `docs/ARCHITECTURE.md`).

## Run it

Requires Node 22.12 or later.

```sh
npm install
npm run dev            # http://localhost:5173
```

| Command                 | What it does                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run build`         | Typecheck, build the client and the prerender bundle, and write every page as static HTML to `dist/` |
| `npm run preview`       | Serve `dist/` locally                                                                                |
| `npm run build:preview` | Build the single-file preview (`dist-artifact/uncovered.html`, hash routing)                         |
| `npm run check`         | Typecheck, lint, formatting and unit tests                                                           |
| `npm run test:e2e`      | Build, serve and run the Playwright and axe suite on desktop and phone                               |
| `npm run format`        | Format with Prettier                                                                                 |

Set `SITE_URL` (for example `https://uncovered.example`) when building for a public address to emit `sitemap.xml`, its line in `robots.txt`, canonical links and `og:url`.

## Deploy

`dist/` is static. On Vercel, set the project's root directory to `uncovered`; `vercel.json` sets the build, clean URLs (`/report/krka` serves `report/krka.html`) and long-lived caching for hashed assets. Unknown addresses get `404.html`, which renders the "This page is uncovered" page for the address that was asked for.

## Where things are

| Path                      | What                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/report/krka.ts`      | The sample report as data: 17 sources with quotes and evidence grades, reported lines, assumptions |
| `src/report/valuation.ts` | DCF, dividend discount, earnings multiples, fair-value range, sensitivity, what the price implies  |
| `src/report/bindings.ts`  | Model figures that prose quotes as `{{tokens}}`                                                    |
| `src/seal/`               | The guilloche seal: geometry, incremental canvas renderer, component                               |
| `src/pages/Report.tsx`    | The reader                                                                                         |
| `scripts/prerender.mjs`   | Static HTML for every route                                                                        |
| `docs/`                   | Creative direction, design system, storyboard, architecture, strategy, award audit                 |
| `lab/`                    | Development pages for tuning seals (`/lab/seal.html` under `npm run dev`)                          |

## Principles

Figures come from filings. Arithmetic is code. Estimates are labelled. A range, not a rating. Reports are research, not investment advice.
