import { valuePerShare } from './dcf';
import { impliedGrowth } from './reverse';
import type { ChartExtent, ValuationInputs, ValueGrid } from './types';

const tidy = (v: number) => Math.round(v * 1e4) / 1e4;
const roundDown = (v: number, step: number) => tidy(Math.floor(v / step - 1e-9) * step);
const roundUp = (v: number, step: number) => tidy(Math.ceil(v / step + 1e-9) * step);

/**
 * The window of the chart: growth on x, target margin on y. Wide enough to
 * show the bearing, today's margin and (where possible) the coastline the
 * market price implies at today's margin.
 */
export function chartExtent(inputs: ValuationInputs, price: number): ChartExtent {
  let growthMax = Math.max(0.4, inputs.growth + 0.15);
  const implied = impliedGrowth({ ...inputs, targetMargin: inputs.operatingMargin }, price);
  if (implied.kind === 'solved' && implied.value > growthMax - 0.08) {
    growthMax = Math.min(1.0, implied.value + 0.12);
  }
  const growthMin = Math.min(-0.1, inputs.growth - 0.1);
  const marginMin = Math.min(-0.1, inputs.operatingMargin - 0.1, inputs.targetMargin - 0.1);
  let marginMax = Math.min(0.9, Math.max(0.3, inputs.operatingMargin + 0.25, inputs.targetMargin + 0.15));

  // Make sure some dry land is in view: walk the far corner outward until
  // the best story on the chart is comfortably worth more than the price.
  const scratch = { ...inputs };
  for (let k = 0; k < 14; k++) {
    scratch.growth = growthMax;
    scratch.targetMargin = marginMax;
    if (valuePerShare(scratch) >= price * 1.6) break;
    if (growthMax < 1.0) growthMax = Math.min(1.0, growthMax + 0.05);
    if (marginMax < 0.9) marginMax = Math.min(0.9, marginMax + 0.05);
  }

  return {
    growthMin: roundDown(growthMin, 0.05),
    growthMax: roundUp(growthMax, 0.05),
    marginMin: roundDown(marginMin, 0.05),
    marginMax: roundUp(marginMax, 0.05),
  };
}

/** Grow an extent so it contains a point, with a margin of one step. */
export function includePoint(extent: ChartExtent, growth: number, margin: number): ChartExtent {
  const pad = 0.05;
  return {
    growthMin: growth - pad < extent.growthMin ? roundDown(growth - pad, 0.05) : extent.growthMin,
    growthMax: growth + pad > extent.growthMax ? roundUp(growth + pad, 0.05) : extent.growthMax,
    marginMin: margin - pad < extent.marginMin ? roundDown(margin - pad, 0.05) : extent.marginMin,
    marginMax: margin + pad > extent.marginMax ? roundUp(margin + pad, 0.05) : extent.marginMax,
  };
}

export const growthAt = (e: ChartExtent, i: number, nx: number) =>
  e.growthMin + ((e.growthMax - e.growthMin) * i) / (nx - 1);
export const marginAt = (e: ChartExtent, j: number, ny: number) =>
  e.marginMin + ((e.marginMax - e.marginMin) * j) / (ny - 1);

/** Value per share for every (growth, target margin) pair on an nx × ny lattice. */
export function valueGrid(inputs: ValuationInputs, extent: ChartExtent, nx = 64, ny = 64): ValueGrid {
  const values = new Float64Array(nx * ny);
  const scratch = { ...inputs };
  for (let j = 0; j < ny; j++) {
    scratch.targetMargin = marginAt(extent, j, ny);
    for (let i = 0; i < nx; i++) {
      scratch.growth = growthAt(extent, i, nx);
      values[j * nx + i] = valuePerShare(scratch);
    }
  }
  return { extent, nx, ny, values };
}

/** Bilinear sample of a grid at fractional growth/margin coordinates. */
export function sampleGrid(grid: ValueGrid, growth: number, margin: number): number {
  const { extent: e, nx, ny, values } = grid;
  const fx = ((growth - e.growthMin) / (e.growthMax - e.growthMin)) * (nx - 1);
  const fy = ((margin - e.marginMin) / (e.marginMax - e.marginMin)) * (ny - 1);
  const x0 = Math.min(nx - 2, Math.max(0, Math.floor(fx)));
  const y0 = Math.min(ny - 2, Math.max(0, Math.floor(fy)));
  const tx = Math.min(1, Math.max(0, fx - x0));
  const ty = Math.min(1, Math.max(0, fy - y0));
  const v00 = values[y0 * nx + x0]!;
  const v10 = values[y0 * nx + x0 + 1]!;
  const v01 = values[(y0 + 1) * nx + x0]!;
  const v11 = values[(y0 + 1) * nx + x0 + 1]!;
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

/**
 * Elevation used by every renderer: the log of value over price, clamped.
 * Sea level (0) is the price; +0.69 is "worth twice the price".
 */
export const ELEVATION_LIMIT = 2.2;
export function elevation(value: number, price: number): number {
  if (!(value > 0) || !(price > 0)) return -ELEVATION_LIMIT;
  return Math.max(-ELEVATION_LIMIT, Math.min(ELEVATION_LIMIT, Math.log(value / price)));
}
