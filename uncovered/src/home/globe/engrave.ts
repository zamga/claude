import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoProjection } from 'd3-geo';
import type { MultiPolygon } from 'geojson';
import { EU, LAND, SI, US } from './geography';

/*
 * The engraved globe: Natural Earth's coastlines drawn the way a banknote
 * engraver draws a globe. The sea is ruled in water lines and the land is
 * hatched, and every line swells where the sphere turns away from the lamp,
 * so the shading is made of line weight, never of grey. The more of a place's
 * filings Uncovered reads, the more densely it is engraved: Slovenia is inked
 * solid, the European Union and the United States are cross-hatched, the rest
 * of the world is hatched once.
 */

export type Place = 'si' | 'eu' | 'us' | 'world';

/** Where the globe turns to show each place, as [longitude, latitude]. */
export const CENTRES: Record<Place, [number, number]> = {
  si: [14.8, 46.1],
  eu: [12, 49],
  us: [-97, 39],
  world: [100, 15],
};

const NOVO_MESTO: [number, number] = [15.17, 45.8];

const LABELS: Record<Place, string> = {
  si: 'Slovenia',
  eu: 'European Union',
  us: 'United States',
  world: 'Anywhere else',
};

export interface GlobeColors {
  sheet: string;
  ink: string;
  line: string;
  muted: string;
  rule: string;
}

type Box = [number, number, number, number];

const BUCKETS = 6;
const RING_TEXT = 'WHERE UNCOVERED READS THE FILINGS · NATURAL EARTH 1:110M · ';

export class EngravedGlobe {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly projection: GeoProjection = geoOrthographic().clipAngle(90).precision(0.4);
  private readonly path;
  private size = 0;
  private radius = 0;
  private light: [number, number, number] = [-0.5, -0.62, 0.6];
  private colors: GlobeColors;
  private focus: Place | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    colors: GlobeColors,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    this.ctx = ctx;
    this.colors = colors;
    this.path = geoPath(this.projection, ctx);
    this.setCentre(CENTRES.si);
  }

  setColors(colors: GlobeColors) {
    this.colors = colors;
  }

  setFocus(place: Place | null) {
    this.focus = place;
  }

  /** The point of the globe facing the reader, as [longitude, latitude]. */
  centre(): [number, number] {
    const [lambda, phi] = this.projection.rotate();
    return [-lambda, -phi];
  }

  setCentre([lon, lat]: [number, number]) {
    this.projection.rotate([-lon, -Math.max(-70, Math.min(70, lat))]);
  }

  /** Where the lamp stands, in the canvas's own units (-1 to 1 across), or null for the resting light. */
  setLamp(at: [number, number] | null) {
    const [x, y] = at ?? [-0.75, -0.85];
    const z = 0.95;
    const n = Math.hypot(x, y, z);
    this.light = [x / n, y / n, z / n];
  }

  resize(cssSize: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = cssSize;
    this.canvas.width = Math.round(cssSize * dpr);
    this.canvas.height = Math.round(cssSize * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.radius = (cssSize / 2) * 0.86;
    this.projection.scale(this.radius).translate([cssSize / 2, cssSize / 2]);
  }

  /** 0 where the lamp falls full on the sphere, 1 where it turns away. */
  private shade(x: number, y: number): number {
    const c = this.size / 2;
    const nx = (x - c) / this.radius;
    const ny = (y - c) / this.radius;
    const d = nx * nx + ny * ny;
    if (d >= 1) return 1;
    const nz = Math.sqrt(1 - d);
    const [lx, ly, lz] = this.light;
    const lambert = Math.max(0, nx * lx + ny * ly + nz * lz);
    return Math.min(1, 0.08 + 0.92 * (1 - lambert) ** 1.4 + 0.3 * (1 - nz) ** 3);
  }

  /**
   * Rule parallel lines at `angle` across `box` (clipped by whatever clip is set),
   * each segment as wide as the shade where it falls, in a few weights.
   */
  private rule(box: Box, angle: number, spacing: number, thin: number, thick: number, step: number, wobble = 0) {
    const { ctx } = this;
    const c = this.size / 2;
    const r = this.radius + 1;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Lines run along d = (cos, sin), stacked along n = (-sin, cos), measured from the centre.
    const corners = [
      [box[0] - c, box[1] - c],
      [box[2] - c, box[1] - c],
      [box[0] - c, box[3] - c],
      [box[2] - c, box[3] - c],
    ] as const;
    const us = corners.map(([x, y]) => -sin * x + cos * y);
    const ts = corners.map(([x, y]) => cos * x + sin * y);
    const uFrom = Math.max(-r, Math.min(...us));
    const uTo = Math.min(r, Math.max(...us));
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    for (let u = Math.ceil(uFrom / spacing) * spacing; u <= uTo; u += spacing) {
      const half = Math.sqrt(Math.max(0, r * r - u * u));
      const tFrom = Math.max(-half, Math.min(...ts));
      const tTo = Math.min(half, Math.max(...ts));
      if (tTo <= tFrom) continue;
      let px = 0;
      let py = 0;
      let first = true;
      for (let t = tFrom; t <= tTo + step * 0.5; t += step) {
        const tt = Math.min(t, tTo);
        const w = wobble ? wobble * Math.sin(tt * 0.085 + u * 0.41) : 0;
        const x = c + cos * tt - sin * (u + w);
        const y = c + sin * tt + cos * (u + w);
        if (!first) {
          const b = Math.min(BUCKETS - 1, Math.floor(this.shade((px + x) / 2, (py + y) / 2) * BUCKETS));
          paths[b]!.moveTo(px, py);
          paths[b]!.lineTo(x, y);
        }
        px = x;
        py = y;
        first = false;
      }
    }
    paths.forEach((p, i) => {
      ctx.lineWidth = thin + ((thick - thin) * (i + 0.5)) / BUCKETS;
      ctx.stroke(p);
    });
  }

  private bounds(shape: MultiPolygon): Box | null {
    const [[x0, y0], [x1, y1]] = this.path.bounds(shape);
    if (!Number.isFinite(x0) || x1 <= x0 || y1 <= y0) return null;
    return [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
  }

  private clipTo(shape: MultiPolygon | { type: 'Sphere' }) {
    this.ctx.beginPath();
    this.path(shape);
    this.ctx.clip('evenodd');
  }

  private visible(point: [number, number]): boolean {
    return geoDistance(point, this.centre()) < Math.PI / 2 - 0.08;
  }

  /** Draw the globe. A draft (while it is being turned) rules coarser lines. */
  render(draft = false) {
    const { ctx, colors } = this;
    const s = this.size;
    const c = s / 2;
    const step = draft ? 14 : 4;
    const disc: Box = [c - this.radius, c - this.radius, c + this.radius, c + this.radius];
    ctx.clearRect(0, 0, s, s);
    ctx.lineCap = 'round';

    // The sheet the globe is printed on, and the sea in water lines.
    ctx.save();
    this.clipTo({ type: 'Sphere' });
    ctx.fillStyle = colors.sheet;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = colors.line;
    ctx.globalAlpha = 0.6;
    this.rule(disc, 0, 2.6, 0.12, 1.1, step, draft ? 0 : 0.55);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = colors.rule;
    ctx.beginPath();
    this.path(geoGraticule10());
    ctx.stroke();
    ctx.restore();

    // The land: the paper shows through, then hatching, denser where Uncovered reads more.
    const layers: [MultiPolygon, string, number, number, boolean][] = [
      [LAND, colors.muted, 2.7, 0.62, false],
      [EU, colors.line, 1.6, 1.15, true],
      [US, colors.line, 1.6, 1.15, true],
    ];
    for (const [shape, ink, spacing, thick, cross] of layers) {
      const box = this.bounds(shape);
      if (!box) continue;
      ctx.save();
      this.clipTo(shape);
      ctx.fillStyle = colors.sheet;
      ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      ctx.strokeStyle = ink;
      this.rule(box, -0.62, spacing, 0.18, thick, step);
      if (cross && !draft) this.rule(box, 0.62, spacing * 2, 0.12, thick * 0.65, step);
      ctx.restore();
    }

    // Slovenia, where every annual report is public, is inked solid.
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    this.path(SI);
    ctx.fill();

    // Coasts and the edges of the places read most.
    ctx.strokeStyle = colors.ink;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    this.path(LAND);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    this.path(EU);
    this.path(US);
    ctx.stroke();

    if (this.focus && this.focus !== 'world') {
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      this.path({ si: SI, eu: EU, us: US }[this.focus]);
      ctx.stroke();
    }

    // The limb, a second ruled circle, and microtext around it.
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(c, c, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(c, c, this.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    this.ring(c, this.radius + 11);

    this.marks();
  }

  /** Text set around a circle, repeated to close it. */
  private ring(c: number, radius: number) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = this.colors.muted;
    ctx.font = '600 6.5px "Hanken Grotesk Variable", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Whole copies of the text, spaced to close the circle.
    const copies = Math.max(1, Math.round((Math.PI * 2 * radius) / (RING_TEXT.length * 4.6)));
    const count = copies * RING_TEXT.length;
    const dpr = this.canvas.width / this.size;
    for (let i = 0; i < count; i++) {
      const ch = RING_TEXT[i % RING_TEXT.length]!;
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(c + Math.cos(a) * radius, c + Math.sin(a) * radius);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(ch, 0, 0);
    }
    ctx.restore();
  }

  /** Novo mesto, where the sample company is engraved, and the name of the place in focus. */
  private marks() {
    const { ctx, colors } = this;
    ctx.font = '650 10.5px "Hanken Grotesk Variable", "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (this.visible(NOVO_MESTO)) {
      const [x, y] = this.projection(NOVO_MESTO)!;
      ctx.fillStyle = colors.sheet;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const place = this.focus ?? 'si';
    const at = CENTRES[place];
    if (!this.visible(at)) return;
    const [x, y] = this.projection(place === 'si' ? NOVO_MESTO : at)!;
    const label = LABELS[place].toUpperCase();
    const tx = x + (place === 'si' ? 9 : 0);
    ctx.textAlign = place === 'si' ? 'left' : 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = colors.sheet;
    ctx.strokeText(label, tx, y);
    ctx.fillStyle = colors.ink;
    ctx.fillText(label, tx, y);
  }
}
