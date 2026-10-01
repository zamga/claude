import { token } from '../lib/theme';

/** Chart colours resolved from the live design tokens, for canvas and WebGL. */
export interface ChartPalette {
  paper: string;
  paperRaised: string;
  ink: string;
  ink2: string;
  ink3: string;
  rule: string;
  water1: string;
  water2: string;
  waterInk: string;
  waterLine: string;
  land1: string;
  land2: string;
  land3: string;
  landInk: string;
  landLine: string;
  intertidal: string;
  intertidalInk: string;
  markLand: string;
  markWater: string;
  signal: string;
  dark: boolean;
}

export function readPalette(): ChartPalette {
  return {
    paper: token('--paper'),
    paperRaised: token('--paper-raised'),
    ink: token('--ink'),
    ink2: token('--ink-2'),
    ink3: token('--ink-3'),
    rule: token('--rule'),
    water1: token('--water-1'),
    water2: token('--water-2'),
    waterInk: token('--water-ink'),
    waterLine: token('--water-line'),
    land1: token('--land-1'),
    land2: token('--land-2'),
    land3: token('--land-3'),
    landInk: token('--land-ink'),
    landLine: token('--land-line'),
    intertidal: token('--intertidal'),
    intertidalInk: token('--intertidal-ink'),
    markLand: token('--mark-land'),
    markWater: token('--mark-water'),
    signal: token('--signal'),
    dark: getComputedStyle(document.documentElement).colorScheme.includes('dark'),
  };
}

export type RGB = [number, number, number];

/** Parse #rgb / #rrggbb / rgb(...) into 0–1 floats. */
export function toRgb(color: string): RGB {
  const c = color.trim();
  if (c.startsWith('#')) {
    const h = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join('') : c.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
  }
  const m = c.match(/[\d.]+/g);
  if (m && m.length >= 3) return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  return [0, 0, 0];
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
