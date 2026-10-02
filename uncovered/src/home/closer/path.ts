/*
 * The camera's path in "Look closer", shared by the renderer that photographs
 * each frame (scripts/plates/render.mjs) and the player that shows them, so
 * the player can place the camera anywhere between two frames exactly.
 *
 * A camera is a point on the cover (CSS px of the cover laid out at A4 width)
 * and a zoom (frame pixels per cover pixel). Between two shots the camera
 * zooms towards one fixed point on the paper, so nothing drifts sideways: the
 * zoom moves evenly in log space, and the centre moves with the width of the
 * view.
 */

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Smootherstep: starts and stops with no jolt, which is how a dolly moves. */
export function ease(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** The camera at time t (0 to 1) along a path through the shots, one segment between each pair. */
export function cameraAt(shots: readonly Camera[], t: number): Camera {
  const segments = shots.length - 1;
  const at = Math.min(segments, Math.max(0, t * segments));
  const s = Math.min(segments - 1, Math.floor(at));
  const a = shots[s]!;
  const b = shots[s + 1]!;
  const e = ease(at - s);
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * e);
  const span = 1 / a.zoom - 1 / b.zoom;
  const k = Math.abs(span) < 1e-9 ? e : (1 / a.zoom - 1 / zoom) / span;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom };
}

/*
 * Scroll to film time. The camera holds at each of the three photographs long
 * enough to read what is said about it, and moves between them.
 */
const HOLDS: [number, number][] = [
  [0, 0.14],
  [0.46, 0.6],
  [0.9, 1],
];
export function timeAt(p: number): number {
  const [h0, h1, h2] = HOLDS;
  if (p <= h0![1]) return 0;
  if (p < h1![0]) return ((p - h0![1]) / (h1![0] - h0![1])) * 0.5;
  if (p <= h1![1]) return 0.5;
  if (p < h2![0]) return 0.5 + ((p - h1![1]) / (h2![0] - h1![1])) * 0.5;
  return 1;
}
/** Which of the three photographs the words belong to at film time t. */
export const beatAt = (t: number) => (t < 0.25 ? 0 : t < 0.75 ? 1 : 2);
