import { useEffect, useRef, useState } from 'react';
import type { Sounding, ValueGrid } from '../engine/types';
import { useResolvedTheme } from '../lib/theme';
import { drawChart2D, type Bearing, type Draw2DOptions } from './draw2d';
import { readPalette } from './palette';

export interface FlatChartProps {
  grid: ValueGrid;
  field: Float32Array;
  price: number;
  marginOfSafety?: number;
  bearing?: Bearing | null;
  today?: Bearing | null;
  soundings?: Sounding[] | null;
  layers?: Draw2DOptions['layers'];
  axes?: boolean;
  spotSoundings?: boolean;
  className?: string;
  /** Accessible description; the canvas itself is decorative. */
  label: string;
}

/** A static flat chart that redraws on resize and theme change. */
export function FlatChart({
  grid,
  field,
  price,
  marginOfSafety = 0.2,
  bearing = null,
  today = null,
  soundings = null,
  layers,
  axes = false,
  spotSoundings = false,
  className,
  label,
}: FlatChartProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useResolvedTheme();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawChart2D(ctx, {
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
        layers,
        axes,
        spotSoundings,
        padding: axes ? { top: 10, right: 10, bottom: 38, left: 48 } : { top: 1, right: 1, bottom: 1, left: 1 },
        fontScale: 0.9,
      });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [grid, field, price, marginOfSafety, bearing, today, soundings, layers, axes, spotSoundings, theme]);

  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}

/** Render children only once the placeholder scrolls near the viewport. */
export function useNearViewport<T extends Element>(margin = '200px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, near]);
  return [ref, near] as const;
}
