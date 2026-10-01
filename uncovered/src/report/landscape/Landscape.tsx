import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { moneyFor, pct } from '../../lib/format';
import { prefersReducedMotion } from '../../lib/motion';
import { token, useTheme } from '../../lib/theme';
import { Odometer } from '../../ui/Odometer';
import { cubicBezier } from '../../seal/renderer';
import type { Report } from '../types';
import { basisOf, dcf, sensitivity, solve, wacc as waccOf } from '../valuation';
import type { LandscapeData, LandscapeScene } from './scene';
import styles from './Landscape.module.css';

/*
 * The value landscape: every pair of assumptions has a value, and the price
 * is a level. Two sliders set the cost of capital and terminal growth; the
 * pin moves across the engraved block, the value turns like a numbering
 * machine, and the sentence underneath says what the price implies at that
 * growth. The block is decoration over a model you can read in full in the
 * sensitivity table: without WebGL the controls and readout still work.
 */

const N = 49;
const M = 36;
const ease = cubicBezier(0.65, 0, 0.35, 1);

const steps = (lo: number, hi: number, n: number) =>
  Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
const round = (v: number, step: number) => Math.round(v / step) * step;

export function Landscape({ report }: { report: Report }) {
  const a = report.assumptions;
  const rev = report.base.revenue;
  const basis = basisOf(a);
  const money = moneyFor(report.currency, basis);
  const w0 = waccOf(a);
  const g0 = a.terminalGrowth;
  const price = basis === 'share' ? report.market?.price : undefined;
  const theme = useTheme();
  const id = useId();

  // The grid: wide enough to show the shape, never so close to the cost of capital that growth runs away.
  const data = useMemo<LandscapeData>(() => {
    const gLo = Math.max(0, round(g0 - 0.015, 0.0025));
    const gHi = round(g0 + 0.01, 0.0025);
    const wLo = Math.max(round(w0 - 0.015, 0.0025), gHi + 0.025);
    const wHi = round(w0 + 0.02, 0.0025);
    const waccs = steps(wLo, wHi, N);
    const growths = steps(gLo, gHi, M);
    const values = sensitivity(a, rev, waccs, growths);
    const flat = values.flat().filter(Number.isFinite);
    const lo = Math.min(...flat, price ?? Infinity);
    const hi = Math.max(...flat, price ?? -Infinity);
    return { waccs, growths, values, price, low: lo - (hi - lo) * 0.18, high: hi };
  }, [a, rev, w0, g0, price]);

  const [w, setW] = useState(w0);
  const [g, setG] = useState(g0);
  const value = dcf(a, rev, { wacc: w, g }).value;
  const impliedWacc =
    price === undefined ? undefined : solve((x) => dcf(a, rev, { wacc: x, g }).value, price, g + 0.004, 0.3);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<LandscapeScene | null>(null);
  const pinRef = useRef<HTMLSpanElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const view = useRef({ yaw: 0.3, pitch: 0.38, rise: 0 });
  const renderRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);

  const u = (w - data.waccs[0]!) / (data.waccs[N - 1]! - data.waccs[0]!);
  const v = (g - data.growths[0]!) / (data.growths[M - 1]! - data.growths[0]!);
  const pinState = useRef({ u, v, value });
  useEffect(() => {
    pinState.current = { u, v, value };
    sceneRef.current?.setPin(u, v);
    renderRef.current();
  }, [u, v, value]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    let disposed = false;
    let raf = 0;
    let scene: LandscapeScene | null = null;

    const placeLabels = () => {
      if (!scene) return;
      const { rise } = view.current;
      const pin = pinState.current;
      const p = scene.project(pin.u, pin.v, pin.value, rise);
      if (pinRef.current)
        pinRef.current.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
      labelsRef.current?.querySelectorAll<HTMLElement>('[data-at]').forEach((el) => {
        const [lu, lv, lval] = el.dataset.at!.split(',').map(Number) as [number, number, number];
        const q = scene!.project(lu, lv, lval, el.dataset.rise ? rise : 1);
        el.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) translate(-50%, -50%)`;
      });
    };
    const draw = () => {
      raf = 0;
      if (!scene) return;
      scene.setView(view.current.yaw, view.current.pitch);
      scene.setRise(view.current.rise);
      scene.render();
      placeLabels();
    };
    renderRef.current = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => {
      scene?.resize(stage.clientWidth, stage.clientHeight);
      renderRef.current();
    });

    // Rise from the floor the first time the block is in view.
    const rise = () => {
      if (prefersReducedMotion()) {
        view.current.rise = 1;
        renderRef.current();
        return;
      }
      const start = performance.now();
      const from = view.current.yaw - 0.35;
      const to = view.current.yaw;
      const step = (now: number) => {
        if (disposed) return;
        const k = Math.min(1, (now - start) / 1800);
        view.current.rise = ease(k);
        view.current.yaw = from + (to - from) * ease(k);
        renderRef.current();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void import('./scene').then(({ LandscapeScene }) => {
          if (disposed) return;
          try {
            scene = new LandscapeScene(canvas, data, {
              paper: token('--sheet'),
              ink: token('--intaglio'),
              price: token('--ovi-b'),
            });
          } catch {
            return;
          }
          sceneRef.current = scene;
          scene.resize(stage.clientWidth, stage.clientHeight);
          scene.setPin(pinState.current.u, pinState.current.v);
          ro.observe(stage);
          setReady(true);
          rise();
        });
      },
      { rootMargin: '0px 0px -20% 0px' },
    );
    io.observe(stage);

    // Turn the block by dragging it; a vertical drag on a phone still scrolls the page.
    let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
    const down = (e: PointerEvent) => {
      if (!scene) return;
      drag = { x: e.clientX, y: e.clientY, yaw: view.current.yaw, pitch: view.current.pitch };
      stage.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      view.current.yaw = Math.max(-1.2, Math.min(1.1, drag.yaw + (e.clientX - drag.x) * 0.008));
      view.current.pitch = Math.max(0.18, Math.min(1.05, drag.pitch + (e.clientY - drag.y) * 0.004));
      renderRef.current();
    };
    const up = () => {
      drag = null;
    };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      scene?.destroy();
      sceneRef.current = null;
      renderRef.current = () => {};
    };
  }, [data]);

  // The engraving follows the theme's ink.
  useEffect(() => {
    sceneRef.current?.setColors({ paper: token('--sheet'), ink: token('--intaglio'), price: token('--ovi-b') });
    renderRef.current();
  }, [theme]);

  const vs = price === undefined ? undefined : value - price;
  const words = `${money.value(value, 0)}${basis === 'share' ? ' a share' : ''}`;

  return (
    <figure className={styles.landscape} aria-labelledby={`${id}-title`}>
      <div
        ref={stageRef}
        className={styles.stage}
        data-ready={ready ? '' : undefined}
        role="img"
        aria-label={`The value landscape: the model's value across costs of capital from ${pct(data.waccs[0]!)} to ${pct(
          data.waccs[N - 1]!,
        )} and terminal growth from ${pct(data.growths[0]!)} to ${pct(data.growths[M - 1]!)}${
          price === undefined ? '' : `, with the price of ${money.amount(price)} as a level across it`
        }. The sensitivity table gives the same values.`}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
        <div ref={labelsRef} className={styles.labels} aria-hidden="true">
          <span data-at={`0,0,${data.low}`} className={styles.tick}>
            {pct(data.waccs[0]!)}
          </span>
          <span data-at={`1,0,${data.low}`} className={styles.tick}>
            {pct(data.waccs[N - 1]!)}
          </span>
          <span data-at={`0.5,-0.08,${data.low}`} className={`${styles.axis} ${styles.axisX}`}>
            Cost of capital →
          </span>
          <span data-at={`1,1,${data.low}`} className={styles.tick}>
            {pct(data.growths[M - 1]!)}
          </span>
          <span data-at={`1.08,0.5,${data.low}`} className={`${styles.axis} ${styles.axisZ}`}>
            Terminal growth →
          </span>
          {price !== undefined && (
            <span data-at={`-0.04,1.04,${price}`} data-rise="" className={styles.priceTag}>
              Price {money.amount(price)}
            </span>
          )}
        </div>
        <span ref={pinRef} className={styles.pin} aria-hidden="true">
          <span>{money.value(value, 0)}</span>
        </span>
        <p className={styles.hint} aria-hidden="true">
          Drag to turn
        </p>
      </div>

      <figcaption className={styles.panel}>
        <p className="eyebrow" id={`${id}-title`}>
          The value landscape
        </p>
        <p className={styles.lead}>
          Every pair of assumptions has a value. Move them and watch it move; the violet line is every pair the price
          implies.
        </p>
        <div className={styles.readout}>
          <Odometer value={money.value(value, 0)} className={styles.value} />
          <span className="visually-hidden">{words}</span>
          <span className={styles.unit}>{basis === 'share' ? 'a share' : 'equity value'}</span>
          {vs !== undefined && price !== undefined && (
            <span className={styles.delta} data-sign={vs >= 0 ? 'above' : 'below'}>
              {money.value(Math.abs(vs), 0)} {vs >= 0 ? 'above' : 'below'} the {money.amount(price)} price
            </span>
          )}
        </div>
        <div className={styles.controls}>
          <label className={styles.control}>
            <span>
              Cost of capital <strong>{pct(w)}</strong>
            </span>
            <input
              type="range"
              min={data.waccs[0]}
              max={data.waccs[N - 1]}
              step={0.0005}
              value={w}
              onChange={(e) => setW(Number(e.target.value))}
              aria-valuetext={`${pct(w)}: ${words}`}
            />
          </label>
          <label className={styles.control}>
            <span>
              Terminal growth <strong>{pct(g)}</strong>
            </span>
            <input
              type="range"
              min={data.growths[0]}
              max={data.growths[M - 1]}
              step={0.0005}
              value={g}
              onChange={(e) => setG(Number(e.target.value))}
              aria-valuetext={`${pct(g)}: ${words}`}
            />
          </label>
        </div>
        {impliedWacc !== undefined && price !== undefined && (
          <p className={styles.implied}>
            At {pct(g)} growth, the {money.amount(price)} price implies a cost of capital of{' '}
            <strong>{pct(impliedWacc)}</strong>; the model uses {pct(w0)}.
          </p>
        )}
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            setW(w0);
            setG(g0);
          }}
          disabled={Math.abs(w - w0) < 1e-9 && Math.abs(g - g0) < 1e-9}
        >
          Back to the base case
        </button>
      </figcaption>
    </figure>
  );
}
