import { describe, expect, it } from 'vitest';
import { FILM } from './film';
import { beatAt, cameraAt, ease, timeAt } from './path';
import { loadOrder } from './player';

describe('the camera path', () => {
  const shots = FILM.wide.shots;

  it('passes through every shot', () => {
    expect(cameraAt(shots, 0)).toEqual(shots[0]);
    expect(cameraAt(shots, 0.5).zoom).toBeCloseTo(shots[1]!.zoom, 9);
    expect(cameraAt(shots, 0.5).x).toBeCloseTo(shots[1]!.x, 9);
    expect(cameraAt(shots, 1).y).toBeCloseTo(shots[2]!.y, 9);
  });

  it('only ever moves closer, without a jolt at either end of a move', () => {
    let previous = 0;
    for (let i = 0; i <= 200; i++) {
      const zoom = cameraAt(shots, i / 200).zoom;
      expect(zoom).toBeGreaterThanOrEqual(previous);
      previous = zoom;
    }
    expect(ease(0.001)).toBeLessThan(1e-7);
    expect(1 - ease(0.999)).toBeLessThan(1e-7);
  });

  it('zooms towards one fixed point on the paper, so nothing drifts sideways', () => {
    // The point that stays put satisfies centre = p - k / zoom for one p along the move.
    const a = shots[0]!;
    const b = shots[1]!;
    const px = (b.x / a.zoom - a.x / b.zoom) / (1 / a.zoom - 1 / b.zoom);
    for (const t of [0.1, 0.25, 0.4]) {
      const c = cameraAt(shots, t);
      const onScreen = (px - c.x) * c.zoom;
      expect(onScreen).toBeCloseTo((px - a.x) * a.zoom, 6);
    }
  });
});

describe('the scroll timeline', () => {
  it('holds at each photograph long enough to read about it', () => {
    expect(timeAt(0)).toBe(0);
    expect(timeAt(0.1)).toBe(0);
    expect(timeAt(0.5)).toBe(0.5);
    expect(timeAt(0.58)).toBe(0.5);
    expect(timeAt(0.95)).toBe(1);
    expect(timeAt(0.3)).toBeGreaterThan(0);
    expect(timeAt(0.3)).toBeLessThan(0.5);
  });

  it('names the photograph in view', () => {
    expect([0, 0.2, 0.5, 0.74, 0.8, 1].map(beatAt)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('the order frames are fetched in', () => {
  const last = FILM.frames - 1;

  it('starts with the three photographs the words are about, then fetches every frame once', () => {
    const order = loadOrder(false);
    expect(order.slice(0, 3)).toEqual([0, last / 2, last]);
    expect(new Set(order).size).toBe(FILM.frames);
  });

  it('fetches only every sixth frame when the reader asks to save data', () => {
    const order = loadOrder(true);
    expect(order.every((i) => i % 6 === 0)).toBe(true);
    expect(order).toContain(last);
  });
});
