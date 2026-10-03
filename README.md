# Stock Picks

Daily editorial stock research as a responsive web app and installable PWA: up to five sourced
picks a day, the thesis and valuation behind each one, watchlists with price and earnings
alerts, a paper portfolio with real ledger arithmetic, and a pick archive that keeps the losses.

Built from _Stock Picks — Complete visual, interaction and application build specification,
Version 3_ (26 screens, 4 tabs, supporting routes, interaction and data contracts).

> **This is the demo build.** Every price, report and outcome is illustrative and generated
> deterministically in your browser. Nothing here is market data or investment advice. Live
> services (API, database, email, push, market data) are not part of this repository and are
> reported as **CONFIGURATION REQUIRED** — see [docs/COMPLETION.md](docs/COMPLETION.md).

## The idea: on the record

Most finance apps sell confidence: neon green, live tickers, celebration. Stock Picks sells a
record. Two surfaces carry that idea through every screen:

- **Paper** (`#F8F5ED`, Bodoni Moda display over Inter) for discovery and reading. Picks, research
  and the archive are set like a broadsheet: numbered arguments, sources one tap away, revisions
  kept, losses printed at the same size as wins.
- **Charcoal** for analysis. Price, valuation and earnings live on a dark instrument surface where
  every figure carries its time, zone, currency and data status.

The signature moment is the chart. Hold and drag, and the quote above it _becomes_ the moment under
your finger — time, price and change rewritten together, with a 180 ms hold that never fights the
page scroll. Release, and it returns to the latest quote. The keyboard and a data-table view reach
the same values, and a text summary describes the chart to assistive technology.

## Quick start

```bash
nvm use 22            # Node >= 22.22
npm ci
npm run dev           # http://localhost:5173
```

Sign in with the demo account **alex@example.com / stockpicks-demo**, or register a new account —
the verification email arrives in the in-app demo mailbox.

Open **Profile → Demo tools** (`/demo`) to bend the world: advance the market clock to fire
alerts, degrade the data feed, simulate offline or slow networks, make the next save fail or lose
its response, browse the component catalogue, or reset all demo data.

## Scripts

| Command                                        | What it does                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                                  | Vite dev server on port 5173                                            |
| `npm run build`                                | Type-check (`tsc -b`) and production build to `dist/`                   |
| `npm run preview`                              | Serve the production build on port 4173                                 |
| `npm run typecheck`                            | TypeScript project build, strict                                        |
| `npm run lint`                                 | ESLint (typescript-eslint + React Hooks / React Compiler rules)         |
| `npm run format:check`                         | Prettier check (`npm run format` writes)                                |
| `npm test`                                     | Vitest unit tests: domain fixtures F01–F04, F06, demo world             |
| `npm run test:e2e`                             | Playwright journeys, axe, 200% text and reduced motion; phone + desktop |
| `npm run check`                                | typecheck, lint, unit tests and build in one go                         |
| `npm run fonts -- --inter <InterVariable.ttf>` | Rebuild the subset WOFF2 fonts (Python `fonttools` + `brotli`)          |
| `npm run icons`                                | Re-render PWA icons and the Open Graph image (Playwright Chromium)      |

### End-to-end tests

```bash
npm run build
npx playwright install chromium        # once; or point at an existing Chromium:
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

Playwright starts `vite preview` itself. Two projects run every spec: **phone** (Pixel 7) and
**desktop** (1440 × 900), locale en-GB, time zone Europe/Ljubljana, so time-zone handling is
exercised against a non-US user.

### Lighthouse

CI runs Lighthouse CI against the production build (`lighthouserc.json`). Locally:

```bash
npm run build
npx --yes @lhci/cli@0.15.1 autorun     # set CHROME_PATH if Chrome is not on the PATH
```

Accessibility, best practices, SEO and CLS are hard gates; the performance score and LCP are
reported as warnings because simulated-throttling results on the current bundle do not meet the
targets on every route yet (numbers in [docs/COMPLETION.md](docs/COMPLETION.md#performance)).

## Configuration

Copy `.env.example` to `.env.local`. Names only are committed; values belong in your deployment's
secret store.

| Variable                                                                  | Purpose                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `VITE_DATA_MODE`                                                          | `demo` (default) or `live`. Live builds refuse to serve data: no live client ships here.                               |
| `VITE_APP_URL`                                                            | Public origin. Drives canonical links, `robots.txt` and `sitemap.xml` (skipped for localhost).                         |
| `VITE_AUTH_PROVIDERS`                                                     | Comma-separated providers (`google,apple`) whose callbacks are configured. Buttons are hidden for anything not listed. |
| `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Required in live mode. A live build missing any of them opens `/maintenance?reason=configuration`, listing names only. |
| `VITE_VAPID_PUBLIC_KEY`                                                   | Web Push (live builds, with a server holding the private key).                                                         |

## Deploying

`npm run build` produces a static site in `dist/` — any static host or edge CDN works
(Cloudflare Pages, Netlify, Vercel, S3 + CloudFront). Requirements:

1. **SPA fallback**: serve `index.html` for unknown paths (`/* → /index.html 200`). The app renders
   its own 404 ("Not listed.").
2. **Caching**: `assets/*` are content-hashed — `Cache-Control: public, max-age=31536000,
immutable`. Serve `index.html`, `sw.js` and `manifest.webmanifest` with `no-cache`.
3. **HTTPS** is required for the service worker, notifications and installation.
4. Set `VITE_APP_URL` at build time so canonical links and the sitemap point at the real origin.

The service worker precaches the shell for offline starts and only switches versions when the page
asks (an update banner offers it). Rolling back is redeploying the previous `dist/`.

## Status and next steps

The demo build is complete enough to review every screen and journey end to end; it is not a
production service. [docs/COMPLETION.md](docs/COMPLETION.md) lists each screen, route, fixture and
journey with its evidence. In priority order:

1. **Prerender the public routes** (picks, research, archive) at build or edge time. Mobile LCP is
   3.0–3.8 s on two of three audited routes under simulated slow 4G; the target is 2.5 s.
2. **Provision the live service**: API, database with row-level security (fixture F05), the alert
   and email worker, Web Push keys, identity providers. The client contract is already in place.
3. **Cross-browser and device evidence**: Safari on iOS, Chrome on Android, Firefox; 430 px,
   768 px, landscape and keyboard-open forms.
4. **Screen-reader pass** (VoiceOver, TalkBack, NVDA) over the main journeys.
5. **Close the open journeys**: J02 research, J08 account lifecycle, offline saves and token expiry.

## Project map

```
src/
  app/          shell, routing (tab stacks, split panes), navigation, session, display prefs
  components/   design system: buttons, lists, sheets, forms, status, PriceChart, icons
  domain/       pure logic: decimals, ledger, returns, alerts, time zones, series, validation
  data/         typed API, React Query keys/hooks, transport (latency, offline, failure modes)
  data/demo/    in-browser demo service: seeded world, price paths, alert engine, mailbox
  features/     cross-screen behaviour: guards, re-auth, watchlist saving, notifications …
  screens/      one folder per tab plus auth, account and system pages
  sw.ts         service worker (precache, update step, notification routing, push)
tests/e2e/      Playwright journeys and axe audits
scripts/        font subsetting and icon rendering
docs/           architecture notes and the completion matrix
```

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack decisions, data flow, navigation model,
  motion and performance strategy.
- [docs/COMPLETION.md](docs/COMPLETION.md) — every screen, route, contract, fixture and journey
  with its status and evidence. Read this before claiming anything works.
