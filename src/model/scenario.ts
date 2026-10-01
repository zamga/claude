import { defaultRanges } from '../engine/montecarlo';
import type { UncertaintyRanges, ValuationInputs } from '../engine/types';

/** Everything a visitor can change on a chart. */
export interface Scenario {
  inputs: ValuationInputs;
  /** The sea level: the share price the chart is drawn against. */
  price: number;
  /** Required margin of safety; sets the load line. */
  marginOfSafety: number;
  /** Width of the visitor's uncertainty, as a multiple of the default ranges. */
  uncertainty: number;
  storyId: string | null;
}

export const DEFAULT_MARGIN_OF_SAFETY = 0.2;

export function rangesFor(scenario: Scenario): UncertaintyRanges {
  const base = defaultRanges(scenario.inputs);
  const k = scenario.uncertainty;
  const widen = (r: { low: number; mode: number; high: number }) => ({
    low: r.mode - (r.mode - r.low) * k,
    mode: r.mode,
    high: r.mode + (r.high - r.mode) * k,
  });
  return {
    growth: widen(base.growth),
    targetMargin: widen(base.targetMargin),
    costOfCapital: widen(base.costOfCapital),
    salesToCapital: widen(base.salesToCapital),
  };
}

/*
 * Share tokens. A chart's assumptions travel in the address as a short
 * base64url string, so a link reproduces the exact chart, soundings included.
 * Values are stored as integers in basis points (or hundredths) in a fixed order.
 */
const VERSION = 1;

const FIELDS = [
  ['growth', 1e4],
  ['targetMargin', 1e4],
  ['convergenceYears', 1],
  ['costOfCapital', 1e4],
  ['terminalCostOfCapital', 1e4],
  ['terminalRoic', 1e4],
  ['salesToCapital', 100],
  ['terminalGrowth', 1e4],
  ['taxRate', 1e4],
] as const satisfies readonly (readonly [keyof ValuationInputs, number])[];

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): Uint8Array {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4);
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function encodeScenario(s: Scenario): string {
  const ints = [
    VERSION,
    ...FIELDS.map(([k, scale]) => Math.round(s.inputs[k] * scale)),
    Math.round(s.price * 100),
    Math.round(s.marginOfSafety * 1e4),
    Math.round(s.uncertainty * 100),
  ];
  const view = new DataView(new ArrayBuffer(ints.length * 4));
  ints.forEach((v, i) => view.setInt32(i * 4, v));
  return toBase64Url(new Uint8Array(view.buffer));
}

/** Apply a token on top of base inputs. Returns null for anything malformed. */
export function decodeScenario(token: string, base: ValuationInputs): Scenario | null {
  try {
    const bytes = fromBase64Url(token);
    if (bytes.length % 4 !== 0) return null;
    const view = new DataView(bytes.buffer);
    const ints = Array.from({ length: bytes.length / 4 }, (_, i) => view.getInt32(i * 4));
    if (ints[0] !== VERSION || ints.length !== FIELDS.length + 4) return null;
    const inputs = { ...base };
    FIELDS.forEach(([k, scale], i) => {
      inputs[k] = ints[i + 1]! / scale;
    });
    const price = ints[FIELDS.length + 1]! / 100;
    const marginOfSafety = ints[FIELDS.length + 2]! / 1e4;
    const uncertainty = ints[FIELDS.length + 3]! / 100;
    const sane =
      price > 0 &&
      inputs.salesToCapital > 0 &&
      inputs.costOfCapital > 0 &&
      inputs.terminalCostOfCapital > 0 &&
      marginOfSafety >= 0 &&
      marginOfSafety < 0.95 &&
      uncertainty >= 0 &&
      uncertainty <= 5;
    return sane ? { inputs, price, marginOfSafety, uncertainty, storyId: null } : null;
  } catch {
    return null;
  }
}
