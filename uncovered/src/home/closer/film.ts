// Written by scripts/plates/render.mjs from the cover it photographed. Do not edit by hand.
import type { Camera } from './path';

export interface Framing {
  width: number;
  height: number;
  shots: readonly Camera[];
}

export const FILM = {
  version: 'v1',
  frames: 73,
  /** Millimetres of paper per CSS pixel of the cover the shots are measured on. */
  mmPerCss: 0.26448362720403024,
  wide: {
    width: 1600,
    height: 900,
    shots: [
      { x: 148.428, y: 624.203, zoom: 0.644 },
      { x: 533.107, y: 976.445, zoom: 3.294 },
      { x: 511.964, y: 991.297, zoom: 11.694 },
    ],
  },
  tall: {
    width: 900,
    height: 1600,
    shots: [
      { x: 397, y: 920.63, zoom: 0.756 },
      { x: 591.391, y: 1067.514, zoom: 2.108 },
      { x: 528.383, y: 1016.952, zoom: 7.484 },
    ],
  },
} as const satisfies { wide: Framing; tall: Framing } & Record<string, unknown>;
