import type { Sounding, ValueGrid } from '../engine/types';
import { formatDate, formatOdds, formatPct, formatPrice, formatSignedPct } from '../engine/format';
import type { Solved } from '../engine/reverse';
import { drawChart2D } from './draw2d';
import type { ChartPalette } from './palette';

export interface PosterInput {
  name: string;
  ticker: string;
  industry: string;
  priceDate: string;
  price: number;
  grid: ValueGrid;
  field: Float32Array;
  palette: ChartPalette;
  marginOfSafety: number;
  bearing: { growth: number; margin: number };
  today: { growth: number; margin: number } | null;
  soundings: Sounding[];
  value: number;
  freeboard: number;
  odds: number;
  marketGrowth: Solved;
  bearingMargin: number;
}

const W = 1200;
const H = 1500;

/**
 * A shareable chart, printed the way an Admiralty chart is: neat line,
 * title cartouche, the chart itself, and the reading in the margin.
 */
export async function renderPoster(p: PosterInput): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const c = p.palette;

  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, W, H);

  // Neat line: a heavy rule and a hairline inside it.
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  // Graduated border ticks.
  ctx.beginPath();
  for (let x = 48; x <= W - 48; x += 12) {
    const long = (x - 48) % 60 === 0;
    ctx.moveTo(x, 48);
    ctx.lineTo(x, 48 + (long ? 10 : 5));
    ctx.moveTo(x, H - 48);
    ctx.lineTo(x, H - 48 - (long ? 10 : 5));
  }
  ctx.stroke();

  // Cartouche.
  ctx.fillStyle = c.ink3;
  ctx.font = "700 18px Archivo, 'Archivo Fallback', sans-serif";
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`PLIMSOLL  ·  ${p.ticker}  ·  ${p.industry.toUpperCase()}`, 96, 128);
  ctx.fillStyle = c.ink;
  ctx.font = "400 92px 'Newsreader Display', 'Newsreader Fallback', serif";
  ctx.fillText(p.name, 92, 222);
  ctx.fillStyle = c.waterInk;
  ctx.font = "italic 400 34px 'Newsreader Display', 'Newsreader Fallback', serif";
  ctx.fillText(`Sea level ${formatPrice(p.price)}, the close on ${formatDate(p.priceDate)}`, 96, 276);

  // The chart.
  ctx.save();
  ctx.translate(72, 316);
  const chartW = W - 144;
  const chartH = 860;
  const sub = document.createElement('canvas');
  sub.width = chartW;
  sub.height = chartH;
  const sctx = sub.getContext('2d')!;
  drawChart2D(sctx, {
    width: chartW,
    height: chartH,
    dpr: 1,
    grid: p.grid,
    field: p.field,
    palette: p.palette,
    marginOfSafety: p.marginOfSafety,
    bearing: p.bearing,
    today: p.today,
    soundings: p.soundings,
    price: p.price,
    axes: true,
    spotSoundings: true,
    padding: { top: 16, right: 16, bottom: 58, left: 78 },
    fontScale: 1.35,
  });
  ctx.drawImage(sub, 0, 0);
  ctx.restore();

  // Reading.
  const y0 = 1240;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, y0 - 36);
  ctx.lineTo(W - 96, y0 - 36);
  ctx.stroke();
  const cols: Array<[string, string]> = [
    ['YOUR VALUE', formatPrice(p.value)],
    ['FREEBOARD', Number.isFinite(p.freeboard) ? formatSignedPct(p.freeboard, 0) : '—'],
    ['ODDS ON DRY LAND', formatOdds(p.odds)],
  ];
  cols.forEach(([label, value], i) => {
    const x = 96 + i * 270;
    ctx.fillStyle = c.ink3;
    ctx.font = "700 15px Archivo, 'Archivo Fallback', sans-serif";
    ctx.fillText(label, x, y0);
    ctx.fillStyle = c.ink;
    ctx.font = "600 52px Archivo, 'Archivo Fallback', sans-serif";
    ctx.fillText(value, x, y0 + 58);
  });
  ctx.fillStyle = c.waterInk;
  ctx.font = "italic 400 30px 'Newsreader Display', 'Newsreader Fallback', serif";
  const story =
    p.marketGrowth.kind === 'solved'
      ? `The market’s story: ${formatPct(p.marketGrowth.value, 0)} growth a year at a ${formatPct(p.bearingMargin, 0)} margin.`
      : `The market’s story lies off this chart at a ${formatPct(p.bearingMargin, 0)} margin.`;
  ctx.fillText(story, 96, y0 + 130);

  ctx.fillStyle = c.ink3;
  ctx.font = "500 16px Archivo, 'Archivo Fallback', sans-serif";
  ctx.fillText('A model, not advice. Land is worth more than the price; water is worth less.', 96, H - 84);
  ctx.textAlign = 'right';
  ctx.fillText('Drawn with Plimsoll', W - 96, H - 84);
  ctx.textAlign = 'left';
  return canvas;
}
