#!/usr/bin/env node
/**
 * Verifies the bundled typefaces against the reference photographs in the specification
 * (Version 3, typography section). See docs/TYPOGRAPHY.md for the method and the recorded result.
 *
 *   pdfimages -all Stock_Picks_Complete_App_Design.pdf /tmp/spec/img     # poppler-utils
 *   CHROMIUM_PATH=/path/to/chromium npm run typography:verify -- --images /tmp/spec
 *
 * Options
 *   --images <dir>      the images extracted from the specification PDF (img-000.jpg, img-001.png, …)
 *   --out <dir>         where report.json and overlays.png are written (default: typography-report)
 *   --candidate <spec>  an extra face to compare, as "id|family file|weight|role", for example
 *                       "source-serif-4@700|/tmp/SourceSerif4.woff2|700|display" (repeatable)
 *   --only <ids>        comma-separated sample ids to score (default: all of samples.json)
 *
 * Each sample is a crop of the photographs. Its ink is normalised against the local background,
 * the candidate is rendered by Chromium (HarfBuzz shaping and kerning) at the size whose ink
 * height matches the crop (±14 % searched), uniform tracking is fitted from the ink width, and the
 * two ink maps are compared:
 *   rigid    soft Dice of the whole fitted line
 *   elastic  soft Dice when each glyph may shift by up to 7 % of the size (the photographs are
 *            generated images whose spacing is irregular, so letterforms are judged separately)
 *   mass     candidate ink ÷ reference ink at the height-derived size (≈1: the same weight)
 * Sizes are reported in CSS px: 476 image px of phone screen correspond to 390 CSS px.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const IMAGE_PX_PER_CSS_PX = 476 / 390;
const NAMED = ['today', 'picks', 'nvda_dark', 'price_dark', 'nvda_light', 'price_light'];
const OVERLAY_UI = ['today_change', 'body', 'add', 'b1_research'];

function parseArgs(argv) {
  const args = { images: null, out: 'typography-report', candidates: [], only: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--images') args.images = value;
    else if (key === '--out') args.out = value;
    else if (key === '--candidate') args.candidates.push(value);
    else if (key === '--only') args.only = value.split(',');
    else continue;
    i++;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.images || !existsSync(args.images)) {
  console.error('Pass --images <dir> with the images extracted from the specification PDF.');
  console.error('  pdfimages -all Stock_Picks_Complete_App_Design.pdf /tmp/spec/img');
  process.exit(2);
}

// The bundled assets (the "latin" files cover every sample) and any extra candidates.
const files = new Map();
const candidates = [
  {
    id: 'freeserif@700',
    file: 'public/fonts/freeserif-700-latin.woff2',
    weight: 700,
    role: 'display',
  },
  ...[400, 450, 500].map((weight) => ({
    id: `roboto-flex@${weight}`,
    file: 'public/fonts/roboto-flex-400-700-latin.woff2',
    weight,
    role: 'ui',
    variable: true,
  })),
  ...args.candidates.map((spec) => {
    const [id, file, weight, role] = spec.split('|');
    return { id, file, weight: Number(weight), role, variable: true };
  }),
].map((candidate, index) => {
  const path = resolve(root, candidate.file);
  const url = `/font/${index}${extname(path)}`;
  files.set(url, path);
  return { ...candidate, family: `Candidate ${index}`, url };
});

const samples = JSON.parse(readFileSync(join(here, 'samples.json'), 'utf8')).filter(
  (sample) => !args.only || args.only.includes(sample.id),
);
for (const image of new Set(samples.map((sample) => sample.image)))
  files.set(`/image/${image}`, resolve(args.images, image));

const TYPES = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.route('http://verify.local/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/')
    return route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><title>verify</title>',
    });
  const file = files.get(path);
  if (!file || !existsSync(file)) return route.fulfill({ status: 404, body: `missing ${path}` });
  return route.fulfill({
    contentType: TYPES[extname(file)] ?? 'application/octet-stream',
    body: readFileSync(file),
  });
});
await page.goto('http://verify.local/');
await page.addScriptTag({ path: join(here, 'harness.js') });

const report = await page.evaluate(
  async ([samples, candidates]) => window.verifyAll(samples, candidates),
  [samples, candidates],
);

// Summary per candidate, then the named samples the specification asks for.
const out = resolve(root, args.out);
mkdirSync(out, { recursive: true });
const summary = {};
for (const candidate of candidates) {
  const rows = Object.values(report.results[candidate.id] ?? {}).filter(Boolean);
  if (!rows.length) continue;
  const mean = (key) => rows.reduce((total, row) => total + row[key], 0) / rows.length;
  summary[candidate.id] = {
    role: candidate.role,
    samples: rows.length,
    elastic: +mean('elastic').toFixed(4),
    rigid: +mean('rigid').toFixed(4),
    mass: +mean('massRatio').toFixed(3),
    trackingEm: +mean('trackingEm').toFixed(4),
    widthRatio: +mean('widthRatio').toFixed(3),
  };
}
const named = {};
for (const id of NAMED) {
  const result = report.results['freeserif@700']?.[id];
  if (result)
    named[id] = {
      cssPx: +(result.size / IMAGE_PX_PER_CSS_PX).toFixed(1),
      trackingEm: result.trackingEm,
      elastic: result.elastic,
      rigid: result.rigid,
    };
}
writeFileSync(
  join(out, 'report.json'),
  JSON.stringify({ summary, named, samples: report.samples, results: report.results }, null, 1),
);

console.log('\nCandidate                 role     n   elastic  rigid   mass   track em  width');
for (const [id, row] of Object.entries(summary).sort((a, b) => b[1].elastic - a[1].elastic))
  console.log(
    `${id.padEnd(25)} ${row.role.padEnd(8)} ${String(row.samples).padStart(3)}   ${row.elastic.toFixed(4)}  ${row.rigid.toFixed(4)}  ${row.mass.toFixed(2)}   ${row.trackingEm.toFixed(3).padStart(7)}  ${row.widthRatio.toFixed(3)}`,
  );
console.log('\nNamed samples (FreeSerif Bold)   size     tracking   elastic');
for (const [id, row] of Object.entries(named))
  console.log(
    `${id.padEnd(32)} ${row.cssPx.toFixed(1).padStart(5)} px  ${row.trackingEm.toFixed(3).padStart(7)} em   ${row.elastic.toFixed(4)}`,
  );

// Overlays: reference | candidate | both (reference only red, candidate only cyan).
const cells = [];
for (const [sampleId, candidateId] of [
  ...NAMED.map((id) => [id, 'freeserif@700']),
  ...OVERLAY_UI.map((id) => [id, 'roboto-flex@500']),
]) {
  if (!report.samples[sampleId]) continue;
  const candidate = candidates.find((item) => item.id === candidateId);
  cells.push({
    sampleId,
    candidateId,
    ...(await page.evaluate(([id, c]) => window.overlay(id, c), [sampleId, candidate])),
  });
}
if (cells.length) {
  await page.setContent(
    `<body style="margin:0;background:#888;font:12px sans-serif">${cells
      .map(
        (cell) =>
          `<div style="display:inline-block;margin:4px;vertical-align:top;background:#fff;padding:4px"><div>${cell.sampleId} · ${cell.candidateId} · ${(cell.size / IMAGE_PX_PER_CSS_PX).toFixed(1)} px · ${cell.tracking.toFixed(3)} em</div><img src="${cell.url}"></div>`,
      )
      .join('')}</body>`,
  );
  await page.screenshot({ path: join(out, 'overlays.png'), fullPage: true });
}
await browser.close();
console.log(`\nWrote ${join(args.out, 'report.json')} and ${join(args.out, 'overlays.png')}`);
