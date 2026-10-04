#!/usr/bin/env node
/**
 * GitHub Pages build: the installable app (service worker, web manifest, offline start) served
 * from a project site's sub-path, such as https://<owner>.github.io/<repo>/.
 *
 *   npm run build:pages                         # base /claude/, writes dist-pages/
 *   PAGES_BASE=/stock-picks/ npm run build:pages
 *
 * GitHub Pages has no rewrites, so a deep link (a reload on /claude/stocks/NVDA, a shared link)
 * is answered by 404.html, a copy of index.html that starts the app on that route. Once the
 * service worker is installed it answers every in-app navigation itself, offline included.
 * Source maps stay out of the published folder.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist-pages');
const trimmed = (process.env.PAGES_BASE ?? '/claude/').replace(/^\/+|\/+$/g, '');
const base = trimmed ? `/${trimmed}/` : '/';

execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: base, VITE_DATA_MODE: 'demo' },
});

copyFileSync(join(out, 'index.html'), join(out, '404.html'));
writeFileSync(join(out, '.nojekyll'), '');
for (const entry of readdirSync(out, { recursive: true })) {
  if (String(entry).endsWith('.map')) rmSync(join(out, String(entry)));
}
console.log(`\nPages build: dist-pages/ for ${base} (404.html answers deep links)`);
