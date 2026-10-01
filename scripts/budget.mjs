/**
 * Asset budgets for the production build, checked in CI after `npm run build`.
 *
 * "Initial" is everything a first visit downloads before it can paint and
 * hydrate: the entry script and its modulepreloads, the stylesheet and the
 * preloaded fonts, read straight from dist/index.html. Lazy chunks are
 * budgeted on their own. Sizes are gzip level 9; the CDN serves Brotli,
 * which is smaller still.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const BUDGETS = [
  { name: 'Initial JavaScript', limit: 105 * KB, files: initial(/<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="\/([^"]+\.js)"/g) },
  { name: 'Initial CSS', limit: 16 * KB, files: initial(/<link[^>]*rel="stylesheet"[^>]*\shref="\/([^"]+\.css)"/g) },
  { name: 'Preloaded fonts', limit: 125 * KB, files: initial(/<link[^>]*rel="preload"[^>]*\shref="\/([^"]+\.woff2)"/g), raw: true },
  { name: 'Chart page chunk', limit: 20 * KB, files: asset('ChartPage-') },
  { name: 'Relief chunk (three.js)', limit: 160 * KB, files: asset('TerrainStage-') },
  // Only emitted when VITE_TELEMETRY_URL is set; without it the code is dropped at build time.
  { name: 'Telemetry chunk', limit: 8 * KB, files: asset('web-vitals'), optional: true },
];

function initial(pattern) {
  return [...html.matchAll(pattern)].map((m) => m[1]);
}

function asset(prefix, ext = '.js') {
  return readdirSync(join(dist, 'assets'))
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .map((f) => `assets/${f}`);
}

const size = (file, raw) => {
  const bytes = readFileSync(join(dist, file));
  // Fonts are already compressed (WOFF2); count their real transfer size.
  return raw ? bytes.length : gzipSync(bytes, { level: 9 }).length;
};

let failed = false;
const rows = BUDGETS.map(({ name, limit, files, raw, optional }) => {
  if (files.length === 0 && optional) {
    return { budget: name, size: 'not built', limit: `${(limit / KB).toFixed(0)} KB`, status: 'ok' };
  }
  if (files.length === 0) {
    failed = true;
    return { budget: name, size: 'missing', limit: `${(limit / KB).toFixed(0)} KB`, status: 'FAIL' };
  }
  const total = files.reduce((sum, f) => sum + size(f, raw), 0);
  const over = total > limit;
  if (over) failed = true;
  return {
    budget: name,
    size: `${(total / KB).toFixed(1)} KB`,
    limit: `${(limit / KB).toFixed(0)} KB`,
    used: `${Math.round((total / limit) * 100)}%`,
    status: over ? 'FAIL' : 'ok',
  };
});

console.table(rows);
if (failed) {
  console.error('Asset budget exceeded. Split the code, lazy-load it, or argue for a new budget in docs/ARCHITECTURE.md.');
  process.exit(1);
}
