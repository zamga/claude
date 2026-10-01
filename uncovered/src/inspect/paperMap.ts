import { sealSpec } from '../seal/guilloche';
import { createRandom, hashString } from '../lib/random';

/*
 * The paper a cover is printed on, as a texture the shader reads:
 *
 *  R  watermark: the company's own seal, pressed into the pulp, so it shows
 *     only when light comes through the sheet;
 *  G  fibres you see against the light;
 *  B  fluorescent fibres, which glow only under UV;
 *  A  the hue each fluorescent fibre glows in.
 *
 * Each channel is drawn white on black on its own canvas, then the four are
 * packed into one RGBA array, so nothing is lost to premultiplied alpha.
 */

export const MAP_WIDTH = 640;
export const MAP_HEIGHT = Math.round((MAP_WIDTH * 297) / 210);

/** Where the watermark sits on the sheet, in sheet units (0 to 1 across, 0 to 1 down; radius in widths). */
export const WATERMARK = { x: 0.3, y: 0.57, r: 0.2 };

function channel(draw: (ctx: CanvasRenderingContext2D) => void): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  draw(ctx);
  return ctx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
}

/** The watermark: the seal's curves drawn soft and wide at low resolution, then enlarged, which blurs them like pulp. */
function watermark(seed: string): Uint8ClampedArray {
  const spec = sealSpec(seed, 'full');
  const small = document.createElement('canvas');
  const scale = 0.25;
  small.width = Math.round(MAP_WIDTH * scale);
  small.height = Math.round(MAP_HEIGHT * scale);
  const s = small.getContext('2d');
  if (!s) throw new Error('Canvas 2D is unavailable');
  s.fillStyle = '#000';
  s.fillRect(0, 0, small.width, small.height);
  const radius = WATERMARK.r * small.width;
  s.setTransform(radius, 0, 0, radius, WATERMARK.x * small.width, WATERMARK.y * small.height);
  s.globalCompositeOperation = 'lighter';
  s.lineJoin = 'round';
  for (const layer of spec.layers) {
    // The finest lace would wash out; the watermark keeps the rosette's larger forms.
    s.strokeStyle = `rgba(255,255,255,${layer.kind === 'lace' ? 0.09 : 0.2})`;
    s.lineWidth = (layer.kind === 'ring' ? 2.2 : 1.4) / radius;
    s.beginPath();
    for (const path of layer.paths) {
      s.moveTo(path[0]!, path[1]!);
      for (let i = 2; i < path.length; i += 2) s.lineTo(path[i]!, path[i + 1]!);
    }
    s.stroke();
  }
  return channel((ctx) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, MAP_WIDTH, MAP_HEIGHT);
  });
}

interface Fibre {
  x: number;
  y: number;
  angle: number;
  length: number;
  bend: number;
  width: number;
  shade: number;
}

function fibres(rand: () => number, count: number, length: [number, number], width: [number, number]): Fibre[] {
  return Array.from({ length: count }, () => ({
    x: rand() * MAP_WIDTH,
    y: rand() * MAP_HEIGHT,
    angle: rand() * Math.PI * 2,
    length: length[0] + rand() * (length[1] - length[0]),
    bend: (rand() - 0.5) * 0.9,
    width: width[0] + rand() * (width[1] - width[0]),
    shade: 0.45 + rand() * 0.55,
  }));
}

function strokeFibre(ctx: CanvasRenderingContext2D, f: Fibre, value: number) {
  const dx = Math.cos(f.angle) * f.length;
  const dy = Math.sin(f.angle) * f.length;
  const mx = f.x + dx / 2 - dy * f.bend * 0.5;
  const my = f.y + dy / 2 + dx * f.bend * 0.5;
  const v = Math.round(Math.max(0, Math.min(1, value)) * 255);
  ctx.strokeStyle = `rgb(${v},${v},${v})`;
  ctx.lineWidth = f.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.quadraticCurveTo(mx, my, f.x + dx, f.y + dy);
  ctx.stroke();
}

export interface PaperMap {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Make the paper for one company: the same name always makes the same sheet. */
export function paperMap(seed: string): PaperMap {
  const rand = createRandom(hashString(`paper:${seed}`));
  const plain = fibres(rand, 900, [6, 22], [0.5, 1.1]);
  const glowing = fibres(rand, 150, [10, 26], [0.8, 1.4]);
  const hues = glowing.map(() => rand());

  const r = watermark(seed);
  const g = channel((ctx) => plain.forEach((f) => strokeFibre(ctx, f, f.shade)));
  const b = channel((ctx) => glowing.forEach((f) => strokeFibre(ctx, f, f.shade)));
  const a = channel((ctx) => glowing.forEach((f, i) => strokeFibre(ctx, f, 0.05 + hues[i]! * 0.95)));

  const data = new Uint8Array(MAP_WIDTH * MAP_HEIGHT * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r[i]!;
    data[i + 1] = g[i]!;
    data[i + 2] = b[i]!;
    data[i + 3] = a[i]!;
  }
  return { data, width: MAP_WIDTH, height: MAP_HEIGHT };
}
