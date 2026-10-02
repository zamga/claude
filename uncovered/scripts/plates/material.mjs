/*
 * The plates' physical model: how a printed Uncovered cover looks to a camera.
 *
 * A capture of the cover (the real markup, rasterised by Chromium at the
 * camera's magnification) gives the ink: where it lies and what colour it is.
 * From that this module builds the surface a macro lens would see, in
 * millimetres:
 *
 *  - intaglio ink standing about 25 µm proud of the paper, its edges ragged
 *    where it bled into the fibres, the paper embossed around it by the press;
 *  - paper made of fibres a few hundredths of a millimetre wide, placed in
 *    paper coordinates so the same fibres stay put while the camera moves;
 *  - a few coloured security fibres, which glow under ultraviolet.
 *
 * It then lights that surface (a raking softbox with soft shadows, satin
 * sheen on the ink, cavities, light scattered inside the paper), or shines
 * ultraviolet on it, and develops it through a lens: a tilted plane of focus,
 * vignetting, a filmic curve and grain. Everything is deterministic: the same
 * capture and parameters give the same pixels.
 */

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- numbers */

/** A 32-bit hash of integers, for placing fibres per cell. */
export function hash(...values) {
  let h = 0x9e3779b9;
  for (const v of values) {
    h ^= Math.imul((v | 0) ^ 0x85ebca6b, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32). */
export function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Value noise on an integer lattice, smoothly interpolated, in [-1, 1]. */
function lattice(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const v = (i, j) => (hash(ix + i, iy + j, seed) / 4294967296) * 2 - 1;
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * fx;
  const b = v(0, 1) + (v(1, 1) - v(0, 1)) * fx;
  return a + (b - a) * fy;
}

/* ------------------------------------------------------------ colour space */

const TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toSrgb(v) {
  const c = v <= 0 ? 0 : v >= 1 ? 1 : v;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Linear through the midtones, then a soft shoulder, so highlights roll off like film rather than clip. */
function filmic(x) {
  return x < 0.62 ? x : 0.62 + 0.38 * (1 - Math.exp(-(x - 0.62) / 0.38));
}

/* ------------------------------------------------------------------ blurs */

/** One pass of a box blur of radius r along rows, in place via tmp. */
function boxRows(src, dst, w, h, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc / n;
      const add = src[row + Math.min(w - 1, x + r + 1)];
      const sub = src[row + Math.max(0, x - r)];
      acc += add - sub;
    }
  }
}

function boxCols(src, dst, w, h, r) {
  const n = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc / n;
      const add = src[Math.min(h - 1, y + r + 1) * w + x];
      const sub = src[Math.max(0, y - r) * w + x];
      acc += add - sub;
    }
  }
}

/** Box radii whose three passes approximate a Gaussian of the given sigma. */
function boxRadii(sigma) {
  const ideal = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  return [0, 1, 2].map((i) => ((i < m ? wl : wu) - 1) / 2);
}

/** A Gaussian blur of a single channel (three box passes each way); returns a new array. */
export function blur(src, w, h, sigma) {
  const out = Float32Array.from(src);
  if (sigma < 0.35) return out;
  const tmp = new Float32Array(src.length);
  for (const r of boxRadii(sigma)) {
    if (r < 1) continue;
    boxRows(out, tmp, w, h, r);
    boxCols(tmp, out, w, h, r);
  }
  return out;
}

/* ------------------------------------------------------------------ paper */

/**
 * The paper's fibres in the camera's view: their height (mm), a tone that
 * shifts the paper's whiteness, and, for the few security fibres, a colour
 * they fluoresce. Fibres live on a 1 mm grid of cells in paper coordinates,
 * each cell seeding its own, so they do not move when the view does.
 */
function layFibres({ w, h, mmPerPx, originMm, seed, density, sheet }) {
  const height = new Float32Array(w * h);
  const tone = new Float32Array(w * h);
  const glow = new Float32Array(w * h * 3);
  const [ox, oy] = originMm;
  const reach = 2.6;
  const cx0 = Math.floor(ox - reach);
  const cy0 = Math.floor(oy - reach);
  const cx1 = Math.ceil(ox + w * mmPerPx + reach);
  const cy1 = Math.ceil(oy + h * mmPerPx + reach);
  const COLOURS = [
    [1.0, 0.22, 0.32],
    [0.25, 0.55, 1.0],
    [0.78, 1.0, 0.25],
  ];
  for (let cy = cy0; cy < cy1; cy++) {
    for (let cx = cx0; cx < cx1; cx++) {
      if (sheet && (cx + 1 < sheet.x0 || cx > sheet.x1 || cy + 1 < sheet.y0 || cy > sheet.y1)) continue;
      const rand = generator(hash(cx, cy, seed));
      const count = Math.floor(density * (0.7 + rand() * 0.6));
      for (let k = 0; k < count; k++) {
        const px = cx + rand();
        const py = cy + rand();
        const length = 0.2 + rand() ** 2 * 2.2;
        // Fibres lie a little more along the machine direction than across it.
        const angle = (rand() - 0.5) * Math.PI * 1.3 + (rand() < 0.5 ? 0 : Math.PI);
        const width = 0.014 + rand() ** 1.5 * 0.034;
        const rise = 0.0011 + rand() * 0.0026;
        const bend = (rand() - 0.5) * length * 0.35;
        const shade = (rand() - 0.5) * 0.06;
        const security = rand() < 0.0011 ? COLOURS[Math.floor(rand() * 3)] : null;
        const wpx = width / mmPerPx;
        if (wpx < 0.12 && !security) continue;
        drawFibre(px, py, length, angle, bend, wpx, rise, shade, security);
      }
    }
  }

  function drawFibre(px, py, length, angle, bend, wpx, rise, shade, security) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const segments = 8;
    // A fibre narrower than a pixel is drawn a pixel wide and correspondingly fainter.
    const drawn = Math.max(1, wpx);
    const weight = Math.min(1, wpx);
    const half = drawn / 2;
    let prev = null;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments - 0.5;
      const off = bend * (1 - 4 * t * t);
      const mx = px + dx * t * length + nx * off;
      const my = py + dy * t * length + ny * off;
      const p = [(mx - ox) / mmPerPx, (my - oy) / mmPerPx];
      if (prev) capsule(prev, p);
      prev = p;
    }

    function capsule(a, b) {
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0]) - half - 1));
      const maxX = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + half + 1));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1]) - half - 1));
      const maxY = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + half + 1));
      if (minX > maxX || minY > maxY) return;
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const len2 = ex * ex + ey * ey || 1;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const qx = x + 0.5 - a[0];
          const qy = y + 0.5 - a[1];
          const t = Math.max(0, Math.min(1, (qx * ex + qy * ey) / len2));
          const ddx = qx - ex * t;
          const ddy = qy - ey * t;
          const u = Math.sqrt(ddx * ddx + ddy * ddy) / half;
          if (u >= 1) continue;
          // A round fibre's cross-section: highest along its middle.
          const profile = Math.sqrt(1 - u * u) * weight;
          const i = y * w + x;
          // Fibres felt together: each adds to the mat, which saturates rather than towers.
          const v = height[i] + rise * profile;
          height[i] = v < 0.006 ? v : 0.006 + (v - 0.006) * 0.25;
          tone[i] += shade * profile;
          if (security) {
            glow[i * 3] = Math.max(glow[i * 3], security[0] * profile);
            glow[i * 3 + 1] = Math.max(glow[i * 3 + 1], security[1] * profile);
            glow[i * 3 + 2] = Math.max(glow[i * 3 + 2], security[2] * profile);
          }
        }
      }
    }
  }

  return { height, tone, glow };
}

/** The pulp between the fibres: fine noise, in mm of height, where the camera can resolve it. */
function pulp({ w, h, mmPerPx, originMm, seed }) {
  const out = new Float32Array(w * h);
  const scale = 0.012; // mm per lattice step of the pulp
  const fine = scale / mmPerPx >= 0.6;
  const [ox, oy] = originMm;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mx = ox + (x + 0.5) * mmPerPx;
      const my = oy + (y + 0.5) * mmPerPx;
      // Formation: paper is cloudy at the scale of millimetres, which raking light shows as a gentle swell.
      let v = (lattice(mx / 1.1, my / 1.1, seed + 11) * 0.6 + lattice(mx / 0.37, my / 0.37, seed + 13) * 0.4) * 0.0035;
      if (fine) {
        const u = mx / scale;
        const t = my / scale;
        v += (lattice(u, t, seed) * 0.7 + lattice(u * 2.3, t * 2.3, seed + 7) * 0.3) * 0.0013;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/* -------------------------------------------------------------------- ink */

/**
 * Ink from a capture on white. Light mixes linearly, so the capture is read
 * in linear light: coverage is how far its darkest channel falls from white,
 * and the ink's colour is what remains once the white is taken out.
 */
function readInk(rgb, w, h) {
  const coverage = new Float32Array(w * h);
  const colour = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const r = TO_LINEAR[rgb[i * 3]];
    const g = TO_LINEAR[rgb[i * 3 + 1]];
    const b = TO_LINEAR[rgb[i * 3 + 2]];
    const a = 1 - Math.min(r, g, b);
    coverage[i] = a;
    if (a > 0.02) {
      colour[i * 3] = Math.max(0, (r - (1 - a)) / a);
      colour[i * 3 + 1] = Math.max(0, (g - (1 - a)) / a);
      colour[i * 3 + 2] = Math.max(0, (b - (1 - a)) / a);
    }
  }
  return { coverage, colour };
}

/* ------------------------------------------------------------------- lens */

/** A stack of progressively blurred copies, for a blur that varies across the frame. */
function pyramid(channels, w, h, sigmas) {
  return sigmas.map((s) => channels.map((c) => blur(c, w, h, s)));
}

/* ------------------------------------------------------------------- main */

const PAPER = [246, 244, 238].map((v) => TO_LINEAR[v]);
const SURFACE = [196, 192, 183].map((v) => TO_LINEAR[v]);

/**
 * Develops one plate.
 *
 * capture   RGB bytes of the cover rasterised on white, w × h
 * mmPerPx   millimetres of paper per pixel at the plane of focus
 * originMm  paper coordinates (mm) of the frame's top-left corner
 * sheet     the sheet's extent in paper mm {x0, y0, x1, y1}; outside it is the surface it lies on
 * light     {azimuth, elevation, spread} in degrees; azimuth in image coordinates, 0 = right, 90 = down
 * lens      {focus: [0..1 of height], band, sigma (px at the frame's edge), vignette, grain}
 * mode      'daylight' or 'uv'
 * fluorescent  RGB bytes of the ink that glows under UV, captured alone on white, w × h, optional
 */
export function develop({
  capture,
  w,
  h,
  mmPerPx,
  originMm,
  sheet,
  light = { azimuth: 225, elevation: 26, spread: 7 },
  lens = { focus: 0.5, band: 0.16, sigma: 0, vignette: 0.24, grain: 0.012 },
  mode = 'daylight',
  fluorescent,
  seed = 1954,
  frame = 0,
  exposure = 1,
}) {
  const n = w * h;
  const { coverage, colour } = readInk(capture, w, h);
  const invisible = fluorescent ? readInk(fluorescent, w, h).coverage : null;
  const [ox, oy] = originMm;

  // Where the sheet is, with a soft edge one pixel wide.
  const onSheet = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const my = oy + (y + 0.5) * mmPerPx;
    const fy = sheet ? clamp01(Math.min(my - sheet.y0, sheet.y1 - my) / mmPerPx + 0.5) : 1;
    for (let x = 0; x < w; x++) {
      const mx = ox + (x + 0.5) * mmPerPx;
      const fx = sheet ? clamp01(Math.min(mx - sheet.x0, sheet.x1 - mx) / mmPerPx + 0.5) : 1;
      onSheet[y * w + x] = Math.min(fx, fy);
    }
  }

  // Ink: ragged where it bled into the fibres, rounded, standing proud; the paper pressed up around it.
  const bleed = 0.007 / mmPerPx;
  let ink = coverage;
  if (bleed > 0.6) {
    const soft = blur(coverage, w, h, bleed);
    ink = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const mx = (ox + (x + 0.5) * mmPerPx) / 0.009;
        const my = (oy + (y + 0.5) * mmPerPx) / 0.009;
        const jag = lattice(mx, my, seed + 3) * 0.16 + lattice(mx * 3.1, my * 3.1, seed + 5) * 0.06;
        ink[i] = clamp01((soft[i] + jag - 0.5) / 0.32 + 0.5) * Math.min(1, coverage[i] * 4 + soft[i] * 2);
      }
    }
  }
  const inkRound = blur(ink, w, h, 0.004 / mmPerPx);
  const emboss = blur(coverage, w, h, 0.06 / mmPerPx);

  const fibres = layFibres({ w, h, mmPerPx, originMm, seed, density: 22, sheet });
  const grain = pulp({ w, h, mmPerPx, originMm, seed });

  const SHEET = 0.1; // mm: the sheet's thickness, so its edge casts a shadow on the surface
  const height = new Float32Array(n);
  const fineInk = 0.006 / mmPerPx >= 0.8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const paper = fibres.height[i] * (1 - inkRound[i] * 0.85) + grain[i] + emboss[i] * 0.009;
      // The ink's own surface is not flat: it dried in ridges as the plate lifted off.
      let top = 0.024;
      if (fineInk && inkRound[i] > 0.01) {
        const mx = (ox + (x + 0.5) * mmPerPx) / 0.006;
        const my = (oy + (y + 0.5) * mmPerPx) / 0.006;
        top += lattice(mx, my, seed + 17) * 0.0025;
      }
      height[i] = onSheet[i] * (SHEET + paper + inkRound[i] * top);
    }
  }

  // Normals from the height field.
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const nz = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = height[y * w + Math.max(0, x - 1)];
      const r = height[y * w + Math.min(w - 1, x + 1)];
      const u = height[Math.max(0, y - 1) * w + x];
      const d = height[Math.min(h - 1, y + 1) * w + x];
      const gx = (r - l) / (2 * mmPerPx);
      const gy = (d - u) / (2 * mmPerPx);
      const len = Math.sqrt(gx * gx + gy * gy + 1);
      nx[i] = -gx / len;
      ny[i] = -gy / len;
      nz[i] = 1 / len;
    }
  }

  // The light: a softbox, sampled in a few directions for soft shadows.
  const samples = [];
  const SAMPLES = 7;
  for (let k = 0; k < SAMPLES; k++) {
    const a = (k / SAMPLES) * TAU;
    const r = k === 0 ? 0 : 1;
    const az = ((light.azimuth + Math.cos(a) * light.spread * r) * Math.PI) / 180;
    const el = ((light.elevation + Math.sin(a) * light.spread * 0.6 * r) * Math.PI) / 180;
    samples.push({
      x: Math.cos(az) * Math.cos(el),
      y: Math.sin(az) * Math.cos(el),
      z: Math.sin(el),
      tan: Math.tan(el),
    });
  }

  let hMax = 0;
  for (let i = 0; i < n; i++) if (height[i] > hMax) hMax = height[i];
  const diffuse = new Float32Array(n);
  const sheen = new Float32Array(n);
  for (const s of samples) {
    const len = Math.hypot(s.x, s.y) || 1;
    const sx = s.x / len;
    const sy = s.y / len;
    const rise = mmPerPx * s.tan; // how much a ray climbs per pixel towards the light
    const reach = Math.min(64, Math.ceil(hMax / rise) + 1);
    const hx = s.x;
    const hy = s.y;
    const hz = s.z + 1;
    const hl = Math.hypot(hx, hy, hz);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const lambert = nx[i] * s.x + ny[i] * s.y + nz[i] * s.z;
        if (lambert <= 0) continue;
        // March towards the light: shadowed if the surface ahead rises above the ray.
        let lit = 1;
        const h0 = height[i];
        for (let t = 1; t <= reach; t++) {
          const px = Math.round(x + sx * t);
          const py = Math.round(y + sy * t);
          if (px < 0 || py < 0 || px >= w || py >= h) break;
          const over = height[py * w + px] - (h0 + rise * t);
          if (over > 0) {
            lit = Math.max(0, 1 - over / (rise * 1.5));
            if (lit === 0) break;
          }
        }
        diffuse[i] += lambert * lit;
        const nh = (nx[i] * hx + ny[i] * hy + nz[i] * hz) / hl;
        if (nh > 0) sheen[i] += nh ** 18 * lit;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    diffuse[i] /= SAMPLES;
    sheen[i] /= SAMPLES;
  }

  // Light scatters inside paper, which softens its shading; ink is opaque and does not.
  const scattered = blur(diffuse, w, h, 0.018 / mmPerPx);
  // Cavities: hollows between raised ink catch less of the room's light.
  const around = blur(height, w, h, 0.03 / mmPerPx);

  // A soft shadow cast by the sheet on the surface, away from the light.
  const lift = 2.4 / mmPerPx;
  const az = (light.azimuth * Math.PI) / 180;
  const shiftX = Math.round(-Math.cos(az) * lift);
  const shiftY = Math.round(-Math.sin(az) * lift);
  const shifted = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - shiftX;
      const sy = y - shiftY;
      shifted[y * w + x] = sx >= 0 && sy >= 0 && sx < w && sy < h ? onSheet[sy * w + sx] : 0;
    }
  }
  const cast = blur(shifted, w, h, 3.2 / mmPerPx);

  const flat = samples.reduce((acc, s) => acc + s.z, 0) / SAMPLES;
  const ambient = mode === 'uv' ? 0.0 : 0.3;
  // Exposed so that bare paper sits just under white, as a photographer would meter it.
  const norm = (exposure * 1.2) / (ambient + flat);
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  const cx = w / 2;
  const cy = h / 2;
  const diag = Math.hypot(cx, cy);
  const lx = Math.cos(az);
  const ly = Math.sin(az);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = ink[i];
      const sheetness = onSheet[i];
      const t = 1 + fibres.tone[i] + grain[i] * 6;
      let ar = PAPER[0] * t;
      let ag = PAPER[1] * t;
      let ab = PAPER[2] * t;
      if (a > 0) {
        ar = ar * (1 - a) + colour[i * 3] * a;
        ag = ag * (1 - a) + colour[i * 3 + 1] * a;
        ab = ab * (1 - a) + colour[i * 3 + 2] * a;
      }
      // Off the sheet: the surface it lies on, in the sheet's shadow.
      if (sheetness < 1) {
        const k = sheetness;
        const shade = 1 - cast[i] * 0.42;
        ar = ar * k + SURFACE[0] * shade * (1 - k);
        ag = ag * k + SURFACE[1] * shade * (1 - k);
        ab = ab * k + SURFACE[2] * shade * (1 - k);
      }
      const cavity = 1 - Math.min(0.32, Math.max(0, around[i] - height[i]) * 22);
      const lightOnPaper = diffuse[i] * (1 - 0.6 * (1 - a)) + scattered[i] * 0.6 * (1 - a);
      // The softbox is near: the side of the frame towards it is a little brighter.
      const falloff = 1 + 0.11 * (((x - cx) * lx + (y - cy) * ly) / diag);
      let er;
      let eg;
      let eb;
      if (mode === 'uv') {
        // Ultraviolet: security paper stays dull, a little violet; fibres and invisible ink fluoresce.
        const dull = 0.012 * (0.55 + lightOnPaper) * falloff;
        er = ar * dull * 0.85 + fibres.glow[i * 3] * 0.62;
        eg = ag * dull * 0.42 + fibres.glow[i * 3 + 1] * 0.62;
        eb = ab * dull * 2.1 + fibres.glow[i * 3 + 2] * 0.62;
        if (invisible) {
          const v = invisible[i];
          er += v * 0.2;
          eg += v * 0.92;
          eb += v * 0.66;
        }
      } else {
        const light1 = (ambient * cavity + lightOnPaper) * norm * falloff;
        const spec = sheen[i] * (0.012 + a * 0.24) * norm * falloff * 2.2;
        er = ar * light1 * 1.0 + spec;
        eg = ag * light1 * 0.985 + spec;
        eb = ab * light1 * 0.95 + spec;
      }
      r[i] = er;
      g[i] = eg;
      b[i] = eb;
    }
  }

  // Fluorescence and ink sheen bloom a little, as they do on a lens.
  if (mode === 'uv') {
    for (const ch of [r, g, b]) {
      const halo = blur(ch, w, h, Math.max(2, 0.03 / mmPerPx));
      const wide = blur(ch, w, h, Math.max(6, 0.12 / mmPerPx));
      for (let i = 0; i < n; i++) ch[i] += halo[i] * 0.55 + wide[i] * 0.35;
    }
  }

  // The lens: a tilted plane of focus (sharp along a band, softer away from it).
  const sigmas = [0, 0.7, 1.4, 2.8, 5.6, 11.2, 22.4];
  const levels = lens.sigma > 0.4 ? pyramid([r, g, b], w, h, sigmas) : null;
  const out = new Uint8ClampedArray(n * 3);
  const rand = generator(hash(seed, frame, 77));
  for (let y = 0; y < h; y++) {
    const dist = Math.abs(y / h - lens.focus);
    const s = lens.sigma * clamp01((dist - lens.band) / (0.5 - lens.band)) ** 1.3;
    let lo = 0;
    while (lo < sigmas.length - 2 && sigmas[lo + 1] < s) lo++;
    const f = clamp01((s - sigmas[lo]) / (sigmas[lo + 1] - sigmas[lo]));
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const vx = (x - cx) / cx;
      const vy = (y - cy) / cy;
      const vig = 1 - lens.vignette * Math.min(1, (vx * vx + vy * vy) / 2) ** 1.1;
      const noise = (rand() + rand() + rand() - 1.5) * lens.grain;
      for (let c = 0; c < 3; c++) {
        const lin = levels ? levels[lo][c][i] * (1 - f) + levels[lo + 1][c][i] * f : [r, g, b][c][i];
        const v = toSrgb(filmic(lin * vig)) + noise;
        out[i * 3 + c] = Math.round(v * 255);
      }
    }
  }
  return out;
}
