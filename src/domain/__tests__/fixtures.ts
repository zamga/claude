import type { Sample } from '../series';

/**
 * F01 — the twelve observations drawn on spec page 22 (5-minute samples, 13:30–14:25 ET on the
 * demo session date). The fifth point is 134.50 at 13:50 ET; the ninth is 139.40 at 14:10 ET; the
 * latest is 142.80 at 14:25 ET.
 */
export const F01_START = Date.UTC(2026, 9, 21, 17, 30); // 13:30 ET (EDT, UTC-4)
export const F01_VALUES = [
  132.0, 133.9, 133.05, 135.8, 134.5, 137.55, 139.05, 137.85, 139.4, 138.3, 140.9, 142.8,
] as const;
export const F01: Sample[] = F01_VALUES.map((v, i) => ({ t: F01_START + i * 5 * 60_000, v }));
export const F01_PREVIOUS_CLOSE = 139.53;
