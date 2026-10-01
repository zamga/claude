import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Sounding, ValueGrid } from '../engine/types';
import { formatPct, formatPrice, formatSignedPct } from '../engine/format';
import { useCoarsePointer, usePrefersReducedMotion, canRender3D } from '../lib/device';
import { useResolvedTheme } from '../lib/theme';
import { drawChart2D, type Bearing, type PlotFrame } from './draw2d';
import { readPalette } from './palette';
import type { ProjectedLabel, StagePoint, TerrainStage } from './terrain/TerrainStage';
import styles from './ChartStage.module.css';

export type ChartMode = '3d' | '2d';

export interface ChartStageProps {
  grid: ValueGrid;
  field: Float32Array;
  price: number;
  marginOfSafety: number;
  bearing: Bearing | null;
  today?: Bearing | null;
  soundings?: Sounding[] | null;
  mode: ChartMode;
  /** Changes when the company changes; the terrain cross-fades. */
  subject: string;
  /** Hero: ambient sway, no editing. */
  ambient?: boolean;
  /** Move the 3D picture within its frame (fractions; positive is up and left). */
  shift?: { x: number; y: number };
  onBearing?: (growth: number, margin: number, phase: 'start' | 'move' | 'end') => void;
  label: string;
  summary: string;
  className?: string;
  /** Called once the 3D stage is ready (or definitely unavailable). */
  onReady?: (api: { home: () => void; topDown: () => void; snapshot: () => string } | null) => void;
}

const STEP = 0.005;

/**
 * The chart. Draws the flat Admiralty-style chart immediately (it is also
 * the fallback and the reduced-motion view), then, if asked for 3D and the
 * device can afford it, lifts the same chart into relief.
 */
export function ChartStage(props: ChartStageProps) {
  const {
    grid,
    field,
    price,
    marginOfSafety,
    bearing,
    today = null,
    soundings = null,
    mode,
    subject,
    ambient = false,
    shift,
    onBearing,
    label,
    summary,
    className,
    onReady,
  } = props;
  const reduced = usePrefersReducedMotion();
  const coarse = useCoarsePointer();
  const theme = useResolvedTheme();
  const summaryId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<TerrainStage | null>(null);
  const frameRef = useRef<PlotFrame | null>(null);
  const subjectRef = useRef(subject);
  const draggingRef = useRef(false);
  const [capable] = useState(() => canRender3D());
  const [webgl, setWebgl] = useState<'idle' | 'ready' | 'failed'>('idle');
  const want3d = mode === '3d' && capable && webgl !== 'failed';
  const show3d = want3d && webgl === 'ready';

  // Latest props for the imperative stage callbacks.
  const live = useRef({ onBearing, price, bearing });
  useEffect(() => {
    live.current = { onBearing, price, bearing };
  });

  /* ------------------------------------------------------------- 2D chart */

  const draw2d = useCallback(() => {
    const canvas = canvas2dRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 2 || h < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const compact = w < 520;
    frameRef.current = drawChart2D(ctx, {
      width: w,
      height: h,
      dpr,
      grid,
      field,
      price,
      palette: readPalette(),
      marginOfSafety,
      bearing,
      today,
      soundings,
      axes: true,
      spotSoundings: !compact,
      padding: { top: 14, right: 14, bottom: compact ? 40 : 44, left: compact ? 48 : 56 },
      fontScale: compact ? 0.92 : 1,
    });
  }, [grid, field, price, marginOfSafety, bearing, today, soundings]);

  useEffect(() => {
    if (show3d) return;
    let raf = requestAnimationFrame(draw2d);
    const host = hostRef.current;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw2d);
    });
    if (host) ro.observe(host);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [draw2d, show3d, theme]);

  /* --------------------------------------------------------- overlay DOM */

  // Overlays are written straight to the DOM: they move every frame while the
  // camera turns, and React state would re-render the stage sixty times a second.
  const showTip = (p: StagePoint | null) =>
    renderTip(tipRef.current, hostRef.current, draggingRef.current ? null : p, live.current.price);
  const placeLabels = (labels: ProjectedLabel[]) =>
    renderLabels(labelsRef.current, labels, live.current.price, live.current.bearing);

  /* ------------------------------------------------------------- 3D stage */

  useEffect(() => {
    if (mode !== '3d' || stageRef.current) return;
    if (!capable) {
      onReady?.(null);
      return;
    }
    let cancelled = false;
    import('./terrain/TerrainStage')
      .then(({ TerrainStage }) => {
        const canvas = canvas3dRef.current;
        if (cancelled || !canvas) return;
        try {
          const stage = new TerrainStage({
            canvas,
            palette: readPalette(),
            reducedMotion: reduced,
            ambient,
            fit: ambient ? (coarse ? 0.8 : 1.04) : coarse ? 0.8 : 0.86,
            shift,
            touch: coarse,
            onHover: (p) => showTip(p),
            onBearing: ambient
              ? undefined
              : (g, m, phase) => {
                  draggingRef.current = phase !== 'end';
                  live.current.onBearing?.(g, m, phase);
                },
            onProject: placeLabels,
            onContextLost: () => {
              stageRef.current?.dispose();
              stageRef.current = null;
              setWebgl('failed');
            },
          });
          stageRef.current = stage;
          setWebgl('ready');
          onReady?.({ home: () => stage.home(), topDown: () => stage.topDown(), snapshot: () => stage.snapshot() });
        } catch {
          setWebgl('failed');
          onReady?.(null);
        }
      })
      .catch(() => {
        if (!cancelled) setWebgl('failed');
      });
    return () => {
      cancelled = true;
    };
    // The stage is created once per mount; later prop changes flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(
    () => () => {
      stageRef.current?.dispose();
      stageRef.current = null;
    },
    [],
  );

  const firstTerrain = useRef(true);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || webgl !== 'ready') return;
    const companyChanged = subjectRef.current !== subject;
    subjectRef.current = subject;
    stage.setTerrain(grid, price, { morph: companyChanged, rebase: companyChanged || firstTerrain.current });
    if (firstTerrain.current) {
      firstTerrain.current = false;
      stage.rise();
    }
    // Price moves are animated separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, subject, webgl]);

  useEffect(() => {
    if (webgl === 'ready') stageRef.current?.setPrice(price);
  }, [price, webgl]);

  useEffect(() => {
    if (webgl === 'ready') stageRef.current?.setMarginOfSafety(marginOfSafety);
  }, [marginOfSafety, webgl]);

  useEffect(() => {
    if (webgl === 'ready') stageRef.current?.setBearing(bearing);
  }, [bearing, webgl]);

  useEffect(() => {
    if (webgl === 'ready') stageRef.current?.setToday(today);
  }, [today, webgl]);

  useEffect(() => {
    if (webgl === 'ready') stageRef.current?.setSoundings(soundings, price);
  }, [soundings, price, webgl, grid]);

  useEffect(() => {
    if (webgl === 'ready') stageRef.current?.setPalette(readPalette());
  }, [theme, webgl]);

  /* ------------------------------------------------- 2D pointer + keys */

  const pick2d = (ev: PointerEvent<HTMLCanvasElement>) => {
    const f = frameRef.current;
    if (!f) return null;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h) return null;
    return { growth: f.fromX(x), margin: f.fromY(y), x, y };
  };

  const elevationAt2d = (g: number, m: number) => {
    const { nx, ny, extent: e } = grid;
    const fx = Math.min(nx - 1, Math.max(0, ((g - e.growthMin) / (e.growthMax - e.growthMin)) * (nx - 1)));
    const fy = Math.min(ny - 1, Math.max(0, ((m - e.marginMin) / (e.marginMax - e.marginMin)) * (ny - 1)));
    const i = Math.min(nx - 2, Math.floor(fx));
    const j = Math.min(ny - 2, Math.floor(fy));
    const tx = fx - i;
    const ty = fy - j;
    const a = field[j * nx + i]!;
    const b = field[j * nx + i + 1]!;
    const c = field[(j + 1) * nx + i]!;
    const d = field[(j + 1) * nx + i + 1]!;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  const nearBearing2d = (x: number, y: number) => {
    const f = frameRef.current;
    if (!f || !bearing) return false;
    return Math.hypot(f.toX(bearing.growth) - x, f.toY(bearing.margin) - y) < 18;
  };

  const onPointerDown2d = (ev: PointerEvent<HTMLCanvasElement>) => {
    if (!onBearing || ambient) return;
    const p = pick2d(ev);
    if (!p) return;
    draggingRef.current = true;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    if (!nearBearing2d(p.x, p.y)) onBearing(p.growth, p.margin, 'move');
    else onBearing(p.growth, p.margin, 'start');
  };

  const onPointerMove2d = (ev: PointerEvent<HTMLCanvasElement>) => {
    const p = pick2d(ev);
    if (draggingRef.current && p && onBearing) {
      onBearing(p.growth, p.margin, 'move');
      return;
    }
    if (ev.pointerType === 'touch') return;
    ev.currentTarget.style.cursor = p && onBearing && !ambient ? (nearBearing2d(p.x, p.y) ? 'grab' : 'crosshair') : '';
    showTip(p ? { growth: p.growth, margin: p.margin, elevation: elevationAt2d(p.growth, p.margin), screen: p } : null);
  };

  const onPointerUp2d = (ev: PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const p = pick2d(ev);
    if (p && onBearing) onBearing(p.growth, p.margin, 'end');
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (!onBearing || !bearing || ambient) return;
    const step = ev.shiftKey ? STEP * 5 : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const mv = moves[ev.key];
    if (!mv) return;
    ev.preventDefault();
    onBearing(bearing.growth + mv[0], bearing.margin + mv[1], 'end');
  };

  return (
    // The chart is a focusable two-dimensional control: arrow keys move the bearing.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={hostRef}
      className={`${styles.stage} ${className ?? ''}`}
      role="group"
      aria-roledescription="chart"
      aria-label={label}
      aria-describedby={summaryId}
      tabIndex={onBearing && !ambient ? 0 : -1}
      onKeyDown={onKeyDown}
      data-mode={show3d ? '3d' : '2d'}
    >
      <canvas
        ref={canvas2dRef}
        className={styles.flat}
        data-hidden={show3d ? 'true' : 'false'}
        onPointerDown={onPointerDown2d}
        onPointerMove={onPointerMove2d}
        onPointerUp={onPointerUp2d}
        onPointerCancel={onPointerUp2d}
        onPointerLeave={() => !draggingRef.current && showTip(null)}
        aria-hidden="true"
      />
      {want3d && (
        <canvas ref={canvas3dRef} className={styles.relief} data-visible={show3d ? 'true' : 'false'} aria-hidden="true" />
      )}
      <div ref={labelsRef} className={styles.labels} data-visible={show3d ? 'true' : 'false'} aria-hidden="true" />
      <div ref={tipRef} className={styles.tip} hidden aria-hidden="true" />
      <p id={summaryId} className="visually-hidden">
        {summary}
        {onBearing && !ambient ? ' Use the arrow keys to move your bearing; hold Shift for bigger steps.' : ''}
      </p>
    </div>
  );
}

function renderTip(tip: HTMLDivElement | null, host: HTMLDivElement | null, p: StagePoint | null, price: number) {
  if (!tip || !host) return;
  if (!p) {
    tip.hidden = true;
    return;
  }
  const value = price * Math.exp(p.elevation);
  tip.hidden = false;
  tip.dataset.land = p.elevation >= 0 ? 'true' : 'false';
  tip.replaceChildren(
    span(styles.tipCoord, `${formatPct(p.growth, 1)} growth · ${formatPct(p.margin, 1)} margin`),
    span(styles.tipValue, formatPrice(value)),
    span(styles.tipDelta, `${formatSignedPct(Math.exp(p.elevation) - 1, 0)} vs price`),
  );
  const x = Math.min(p.screen.x + 16, host.clientWidth - tip.offsetWidth - 8);
  const y = Math.max(8, p.screen.y - tip.offsetHeight - 14);
  tip.style.transform = `translate(${x}px, ${y}px)`;
}

function span(className: string | undefined, text: string) {
  const el = document.createElement('span');
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function renderLabels(root: HTMLDivElement | null, labels: ProjectedLabel[], price: number, bearing: Bearing | null) {
  if (!root) return;
  const seen = new Set<string>();
  for (const l of labels) {
    seen.add(l.id);
    let el = root.querySelector<HTMLElement>(`[data-id="${CSS.escape(l.id)}"]`);
    if (!el) {
      el = document.createElement('span');
      el.dataset.id = l.id;
      el.className = labelClass(l.id);
      root.appendChild(el);
    }
    const text = labelText(l.id, price, bearing);
    if (el.textContent !== text) el.textContent = text;
    el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
    el.hidden = !l.visible;
  }
  root.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
    if (!seen.has(el.dataset.id!)) el.remove();
  });
}

function labelClass(id: string): string {
  if (id.startsWith('g:')) return `${styles.tick} ${styles.tickGrowth ?? ''}`;
  if (id.startsWith('m:')) return `${styles.tick} ${styles.tickMargin}`;
  if (id.startsWith('d:')) return id === 'd:0' ? `${styles.draft} ${styles.draftSea}` : (styles.draft ?? '');
  return styles.bearingLabel ?? '';
}

function labelText(id: string, price: number, bearing?: Bearing | null) {
  if (id.startsWith('g:') || id.startsWith('m:')) return formatPct(Number(id.slice(2)), 0);
  if (id.startsWith('d:')) {
    const level = Number(id.slice(2));
    return level === 0 ? `${formatPrice(price)} sea level` : formatPrice(price * Math.exp(level));
  }
  if (id === 'bearing' && bearing) return 'Your bearing';
  return '';
}
