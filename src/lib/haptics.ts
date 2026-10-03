/**
 * Haptic policy (spec page 20): a light response for discrete selection, one for a confirmed save
 * and one for a rejected action, where supported and allowed. Never the only feedback, never a
 * vibration loop. Chart ticks are rate-limited to one per 80 ms.
 */
let enabled = true;
let lastTick = 0;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function vibrate(pattern: number | number[]): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Unsupported or blocked: visual feedback carries the meaning.
  }
}

export const haptics = {
  selection: () => vibrate(8),
  success: () => vibrate(14),
  error: () => vibrate([10, 40, 10]),
  tick: () => {
    const now = performance.now();
    if (now - lastTick < 80) return;
    lastTick = now;
    vibrate(4);
  },
};
