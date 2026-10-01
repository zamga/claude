import type { SealSpec } from './guilloche';

/*
 * Draws a seal on a canvas, either finished or engraved over time. Engraving
 * is incremental: each frame strokes only the new stretch of every curve, so
 * a seal with ~80,000 points costs a few thousand segments per frame, never a
 * full redraw.
 */

export interface DrawOptions {
  /** CSS pixel size of the square canvas. */
  size: number;
  ink: string;
  /** Base hairline in CSS pixels; layers scale it by their weight. */
  hairline?: number;
  /** Opacity of the ink. */
  alpha?: number;
}

export class SealRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private spec: SealSpec;
  private opts: Required<DrawOptions>;
  private raf = 0;
  private drawn: Float32Array; // per layer, the share of each path already engraved
  /** How far through the whole engraving the drawing stands, 0 to 1. */
  private at = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    spec: SealSpec,
    opts: DrawOptions,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    this.ctx = ctx;
    this.spec = spec;
    this.opts = { hairline: 0.6, alpha: 0.92, ...opts };
    this.drawn = new Float32Array(spec.layers.length);
    this.resize();
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(this.opts.size * dpr);
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, px, px);
    // Unit space: origin at the centre, radius 1 at the edge (less a hair for the stroke).
    const half = px / 2;
    const scale = half * 0.985;
    this.ctx.setTransform(scale, 0, 0, scale, half, half);
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'butt';
  }

  private stroke(layer: number, from: number, to: number) {
    const { ctx } = this;
    const l = this.spec.layers[layer]!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const unit = ((this.opts.size * dpr) / 2) * 0.985;
    ctx.lineWidth = (this.opts.hairline * l.weight * dpr) / unit;
    ctx.strokeStyle = this.opts.ink;
    ctx.globalAlpha = this.opts.alpha;
    ctx.beginPath();
    for (const path of l.paths) {
      const n = path.length / 2;
      const a = Math.max(0, Math.floor(from * (n - 1)));
      const b = Math.min(n - 1, Math.ceil(to * (n - 1)));
      if (b <= a) continue;
      ctx.moveTo(path[a * 2]!, path[a * 2 + 1]!);
      for (let i = a + 1; i <= b; i++) ctx.lineTo(path[i * 2]!, path[i * 2 + 1]!);
    }
    ctx.stroke();
  }

  /** Draw the finished seal at once. */
  drawStatic() {
    this.drawTo(1);
  }

  /** Draw the seal as it stands part of the way through its engraving, at once. */
  drawTo(progress: number) {
    this.cancel();
    this.resize();
    const t = clamp01(progress);
    this.spec.layers.forEach((layer, i) => {
      const local = clamp01((t - layer.start) / (layer.end - layer.start));
      if (local > 0) this.stroke(i, 0, local);
      this.drawn[i] = local;
    });
    this.at = t;
  }

  /**
   * Engrave on from where the drawing stands to `progress` over `duration`
   * ms: a seal that grows as the work it stands for gets done.
   */
  engraveTo(progress: number, duration: number, ease: (t: number) => number = easeEngrave): Promise<void> {
    this.cancel();
    const from = this.at;
    const to = clamp01(progress);
    if (to <= from) return Promise.resolve();
    const start = performance.now();
    return new Promise((resolve) => {
      const frame = (now: number) => {
        const k = Math.min(1, (now - start) / duration);
        const t = from + (to - from) * ease(k);
        this.at = t;
        this.spec.layers.forEach((layer, i) => {
          const target = clamp01((t - layer.start) / (layer.end - layer.start));
          const done = this.drawn[i]!;
          if (target > done) {
            this.stroke(i, done, target);
            this.drawn[i] = target;
          }
        });
        if (k < 1) this.raf = requestAnimationFrame(frame);
        else {
          this.raf = 0;
          resolve();
        }
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  /** Engrave the seal over `duration` ms; resolves when finished or cancelled. */
  engrave(duration: number, ease: (t: number) => number = easeEngrave): Promise<void> {
    this.cancel();
    this.resize();
    this.drawn.fill(0);
    const start = performance.now();
    return new Promise((resolve) => {
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        this.spec.layers.forEach((layer, i) => {
          const local = clamp01((t - layer.start) / (layer.end - layer.start));
          const target = ease(local);
          const done = this.drawn[i]!;
          if (target > done) {
            this.stroke(i, done, target);
            this.drawn[i] = target;
          }
        });
        this.at = t;
        if (t < 1) this.raf = requestAnimationFrame(frame);
        else {
          this.raf = 0;
          resolve();
        }
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  update(spec: SealSpec, opts: Partial<DrawOptions> = {}) {
    this.spec = spec;
    this.opts = { ...this.opts, ...opts };
    this.drawn = new Float32Array(spec.layers.length);
    this.at = 0;
  }

  cancel() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** cubic-bezier(0.65, 0, 0.35, 1), the engraving ease, evaluated by Newton-Raphson. */
export function easeEngrave(x: number): number {
  return cubicBezier(0.65, 0, 0.35, 1)(x);
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sampleX(t) - x;
      const d = slopeX(t);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(clamp01(t));
  };
}
