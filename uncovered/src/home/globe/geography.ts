import type { MultiPolygon } from 'geojson';
import data from './geography.json';

/*
 * The places the globe draws, decoded from the compact form written by
 * scripts/geography.mjs: polygons of rings, each ring the integer steps
 * between its points in tenths of a degree.
 */

type Encoded = number[][][];

function decode(polygons: Encoded): MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: polygons.map((rings) =>
      rings.map((flat) => {
        const ring: [number, number][] = [];
        let x = 0;
        let y = 0;
        for (let i = 0; i < flat.length; i += 2) {
          x += flat[i]!;
          y += flat[i + 1]!;
          ring.push([x / 10, y / 10]);
        }
        return ring;
      }),
    ),
  };
}

export const LAND = decode(data.land);
export const EU = decode(data.eu);
export const US = decode(data.us);
export const SI = decode(data.si);
