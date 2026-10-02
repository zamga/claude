import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion';
import { token, useTheme } from '../../lib/theme';
import { cubicBezier } from '../../seal/renderer';
import type { EngravedGlobe, GlobeColors, Place } from './engrave';
import styles from './Globe.module.css';

/*
 * The coverage table as an engraved globe (see engrave.ts). It loads as the
 * section approaches, arrives by turning from the Atlantic to Slovenia, turns
 * to whichever place the reader points at in the table, and can be turned by
 * hand; the pointer is a lamp that lights it. It is decoration: the table
 * beside it says the same in words.
 */

const ease = cubicBezier(0.65, 0, 0.35, 1);
const FROM: [number, number] = [-38, 28];

const colors = (): GlobeColors => ({
  sheet: token('--sheet'),
  ink: token('--ink'),
  line: token('--intaglio'),
  muted: token('--ink-3'),
  rule: token('--rule-2'),
});

/** The way round from one longitude to another that turns least. */
const nearest = (from: number, to: number) => from + ((((to - from) % 360) + 540) % 360) - 180;

export function Globe({ focus }: { focus: Place | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<EngravedGlobe | null>(null);
  const turnRef = useRef<(to: [number, number], ms: number) => void>(() => {});
  const [ready, setReady] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    let disposed = false;
    let frame = 0;
    let rest = 0;

    const draw = (draft: boolean) => {
      window.clearTimeout(rest);
      globeRef.current?.render(draft);
      // Settle on the full engraving once nothing has moved for a moment.
      if (draft) rest = window.setTimeout(() => globeRef.current?.render(false), 160);
    };
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(() => {
        pending = false;
        draw(true);
      });
    };

    const turn = (to: [number, number], ms: number) => {
      const globe = globeRef.current;
      if (!globe) return;
      cancelAnimationFrame(frame);
      const [lon0, lat0] = globe.centre();
      const target: [number, number] = [nearest(lon0, to[0]), to[1]];
      if (ms <= 0 || prefersReducedMotion()) {
        globe.setCentre(target);
        draw(false);
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        if (disposed) return;
        const k = Math.min(1, (now - start) / ms);
        const e = ease(k);
        globe.setCentre([lon0 + (target[0] - lon0) * e, lat0 + (target[1] - lat0) * e]);
        if (k < 1) {
          globe.render(true);
          frame = requestAnimationFrame(step);
        } else draw(false);
      };
      frame = requestAnimationFrame(step);
    };
    turnRef.current = turn;

    const ro = new ResizeObserver(() => {
      globeRef.current?.resize(stage.clientWidth);
      draw(false);
    });

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void import('./engrave').then(({ EngravedGlobe, CENTRES }) => {
          if (disposed) return;
          let globe: EngravedGlobe;
          try {
            globe = new EngravedGlobe(canvas, colors());
          } catch {
            return;
          }
          globeRef.current = globe;
          globe.resize(stage.clientWidth);
          ro.observe(stage);
          setReady(true);
          if (prefersReducedMotion()) draw(false);
          else {
            globe.setCentre(FROM);
            turn(CENTRES.si, 1800);
          }
        });
      },
      { rootMargin: '40% 0px' },
    );
    io.observe(stage);

    // Turned by hand: a drag spins it, and it coasts to a stop when let go.
    let drag: { x: number; y: number; vx: number; vy: number } | null = null;
    const local = (e: PointerEvent): [number, number] => {
      const r = stage.getBoundingClientRect();
      const half = r.width / 2;
      return [(e.clientX - r.left - half) / (half * 0.86), (e.clientY - r.top - half) / (half * 0.86)];
    };
    const down = (e: PointerEvent) => {
      if (!globeRef.current) return;
      cancelAnimationFrame(frame);
      drag = { x: e.clientX, y: e.clientY, vx: 0, vy: 0 };
      stage.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const globe = globeRef.current;
      if (!globe) return;
      if (drag) {
        const perPixel = 57 / (stage.clientWidth * 0.43);
        const dx = (e.clientX - drag.x) * perPixel;
        const dy = (e.clientY - drag.y) * perPixel;
        drag = { x: e.clientX, y: e.clientY, vx: dx, vy: dy };
        const [lon, lat] = globe.centre();
        globe.setCentre([lon - dx, lat + dy]);
      } else if (e.pointerType === 'mouse') globe.setLamp(local(e));
      schedule();
    };
    const up = () => {
      const globe = globeRef.current;
      const was = drag;
      drag = null;
      if (!globe || !was || prefersReducedMotion()) return;
      let { vx, vy } = was;
      const coast = () => {
        vx *= 0.92;
        vy *= 0.92;
        if (Math.abs(vx) + Math.abs(vy) < 0.02 || disposed) {
          draw(false);
          return;
        }
        const [lon, lat] = globe.centre();
        globe.setCentre([lon - vx, lat + vy]);
        globe.render(true);
        frame = requestAnimationFrame(coast);
      };
      frame = requestAnimationFrame(coast);
    };
    const leave = () => {
      globeRef.current?.setLamp(null);
      schedule();
    };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('pointerleave', leave);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(rest);
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('pointerleave', leave);
    };
  }, []);

  // The place the reader points at in the table.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.setFocus(focus);
    if (focus) void import('./engrave').then(({ CENTRES }) => turnRef.current(CENTRES[focus], 900));
    else globe.render(false);
  }, [focus]);

  // The ink follows the theme.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.setColors(colors());
    globe.render(false);
  }, [theme]);

  return (
    <div
      ref={stageRef}
      className={styles.globe}
      aria-hidden="true"
      data-ready={ready ? '' : undefined}
      data-focus={focus ?? undefined}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
