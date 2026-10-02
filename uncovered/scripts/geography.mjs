/*
 * The geography the engraved globe is drawn from, cut once from Natural Earth's
 * 1:110m countries (public domain, through the world-atlas package) and kept
 * in the repository: the land, and the places the coverage table names, each
 * merged along its inner borders. Coordinates are kept in tenths of a degree
 * (under a pixel on the globe) and each ring is written as the integer steps
 * between its points, which compress to a third of plain coordinates; see
 * decode() in src/home/globe/geography.ts. Run it again with
 * `node scripts/geography.mjs` after upgrading world-atlas.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merge } from 'topojson-client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const world = JSON.parse(readFileSync(join(root, 'node_modules/world-atlas/countries-110m.json'), 'utf8'));
const countries = world.objects.countries.geometries;

// The 27 member states of the European Union, by ISO 3166-1 numeric code. Malta is too small to draw at this scale.
const EU = [
  '040',
  '056',
  '100',
  '191',
  '196',
  '203',
  '208',
  '233',
  '246',
  '250',
  '276',
  '300',
  '348',
  '372',
  '380',
  '428',
  '440',
  '442',
  '470',
  '528',
  '616',
  '620',
  '642',
  '703',
  '705',
  '724',
  '752',
];

const pick = (ids) => {
  const found = countries.filter((c) => ids.includes(c.id));
  return merge(world, found);
};

/** A geometry as polygons of rings, each ring the steps between its points in tenths of a degree. */
const encode = (geometry) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .map((rings) =>
      rings
        .map((ring) => {
          const flat = [];
          let px = 0;
          let py = 0;
          for (const [x, y] of ring) {
            const qx = Math.round(x * 10);
            const qy = Math.round(y * 10);
            if (flat.length && qx === px && qy === py) continue;
            flat.push(qx - px, qy - py);
            px = qx;
            py = qy;
          }
          return flat;
        })
        .filter((ring) => ring.length >= 8),
    )
    .filter((rings) => rings.length > 0);
};

const out = {
  source: 'Natural Earth 1:110m countries, public domain, via world-atlas',
  land: encode(merge(world, world.objects.land.geometries)),
  eu: encode(pick(EU)),
  us: encode(pick(['840'])),
  si: encode(pick(['705'])),
};

const file = join(root, 'src/home/globe/geography.json');
writeFileSync(file, JSON.stringify(out));
console.log(`${file.replace(root + '/', '')}: ${(JSON.stringify(out).length / 1024).toFixed(1)} kB`);
