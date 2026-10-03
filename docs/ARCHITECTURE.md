# Architecture

How Stock Picks is put together, and why. Status of each part lives in
[COMPLETION.md](COMPLETION.md).

## Stack decision

| Choice                                   | Why                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite + React 19 SPA, installable PWA** | The product is an app, not a site: four tab stacks that keep their place, split panes on wide screens, offline reading, notification deep links and installation. Almost every view is personal or depends on the market clock, so server rendering buys little in the demo build. |
| **TypeScript strict**                    | The API envelope, error codes and money types are shared by screens, the demo service and tests.                                                                                                                                                                                   |
| **React Router 8 (data router)**         | `useBlocker` for unsaved-changes guards; `useRoutes` per pane for split view; one catch-all route resolved against our own route table.                                                                                                                                            |
| **TanStack Query 5**                     | Latest-request-wins, cancellation, stale-while-revalidate and optimistic updates with rollback are the spec's network contract.                                                                                                                                                    |
| **big.js**                               | Prices, quantities, fees and returns are decimals. Floating point never touches a ledger figure.                                                                                                                                                                                   |
| **Hand-built SVG chart**                 | The chart's gesture contract (tap pins, 180 ms hold inspects, drag scrubs, vertical scroll wins) and its exact fixture values could not be met through a charting library's abstractions without fighting them. It is about 1,300 lines we fully control.                          |
| **CSS Modules + design tokens**          | Zero runtime cost, surface-scoped semantic tokens (`[data-surface='paper' \| 'charcoal']`), and a reduced-motion mode that rewrites durations in one place.                                                                                                                        |
| **Workbox (injectManifest)**             | A custom service worker: precache, explicit update step, notification click routing, push display.                                                                                                                                                                                 |

Rejected: **Next.js/Remix** (a server runtime for mostly personal, clock-driven views; worth
revisiting for prerendered public pages — see Performance), **GSAP / smooth-scroll libraries**
(native scroll is a requirement for the chart's scroll-versus-scrub arbitration, and every motion
is a short CSS or View Transition), **WebGL** (no part of the brief is served by it; it would cost
the mid-range phone budget).

## Layers

```
screens/      what a person sees; one component per route, composed from components/ + features/
features/     behaviour shared across screens (guards, re-auth, saving, notifications, preferences)
components/   the design system; knows nothing about the API
data/         typed API, query keys and hooks, transport, error envelope
data/demo/    the in-browser service that answers the API in demo builds
domain/       pure, tested logic: decimals, ledger, returns, alerts, time, series, validation
```

Dependencies point downwards only. `domain/` imports nothing from the app and is tested with fixed
clocks and decimal inputs.

## Data flow

1. **API surface** (`data/api.ts`) mirrors the `/api/v1` resources on spec page 49 —
   `api.picks.today()`, `api.alerts.create(input, key)`, `api.paper.transactions.create(…)` and so on.
2. **Transport** (`data/transport.ts`) wraps every call in the spec's envelope
   (`{ data, meta: { requestId, asOf, demo } }` or `error(code, message, fieldErrors, retryable)`),
   adds latency and reproduces the failure modes the interface must handle honestly: offline, slow,
   rejected writes and writes whose response is lost after commit. A request log keeps request ids
   (never payloads) for support.
3. **Live mode** refuses every request with `not_configured` before any handler runs, and startup
   routes a live build with missing variables to `/maintenance?reason=configuration`. There is no
   path by which a live build shows demo data.
4. **Queries** (`data/queries.ts`) split keys into `public` and `private`. Public reads are persisted
   for offline reading; private reads are persisted per account and removed on sign-out together
   with drafts, reading positions and the in-memory cache.
5. **Writes** carry an idempotency key that lives as long as the form — or, for alerts and paper
   transactions, as long as the exact reviewed input. Retrying after a lost response returns the
   original result instead of a duplicate; reusing a key for different input is refused. Edits
   carry the record version: a `version_conflict` is shown, never overwritten silently, and the
   preference forms offer "Use the latest" or "Keep mine".

## The demo service

`data/demo/` is a deterministic world that lives in `localStorage`:

- **Clock**: the demo opens at Wednesday 21 October 2026, 14:25 New York time, and can be advanced to
  16:30 from Demo tools. The market calendar models holidays, early closes and both DST transitions.
- **Prices** are generated from seeded paths anchored to the figures the boards show (NVDA 142.80
  at 14:25 New York time, the paper-ledger closes, the archive outcomes), so screens, tests and
  boards agree. The F01 chart fixture is tested on the domain functions with its own 12
  observations.
- **Alert engine** evaluates committed observations in order, fires at most once per crossing,
  respects quiet hours per channel, writes the inbox immediately and the demo mailbox/notifications
  when delivery is allowed.
- **Ledger** applies paper transactions through `domain/ledger.ts`; the archive re-measures every
  pick outcome from the price paths, so the performance review is computed, not typed in.
- The service ships as its own chunk and starts after the shell's first paint, so its CPU work never
  delays first contentful paint. Every request awaits it.

## Navigation model

`app/routeTable.ts` is the single source of truth: id (S01–S26), owning tab, kind
(`collection` / `detail` / `standalone`), surface, structural parent, privacy and default detail.

- **Phone and tablet (< 1024 px)**: one pane, a tab bar on collection screens, one history stack per
  tab. Back is in-app history when there is one, otherwise the structural parent — a deep link to a
  report goes Back to the reading room, not out of the app.
- **Desktop (≥ 1024 px)**: a navigation rail, the collection on the left and its detail beside it.
  Each pane resolves its own route with `useRoutes`; a collection opens its default detail (the
  first pick, the first earnings event) so the right side is never empty.
- **Scroll and focus**: each history entry restores its scroll position. Focus moves to the new
  screen's heading; Back returns it to the row or control that opened the screen.
- **Private routes** without a session go to `/access-denied?returnTo=…`; sign-in, registration
  and email verification all resume the original destination.

## Typography

- Faces are matched to the reference photographs: FreeSerif Bold for display and figures, Roboto
  Flex (weight 400–700) for the interface. The method, scores and shipped files are recorded in
  [TYPOGRAPHY.md](TYPOGRAPHY.md); `npm run typography:verify` re-scores them against the photographs.
- `src/styles/tokens.css` holds the measured roles (64 px headlines, 46 px quotes, 31/25/21 px
  sections, 15 px copy, 11 px eyebrows) and weights (400, 450, 550, 600); screens that the
  photographs set differently override locally.
- `ScreenHeading` fits each headline to its column: the photographed line breaks are kept by
  setting a title smaller only when a word would not fit or when, at no less than 80 %, that brings
  it within its photographed line count. It refits on width changes, web-font load and the in-app
  text size.

## Motion

Motion explains hierarchy and state; nothing loops for decoration.

| Moment              | Trigger            | Duration / easing                                |
| ------------------- | ------------------ | ------------------------------------------------ |
| Press               | pointer down / up  | 80 ms in, 140 ms out, `cubic-bezier(.2,0,0,1)`   |
| Detail enter / exit | push / pop         | 240 ms (+24 px, fade) / 200 ms, View Transitions |
| Shared ticker       | row → detail       | the tapped ticker morphs into the detail header  |
| Tab switch          | tab bar / rail     | 160 ms crossfade                                 |
| Sheet               | open / close       | 280 ms / 220 ms, drag to dismiss                 |
| Chart inspection    | hold 180 ms / drag | crosshair in 80 ms, out 120 ms; transform only   |
| Range change        | range tab          | 180 ms crossfade; a stale response never commits |
| Skeletons           | pending > 150 ms   | geometry reserved from the first frame (no CLS)  |

**Reduced motion** (system setting or the in-app override) collapses every transform to a
0–100 ms opacity change, removes shimmer and the chart reveal, and keeps every state change
visible. The idea survives intact: nothing about the record depends on movement.

## The chart

- `domain/chartGesture.ts` is a pure state machine (idle → pending → scrubbing / pinned) with the
  spec's thresholds: 180 ms hold, 8 px horizontal travel at 1.25× dominance, vertical movement yields
  to the page. Tested independently of the DOM.
- `domain/series.ts` selects the nearest valid sample (earlier on ties), never selects a gap,
  breaks the line at missing intervals and downsamples while keeping endpoints, extrema and gaps.
- `components/chart/inspectionStore.ts` holds the inspected sample outside React state, so scrubbing
  re-renders only the quote hero and crosshair at frame rate.
- The price chart has a text summary and a data-table view with the same values.

## Performance strategy

- Entry: React, router and query in their own long-cached chunks; screens lazy-loaded per route with
  the daily picks screen eager (it is the landing view); the demo service deferred past first paint.
- Entry CSS is inlined into `index.html` by a build plugin; two subset WOFF2 fonts (FreeSerif Bold
  and Roboto Flex 400–700, latin, about 50 kB together) are preloaded, latin-ext loads only on
  demand via `unicode-range`; metric-matched local fallbacks hold the space while they load
  (docs/TYPOGRAPHY.md).
- Skeletons reserve the final geometry; secondary sections wait for the primary query, so the page
  does not shift when data lands.

The open gap is first-load LCP on simulated slow 4G: the landing view is client-rendered after
about 150 kB of compressed JavaScript (gzip; React 65 kB, router 30 kB, query 14 kB, app entry
26 kB), plus the 36 kB demo service fetched in parallel. Prerendering the public routes (picks,
research, archive) at build or edge time is the next step; the measured numbers are in
COMPLETION.md.

## Accessibility

Semantic landmarks and headings on every screen; lists as lists, tables as tables; visible focus
rings; every icon button labelled; form errors announced and tied to their fields; route changes
announced politely; dialogs and sheets trap and return focus; colour tokens meet AA on both surfaces
(the bright accent is decorative only, with a darker token for text). The chart, valuation sliders
and sort controls all have keyboard paths. Text scales with the browser setting and the in-app text
size.

**Large text.** Text follows the browser's font size and the in-app setting (up to 150%), and is
tested at 200% at phone width on 23 main screens. Display type is capped by the pane width
(`min(4rem, 16.4cqi)`, then fitted to the column so a word never breaks mid-word); components reflow with
`em`-based container queries that never trigger at the default size: tabs wrap instead of
scrolling out of sight, three-column figures become a list, label/value rows put the value under
its label, and the row sparkline steps aside for the price. Tab-bar labels stop growing at what
four columns hold, as native tab bars do.
