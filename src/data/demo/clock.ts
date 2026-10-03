/**
 * The demo market clock. The deterministic dataset describes the US regular session on
 * Wednesday 21 October 2026; "now" starts at 14:25 ET and only moves when the person advances it
 * from Demo tools, so every screen and test sees the same data.
 */
export const DEMO_SESSION_DATE = '2026-10-21';
export const DEMO_START = Date.UTC(2026, 9, 21, 18, 25); // 14:25 ET
export const DEMO_US_CLOSE = Date.UTC(2026, 9, 21, 20, 0); // 16:00 ET
export const DEMO_STEP_MS = 5 * 60_000;
export const DEMO_MAX_OFFSET = DEMO_US_CLOSE - DEMO_START + 30 * 60_000;
