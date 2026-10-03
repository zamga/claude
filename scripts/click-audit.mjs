#!/usr/bin/env node
/**
 * Click-through audit: every routed screen, signed in and signed out, is loaded fresh and each of
 * its controls is activated on its own (and, one level down, every control that activation reveals:
 * sheets, dialogs, expanders). Each activation records what happened (navigation, new controls,
 * dialogs, downloads, page errors, console errors, failed requests, error screens) and the run ends
 * with a summary of everything that needs a look. Not part of CI: a full run takes 20-40 minutes.
 *
 *   npm run build && npx vite preview --port 4175 &
 *   CHROMIUM_PATH=/path/to/chromium npm run audit:clicks -- --base http://localhost:4175
 *
 * Options
 *   --base <url>       the app (default http://localhost:4175); for the static preview, the page URL
 *   --hash             routes live in the URL hash (the preview build)
 *   --layout <name>    phone (390 x 844, touch; default) or desktop (1440 x 900, split view)
 *   --auth <list>      in,out (default both): signed in with the demo account, and as a guest
 *   --only <routes>    comma-separated routes instead of all of them
 *   --workers <n>      parallel pages (default 4)
 *   --out <file>       JSON lines, one per activation (default click-audit.jsonl)
 */
import { chromium } from '@playwright/test';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = { base: 'http://localhost:4175', hash: false, layout: 'phone', auth: ['in', 'out'] };
  Object.assign(args, { only: null, workers: 4, out: 'click-audit.jsonl' });
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === '--hash') args.hash = true;
    else if (key === '--base') args.base = value;
    else if (key === '--layout') args.layout = value;
    else if (key === '--auth') args.auth = value.split(',');
    else if (key === '--only') args.only = value.split(',');
    else if (key === '--workers') args.workers = Number(value);
    else if (key === '--out') args.out = value;
    else continue;
    if (key !== '--hash') i++;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const PUBLIC = [
  '/',
  '/market',
  '/search',
  '/earnings',
  '/earnings/ern_nvda_q2fy27',
  '/ipos',
  '/ipos/ipo_alto',
  '/stocks/NVDA',
  '/stocks/NVDA/thesis',
  '/stocks/NVDA/valuation',
  '/research',
  '/research/rep_nvda_thesis',
  '/archive',
  '/archive/performance',
  '/archive/arc_2026_09_02_nvda',
  '/help',
  '/help/how-picks-work',
  '/support',
  '/legal/terms',
  '/legal/privacy',
  '/demo',
  '/demo/components',
  '/auth/sign-in',
  '/auth/register',
  '/auth/verify',
  '/auth/forgot',
  '/auth/reset',
  '/access-denied',
  '/maintenance',
  '/nope',
];
const PRIVATE = [
  '/watchlist',
  '/watchlist/alerts',
  '/alerts',
  '/alerts/new?instrument=NVDA',
  '/alerts/rule_nvda_150/edit',
  '/portfolio',
  '/portfolio/NVDA',
  '/paper/transactions/new?instrument=NVDA',
  '/watchlists/new',
  '/watchlists/wl_high_conviction/edit',
  '/profile',
  '/settings',
  '/settings/notifications',
  '/settings/research',
  '/account/edit',
  '/account/security',
  '/account/data',
  '/account/delete',
  '/onboarding',
];
const REVEALED_LIMIT = 30;

const device =
  args.layout === 'desktop'
    ? { viewport: { width: 1440, height: 900 } }
    : {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      };
const urlFor = (path) => (args.hash ? `${args.base}#${path}` : `${args.base}${path}`);
const origin = new URL(args.base).origin;
const appPath = (loc) =>
  args.hash ? loc.hash.replace(/^#/, '') || '/' : loc.pathname + loc.search;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function newContext(storageState) {
  const context = await browser.newContext({
    ...device,
    locale: 'en-GB',
    timezoneId: 'Europe/Ljubljana',
    acceptDownloads: true,
    storageState,
  });
  // The instant demo network keeps every screen's data a frame away.
  await context.addInitScript(() =>
    sessionStorage.setItem(
      'stockpicks.demo.network.v1',
      JSON.stringify({ offline: false, slow: false, nextWrite: 'normal', instant: true }),
    ),
  );
  return context;
}

/** Runs in the page: the controls, their descriptions, and what changed after an activation. */
function installProbe() {
  const SELECTOR = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="tab"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="checkbox"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="link"]',
    '[role="slider"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const nameOf = (el) => {
    const ids = el.getAttribute('aria-labelledby');
    const labelled = ids
      ? ids
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
      : '';
    const text =
      el.getAttribute('aria-label') ||
      labelled ||
      el.textContent ||
      el.labels?.[0]?.textContent ||
      el.getAttribute('title') ||
      '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 70);
  };
  window.__audit = {
    list: () =>
      [...document.querySelectorAll(SELECTOR)].filter((el) => {
        if (el.closest('[inert], [aria-hidden="true"]')) return false;
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && box.width >= 1 && box.height >= 1;
      }),
    describe: (el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') ?? '',
      type: el.getAttribute('type') ?? '',
      name: nameOf(el),
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      current:
        el.getAttribute('aria-checked') === 'true' ||
        el.getAttribute('aria-selected') === 'true' ||
        el.getAttribute('aria-pressed') === 'true' ||
        el.getAttribute('aria-current') === 'page',
      shell: !!el.closest('nav[aria-label="Primary"]') || el.matches('a[href="#main-content"]'),
    }),
    errors: () => {
      const text = document.body.innerText;
      const phrases = ['This view could not be shown', 'page not found', 'could not be loaded'];
      const found = phrases.filter((phrase) => text.includes(phrase));
      if (!document.getElementById('root')?.children.length) found.push('empty page');
      return found;
    },
    watch: () => {
      const state = { count: 0 };
      const observer = new MutationObserver((records) => {
        for (const record of records)
          if (record.type !== 'attributes' || record.attributeName !== 'data-pressed')
            state.count++;
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      window.__auditWatch = { observer, state };
    },
    stop: () => {
      window.__auditWatch?.observer.disconnect();
      return window.__auditWatch?.state.count ?? 0;
    },
    dialogs: () =>
      [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')].length,
    location: () => ({ href: location.href, pathname: location.pathname, hash: location.hash }),
    active: () => {
      const el = document.activeElement;
      return el ? `${el.tagName}#${el.id}:${(el.textContent ?? '').slice(0, 20)}` : '';
    },
  };
}

async function ready(page) {
  await page.waitForLoadState('load');
  await page.evaluate(installProbe);
  await page.evaluate(() => document.fonts.ready);
  // Wait until the screen stops adding controls (a split view loads its second pane after the
  // first), so a control's index means the same control on every fresh load.
  let previous = -1;
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForTimeout(250);
    const count = await page.evaluate(() => window.__audit.list().length);
    if (count === previous) break;
    previous = count;
  }
}

async function activate(page, handle, info) {
  if (info.tag === 'select') {
    const next = await handle.evaluate(
      (el) => [...el.options].map((o) => o.value).find((value) => value !== el.value) ?? null,
    );
    if (next === null) return { how: 'select (one option)' };
    await handle.selectOption(next);
    return { how: 'select' };
  }
  try {
    await handle.click({ timeout: 2500 });
    return { how: 'click' };
  } catch (error) {
    // What a keyboard user would do instead (the skip link, aria-disabled buttons).
    const reason =
      String(error.message)
        .split('\n')
        .find((line) => line.includes(' - ')) ?? '';
    try {
      await handle.focus();
      const toggle = ['checkbox', 'switch', 'radio'].includes(info.role || info.type);
      await page.keyboard.press(toggle ? 'Space' : 'Enter');
      return { how: 'keyboard', reason: reason.trim() };
    } catch {
      return { how: 'failed', reason: reason.trim() };
    }
  }
}

const queue = [];
let running = 0;
let finished = 0;
writeFileSync(args.out, '');

async function run(job, signedIn) {
  const context = await newContext(job.auth === 'in' ? signedIn : undefined);
  const page = await context.newPage();
  const events = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    downloads: [],
    popups: [],
  };
  page.on('pageerror', (error) => events.pageErrors.push(String(error.message).slice(0, 200)));
  page.on('console', (message) => {
    if (message.type() === 'error') events.consoleErrors.push(message.text().slice(0, 200));
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400)
      events.failedRequests.push(`${response.status()} ${url.pathname}`);
  });
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));
  page.on('download', (download) => events.downloads.push(download.suggestedFilename()));
  context.on('page', (popup) => events.popups.push(popup.url()));
  const result = { route: job.route, auth: job.auth, path: job.path };
  try {
    await page.goto(urlFor(job.route));
    await ready(page);
    if (job.path.length === 0) {
      result.loadErrors = await page.evaluate(() => window.__audit.errors());
      result.landed = appPath(await page.evaluate(() => window.__audit.location()));
      const items = await page.evaluate(() => window.__audit.list().map(window.__audit.describe));
      result.controls = items.length;
      if (!job.loadOnly)
        items.forEach((item, index) => {
          if (!item.shell || job.route === '/')
            queue.push({ route: job.route, auth: job.auth, path: [index], name: item.name });
        });
    } else {
      let target = await page.evaluateHandle(
        (index) => window.__audit.list()[index] ?? null,
        job.path[0],
      );
      if (job.path.length === 2) {
        const opener = await target.evaluate((el) => window.__audit.describe(el));
        await page.evaluate(() => (window.__before = new Set(window.__audit.list())));
        await activate(page, target.asElement(), opener);
        await page.waitForTimeout(650);
        await page.evaluate(installProbe);
        target = await page.evaluateHandle(
          (index) => window.__audit.list().filter((el) => !window.__before?.has(el))[index] ?? null,
          job.path[1],
        );
        result.opener = opener.name;
      }
      const handle = target.asElement();
      if (!handle) throw new Error('control not found after reload');
      const info = await handle.evaluate((el) => window.__audit.describe(el));
      result.control = info;
      const before = await page.evaluate(() => {
        window.__before = new Set(window.__audit.list());
        return {
          loc: window.__audit.location(),
          dialogs: window.__audit.dialogs(),
          active: window.__audit.active(),
        };
      });
      // What changes on this page without any activation (live clocks, animations).
      await page.evaluate(() => window.__audit.watch());
      await page.waitForTimeout(350);
      const baseline = await page.evaluate(() => window.__audit.stop());
      await page.evaluate(() => window.__audit.watch());
      result.activation = await activate(page, handle, info);
      await page.waitForTimeout(700);
      await page.waitForLoadState('load');
      await page.evaluate(installProbe);
      // A control may reload the page (restart, reset): then nothing from before survives.
      const after = await page.evaluate(() => ({
        reloaded: !window.__before,
        loc: window.__audit.location(),
        dialogs: window.__audit.dialogs(),
        active: window.__audit.active(),
        mutations: window.__audit.stop(),
        errors: window.__audit.errors(),
        revealed: window.__before
          ? window.__audit
              .list()
              .filter((el) => !window.__before.has(el))
              .map(window.__audit.describe)
          : [],
      }));
      result.to = appPath(after.loc);
      result.leftApp =
        new URL(after.loc.href).origin !== origin ||
        (args.hash && after.loc.pathname !== before.loc.pathname);
      result.effect =
        after.reloaded ||
        after.loc.href !== before.loc.href ||
        after.mutations > baseline ||
        after.dialogs !== before.dialogs ||
        events.downloads.length > 0 ||
        events.popups.length > 0;
      result.focusMoved = after.active !== before.active;
      result.errors = after.errors.filter(
        (e) => !(job.route === '/nope' && e === 'page not found'),
      );
      if (job.path.length === 1 && after.loc.href === before.loc.href)
        after.revealed.slice(0, REVEALED_LIMIT).forEach((item, index) => {
          if (!item.shell)
            queue.push({
              route: job.route,
              auth: job.auth,
              path: [job.path[0], index],
              name: item.name,
            });
        });
    }
  } catch (error) {
    result.auditError = String(error.message).split('\n')[0].slice(0, 200);
  }
  appendFileSync(args.out, `${JSON.stringify({ ...result, ...events })}\n`);
  await context.close().catch(() => undefined);
}

// Sign in once through the interface; every signed-in job starts from a copy of that storage.
let signedIn;
if (args.auth.includes('in')) {
  const context = await newContext(undefined);
  const page = await context.newPage();
  await page.goto(urlFor('/auth/sign-in'));
  await page.getByRole('button', { name: 'Fill in the demo account' }).click();
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.waitForFunction(() => !(location.hash || location.pathname).includes('/auth'));
  await page.waitForTimeout(800);
  signedIn = await context.storageState();
  await context.close();
}
for (const auth of args.auth)
  for (const route of [...PUBLIC, ...PRIVATE]) {
    if (args.only && !args.only.includes(route)) continue;
    // Signed out, a private route is only loaded: it should ask for sign-in.
    queue.push({ route, auth, path: [], loadOnly: auth === 'out' && PRIVATE.includes(route) });
  }

async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) {
      if (running === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
      continue;
    }
    running++;
    await run(job, signedIn).catch((error) => console.error(job.route, error.message));
    running--;
    if (++finished % 100 === 0) console.log(`${finished} done, ${queue.length} queued`);
  }
}
await Promise.all(Array.from({ length: args.workers }, worker));
await browser.close();

// Summary: everything that needs a look, by kind.
const rows = readFileSync(args.out, 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const label = (row) =>
  `${row.auth.padEnd(3)} ${row.route} [${row.path.join(' > ')}] "${row.control?.name ?? ''}"${row.opener ? ` (in "${row.opener}")` : ''}`;
const groups = {
  'Screens that failed to load': rows
    .filter(
      (r) => r.path.length === 0 && (r.loadErrors?.length || r.pageErrors.length || r.auditError),
    )
    .filter((r) => r.route !== '/nope' || r.pageErrors.length)
    .map(
      (r) =>
        `${r.auth} ${r.route} → ${r.landed} ${JSON.stringify(r.loadErrors)} ${r.pageErrors.join('; ')}`,
    ),
  'JavaScript errors': rows
    .filter((r) => r.path.length && (r.pageErrors.length || r.consoleErrors.length))
    .map((r) => `${label(r)}: ${[...r.pageErrors, ...r.consoleErrors].join('; ')}`),
  'Error screens after an activation': rows
    .filter((r) => r.errors?.length)
    .map((r) => `${label(r)} → ${r.to}: ${r.errors.join(', ')}`),
  'Failed requests': rows
    .filter((r) => r.failedRequests.length)
    .map((r) => `${label(r)}: ${r.failedRequests.join(', ')}`),
  'Left the app': rows.filter((r) => r.leftApp).map((r) => `${label(r)} → ${r.to}`),
  'Could not be activated': rows
    .filter((r) => r.activation?.how === 'failed' || (r.auditError && r.path.length))
    .map((r) => `${label(r)}: ${r.activation?.reason ?? r.auditError}`),
  'No visible effect (excluding current tabs, disabled controls and text fields)': rows
    .filter(
      (r) => r.path.length && r.effect === false && !r.control?.current && !r.control?.disabled,
    )
    .filter(
      (r) =>
        !['input', 'textarea'].includes(r.control?.tag) ||
        ['checkbox', 'radio'].includes(r.control?.type),
    )
    .map((r) => `${label(r)}${r.focusMoved ? ' (focus moved)' : ''}`),
  'Popups and downloads (check the target)': rows
    .filter((r) => r.popups.length || r.downloads.length)
    .map((r) => `${label(r)}: ${[...r.popups, ...r.downloads].join(', ')}`),
};
const activations = rows.filter((r) => r.path.length);
console.log(
  `\n${rows.length - activations.length} screens, ${activations.length} activations (${activations.filter((r) => r.path.length === 2).length} inside revealed controls) → ${args.out}`,
);
for (const [title, lines] of Object.entries(groups)) {
  console.log(`\n${title}: ${lines.length}`);
  for (const line of lines.slice(0, 40)) console.log(`  ${line}`);
}
