import type { Sounding, ValueGrid } from '../engine/types';
import { ELEVATION_LIMIT } from '../engine/grid';
import { formatPct } from '../engine/format';
import { isoSegments, levelsBetween } from './contours';
import { mix, toRgb, type ChartPalette, type RGB } from './palette';

export interface Bearing {
  growth: number;
  margin: number;
}

export interface Draw2DOptions {
  width: number;
  height: number;
  dpr: number;
  grid: ValueGrid;
  /** ln(value/price) per grid node. */
  field: Float32Array;
  palette: ChartPalette;
  marginOfSafety: number;
  bearing?: Bearing | null;
  today?: Bearing | null;
  soundings?: Sounding[] | null;
  price: number;
  /** Axis ticks and titles. Off for thumbnails. */
  axes?: boolean;
  /** Spot heights and depth soundings printed on the chart. */
  spotSoundings?: boolean;
  padding?: { top: number; right: number; bottom: number; left: number };
  fontScale?: number;
  /** Teaching layers: draw the terrain without a sea, or stress the coastline. */
  layers?: { sea?: boolean; coast?: 'none' | 'normal' | 'emphasis' };
}

export interface PlotFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chart units to canvas CSS pixels. */
  toX: (growth: number) => number;
  toY: (margin: number) => number;
  fromX: (px: number) => number;
  fromY: (py: number) => number;
}

export function plotFrame(opts: Pick<Draw2DOptions, 'width' | 'height' | 'grid' | 'padding'>): PlotFrame {
  const p = opts.padding ?? { top: 12, right: 12, bottom: 12, left: 12 };
  const x = p.left;
  const y = p.top;
  const w = Math.max(10, opts.width - p.left - p.right);
  const h = Math.max(10, opts.height - p.top - p.bottom);
  const e = opts.grid.extent;
  const gw = e.growthMax - e.growthMin;
  const mh = e.marginMax - e.marginMin;
  return {
    x,
    y,
    w,
    h,
    toX: (g) => x + ((g - e.growthMin) / gw) * w,
    toY: (m) => y + h - ((m - e.marginMin) / mh) * h,
    fromX: (px) => e.growthMin + ((px - x) / w) * gw,
    fromY: (py) => e.marginMin + ((y + h - py) / h) * mh,
  };
}

/** Bilinear sample of the elevation field at fractional grid coordinates. */
function sampleField(field: Float32Array, nx: number, ny: number, fx: number, fy: number): number {
  const x0 = Math.min(nx - 2, Math.max(0, Math.floor(fx)));
  const y0 = Math.min(ny - 2, Math.max(0, Math.floor(fy)));
  const tx = Math.min(1, Math.max(0, fx - x0));
  const ty = Math.min(1, Math.max(0, fy - y0));
  const a = field[y0 * nx + x0]!;
  const b = field[y0 * nx + x0 + 1]!;
  const c = field[(y0 + 1) * nx + x0]!;
  const d = field[(y0 + 1) * nx + x0 + 1]!;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * Hypsometric tint, Admiralty style: buff land darkening with height, a
 * green drying bank between the price and your load line, blue shallows
 * that fade to paper in deep water.
 */
export function tintFor(e: number, loadLine: number, c: TintColors): RGB {
  if (e >= loadLine) {
    const t = Math.min(1, (e - loadLine) / 1.4);
    return t < 0.5 ? mix(c.land1, c.land2, t / 0.5) : mix(c.land2, c.land3, (t - 0.5) / 0.5);
  }
  if (e >= 0) return c.intertidal;
  const d = -e;
  if (d < 0.18) return c.water1;
  return d < 0.6 ? mix(c.water1, c.water2, (d - 0.18) / 0.42) : mix(c.water2, c.paper, Math.min(1, (d - 0.6) / 0.9));
}

/** Plain hypsometric ramp, used when the sea is switched off for teaching. */
function landRamp(t: number, c: TintColors): RGB {
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5 ? mix(c.land1, c.land2, k / 0.5) : mix(c.land2, c.land3, (k - 0.5) / 0.5);
}

export interface TintColors {
  land1: RGB;
  land2: RGB;
  land3: RGB;
  intertidal: RGB;
  water1: RGB;
  water2: RGB;
  paper: RGB;
}

export function tintColors(p: ChartPalette): TintColors {
  return {
    land1: toRgb(p.land1),
    land2: toRgb(p.land2),
    land3: toRgb(p.land3),
    intertidal: toRgb(p.intertidal),
    water1: toRgb(p.water1),
    water2: toRgb(p.water2),
    paper: toRgb(p.paper),
  };
}

/** Underwater "waterlining": lines parallel to the coast, spaced wider with depth. */
export const WATERLINES = [-0.035, -0.08, -0.135, -0.2, -0.28, -0.38, -0.5, -0.66];

function strokeSegments(ctx: CanvasRenderingContext2D, segs: Float32Array, f: PlotFrame) {
  ctx.beginPath();
  for (let k = 0; k < segs.length; k += 4) {
    ctx.moveTo(f.toX(segs[k]!), f.toY(segs[k + 1]!));
    ctx.lineTo(f.toX(segs[k + 2]!), f.toY(segs[k + 3]!));
  }
  ctx.stroke();
}

export function drawChart2D(ctx: CanvasRenderingContext2D, o: Draw2DOptions): PlotFrame {
  const { grid, field, palette: p } = o;
  const f = plotFrame(o);
  const s = o.fontScale ?? 1;
  const loadLine = -Math.log(1 - Math.min(0.9, Math.max(0, o.marginOfSafety)));
  const sea = o.layers?.sea ?? true;
  const coastStyle = o.layers?.coast ?? 'normal';
  let fieldMin = Infinity;
  let fieldMax = -Infinity;
  for (let k = 0; k < field.length; k++) {
    fieldMin = Math.min(fieldMin, field[k]!);
    fieldMax = Math.max(fieldMax, field[k]!);
  }

  ctx.save();
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, o.width, o.height);

  // 1. Raster: tints and hillshade at half resolution, upscaled smoothly.
  const rw = Math.max(64, Math.round((f.w * o.dpr) / 2));
  const rh = Math.max(64, Math.round((f.h * o.dpr) / 2));
  const raster = new OffscreenCanvasOr(rw, rh);
  const rctx = raster.getContext('2d')!;
  const img = rctx.createImageData(rw, rh);
  const colors = tintColors(p);
  const { nx, ny } = grid;
  const light = [-0.55, 0.55, 0.63];
  for (let py = 0; py < rh; py++) {
    const fy = ((rh - 1 - py) / (rh - 1)) * (ny - 1);
    for (let px = 0; px < rw; px++) {
      const fx = (px / (rw - 1)) * (nx - 1);
      const e = sampleField(field, nx, ny, fx, fy);
      let [r, g, b] = sea
        ? tintFor(e, loadLine, colors)
        : landRamp((e - fieldMin) / Math.max(1e-6, fieldMax - fieldMin), colors);
      if (e >= 0 || !sea) {
        const ex = sampleField(field, nx, ny, fx + 0.5, fy) - sampleField(field, nx, ny, fx - 0.5, fy);
        const ey = sampleField(field, nx, ny, fx, fy + 0.5) - sampleField(field, nx, ny, fx, fy - 0.5);
        const k = 9;
        const nxv = -ex * k;
        const nyv = -ey * k;
        const len = Math.hypot(nxv, nyv, 1);
        const shade = (nxv * light[0]! + nyv * light[1]! + light[2]!) / len;
        const lift = 0.9 + 0.2 * shade;
        r *= lift;
        g *= lift;
        b *= lift;
      }
      const i = (py * rw + px) * 4;
      img.data[i] = Math.min(255, r * 255);
      img.data[i + 1] = Math.min(255, g * 255);
      img.data[i + 2] = Math.min(255, b * 255);
      img.data[i + 3] = 255;
    }
  }
  rctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(raster.canvas, f.x, f.y, f.w, f.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x, f.y, f.w, f.h);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 2. Graticule: every 5 points of growth and margin.
  const e = grid.extent;
  ctx.strokeStyle = p.rule;
  ctx.globalAlpha = p.dark ? 0.55 : 0.75;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let g = Math.ceil(e.growthMin / 0.05) * 0.05; g <= e.growthMax + 1e-9; g += 0.05) {
    ctx.moveTo(Math.round(f.toX(g)) + 0.5, f.y);
    ctx.lineTo(Math.round(f.toX(g)) + 0.5, f.y + f.h);
  }
  for (let m = Math.ceil(e.marginMin / 0.05) * 0.05; m <= e.marginMax + 1e-9; m += 0.05) {
    ctx.moveTo(f.x, Math.round(f.toY(m)) + 0.5);
    ctx.lineTo(f.x + f.w, Math.round(f.toY(m)) + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 3. Land contours every 0.1 (about 10% of value); index contour every 0.5.
  ctx.strokeStyle = p.landLine;
  for (const level of levelsBetween(sea ? 0.1 : -ELEVATION_LIMIT + 0.01, ELEVATION_LIMIT - 0.01, 0.1)) {
    const index = Math.abs((level * 10) % 5) < 1e-6;
    ctx.globalAlpha = index ? 0.9 : 0.45;
    ctx.lineWidth = index ? 1.1 : 0.6;
    strokeSegments(ctx, isoSegments(grid, field, level), f);
  }

  // 4. Waterlining below sea level.
  ctx.strokeStyle = p.waterLine;
  if (sea) {
    WATERLINES.forEach((level, k) => {
      ctx.globalAlpha = Math.max(0.12, 0.8 - k * 0.09);
      ctx.lineWidth = 0.7;
      strokeSegments(ctx, isoSegments(grid, field, level), f);
    });
  }
  ctx.globalAlpha = 1;

  // 5. Load line: where your margin of safety begins.
  if (sea && loadLine > 0.005) {
    ctx.strokeStyle = p.intertidalInk;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([3, 3]);
    strokeSegments(ctx, isoSegments(grid, field, loadLine), f);
    ctx.setLineDash([]);
  }

  // 6. The coastline: today's price.
  if (sea && coastStyle !== 'none') {
    const coast = isoSegments(grid, field, 0);
    if (coastStyle === 'emphasis') {
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 7;
      strokeSegments(ctx, coast, f);
    }
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = coastStyle === 'emphasis' ? 3.2 : 2;
    strokeSegments(ctx, coast, f);
  }

  // 7. Spot heights on land, soundings in water.
  if (o.spotSoundings && sea) drawSpotSoundings(ctx, o, f, s);

  // 8. Monte Carlo soundings.
  if (o.soundings?.length) {
    for (const d of o.soundings) {
      const x = f.toX(d.growth);
      const y = f.toY(d.targetMargin);
      if (x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h) continue;
      ctx.fillStyle = d.value >= o.price ? p.markLand : p.markWater;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 9. Today: where the company stands now.
  if (o.today) {
    const x = f.toX(o.today.growth);
    const y = f.toY(o.today.margin);
    ctx.strokeStyle = p.ink;
    ctx.fillStyle = p.paper;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y - 5 * s);
    ctx.lineTo(x + 5 * s, y);
    ctx.lineTo(x, y + 5 * s);
    ctx.lineTo(x - 5 * s, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 10. Your bearing.
  if (o.bearing) {
    const x = f.toX(o.bearing.growth);
    const y = f.toY(o.bearing.margin);
    ctx.strokeStyle = p.signal;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 8 * s, 0, Math.PI * 2);
    ctx.moveTo(x - 13 * s, y);
    ctx.lineTo(x - 4 * s, y);
    ctx.moveTo(x + 4 * s, y);
    ctx.lineTo(x + 13 * s, y);
    ctx.moveTo(x, y - 13 * s);
    ctx.lineTo(x, y - 4 * s);
    ctx.moveTo(x, y + 4 * s);
    ctx.lineTo(x, y + 13 * s);
    ctx.stroke();
    ctx.fillStyle = p.signal;
    ctx.beginPath();
    ctx.arc(x, y, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 11. Neat line and axes.
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
  if (o.axes) drawAxes(ctx, o, f, s);
  ctx.restore();
  return f;
}

function drawSpotSoundings(ctx: CanvasRenderingContext2D, o: Draw2DOptions, f: PlotFrame, s: number) {
  const { grid, field, palette: p } = o;
  const cols = Math.max(3, Math.round(f.w / (78 * s)));
  const rows = Math.max(3, Math.round(f.h / (64 * s)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Stagger alternate rows, like a hand-placed survey.
      const u = (c + 0.5 + (r % 2 ? 0.25 : -0.25)) / cols;
      const v = (r + 0.5) / rows;
      const fx = u * (grid.nx - 1);
      const fy = v * (grid.ny - 1);
      const e = sampleField(field, grid.nx, grid.ny, fx, fy);
      if (Math.abs(e) < 0.05 || Math.abs(e) >= ELEVATION_LIMIT - 0.01) continue;
      const x = f.x + u * f.w;
      const y = f.y + f.h - v * f.h;
      const pct = Math.round((Math.exp(e) - 1) * 100);
      const label = e > 0 ? `+${pct}` : `${Math.abs(pct)}`;
      ctx.font =
        e > 0
          ? `500 ${10.5 * s}px Archivo, 'Archivo Fallback', sans-serif`
          : `italic 400 ${12 * s}px 'Newsreader Display', 'Newsreader Fallback', serif`;
      ctx.fillStyle = e > 0 ? p.landInk : p.waterInk;
      ctx.globalAlpha = 0.85;
      ctx.fillText(label, x, y);
    }
  }
  ctx.globalAlpha = 1;
}

function drawAxes(ctx: CanvasRenderingContext2D, o: Draw2DOptions, f: PlotFrame, s: number) {
  const e = o.grid.extent;
  const p = o.palette;
  ctx.fillStyle = p.ink3;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 1;
  ctx.font = `500 ${10.5 * s}px Archivo, 'Archivo Fallback', sans-serif`;
  const stepG = e.growthMax - e.growthMin > 0.6 ? 0.1 : 0.05;
  const stepM = e.marginMax - e.marginMin > 0.6 ? 0.1 : 0.05;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let g = Math.ceil(e.growthMin / stepG) * stepG; g <= e.growthMax + 1e-9; g += stepG) {
    const x = f.toX(g);
    ctx.beginPath();
    ctx.moveTo(x, f.y + f.h);
    ctx.lineTo(x, f.y + f.h + 4 * s);
    ctx.stroke();
    ctx.fillText(formatPct(g, 0), x, f.y + f.h + 7 * s);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let m = Math.ceil(e.marginMin / stepM) * stepM; m <= e.marginMax + 1e-9; m += stepM) {
    const y = f.toY(m);
    ctx.beginPath();
    ctx.moveTo(f.x, y);
    ctx.lineTo(f.x - 4 * s, y);
    ctx.stroke();
    ctx.fillText(formatPct(m, 0), f.x - 7 * s, y);
  }
  ctx.fillStyle = p.ink2;
  ctx.font = `600 ${10 * s}px Archivo, 'Archivo Fallback', sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('REVENUE GROWTH, YEARS 1–5 →', f.x + f.w, f.y + f.h + 22 * s);
  ctx.save();
  ctx.translate(f.x - 40 * s, f.y);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('OPERATING MARGIN →', 0, 0);
  ctx.restore();
}

/** OffscreenCanvas where available, a detached <canvas> elsewhere. */
class OffscreenCanvasOr {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  constructor(w: number, h: number) {
    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(w, h);
    } else {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      this.canvas = c;
    }
  }
  getContext(type: '2d') {
    return this.canvas.getContext(type) as CanvasRenderingContext2D | null;
  }
}
