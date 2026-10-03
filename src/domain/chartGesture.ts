/**
 * The chart touch contract (spec pages 21–23) as a pure state machine.
 *
 * Components translate pointer coordinates into events and attach the timestamp ("key") of the
 * nearest real sample under the pointer. The machine decides what is inspected; it never
 * interpolates prices and never owns timers — it returns effects for the component to run.
 */

export const HOLD_MS = 180;
export const SLOP_PX = 8;
export const DOMINANCE = 1.25;

export type PointerKind = 'touch' | 'pen' | 'mouse';

export type GestureState =
  | { mode: 'rest' }
  | { mode: 'hover'; key: number; pinned: number | null }
  | {
      mode: 'pending';
      pointerId: number;
      kind: PointerKind;
      x0: number;
      y0: number;
      t0: number;
      x: number;
      y: number;
      key: number | null;
      pinned: number | null;
    }
  | { mode: 'scrubbing'; pointerId: number; kind: PointerKind; key: number }
  | { mode: 'pinned'; key: number };

export type GestureEvent =
  | {
      type: 'down';
      pointerId: number;
      kind: PointerKind;
      x: number;
      y: number;
      t: number;
      key: number | null;
      button?: number;
    }
  | {
      type: 'move';
      pointerId: number;
      kind: PointerKind;
      x: number;
      y: number;
      t: number;
      key: number | null;
      buttons?: number;
    }
  | { type: 'hold'; t: number }
  | { type: 'up'; pointerId: number; x: number; y: number; t: number; key: number | null }
  | { type: 'cancel'; pointerId: number }
  | { type: 'leave'; kind: PointerKind }
  | { type: 'escape' }
  | { type: 'outside' }
  | { type: 'reset' }
  | { type: 'select'; key: number };

export type GestureEffect =
  'startHold' | 'clearHold' | 'capture' | 'release' | 'hapticSelection' | 'fadeOut' | 'announce';

export interface Transition {
  state: GestureState;
  effects: GestureEffect[];
}

export const REST: GestureState = { mode: 'rest' };

const stay = (state: GestureState): Transition => ({ state, effects: [] });

function restoreAfterPending(pinned: number | null): GestureState {
  return pinned == null ? REST : { mode: 'pinned', key: pinned };
}

function movedBeyondSlop(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= SLOP_PX;
}

export function transition(state: GestureState, event: GestureEvent): Transition {
  if (event.type === 'reset') {
    const effects: GestureEffect[] = state.mode === 'rest' ? [] : ['clearHold', 'release'];
    return { state: REST, effects };
  }

  switch (state.mode) {
    case 'rest':
    case 'pinned':
    case 'hover': {
      const pinned =
        state.mode === 'pinned' ? state.key : state.mode === 'hover' ? state.pinned : null;
      if (event.type === 'down') {
        if (event.kind === 'mouse' && event.button != null && event.button !== 0)
          return stay(state);
        return {
          state: {
            mode: 'pending',
            pointerId: event.pointerId,
            kind: event.kind,
            x0: event.x,
            y0: event.y,
            t0: event.t,
            x: event.x,
            y: event.y,
            key: event.key,
            pinned,
          },
          // Mouse presses never start a hold: click pins and drag scrubs.
          effects: event.kind === 'mouse' ? [] : ['startHold'],
        };
      }
      if (event.type === 'move' && event.kind === 'mouse' && !event.buttons) {
        if (event.key == null) return stay(state);
        return { state: { mode: 'hover', key: event.key, pinned }, effects: [] };
      }
      if (event.type === 'leave' && state.mode === 'hover') {
        return { state: restoreAfterPending(state.pinned), effects: [] };
      }
      if (event.type === 'select') {
        return { state: { mode: 'pinned', key: event.key }, effects: ['announce'] };
      }
      if ((event.type === 'escape' || event.type === 'outside') && pinned != null) {
        return { state: REST, effects: ['fadeOut', 'announce'] };
      }
      return stay(state);
    }

    case 'pending': {
      if (event.type === 'down' && event.pointerId !== state.pointerId) {
        // A second contact cancels single-touch inspection so zoom/accessibility gestures proceed.
        return { state: REST, effects: ['clearHold', 'release'] };
      }
      if (event.type === 'move' && event.pointerId === state.pointerId) {
        const dx = event.x - state.x0;
        const dy = event.y - state.y0;
        const updated = { ...state, x: event.x, y: event.y, key: event.key };
        if (!movedBeyondSlop(dx, dy)) return stay(updated);
        if (Math.abs(dx) >= DOMINANCE * Math.abs(dy)) {
          if (event.key == null) return stay(updated);
          return {
            state: {
              mode: 'scrubbing',
              pointerId: state.pointerId,
              kind: state.kind,
              key: event.key,
            },
            effects: ['clearHold', 'capture'],
          };
        }
        if (Math.abs(dy) > DOMINANCE * Math.abs(dx)) {
          // Vertical intent yields to page scrolling; cancel the hold timer and chart selection.
          return { state: restoreAfterPending(state.pinned), effects: ['clearHold'] };
        }
        return stay(updated); // diagonal: keep pending until a dominance threshold is crossed
      }
      if (event.type === 'hold') {
        if (event.t - state.t0 < HOLD_MS) return stay(state);
        if (movedBeyondSlop(state.x - state.x0, state.y - state.y0) || state.key == null) {
          return stay(state);
        }
        return {
          state: {
            mode: 'scrubbing',
            pointerId: state.pointerId,
            kind: state.kind,
            key: state.key,
          },
          effects: ['capture', 'hapticSelection'],
        };
      }
      if (event.type === 'up' && event.pointerId === state.pointerId) {
        const quick = event.t - state.t0 < HOLD_MS || state.kind === 'mouse';
        const still = !movedBeyondSlop(event.x - state.x0, event.y - state.y0);
        const key = event.key ?? state.key;
        if (quick && still && key != null) {
          return {
            state: { mode: 'pinned', key },
            effects: ['clearHold', 'hapticSelection', 'announce'],
          };
        }
        return { state: restoreAfterPending(state.pinned), effects: ['clearHold'] };
      }
      if (event.type === 'cancel' && event.pointerId === state.pointerId) {
        return { state: restoreAfterPending(state.pinned), effects: ['clearHold', 'release'] };
      }
      if (event.type === 'escape') {
        return { state: REST, effects: ['clearHold', 'release'] };
      }
      return stay(state);
    }

    case 'scrubbing': {
      if (event.type === 'move' && event.pointerId === state.pointerId) {
        if (event.key == null || event.key === state.key) return stay(state);
        return { state: { ...state, key: event.key }, effects: [] };
      }
      if (event.type === 'up' && event.pointerId === state.pointerId) {
        return { state: REST, effects: ['release', 'fadeOut', 'announce'] };
      }
      if (event.type === 'cancel' && event.pointerId === state.pointerId) {
        return { state: REST, effects: ['release', 'fadeOut'] };
      }
      if (event.type === 'down' && event.pointerId !== state.pointerId) {
        return { state: REST, effects: ['release', 'fadeOut'] };
      }
      if (event.type === 'escape') {
        return { state: REST, effects: ['release', 'fadeOut'] };
      }
      return stay(state);
    }
  }
}

/** Timestamp of the sample currently inspected, or null when the latest quote should show. */
export function inspectedKey(state: GestureState): number | null {
  switch (state.mode) {
    case 'hover':
    case 'scrubbing':
    case 'pinned':
      return state.key;
    case 'pending':
      return state.pinned;
    default:
      return null;
  }
}

/** Whether the page should be prevented from scrolling (only while actively scrubbing). */
export function claimsGesture(state: GestureState): boolean {
  return state.mode === 'scrubbing';
}
