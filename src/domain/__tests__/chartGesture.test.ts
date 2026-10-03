import { describe, expect, it } from 'vitest';
import {
  HOLD_MS,
  inspectedKey,
  REST,
  transition,
  type GestureEvent,
  type GestureState,
} from '../chartGesture';

function run(events: GestureEvent[], start: GestureState = REST) {
  let state = start;
  const effects: string[] = [];
  for (const event of events) {
    const result = transition(state, event);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const down = (x: number, y: number, t: number, key = 100): GestureEvent => ({
  type: 'down',
  pointerId: 1,
  kind: 'touch',
  x,
  y,
  t,
  key,
});
const move = (x: number, y: number, t: number, key = 100): GestureEvent => ({
  type: 'move',
  pointerId: 1,
  kind: 'touch',
  x,
  y,
  t,
  key,
});
const up = (x: number, y: number, t: number, key = 100): GestureEvent => ({
  type: 'up',
  pointerId: 1,
  x,
  y,
  t,
  key,
});

describe('chart touch contract', () => {
  it('pointer down enters PENDING without changing the quote', () => {
    const { state, effects } = run([down(50, 50, 0)]);
    expect(state.mode).toBe('pending');
    expect(inspectedKey(state)).toBeNull();
    expect(effects).toContain('startHold');
  });

  it('a short tap pins the nearest point', () => {
    const { state } = run([down(50, 50, 0, 7), up(52, 51, 120, 7)]);
    expect(state).toEqual({ mode: 'pinned', key: 7 });
  });

  it('a hold at 180 ms with little movement starts scrubbing', () => {
    const early = run([down(50, 50, 0), { type: 'hold', t: HOLD_MS - 1 }]);
    expect(early.state.mode).toBe('pending');
    const held = run([down(50, 50, 0, 5), move(53, 52, 90, 5), { type: 'hold', t: HOLD_MS }]);
    expect(held.state).toMatchObject({ mode: 'scrubbing', key: 5 });
    expect(held.effects).toContain('hapticSelection');
  });

  it('a horizontal drag of 8 px with 1.25x dominance scrubs', () => {
    const { state, effects } = run([down(50, 50, 0), move(58, 52, 40, 9)]);
    expect(state).toMatchObject({ mode: 'scrubbing', key: 9 });
    expect(effects).toEqual(expect.arrayContaining(['clearHold', 'capture']));
  });

  it('a vertical movement yields to page scrolling and cancels the hold', () => {
    const { state, effects } = run([down(50, 50, 0), move(52, 60, 40)]);
    expect(state.mode).toBe('rest');
    expect(effects).toContain('clearHold');
  });

  it('a diagonal gesture below both dominance thresholds stays pending', () => {
    const { state } = run([down(50, 50, 0), move(57, 57, 40)]);
    expect(state.mode).toBe('pending');
  });

  it('scrub moves update the selected sample', () => {
    const { state } = run([down(50, 50, 0), move(60, 50, 30, 1), move(80, 51, 60, 2)]);
    expect(inspectedKey(state)).toBe(2);
  });

  it('release after a scrub fades inspection and restores the latest quote', () => {
    const { state, effects } = run([down(50, 50, 0), move(60, 50, 30, 1), up(60, 50, 400, 1)]);
    expect(state.mode).toBe('rest');
    expect(effects).toContain('fadeOut');
  });

  it('pointer cancel clears capture, timers and transient inspection', () => {
    const { state, effects } = run([
      down(50, 50, 0),
      move(60, 50, 30, 1),
      { type: 'cancel', pointerId: 1 },
    ]);
    expect(state.mode).toBe('rest');
    expect(effects).toContain('release');
  });

  it('a second contact cancels the single-touch scrub', () => {
    const { state } = run([
      down(50, 50, 0),
      move(60, 50, 30, 1),
      { type: 'down', pointerId: 2, kind: 'touch', x: 90, y: 90, t: 50, key: 3 },
    ]);
    expect(state.mode).toBe('rest');
  });

  it('a pinned point persists until tap outside, Escape or a range change', () => {
    const pinned: GestureState = { mode: 'pinned', key: 4 };
    expect(run([{ type: 'hold', t: 999 }], pinned).state).toEqual(pinned);
    expect(run([{ type: 'outside' }], pinned).state.mode).toBe('rest');
    expect(run([{ type: 'escape' }], pinned).state.mode).toBe('rest');
    expect(run([{ type: 'reset' }], pinned).state.mode).toBe('rest');
  });

  it('pressing on a pinned chart keeps the pin visible while pending', () => {
    const { state } = run([down(10, 10, 0, 6)], { mode: 'pinned', key: 4 });
    expect(state.mode).toBe('pending');
    expect(inspectedKey(state)).toBe(4);
  });

  it('mouse hover inspects temporarily, click pins, leave clears hover', () => {
    const hover = run([
      { type: 'move', pointerId: 9, kind: 'mouse', x: 1, y: 1, t: 0, key: 3, buttons: 0 },
    ]);
    expect(hover.state).toEqual({ mode: 'hover', key: 3, pinned: null });
    const left = run([{ type: 'leave', kind: 'mouse' }], hover.state);
    expect(left.state.mode).toBe('rest');
    const clicked = run([
      { type: 'down', pointerId: 9, kind: 'mouse', x: 1, y: 1, t: 0, key: 3, button: 0 },
      { type: 'up', pointerId: 9, x: 1, y: 1, t: 600, key: 3 },
    ]);
    expect(clicked.state).toEqual({ mode: 'pinned', key: 3 });
  });

  it('keyboard selection pins a sample', () => {
    expect(run([{ type: 'select', key: 12 }]).state).toEqual({ mode: 'pinned', key: 12 });
  });
});
