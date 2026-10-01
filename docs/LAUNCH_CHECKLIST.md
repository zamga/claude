# Launch checklist

✅ done and verified in this build · ☐ to do at launch (needs an account, a device, a person or a decision)

## Performance

- ✅ Asset budgets enforced in CI (`npm run budget`): initial JS ≤ 105 KB, CSS ≤ 16 KB, preloaded fonts ≤ 125 KB, chart chunk ≤ 20 KB, Three.js ≤ 160 KB
- ✅ Lighthouse mobile asserted in CI on five routes; measured 94–97, LCP 2.46–2.50 s, CLS 0
- ✅ Prerendered HTML, hydration after first paint, no outlined Suspense boundaries
- ✅ Fonts subset and preloaded, accented Latin on demand, metric-matched fallbacks
- ✅ Hashed assets cached for a year (`immutable`); relief code loads only where it can render
- ☐ Real devices: iPhone (Safari), a mid-range Android (Chrome), an iPad: relief frame rate, INP while dragging, memory
- ☐ First week: watch p75 LCP, INP and CLS per route and per build in the telemetry

## Accessibility (WCAG 2.2 AA)

- ✅ axe-core: zero violations on six routes, desktop and phone
- ✅ Keyboard: skip link, visible focus everywhere, chart bearing on arrow keys, command palette, dialogs, menu sheet
- ✅ Reduced motion: flat chart, no sway, no page transitions, identical readings
- ✅ Contrast measured for every text and control token in both themes
- ☐ Screen readers: VoiceOver (iOS, macOS), NVDA with Firefox, TalkBack
- ☐ Zoom to 200% and 400% (reflow) and Windows forced-colours mode

## SEO and sharing

- ✅ 17 prerendered routes with unique title, description, canonical URL and Open Graph tags
- ✅ `sitemap.xml`, `robots.txt` and `llms.txt` generated from the route list
- ✅ JSON-LD `WebApplication`, web manifest, favicon, touch icon, social image
- ☐ Set `SITE_URL` to the production origin for the production build
- ☐ Submit the sitemap to Google Search Console and Bing Webmaster Tools
- ☐ Per-chart social images (award audit, fix 4)

## Browsers and devices

- ✅ Chromium desktop and Pixel 7 emulation in CI, WebGL relief forced on and off
- ☐ Safari (macOS, iOS), Firefox, Samsung Internet: View Transitions fallback, WebGL 2, the `unicode-range` font split
- ☐ A low-memory Android: confirm the flat-chart fallback (under 2 GB, Save-Data)

## Analytics and monitoring

- ✅ Field telemetry built in: Core Web Vitals with attribution, errors, product actions; GPC and Do Not Track respected
- ☐ Build environment: `VITE_TELEMETRY_URL=/api/telemetry` (and `VITE_TELEMETRY_SAMPLE` if traffic is high)
- ☐ Log drain, or `TELEMETRY_FORWARD_URL` and `TELEMETRY_FORWARD_TOKEN`, into the team's log analytics
- ☐ Dashboards: p75 vitals by route and build; error rate by build; chart view → bearing moved → link copied
- ☐ Alerts: error-rate spike on a new build; p75 INP over 200 ms
- ☐ Uptime checks on `/` and `/api/company?ticker=AAPL`

## Security and privacy

- ✅ Content-Security-Policy with no inline or evaluated script (hash checked by a unit test, enforced during end-to-end tests), HSTS, `nosniff`, `frame-ancestors 'none'`, COOP, referrer and permissions policies
- ✅ No cookies; scenarios live in the browser and in links; telemetry reduces paths to route templates
- ☐ A privacy note describing the telemetry (legal review)
- ☐ If telemetry goes to another origin, add it to `connect-src`

## Data and legal

- ✅ Sources and notes on every company; method, defaults and limits published; "not investment advice" on the method page and in the footer
- ✅ Font licences (SIL OFL) shipped with the fonts
- ☐ `SEC_USER_AGENT` with a real name and contact address, per the SEC's fair-access policy
- ☐ `ALPHAVANTAGE_API_KEY`, after checking the plan's display terms
- ☐ Refresh the snapshot (`npm run data:refresh`), review the diff, redeploy; schedule monthly

## Release

- ✅ CI on every pull request: types, lint, unit tests, build, budgets, end-to-end, accessibility, Lighthouse, visual regression
- ☐ Connect the repository to Vercel: a preview deployment per pull request, production from `main`
- ☐ Smoke-test `/api/company` and `/api/telemetry` on the first preview deployment
- ☐ Protect `main`: require the CI checks
- ☐ Record visual baselines (run the workflow with `update_baselines`, commit the images)
- ☐ Rollback drill: `vercel rollback` (or Instant Rollback in the dashboard) to the previous production deployment; confirm the telemetry build tag switches back
- ☐ Custom domain with HTTPS; confirm the security headers on it

## Content

- ✅ Every nautical term carries its plain finance name; glossary on the method page
- ☐ Review of defaults and method copy by a finance editor
- ☐ Final proofread
