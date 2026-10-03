import { sessionTimes, tradingDays } from './calendar';
import { DEMO_START } from './clock';
import { gaussians } from './random';

/**
 * Demo EUR/USD observations (1 EUR = rate USD). Portfolio conversion uses these; when the feed
 * is interrupted the latest rate is withheld so converted totals are marked incomplete.
 */
export const FX_SOURCE = 'Demo FX feed — simulated rates';

const ANCHORS: [string, number][] = [
  ['2026-05-29', 1.092],
  ['2026-08-20', 1.085],
  ['2026-10-20', 1.0786],
];

interface FxPoint {
  t: number;
  rate: number;
}

let cache: FxPoint[] | null = null;

function series(): FxPoint[] {
  if (cache) return cache;
  const days = tradingDays('US', '2026-05-29', '2026-10-20');
  const z = gaussians(4242, days.length + 2);
  const sigma = 0.0035;
  const out: FxPoint[] = [];
  for (let a = 0; a < ANCHORS.length - 1; a += 1) {
    const [d0, v0] = ANCHORS[a]!;
    const [d1, v1] = ANCHORS[a + 1]!;
    const i0 = days.indexOf(d0);
    const i1 = days.indexOf(d1);
    const n = i1 - i0;
    const walk = [0];
    for (let k = 1; k <= n; k += 1) walk.push(walk[k - 1]! + sigma * z[i0 + k]!);
    for (let k = a === 0 ? 0 : 1; k <= n; k += 1) {
      const frac = k / n;
      const value = Math.exp(
        Math.log(v0) + frac * (Math.log(v1) - Math.log(v0)) + walk[k]! - frac * walk[n]!,
      );
      out.push({
        t: sessionTimes('US', days[i0 + k]!).closesAt,
        rate: Math.round(value * 10000) / 10000,
      });
    }
  }
  out.push({ t: DEMO_START, rate: 1.079 });
  cache = out;
  return out;
}

/** Latest EUR/USD observation at or before `at`; null before the series begins. */
export function eurUsdAt(at: number): { rate: string; observedAt: number } | null {
  let latest: FxPoint | null = null;
  for (const point of series()) {
    if (point.t > at) break;
    latest = point;
  }
  return latest ? { rate: latest.rate.toFixed(4), observedAt: latest.t } : null;
}
