/*
 * Photographs Uncovered's own print: the frames of "Look closer", the film on
 * the front page that moves from the whole Krka cover to the source printed
 * under one of its figures; the same cover under ultraviolet; and the cards
 * shown where a page is shared.
 *
 *   npm run build && node scripts/plates/render.mjs [--only film|wide|tall|uv|cards] [--frame N]
 *
 * Serves the built site, captures the cover with Chromium at each frame's
 * magnification (scripts/plates/capture.mjs), develops each capture through
 * the physical model (scripts/plates/material.mjs) on worker threads, and
 * writes WebP frames to public/film/ plus src/home/closer/film.ts, the shots
 * the player needs to place its camera between frames. Deterministic: the
 * same build gives the same frames.
 */
import { createServer } from 'node:http';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { openCover, MM_PER_CSS } from './capture.mjs';
import { cameraAt } from '../../src/home/closer/path.ts';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'dist');

const VERSION = 'v1';
const FRAMES = 73; // two moves of 36 frames, and the frame they start from
const OUT = join(root, 'public', 'film', 'look-closer', VERSION);
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
const single = args.includes('--frame') ? Number(args[args.indexOf('--frame') + 1]) : undefined;
// What to render: the film's two framings, the cards shown when a page is shared, or everything.
const wanted = (product) =>
  !only || only === product || (only === 'film' && (product === 'wide' || product === 'tall'));

/* A static server for the build, so the script needs nothing else running. */
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
const server = createServer(async (req, res) => {
  if (req.url === '/__card') {
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>card</title>');
    return;
  }
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(dist, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const cam = await openCover({
  url: `http://127.0.0.1:${port}/`,
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const { cover } = cam;
const sheet = { x0: 0, y0: 0, x1: cover.width * MM_PER_CSS, y1: cover.height * MM_PER_CSS };

// The figure the film stops at, and its source printed beneath it.
const ROW = ['article dl div', 'Revenue 2025'];
const SOURCE = 'KRKA, D. D. · MAR 2026';
const row = await cam.locate(...ROW);
const source = await cam.locate(...ROW, SOURCE);
const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/*
 * Two framings of the same move: wide for landscape screens and tall for
 * phones held upright. Each is composed with room for the words: on a wide
 * screen the subject sits right of centre and the words to its left; held
 * upright, the subject sits high and the words below it. `lead` is how far
 * the subject sits from the centre of the frame, as a share of its width
 * (wide) or height (tall).
 */
function framing({ w, h, zoom, subject, lead, axis }) {
  const view = (axis === 'x' ? w : h) / zoom;
  return axis === 'x'
    ? { x: subject.x - lead * view, y: subject.y, zoom }
    : { x: subject.x, y: subject.y + lead * view, zoom };
}
const coverCentre = { x: cover.width / 2, y: cover.height / 2 };
const ORIENTATIONS = {
  wide: {
    w: 1600,
    h: 900,
    shots: [
      framing({ w: 1600, h: 900, zoom: 900 / (cover.height * 1.12), subject: coverCentre, lead: 0.1, axis: 'x' }),
      framing({ w: 1600, h: 900, zoom: 1000 / row.width, subject: centre(row), lead: 0.12, axis: 'x' }),
      framing({ w: 1600, h: 900, zoom: 1000 / source.width, subject: centre(source), lead: 0.12, axis: 'x' }),
    ],
  },
  tall: {
    w: 900,
    h: 1600,
    shots: [
      framing({ w: 900, h: 1600, zoom: 600 / cover.width, subject: coverCentre, lead: 0.14, axis: 'y' }),
      framing({ w: 900, h: 1600, zoom: 640 / row.width, subject: centre(row), lead: 0.12, axis: 'y' }),
      framing({ w: 900, h: 1600, zoom: 640 / source.width, subject: centre(source), lead: 0.12, axis: 'y' }),
    ],
  },
};

const log = (v, a, b) => Math.log(v / a) / Math.log(b / a);
/*
 * The lens: depth of field narrows as the camera nears the paper. Blur (as a
 * share of the frame's short side) and the sharp band follow the width of
 * paper in view, from a whole sheet to a line of microtext.
 */
function lensFor(fieldMm, shortSide) {
  const k = Math.min(1, Math.max(0, log(fieldMm, 600, 25)));
  return {
    focus: 0.5,
    sigma: shortSide * (0.0013 + k ** 1.2 * 0.0092),
    band: 0.3 - k * 0.14,
    vignette: 0.24,
    grain: 0.009,
  };
}

/* Worker pool: captures happen in order on this thread, developing on the others. */
const workers = Array.from({ length: Math.max(1, Math.min(4, availableParallelism() - 1)) }, () => {
  const worker = new Worker(new URL('./develop-worker.mjs', import.meta.url));
  worker.busy = null;
  return worker;
});
let nextId = 0;
const queue = [];
function developOnWorker(params) {
  return new Promise((resolve) => {
    queue.push({ id: nextId++, params, resolve });
    pump();
  });
}
function pump() {
  for (const worker of workers) {
    if (worker.busy || !queue.length) continue;
    const job = queue.shift();
    worker.busy = job;
    worker.once('message', ({ pixels }) => {
      worker.busy = null;
      job.resolve(new Uint8Array(pixels));
      pump();
    });
    const transfer = [job.params.capture, job.params.fluorescent].filter(Boolean);
    worker.postMessage({ id: job.id, params: job.params }, transfer);
  }
}

const written = [];
for (const [name, o] of Object.entries(ORIENTATIONS)) {
  if (!wanted(name)) continue;
  const dir = join(OUT, name);
  if (single === undefined) await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const jobs = [];
  for (let i = 0; i < FRAMES; i++) {
    if (single !== undefined && i !== single) continue;
    const t = i / (FRAMES - 1);
    const camera = cameraAt(o.shots, t);
    const grab = await cam.grab({ cx: camera.x, cy: camera.y, zoom: camera.zoom, w: o.w, h: o.h });
    const field = (o.w / camera.zoom) * MM_PER_CSS;
    // The softbox swings a little across the move, as a photographer's light would between set-ups.
    const light = { azimuth: 218 + 14 * t, elevation: 27 - 5 * t, spread: 7 };
    const capture = grab.raw.buffer.slice(grab.raw.byteOffset, grab.raw.byteOffset + grab.raw.byteLength);
    jobs.push(
      developOnWorker({
        capture,
        w: o.w,
        h: o.h,
        mmPerPx: grab.mmPerPx,
        originMm: grab.originMm,
        sheet,
        light,
        lens: lensFor(field, Math.min(o.w, o.h)),
        seed: 1954,
        frame: i,
      }).then(async (pixels) => {
        const file = join(dir, `${String(i).padStart(2, '0')}.webp`);
        await sharp(Buffer.from(pixels), { raw: { width: o.w, height: o.h, channels: 3 } })
          .webp({ quality: 72, effort: 6, smartSubsample: true })
          .toFile(file);
        written.push(file);
        if (written.length % 10 === 0) console.log(`${written.length} frames`);
      }),
    );
  }
  await Promise.all(jobs);
}

/*
 * The same cover under ultraviolet, for the front page's method section: the
 * paper goes dark, printing ink darker still, and what was printed to be
 * checked (the microtext and the security fibres) fluoresces.
 */
const PLATES = join(root, 'public', 'plates');
const bytesOf = (raw) => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
async function ultraviolet({ subject, zoom, w, h, lead = 0, axis = 'x' }) {
  const camera = framing({ w, h, zoom, subject, lead, axis });
  const print = await cam.grab({ cx: camera.x, cy: camera.y, zoom: camera.zoom, w, h });
  const micro = await cam.grab({ cx: camera.x, cy: camera.y, zoom: camera.zoom, w, h, layer: 'micro' });
  const field = (w / camera.zoom) * MM_PER_CSS;
  return developOnWorker({
    capture: bytesOf(print.raw),
    fluorescent: bytesOf(micro.raw),
    w,
    h,
    mmPerPx: print.mmPerPx,
    originMm: print.originMm,
    sheet,
    mode: 'uv',
    light: { azimuth: 230, elevation: 30, spread: 9 },
    lens: { ...lensFor(field, h), vignette: 0.34 },
    seed: 1954,
    frame: 0,
  });
}
const keyData = await cam.locate('article section[aria-label="Key data"]');
const uvSubject = { x: keyData.x + keyData.width / 2, y: keyData.y + keyData.height * 0.55 };
if (wanted('uv')) {
  await mkdir(PLATES, { recursive: true });
  const bands = [{ file: 'uv.webp', w: 2000, h: 760, zoom: 1500 / keyData.width }];
  for (const band of bands) {
    const pixels = await ultraviolet({ subject: uvSubject, zoom: band.zoom, w: band.w, h: band.h });
    await sharp(Buffer.from(pixels), { raw: { width: band.w, height: band.h, channels: 3 } })
      .webp({ quality: 74, effort: 6, smartSubsample: true })
      .toFile(join(PLATES, band.file));
    written.push(band.file);
  }
}

/*
 * Cards for links shared to other sites: a photograph of the cover with the
 * page's words beside it, set in the site's own typefaces. 1200 × 630, the
 * size Open Graph and X expect, as JPEG, which every network reads.
 */
const CARDS = join(root, 'public', 'social');
if (wanted('cards')) {
  await mkdir(CARDS, { recursive: true });
  const fonts = (await readdir(join(dist, 'assets'))).filter((f) => /-core-.*\.woff2$/.test(f));
  const font = (pattern) => fonts.find((f) => pattern.test(f));
  const origin = `http://127.0.0.1:${port}`;
  const css = `
    @font-face { font-family: Display; font-style: normal; font-weight: 400 900; src: url(${origin}/assets/${font(/bodoni-moda-opsz-normal/)}) format('woff2'); }
    @font-face { font-family: Display; font-style: italic; font-weight: 400 900; src: url(${origin}/assets/${font(/bodoni-moda-opsz-italic/)}) format('woff2'); }
    @font-face { font-family: Sans; font-weight: 100 900; src: url(${origin}/assets/${font(/hanken-grotesk/)}) format('woff2'); }
    html, body { margin: 0; }
    .card { position: relative; width: 1200px; height: 630px; overflow: hidden; color: #101613; font-family: Sans, sans-serif; }
    .card img.plate { position: absolute; inset: 0; width: 100%; height: 100%; }
    .veil { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(244 242 238 / 0.97) 0%, rgb(244 242 238 / 0.92) 38%, rgb(244 242 238 / 0) 54%); }
    .mark { position: absolute; left: 64px; top: 54px; display: flex; align-items: center; gap: 12px; }
    .mark img { width: 34px; height: 34px; }
    .mark b { font-family: Display; font-weight: 450; font-size: 34px; letter-spacing: -0.01em; }
    .mark span { font-size: 12px; font-weight: 650; letter-spacing: 0.16em; margin-top: 10px; }
    .words { position: absolute; left: 64px; top: 150px; width: 470px; display: grid; gap: 18px; }
    .kicker { font-size: 14px; font-weight: 650; letter-spacing: 0.14em; text-transform: uppercase; color: #4c5651; }
    h1 { margin: 0; font-family: Display; font-weight: 430; font-size: 70px; line-height: 0.92; letter-spacing: -0.035em; }
    h1 em { font-style: italic; font-weight: 450; color: #155e46; }
    .line { font-size: 24px; font-weight: 600; color: #155e46; font-variant-numeric: lining-nums tabular-nums; }
    .foot { position: absolute; left: 64px; bottom: 50px; font-size: 13px; font-weight: 650; letter-spacing: 0.14em; text-transform: uppercase; color: #333c37; }
    .uv { color: #eceaf4; }
    .uv .veil { background: linear-gradient(90deg, rgb(13 10 22 / 0.94) 0%, rgb(13 10 22 / 0.86) 38%, rgb(13 10 22 / 0) 56%); }
    .uv h1 em { color: #63e4b8; }
    .uv .foot { color: #bdb9cf; }
    .uv .mark img { filter: brightness(1.9) hue-rotate(-8deg); }
  `;
  const range = (await cam.text('article p', '€212'))?.replace(/\s*–\s*/, '–');
  const nameBox = await cam.locate('article h2');
  const seal = await cam.locate('article [data-foil]');
  const value = await cam.locate('article p', '€212');
  const identity = {
    x: (nameBox.x + seal.x + seal.width) / 2,
    y: seal.y + seal.height / 2,
  };
  const cards = [
    {
      file: 'home.jpg',
      subject: identity,
      zoom: 640 / (seal.x + seal.width - nameBox.x),
      words: `<h1>Initiating coverage on <em>every</em> company.</h1>`,
      foot: 'Every figure traced to its source',
    },
    {
      file: 'report-krka.jpg',
      subject: { x: value.x + value.width / 2 + 40, y: value.y + value.height / 2 },
      zoom: 520 / (value.width + 80),
      words: `<p class="kicker">Initiation of coverage · 1 October 2026</p><h1>Krka, d. d.,<br><em>Novo mesto</em></h1><p class="line">Fair value ${range} a share</p>`,
      foot: '17 sources · every figure footnoted',
    },
    {
      file: 'method.jpg',
      // Under ultraviolet, where only what can be checked glows.
      uv: true,
      subject: uvSubject,
      zoom: 820 / keyData.width,
      words: `<h1>How Uncovered stays <em>honest</em>.</h1>`,
      foot: 'Evidence grades on every figure',
    },
  ];
  // Every plate is captured before any card is composed: a cover page left in the background is not painted.
  const w = 1200;
  const h = 630;
  const plates = [];
  for (const card of cards) {
    if (card.uv) {
      plates.push(ultraviolet({ subject: card.subject, zoom: card.zoom, w, h, lead: 0.22 }));
      continue;
    }
    const camera = framing({ w, h, zoom: card.zoom, subject: card.subject, lead: 0.22, axis: 'x' });
    const grab = await cam.grab({ cx: camera.x, cy: camera.y, zoom: camera.zoom, w, h });
    const field = (w / camera.zoom) * MM_PER_CSS;
    const capture = grab.raw.buffer.slice(grab.raw.byteOffset, grab.raw.byteOffset + grab.raw.byteLength);
    plates.push(
      developOnWorker({
        capture,
        w,
        h,
        mmPerPx: grab.mmPerPx,
        originMm: grab.originMm,
        sheet,
        light: { azimuth: 222, elevation: 25, spread: 7 },
        lens: lensFor(field, h),
        seed: 1954,
        frame: 0,
      }),
    );
  }
  for (const [i, card] of cards.entries()) {
    const pixels = await plates[i];
    const plate = await sharp(Buffer.from(pixels), { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer();
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
      <div class="card${card.uv ? ' uv' : ''}">
        <img class="plate" src="data:image/png;base64,${plate.toString('base64')}" alt="">
        <div class="veil"></div>
        <div class="mark"><img src="${origin}/favicon.svg" alt=""><b>Uncovered</b><span>RESEARCH</span></div>
        <div class="words">${card.words}</div>
        <p class="foot">${card.foot}</p>
      </div></body></html>`;
    const shot = await cam.compose(html, { width: w, height: h });
    await sharp(shot).jpeg({ quality: 84, mozjpeg: true }).toFile(join(CARDS, card.file));
    written.push(card.file);
  }
}

await cam.close();
server.close();
for (const worker of workers) await worker.terminate();

if (single === undefined && wanted('wide') && wanted('tall')) {
  // The shots, for the player: it places its camera between frames with the same path.
  const round = (n) => Math.round(n * 1000) / 1000;
  const shots = (o) => o.shots.map((s) => `{ x: ${round(s.x)}, y: ${round(s.y)}, zoom: ${round(s.zoom)} }`).join(', ');
  const module = `// Written by scripts/plates/render.mjs from the cover it photographed. Do not edit by hand.
import type { Camera } from './path';

export interface Framing {
  width: number;
  height: number;
  shots: readonly Camera[];
}

export const FILM = {
  version: '${VERSION}',
  frames: ${FRAMES},
  /** Millimetres of paper per CSS pixel of the cover the shots are measured on. */
  mmPerCss: ${MM_PER_CSS},
  wide: { width: ${ORIENTATIONS.wide.w}, height: ${ORIENTATIONS.wide.h}, shots: [${shots(ORIENTATIONS.wide)}] },
  tall: { width: ${ORIENTATIONS.tall.w}, height: ${ORIENTATIONS.tall.h}, shots: [${shots(ORIENTATIONS.tall)}] },
} as const satisfies { wide: Framing; tall: Framing } & Record<string, unknown>;
`;
  const target = join(root, 'src', 'home', 'closer', 'film.ts');
  await writeFile(target, module);
  execFileSync('npx', ['prettier', '--write', target], { cwd: root, stdio: 'ignore' });
}
console.log(`wrote ${written.length} files`);
