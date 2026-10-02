import { sealSpec } from '../seal/guilloche';

/*
 * The watermark: the company's own seal pressed into the pulp, so it shows
 * only when light comes through the sheet. Drawn small on a canvas and
 * enlarged by the GPU, which softens it like pulp; the fibres are made on the
 * GPU when the paper is baked (see paper.ts), so nothing here reads pixels
 * back.
 */

/** Where the watermark sits on the sheet, in sheet units (0 to 1 across, 0 to 1 down; radius in widths). */
export const WATERMARK = { x: 0.3, y: 0.57, r: 0.2 };

const SIZE = 160;

export function watermarkImage(seed: string): HTMLCanvasElement {
  const spec = sealSpec(seed, 'full');
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const unit = (SIZE / 2) * 0.96;
  ctx.setTransform(unit, 0, 0, unit, SIZE / 2, SIZE / 2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (const layer of spec.layers) {
    // The finest lace would only wash out in the pulp; the watermark keeps the rosette's larger forms.
    if (layer.kind === 'lace') continue;
    ctx.strokeStyle = `rgba(255,255,255,${layer.kind === 'ring' ? 0.5 : 0.22})`;
    ctx.lineWidth = (layer.kind === 'ring' ? 1.6 : 1.1) / unit;
    ctx.beginPath();
    for (const path of layer.paths) {
      ctx.moveTo(path[0]!, path[1]!);
      for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i]!, path[i + 1]!);
    }
    ctx.stroke();
  }
  return canvas;
}
