import { useEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '../lib/motion';
import { token, useTheme } from '../lib/theme';
import { Lamp, type LampState } from './lamp';
import { TILT_GRANTED, tiltNeedsPermission } from './tilt';
import type { Paper } from './paper';

/*
 * Make a sheet inspectable. The lamp follows the pointer, a finger or the idle
 * sweep; the sheet tilts towards it (or with the phone); and once the visitor
 * acts with the sheet in view, the WebGL paper is drawn under the printed HTML,
 * when the page is next idle. The lamp is written to
 * the sheet as CSS custom properties, so masks and tilt stay in CSS:
 * --lx and --ly (px from the sheet's corner), --lit (0 to 1), --rx and --ry
 * (degrees). The sheet carries data-lamp="held" while a person holds the lamp,
 * and data-gl="on" once the paper is drawn.
 */

interface InspectOptions {
  enabled: boolean;
  /** The company: its watermark and fibres are made from its name. */
  seed: string;
  /** Turn the sheet towards the hand that holds it. Off where the sheet carries links to click. */
  tilt: boolean;
  /** Sweep the lamp over the sheet until someone takes it (see Lamp). */
  sweep: boolean;
}

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 });
  else window.setTimeout(fn, 300);
};

const look = () => (token('--uv') === '1' ? 'uv' : 'day');

/** An element's position inside the sheet, from layout, so the sheet's tilt does not disturb it. */
function offsetWithin(el: HTMLElement, root: HTMLElement): [number, number] {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return [x, y];
}

/**
 * Everything the lamp reveals or hides (data-lamp-mask) is masked in CSS by a
 * circle at the lamp, in the element's own coordinates: give each element its
 * offset in the sheet once, and only the lamp's position changes per frame.
 */
function measureMasks(sheet: HTMLElement) {
  sheet.querySelectorAll<HTMLElement>('[data-lamp-mask]').forEach((el) => {
    const [x, y] = offsetWithin(el, sheet);
    el.style.setProperty('--ox', `${x}px`);
    el.style.setProperty('--oy', `${y}px`);
  });
}

export function useInspect(
  sheetRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { enabled, seed, tilt, sweep }: InspectOptions,
) {
  const theme = useTheme();
  const paperRef = useRef<Paper | null>(null);
  const lastRef = useRef<LampState | null>(null);
  const seedRef = useRef(seed);

  useEffect(() => {
    const sheet = sheetRef.current;
    const canvas = canvasRef.current;
    if (!enabled || !sheet || !canvas) return;
    let width = sheet.offsetWidth;
    let height = sheet.offsetHeight;
    let disposed = false;
    let pressed = false;

    const paint = (s: LampState) => {
      lastRef.current = s;
      const style = sheet.style;
      style.setProperty('--lx', `${(s.x * width).toFixed(1)}px`);
      style.setProperty('--ly', `${(s.y * height).toFixed(1)}px`);
      style.setProperty('--lit', s.lit.toFixed(3));
      // The sheet turns only while it is in hand, and its shadow falls away from the side it turns to.
      const turn = tilt ? s.grip : 0;
      style.setProperty('--ry', `${(s.tiltX * 6 * turn).toFixed(2)}deg`);
      style.setProperty('--rx', `${(-s.tiltY * 5 * turn).toFixed(2)}deg`);
      style.setProperty('--sx', `${(-s.tiltX * 14 * turn).toFixed(1)}px`);
      style.setProperty('--sy', `${(22 + s.tiltY * 10 * turn).toFixed(1)}px`);
      const held = s.held ? 'held' : 'free';
      if (sheet.dataset.lamp !== held) sheet.dataset.lamp = held;
      paperRef.current?.render(s);
    };
    // The figure the first paint shows lit (data-rest): the lamp rests there first.
    const resting = sheet.querySelector<HTMLElement>('[data-rest] [data-lamp-mask]');
    let rest: { x: number; y: number } | undefined;
    if (resting && width && height) {
      const [x, y] = offsetWithin(resting, sheet);
      rest = { x: (x + resting.offsetWidth * 0.42) / width, y: (y + resting.offsetHeight / 2) / height };
    }
    const lamp = new Lamp({ reduced: prefersReducedMotion(), sweep, rest, onFrame: paint });

    const at = (e: PointerEvent): [number, number] => {
      const r = sheet.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !pressed) return;
      lamp.point(...at(e));
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pressed = true;
      lamp.point(...at(e));
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') pressed = false;
      lamp.release();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') lamp.release();
    };
    sheet.addEventListener('pointermove', onMove);
    sheet.addEventListener('pointerdown', onDown);
    sheet.addEventListener('pointerup', onUp);
    sheet.addEventListener('pointercancel', onUp);
    sheet.addEventListener('pointerleave', onLeave);

    // The phone's tilt moves the foil, where the browser reports it without asking.
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) lamp.tilt(null, null);
      else lamp.tilt(e.gamma / 25, (e.beta - 40) / 25);
    };
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const listenToTilt = () => window.addEventListener('deviceorientation', onOrient);
    if (coarse) {
      if (tiltNeedsPermission()) window.addEventListener(TILT_GRANTED, listenToTilt);
      else listenToTilt();
    }

    // Work only while the sheet can be seen.
    let inView = false;
    const updateVisible = () => lamp.setVisible(inView && !document.hidden);
    const io = new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView) sheet.dataset.onscreen = '';
      else delete sheet.dataset.onscreen;
      updateVisible();
      startPaper();
    });
    io.observe(sheet);
    document.addEventListener('visibilitychange', updateVisible);

    const measureFoil = () => {
      const paper = paperRef.current;
      const foil = sheet.querySelector<HTMLElement>('[data-foil]');
      if (!paper || !foil) return;
      const s = sheet.getBoundingClientRect();
      const f = foil.getBoundingClientRect();
      paper.setFoil(
        (f.left + f.width / 2 - s.left) / s.width,
        (f.top + f.height / 2 - s.top) / s.height,
        (f.width / s.width) * 0.47,
      );
    };
    const ro = new ResizeObserver(() => {
      width = sheet.offsetWidth;
      height = sheet.offsetHeight;
      paperRef.current?.resize(width, height);
      measureFoil();
      measureMasks(sheet);
      if (lastRef.current) paint(lastRef.current);
    });
    ro.observe(sheet);

    // A lamp resting on a figure stays there a moment before the assistant takes it on.
    lamp.start(rest ? 2600 : 600);

    // The paper is decoration. It is made once the visitor does something (moves the pointer, touches,
    // scrolls, presses a key) while the sheet is in view, when the page is next idle: the first screen
    // never waits for WebGL, and a sheet nobody touches or sees never pays for it (making it can hold a
    // weak GPU's frames for seconds). Until then the lamp still reveals the sources, in CSS.
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    let acted = false;
    let started = false;
    function startPaper() {
      if (started || !acted || !inView) return;
      started = true;
      idle(load);
    }
    const begin = () => {
      events.forEach((type) => window.removeEventListener(type, begin));
      acted = true;
      startPaper();
    };
    events.forEach((type) => window.addEventListener(type, begin, { passive: true }));
    const load = () => {
      // The visitor may have scrolled the sheet away before the page was idle: wait until it is back.
      if (!inView) {
        started = false;
        return;
      }
      void import('./paper').then(({ Paper, wantsPaper }) => {
        if (disposed || !wantsPaper()) return;
        let paper: Paper;
        try {
          paper = new Paper(canvas, seedRef.current, () => {
            delete sheet.dataset.gl;
            paperRef.current = null;
          });
        } catch {
          return;
        }
        paperRef.current = paper;
        paper.setLook(look(), token('--sheet'), token('--sheet'));
        paper.resize(width, height);
        measureFoil();
        paper.render(lastRef.current ?? { x: 0.72, y: 0.7, lit: 0, tiltX: 0, tiltY: 0, held: false, grip: 0 });
        sheet.dataset.gl = 'on';
      });
    };

    return () => {
      disposed = true;
      events.forEach((type) => window.removeEventListener(type, begin));
      lamp.destroy();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', updateVisible);
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener(TILT_GRANTED, listenToTilt);
      sheet.removeEventListener('pointermove', onMove);
      sheet.removeEventListener('pointerdown', onDown);
      sheet.removeEventListener('pointerup', onUp);
      sheet.removeEventListener('pointercancel', onUp);
      sheet.removeEventListener('pointerleave', onLeave);
      paperRef.current?.destroy();
      paperRef.current = null;
      delete sheet.dataset.gl;
    };
  }, [enabled, tilt, sweep, sheetRef, canvasRef]);

  // Daylight or UV follows the theme.
  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    paper.setLook(theme === 'dark' ? 'uv' : 'day', token('--sheet'), token('--sheet'));
    if (lastRef.current) paper.render(lastRef.current);
  }, [theme]);

  // A new company gets its own paper once the typing settles, and its figures are measured again.
  useEffect(() => {
    seedRef.current = seed;
    const sheet = sheetRef.current;
    if (enabled && sheet) measureMasks(sheet);
    const t = window.setTimeout(() => {
      const paper = paperRef.current;
      if (!paper) return;
      paper.setSeed(seed);
      if (lastRef.current) paper.render(lastRef.current);
    }, 280);
    return () => window.clearTimeout(t);
  }, [seed, enabled, sheetRef]);
}
