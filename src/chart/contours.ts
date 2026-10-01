import type { ValueGrid } from '../engine/types';
import { elevation } from '../engine/grid';

/**
 * Elevation relative to sea level for each grid node:
 * ln(value / price), clamped. Positive is dry land.
 */
export function elevationField(grid: ValueGrid, price: number): Float32Array {
  const out = new Float32Array(grid.values.length);
  for (let k = 0; k < out.length; k++) out[k] = elevation(grid.values[k]!, price);
  return out;
}

/**
 * Marching squares. Returns line segments (x1, y1, x2, y2 in chart units:
 * growth, margin) where the field crosses `level`. Saddles are resolved
 * with the cell-centre average, so lines never cross.
 */
export function isoSegments(grid: ValueGrid, field: Float32Array, level: number): Float32Array {
  const { nx, ny, extent: e } = grid;
  const sx = (e.growthMax - e.growthMin) / (nx - 1);
  const sy = (e.marginMax - e.marginMin) / (ny - 1);
  const out: number[] = [];

  const lerp = (a: number, b: number) => (level - a) / (b - a);

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = field[j * nx + i]!; // bottom-left
      const b = field[j * nx + i + 1]!; // bottom-right
      const c = field[(j + 1) * nx + i + 1]!; // top-right
      const d = field[(j + 1) * nx + i]!; // top-left
      const code = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
      if (code === 0 || code === 15) continue;

      const x0 = e.growthMin + i * sx;
      const y0 = e.marginMin + j * sy;
      // Edge crossing points.
      const bottom = () => [x0 + lerp(a, b) * sx, y0] as const;
      const right = () => [x0 + sx, y0 + lerp(b, c) * sy] as const;
      const top = () => [x0 + lerp(d, c) * sx, y0 + sy] as const;
      const left = () => [x0, y0 + lerp(a, d) * sy] as const;
      const seg = (p: readonly [number, number], q: readonly [number, number]) => out.push(p[0], p[1], q[0], q[1]);

      switch (code) {
        case 1:
        case 14:
          seg(left(), bottom());
          break;
        case 2:
        case 13:
          seg(bottom(), right());
          break;
        case 3:
        case 12:
          seg(left(), right());
          break;
        case 4:
        case 11:
          seg(right(), top());
          break;
        case 6:
        case 9:
          seg(bottom(), top());
          break;
        case 7:
        case 8:
          seg(left(), top());
          break;
        case 5:
        case 10: {
          const centre = (a + b + c + d) / 4 > level;
          // code 5: a and c high. Centre high joins them.
          if ((code === 5) === centre) {
            seg(left(), top());
            seg(bottom(), right());
          } else {
            seg(left(), bottom());
            seg(right(), top());
          }
          break;
        }
      }
    }
  }
  return new Float32Array(out);
}

/** Contour levels every `step` log units across [min, max], excluding sea level. */
export function levelsBetween(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(min / step); k * step <= max + 1e-9; k++) {
    if (k !== 0) out.push(Number((k * step).toFixed(6)));
  }
  return out;
}
