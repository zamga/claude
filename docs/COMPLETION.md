# Completion matrix

What this build does, what it does not, and the evidence behind each claim. It follows the spec's
own rule (page 41): nothing is marked as passing without a recorded run.

| Column       | Value                      | Meaning                                                                      |
| ------------ | -------------------------- | ---------------------------------------------------------------------------- |
| **Build**    | **Built**                  | Complete against the spec in the demo build.                                 |
|              | **Partial**                | Built, with the gap named in the row.                                        |
|              | **Not built**              | Specified, not implemented in this repository.                               |
|              | **Configuration required** | Needs an external service or credential that is not part of this repository. |
| **Evidence** | **PASS**                   | An automated test recorded a pass on this build; the test is named.          |
|              | **REVIEWED**               | Checked by hand in Chromium at the stated widths; no automated test.         |
|              | **NOT RUN**                | No execution evidence.                                                       |

## Evidence environment

- **Build**: branch `claude/new-session-pjhs5b`, 3 October 2026, demo mode (`VITE_DATA_MODE=demo`),
  production bundle served by `vite preview`.
- **Unit**: Vitest 5.0.3 on Node 22.22.0 — 90 tests in 10 files, all passing.
- **Browser**: Playwright 1.63.0 driving Chromium 141.0.7390.37 (headless). Two projects run every
  spec: **phone** (Pixel 7 emulation, 412 px, touch) and **desktop** (1440 × 900, split view).
  Locale en-GB, time zone Europe/Ljubljana. Result: **82 passed, 4 skipped** (phone-only checks on
  the desktop project). The navigation and accessibility specs were also repeated 3× under four
  parallel workers: 144 passed.
- **Accessibility**: axe-core 4.13 with WCAG 2.0/2.1/2.2 A and AA rules plus axe best practices,
  on 35 routes in both layouts. The gate fails on any violation of any impact. Result: none.
- **Lighthouse**: 12.6.1 through LHCI 0.15.1, mobile form factor, simulated throttling (150 ms RTT,
  1.6 Mbps, 4× CPU slowdown), one run per URL.
- **Not run anywhere**: physical iOS or Android devices; Safari/WebKit, Firefox and Edge; screen
  readers (VoiceOver, TalkBack, NVDA); 430 px, 768 px and landscape viewports; a form with the
  on-screen keyboard open; live services of any kind.

Spec names below refer to `tests/e2e/<name>.spec.ts`; unit names to `src/**/__tests__`.

## Screens S01–S26

| ID  | Screen             | Route                                           | Build                                       | Evidence                                                                                                                                                                                                                                                                    |
| --- | ------------------ | ----------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | Daily picks        | `/`                                             | Built                                       | PASS `navigation` (scroll restored on Back, focus returns to the row), `a11y`, `text-size`, Lighthouse accessibility/SEO/CLS gates (performance below target). REVIEWED 320, 390, 1440 px.                                                                                  |
| S02 | Pick analysis      | `/stocks/:symbol`                               | Built                                       | PASS `chart` ×4 (keyboard inspect, pin, Escape; tap pins; range switch stays coherent; data table), `offline`, `navigation` (deep link Back), `a11y`, `text-size`, Lighthouse accessibility/SEO/CLS gates (performance below target); unit F01. REVIEWED 320, 390, 1440 px. |
| S03 | Sign-in            | `/auth/sign-in`                                 | Built; Apple/Google configuration required  | PASS `auth` (wrong password keeps the email, clears the password), `a11y`, `text-size`. Provider buttons stay hidden until `VITE_AUTH_PROVIDERS` names a configured provider.                                                                                               |
| S04 | Personalization    | `/onboarding`, `/settings/research`             | Built                                       | PASS `auth` (preferences step inside registration), `a11y` (`/settings/research`). REVIEWED 390 px.                                                                                                                                                                         |
| S05 | Market overview    | `/market`                                       | Built                                       | PASS `a11y`, `text-size`, `motion`, `navigation` (tab keeps its place).                                                                                                                                                                                                     |
| S06 | Search & filters   | `/search`                                       | Built                                       | PASS `a11y`, `text-size`, `auth` (empty-state action lands here). Filter sheet and sort: NOT RUN.                                                                                                                                                                           |
| S07 | Earnings calendar  | `/earnings`                                     | Built                                       | PASS `a11y`, `text-size`. REVIEWED 390, 1440 px.                                                                                                                                                                                                                            |
| S08 | Earnings review    | `/earnings/:eventId`                            | Built                                       | PASS `a11y`. REVIEWED 390 px.                                                                                                                                                                                                                                               |
| S09 | IPO pipeline       | `/ipos`                                         | Built                                       | PASS `a11y`, `text-size`. REVIEWED 390 px.                                                                                                                                                                                                                                  |
| S10 | IPO dossier        | `/ipos/:ipoId`                                  | Built                                       | PASS `a11y`, `text-size`. REVIEWED 390 px.                                                                                                                                                                                                                                  |
| S11 | Investment thesis  | `/stocks/:symbol/thesis`                        | Built                                       | PASS `a11y`, `text-size`.                                                                                                                                                                                                                                                   |
| S12 | Valuation          | `/stocks/:symbol/valuation`                     | Built                                       | PASS `a11y`, `text-size`; unit `P/E scenario model` ×4. Saving a scenario: NOT RUN.                                                                                                                                                                                         |
| S13 | Watchlists         | `/watchlist`                                    | Built                                       | PASS `a11y`, `text-size`. REVIEWED 390, 1440 px.                                                                                                                                                                                                                            |
| S14 | Create alert       | `/alerts/new`, `/alerts/:id/edit`               | Built                                       | PASS `alerts` ×3 (identical rule refused with a link to it; already-beyond preview, double press creates one; lost reply retried without a duplicate), `a11y`, `text-size`; unit F02. REVIEWED 320, 390 px.                                                                 |
| S15 | Paper portfolio    | `/portfolio`                                    | Built                                       | PASS `portfolio`, `a11y`, `text-size`; unit F03, F04. REVIEWED 390 px.                                                                                                                                                                                                      |
| S16 | Paper position     | `/portfolio/:symbol`, `/paper/transactions/new` | Built                                       | PASS `portfolio` ×2 (buy previewed, saved once, reflected; overselling explained, not attempted), `a11y`, `text-size`. REVIEWED 390 px.                                                                                                                                     |
| S17 | Research library   | `/research`                                     | Built                                       | PASS `a11y`, `text-size`, Lighthouse accessibility/SEO/CLS gates (performance below target). REVIEWED 390, 1440 px.                                                                                                                                                         |
| S18 | Report reader      | `/research/:reportId`                           | Built                                       | PASS `a11y`. REVIEWED 390 px. Reading position and version history: NOT RUN.                                                                                                                                                                                                |
| S19 | Alert inbox        | `/watchlist/alerts`                             | Built                                       | PASS `alerts` (opening an item marks it read and opens its exact context), `a11y`, `text-size`. REVIEWED 390 px.                                                                                                                                                            |
| S20 | Alert settings     | `/settings/notifications`                       | Built; push delivery configuration required | PASS `a11y`, `text-size`. REVIEWED 390 px. Device permission is shown separately from the saved preference.                                                                                                                                                                 |
| S21 | Profile            | `/profile`                                      | Built                                       | PASS `a11y`, `text-size`. REVIEWED 390 px.                                                                                                                                                                                                                                  |
| S22 | App settings       | `/settings`                                     | Built                                       | PASS `a11y`, `motion` (in-app Motion setting previews immediately), `text-size`. REVIEWED 390 px.                                                                                                                                                                           |
| S23 | Pick archive       | `/archive`, `/archive/:archiveId`               | Built                                       | PASS `a11y`, `text-size`; unit `archive outcomes are re-measured from the price paths` ×3. REVIEWED 390 px.                                                                                                                                                                 |
| S24 | Performance review | `/archive/performance`                          | Built                                       | PASS `a11y`, `text-size`; unit (12 closed, 7 positive, +3.4%, pending window stays pending). REVIEWED 390 px.                                                                                                                                                               |
| S25 | Empty watchlist    | state of `/watchlist`                           | Built                                       | PASS `auth` (a new account sees the first-use state; Search leads to `/search`). Filtered-empty variant: NOT RUN.                                                                                                                                                           |
| S26 | Offline detail     | state of every detail screen                    | Built                                       | PASS `offline` (cached quote and chart labelled, retry while offline stays honest, reconnect clears every label together).                                                                                                                                                  |

## Supporting routes (spec page 44)

| Route                                                     | Build                                                                                                        | Evidence                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `/auth/register`                                          | Built                                                                                                        | PASS `auth`, `a11y`                                          |
| `/auth/verify`                                            | Built; the in-app demo mailbox stands in for email                                                           | PASS `auth`                                                  |
| `/auth/forgot`, `/auth/reset`                             | Built (demo mailbox)                                                                                         | NOT RUN                                                      |
| `/auth/callback`                                          | Partial: the return handler is built; providers are configuration required                                   | NOT RUN                                                      |
| `/account/edit`                                           | Built (a new email stays pending until verified)                                                             | PASS `a11y`                                                  |
| `/account/security`                                       | Partial: password change and signed-in devices with revocation are built; two-step verification is not built | PASS `a11y`                                                  |
| `/watchlists/new`, `/watchlists/:id/edit`                 | Built                                                                                                        | NOT RUN                                                      |
| `/alerts`, `/alerts/:id/edit`                             | Built                                                                                                        | PASS `alerts` (list), `a11y`                                 |
| `/paper/transactions/new`                                 | Built                                                                                                        | PASS `portfolio`, `a11y`                                     |
| `/account/data`                                           | Built: JSON export after re-authentication                                                                   | PASS `a11y`                                                  |
| `/account/delete`                                         | Built (type DELETE, re-authenticate; removes the demo account from this browser)                             | PASS `a11y`                                                  |
| `/help`, `/help/:article`, `/support`, `/legal/:document` | Built. Legal texts describe the demo build and have had no legal review                                      | PASS `a11y` (`/help`, `/legal/terms`), `text-size` (`/help`) |
| `/plans`, `/billing/return`                               | Not built: billing is off in this release (J10 applies only when billing is enabled)                         | —                                                            |
| `*` (404)                                                 | Built ("Not listed.")                                                                                        | PASS `navigation`, `a11y`                                    |
| `/access-denied`                                          | Built; private screens also explain sign-in in place                                                         | NOT RUN                                                      |
| `/maintenance`                                            | Built: read-only and configuration-required states; lists missing variable names only                        | NOT RUN                                                      |
| `/demo`, `/demo/components`                               | Built (demo build only)                                                                                      | PASS `a11y` (`/demo`)                                        |

## Interaction acceptance checks (spec page 28)

| #   | Check                  | Status  | Evidence and gap                                                                                                                                                                                                  |
| --- | ---------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Press response ≤ 50 ms | NOT RUN | The pressed state is set on pointer down and drawn with an 80 ms CSS transition; never measured on a device.                                                                                                      |
| 02  | Tap / hold / drag      | PASS\*  | Unit `chart touch contract` ×14 (180 ms hold, 8 px drag at 1.25× dominance, vertical movement yields to scroll, cancel, second contact); `chart` tap pins. \*Emulated pointers only; real touch hardware NOT RUN. |
| 03  | Chart correctness      | PASS    | Unit F01 (fifth point 134.50 at 13:50 ET, ninth 139.40 at 14:10 ET, ties pick the earlier sample, gaps never selected); `chart` data table shows the same values.                                                 |
| 04  | Live updates in scrub  | NOT RUN | The inspected sample is held by timestamp in `inspectionStore`, so a new quote cannot move it; no test delivers a quote mid-scrub.                                                                                |
| 05  | Range race             | PARTIAL | Range requests are keyed per range and superseded requests are aborted (latest selection wins). `chart` checks coherence after switching, not out-of-order responses.                                             |
| 06  | Navigation return      | PASS\*  | `navigation`: deep link Back goes to the structural parent; list scroll restored; focus returns to the row; each tab keeps its place. \*Restoring filters on Back: NOT RUN.                                       |
| 07  | Duplicate actions      | PASS\*  | `alerts`: double press creates one rule; a lost reply retried returns the original. `portfolio`: a buy is saved once. \*Watchlist creation and position updates: NOT RUN.                                         |
| 08  | Offline recovery       | PARTIAL | `offline`: reading offline labels cached data, retry stays honest, reconnect clears every label. Disconnecting during a search or a save: NOT RUN.                                                                |
| 09  | Reduced motion         | PASS    | `motion`: the system setting and the in-app setting remove movement offsets, press scaling and the skeleton shimmer; states stay visible.                                                                         |
| 10  | Accessibility          | PARTIAL | PASS: axe on 35 routes × 2 layouts, keyboard chart inspection, focus return, 200% text on 23 screens (`text-size`). NOT RUN: a full keyboard-only journey and any screen-reader pass.                             |
| 11  | Viewport               | PARTIAL | PASS: phone 412 px and desktop 1440 px on every spec; 200% text at phone width. REVIEWED: 320 and 390 px. NOT RUN: 430 px, 768 px, landscape, keyboard-open form.                                                 |

## Fixtures F01–F08 (spec page 60)

| ID  | Fixture                | Status                 | Evidence                                                                                                                                                                               |
| --- | ---------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Chart selection        | PASS                   | `series.test.ts` › F01 chart selection ×5                                                                                                                                              |
| F02 | Crossing and dedupe    | PASS                   | `alerts.test.ts` › F02 ×2, plus arming, stale baselines, cross-below, pause and repeat cooldown                                                                                        |
| F03 | Paper arithmetic       | PASS                   | `ledger.test.ts` › F03 (cash 918, basis 100.50, realized 18.50, unrealized 9.50, equity 1,028, total 28)                                                                               |
| F04 | Cash-flow return       | PASS                   | `performance.test.ts` › F04 (10% time-weighted, unavailable when the boundary valuation is missing)                                                                                    |
| F05 | Identity and ownership | Configuration required | Needs the real database and its row-level security. The demo keeps accounts apart inside one browser, which proves nothing about server isolation.                                     |
| F06 | Currency and actions   | PASS\*                 | `ledger.test.ts` › F06 ×4 (EUR stays EUR, 2:1 split, missing FX marks totals incomplete). \*A duplicate split event: NOT RUN.                                                          |
| F07 | Network and ordering   | PARTIAL                | Lost reply without duplicate: PASS (`alerts`). Latest query wins: by design (keyed, aborted requests), NOT RUN with delayed responses. Session expiry and conflicting drafts: NOT RUN. |
| F08 | Calendar and delivery  | PARTIAL                | `time.test.ts`: skipped and repeated DST times, quiet hours across DST, briefing time — PASS. Server scheduling with every tab closed needs the worker: configuration required.        |

## Journeys J01–J10 (spec page 46)

| ID  | Journey              | Status    | Evidence and gap                                                                                                                                                                                                                                                 |
| --- | -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J01 | First use            | PARTIAL   | `auth`: register → verify in the demo mailbox → preferences → resume the original destination → first-use watchlist. Saving from a pick, reload and a second device: NOT RUN.                                                                                    |
| J02 | Research             | NOT RUN   | Each screen is built; the journey has no end-to-end test.                                                                                                                                                                                                        |
| J03 | Catalyst             | PARTIAL   | Calendar → event → reminder is built; unconfirmed times are labelled; reminders skip postponed and cancelled events. The demo cannot reschedule an event, so that leg is NOT RUN.                                                                                |
| J04 | Alert                | PARTIAL   | Preview → confirm → exactly one rule: PASS. Firing runs in the in-browser demo engine (inbox, demo mailbox, browser notification). "Close the app, server observes": configuration required.                                                                     |
| J05 | Paper tracking       | PARTIAL   | A buy is previewed (shares after), saved once and recorded in the position; overselling is refused: PASS. Cash and average cost on screen, journal notes, a partial sell and the return comparison: built, NOT RUN end to end; their arithmetic PASS (F03, F04). |
| J06 | Honest history       | PARTIAL   | Losses, a delisted instrument and pending windows are in the archive (unit PASS). The browser journey: NOT RUN.                                                                                                                                                  |
| J07 | Recovery             | PARTIAL   | Offline reading and recovery: PASS. A save attempted offline and token expiry: NOT RUN.                                                                                                                                                                          |
| J08 | Account lifecycle    | NOT RUN   | Change email, devices, export and deletion are built against the demo service; revoking a real second session needs the server.                                                                                                                                  |
| J09 | Publisher            | Not built | No editorial or review tools in this repository.                                                                                                                                                                                                                 |
| J10 | Optional paid access | Not built | Billing is off.                                                                                                                                                                                                                                                  |

## Platform and operations (spec pages 42–57, 61–64)

| Area                                      | Build                   | Notes                                                                                                                                      |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Client app, navigation, split view        | Built                   | Route table is the single source of truth; per-tab stacks; deep links Back to their structural parent.                                     |
| PWA                                       | Built                   | Precached shell (141 entries), explicit update prompt, notification click opens the exact item, push display for live builds.              |
| `/api/v1` contract                        | Built (demo)            | Envelope, error codes, idempotency keys, record versions and lost-reply behaviour as specified; served in the browser by the demo service. |
| Live API, database, row-level security    | Configuration required  | No server, schema or migrations ship here. A live build refuses every request with `not_configured` and never shows demo data.             |
| Market data ingestion                     | Not built               | Deterministic demo price paths only.                                                                                                       |
| Alert worker, email and Web Push delivery | Not built (server side) | The demo engine runs in the browser while the app is open. Push subscription needs a VAPID key pair and a server.                          |
| Editorial publishing and corrections      | Not built               | Reports, revisions and withdrawals are seeded content.                                                                                     |
| Paper ledger                              | Built                   | Decimal ledger with reversals, splits, FX and partial totals (`domain/ledger.ts`).                                                         |
| Accounts and sessions                     | Built (demo)            | PBKDF2-SHA-256 hashes in browser storage, re-authentication for export and deletion. Production identity: configuration required.          |
| Two-step verification                     | Not built               | Shown as unavailable rather than faked.                                                                                                    |
| Billing                                   | Not built               | Off in this release.                                                                                                                       |
| Error monitoring, analytics               | Not built               | Only a local request-id log for support. No trackers.                                                                                      |
| Backups, restore, RPO/RTO                 | Configuration required  | Depends on the database. Rolling back the client is redeploying the previous `dist/`.                                                      |
| Continuous integration                    | Built                   | `.github/workflows/ci.yml`: typecheck, lint, format, unit, build, Playwright, Lighthouse CI. First run happens on the pull request.        |
| Internationalisation                      | Partial                 | English only. Times follow the person's chosen time zone; number (en-US) and date (en-GB) formats are fixed.                               |

## Typography (spec Version 3: locked to the reference photographs)

| Requirement                                                  | Build                                                       | Evidence                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Display type keeps the photographed letterforms and numerals | Built: FreeSerif Bold (Times Roman design)                  | Measured with `npm run typography:verify` (needs the spec's images; not part of CI): elastic Dice 0.834 on 51 display samples; first of 37 serif families in the comparison (41 samples); named samples in docs/TYPOGRAPHY.md. |
| Interface type keeps weights, spacing and numeric appearance | Built: Roboto Flex 400–700                                  | Measured: 0.723 on 61 interface samples, fitted without tracking at natural width; weights 400/450/550/600 from ink mass. First of 39 sans families on samples of 15 px and above.                                             |
| Sizes and tracking follow the photographs where they differ  | Built: measured roles in `tokens.css`, per-screen overrides | REVIEWED: photograph-beside-app boards for S01–S24 at 390 px (`docs/typography/`). Audit of 201 photographed elements: median deviation 3.4 %, 184 within 10 %, the rest explained in docs/TYPOGRAPHY.md.                      |
| Important labels at 13 px or above; nothing below 11 px      | Built: label and micro floors                               | Hints, step counters, legal links, unavailable-action notes, password progress, save state, filter labels and chart ranges at 13 px or more. Scan of 48 routes at 390 px: no rendered text below 11 px.                        |
| No tracking on numeric data columns                          | Built                                                       | Earnings results table, archive returns, key-value values and row prices set at 0 em; single figures keep −0.02 em.                                                                                                            |
| Photographed line breaks                                     | Built: headline fit in `ScreenHeading`                      | REVIEWED: "Today's / picks.", "The investment / case.", "Inside the / semiconductor / cycle.", "Stay informed." match their photographs. PASS `text-size` (no word leaves its box at 200%).                                    |
| Verified assets recorded, licence files bundled              | Built                                                       | docs/TYPOGRAPHY.md (sources, versions, SHA-256); `public/fonts/FreeSerif-LICENSE.txt`, `public/fonts/RobotoFlex-OFL.txt`; reproducible `npm run fonts`.                                                                        |
| Loading fallbacks never become the design                    | Built                                                       | Latin files preloaded; metric-matched local fallbacks only while loading; Lighthouse CLS ≤ 0.04.                                                                                                                               |
| Exact family names                                           | Not verifiable                                              | The photographs are generated images; the match is by measurement, not by name. One photographed serif button (S20) and "•" separators are not followed; see docs/TYPOGRAPHY.md.                                               |

## Performance

Lighthouse, mobile, simulated slow 4G and 4× CPU, one run per URL on the final build:

| URL            | Performance | Accessibility | Best practices | SEO | FCP   | LCP   | TBT    | CLS   |
| -------------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ | ----- |
| `/`            | 83          | 100           | 100            | 100 | 2.2 s | 3.1 s | 359 ms | 0.035 |
| `/stocks/NVDA` | 83          | 100           | 100            | 100 | 2.0 s | 2.2 s | 535 ms | 0.031 |
| `/research`    | 80          | 100           | 100            | 100 | 2.1 s | 3.8 s | 306 ms | 0     |

Single runs vary: runs on the final typography builds ranged 79–85 for performance and
270–600 ms for total blocking time, with accessibility at 100 and CLS at or below 0.04 in all.

Bundle (gzip): about 150 kB of JavaScript before first render (React 65 kB, router 30 kB, query
14 kB, app entry 26 kB, shared modules 18 kB), plus the 36 kB demo service fetched in parallel and
started after first paint. Entry CSS is inlined; two subset WOFF2 fonts (FreeSerif Bold and Roboto
Flex, about 50 kB together) are preloaded.

**Targets not met**: performance score ≥ 90 and LCP ≤ 2.5 s on every route. The landing view is
client-rendered, so its largest paint waits for the JavaScript. Total blocking time comes from
React rendering the first screens on the slowed CPU (long tasks of 70–240 ms, all attributed to the
React chunk). The fix with the most leverage is prerendering the public routes at build or edge
time, then deferring below-the-fold sections; see the README's next steps.

## Known limitations

- Everything is illustrative demo data generated in the browser; nothing is market data.
- Live services (API, database, email, push, market data, identity providers, billing) are not
  part of this repository.
- Tested in Chromium only; no Safari, Firefox or real-device evidence yet.
- Legal and help texts describe the demo and have had no legal review.
