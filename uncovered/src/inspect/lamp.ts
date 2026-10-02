/*
 * The lamp: where the light falls on a sheet, how strongly, and how the sheet
 * is tilted. The pointer is the lamp on a desk; a finger is the lamp on a
 * phone; with nobody handling the sheet, an assistant sweeps the lamp along a
 * slow path that passes over the figures and their sources. Positions are in
 * the sheet's own units (0 to 1 across, 0 to 1 down). Everything settles with
 * critically damped springs: no overshoot, like a hand that knows where it is
 * going.
 */

export interface LampState {
  /** Where the light falls, in sheet units. */
  x: number;
  y: number;
  /** How strongly the lamp is on, 0 to 1. */
  lit: number;
  /** Tilt of the sheet, -1 to 1 on each axis. */
  tiltX: number;
  tiltY: number;
  /** Whether a person is holding the lamp (rather than the idle sweep). */
  held: boolean;
  /**
   * How firmly the sheet is in hand, 0 to 1: it eases in when a person picks it up (or the phone reports
   * its tilt) and out when they let go. The sheet itself turns only by tilt × grip, so the idle sweep moves
   * the light and the foil, never the text.
   */
  grip: number;
}

export interface LampOptions {
  /** Called on every frame in which anything moved. */
  onFrame: (state: LampState) => void;
  /** Reduced motion: no sweep, and the light follows the hand without inertia. */
  reduced: boolean;
  /**
   * Let an assistant sweep the lamp over the sheet until someone takes it: twice round the path at most,
   * after which the light rests over the key data. Without it, the lamp is off until someone points.
   */
  sweep: boolean;
  /**
   * Where the light rests: after the sweep, or when there is none. A sheet with a sweep starts lit
   * there, as its first paint shows it, and the assistant takes the lamp from there.
   */
  rest?: { x: number; y: number };
}

// The assistant's path: over the seal and its foil, down across the value and the key data, back by the thesis.
const PATH: [number, number][] = [
  [0.79, 0.24],
  [0.56, 0.43],
  [0.28, 0.5],
  [0.42, 0.66],
  [0.77, 0.72],
  [0.86, 0.55],
];
const LAP_MS = 14_000;
const IDLE_MS = 2_400;
const MAX_LAPS = 2;
// The assistant holds the lamp more gently than a person does; a person's lamp is at full strength.
const SWEEP_LIT = 0.62;
const REST_LIT = 0.7;

function catmullRom(points: [number, number][], t: number): [number, number] {
  const n = points.length;
  const f = (((t % 1) + 1) % 1) * n;
  const i = Math.floor(f);
  const u = f - i;
  const p0 = points[(i - 1 + n) % n]!;
  const p1 = points[i % n]!;
  const p2 = points[(i + 1) % n]!;
  const p3 = points[(i + 2) % n]!;
  const c = (a: number, b: number, c2: number, d: number) =>
    0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u * u + (-a + 3 * b - 3 * c2 + d) * u * u * u);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}

/** One critically damped spring step towards `target` (no overshoot). */
function settle(value: number, velocity: number, target: number, stiffness: number, dt: number): [number, number] {
  const omega = Math.sqrt(stiffness);
  const x = value - target;
  const exp = Math.exp(-omega * dt);
  const nextX = (x + (velocity + omega * x) * dt) * exp;
  const nextV = (velocity - omega * (velocity + omega * x) * dt) * exp;
  return [target + nextX, nextV];
}

export class Lamp {
  private state: LampState;
  private velocity = { x: 0, y: 0, lit: 0, tiltX: 0, tiltY: 0, grip: 0 };
  private target: { x: number; y: number; lit: number; tiltX: number; tiltY: number; grip: number };
  /** Whether the assistant may still sweep: until someone takes the lamp, or the laps are done. */
  private sweepAllowed: boolean;
  private raf = 0;
  private timer = 0;
  private last = 0;
  private sweepStart = 0;
  private idleSince = 0;
  private visible = true;
  private sweeping = false;
  private held = false;
  private device: { x: number; y: number } | null = null;

  constructor(private readonly opts: LampOptions) {
    const rest = opts.rest ?? { x: 0.72, y: 0.7 };
    const lit = opts.sweep && (opts.reduced || opts.rest) ? REST_LIT : 0;
    this.state = { ...rest, lit: opts.sweep && opts.rest ? REST_LIT : 0, tiltX: 0, tiltY: 0, held: false, grip: 0 };
    this.target = { ...rest, lit, tiltX: 0, tiltY: 0, grip: 0 };
    this.sweepAllowed = opts.sweep && !opts.reduced;
  }

  /** Start: after a beat, the assistant takes the lamp (or, with reduced motion, sets it down). */
  start(delay = 600) {
    this.idleSince = performance.now() - IDLE_MS + delay;
    this.wake();
  }

  /** The person points at the sheet (x, y in sheet units). */
  point(x: number, y: number) {
    this.held = true;
    this.sweeping = false;
    this.sweepAllowed = false;
    this.target.x = x;
    this.target.y = y;
    this.target.lit = 1;
    this.target.grip = 1;
    if (!this.device) {
      this.target.tiltX = clamp(x * 2 - 1, -1, 1);
      this.target.tiltY = clamp(y * 2 - 1, -1, 1);
    }
    if (this.opts.reduced) {
      this.state.x = x;
      this.state.y = y;
      this.state.lit = 1;
    }
    this.wake();
  }

  /** The person lets go: the light fades (or, on a sheet that had a sweep, settles where it rests) and the sheet lies flat. */
  release() {
    this.held = false;
    this.idleSince = performance.now();
    this.target.lit = this.opts.sweep ? REST_LIT * 0.7 : 0;
    this.target.grip = this.device ? 1 : 0;
    if (!this.device) {
      this.target.tiltX = 0;
      this.target.tiltY = 0;
    }
    this.wake();
  }

  /** The phone's own tilt, -1 to 1 on each axis, or null when it stops reporting. */
  tilt(x: number | null, y: number | null) {
    this.device = x === null || y === null ? null : { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
    if (this.device) {
      this.target.tiltX = this.device.x;
      this.target.tiltY = this.device.y;
    }
    this.target.grip = this.device || this.held ? 1 : 0;
    this.wake();
  }

  /** Pause while the sheet is off screen or the page is hidden. */
  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.wake();
    else this.sleep();
  }

  destroy() {
    this.sleep();
  }

  private wake() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = 0;
    if (this.raf || !this.visible) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private sleep() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.timer) window.clearTimeout(this.timer);
    this.raf = 0;
    this.timer = 0;
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;

    if (this.sweepAllowed && !this.held && now - this.idleSince > IDLE_MS) {
      if (!this.sweeping) {
        this.sweeping = true;
        // Join the path near where the light already is.
        this.sweepStart = now - this.nearestPhase() * LAP_MS;
      }
      const lap = (now - this.sweepStart) / LAP_MS;
      if (lap >= MAX_LAPS) {
        // Enough: the light comes to rest over the key data and nothing moves any more.
        this.sweeping = false;
        this.sweepAllowed = false;
        const rest = this.opts.rest ?? { x: 0.72, y: 0.7 };
        this.target.x = rest.x;
        this.target.y = rest.y;
        this.target.lit = REST_LIT * 0.85;
      } else {
        const [x, y] = catmullRom(PATH, lap);
        this.target.x = x;
        this.target.y = y;
        this.target.lit = SWEEP_LIT;
        if (!this.device) {
          // The foil answers the light's angle; the sheet itself stays still (grip is 0).
          this.target.tiltX = (x - 0.5) * 1.1;
          this.target.tiltY = (y - 0.5) * 1.1;
        }
      }
    }

    const s = this.state;
    const v = this.velocity;
    const t = this.target;
    const k = this.held ? 220 : 60;
    if (this.opts.reduced) {
      s.x = t.x;
      s.y = t.y;
      s.lit = t.lit;
      s.tiltX = t.tiltX;
      s.tiltY = t.tiltY;
      s.grip = t.grip;
    } else {
      [s.x, v.x] = settle(s.x, v.x, t.x, k, dt);
      [s.y, v.y] = settle(s.y, v.y, t.y, k, dt);
      [s.lit, v.lit] = settle(s.lit, v.lit, t.lit, 90, dt);
      [s.tiltX, v.tiltX] = settle(s.tiltX, v.tiltX, t.tiltX, 70, dt);
      [s.tiltY, v.tiltY] = settle(s.tiltY, v.tiltY, t.tiltY, 70, dt);
      [s.grip, v.grip] = settle(s.grip, v.grip, t.grip, 60, dt);
    }
    s.held = this.held;
    this.opts.onFrame(s);

    const moving =
      this.sweeping ||
      Math.abs(s.x - t.x) + Math.abs(s.y - t.y) > 1e-4 ||
      Math.abs(s.lit - t.lit) > 1e-3 ||
      Math.abs(s.tiltX - t.tiltX) + Math.abs(s.tiltY - t.tiltY) > 1e-3 ||
      Math.abs(s.grip - t.grip) > 1e-3;
    if (moving) this.wake();
    else if (this.sweepAllowed && !this.held && !this.sweeping) {
      // Settled and nobody holding it: hand the lamp to the assistant once the pause is over.
      const wait = Math.max(16, this.idleSince + IDLE_MS - now);
      this.timer = window.setTimeout(() => this.wake(), wait);
    }
  };

  private nearestPhase(): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 48; i++) {
      const [x, y] = catmullRom(PATH, i / 48);
      const d = (x - this.state.x) ** 2 + (y - this.state.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i / 48;
      }
    }
    return best;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
