import { memo, useMemo } from 'react';
import { segments, valueExtent, type Sample } from '@/domain/series';

/**
 * Decorative row sparkline (aria-hidden): the adjacent numeric change carries the meaning.
 * Gaps break the line; nothing is interpolated.
 */
export const Sparkline = memo(function Sparkline({
  samples,
  reference,
  width = 72,
  height = 28,
  area = true,
  window,
  fluid = false,
}: {
  samples: readonly Sample[];
  reference?: number | null;
  width?: number;
  height?: number;
  area?: boolean;
  window?: { start: number; end: number } | null;
  /** Stretch to the container width (the drawing keeps its proportions vertically). */
  fluid?: boolean;
}) {
  const geometry = useMemo(() => {
    const valid = samples.filter((sample) => sample.v != null);
    if (valid.length < 2) return null;
    const extent = valueExtent(samples, 0.12)!;
    const t0 = window?.start ?? samples[0]!.t;
    const t1 = window?.end ?? samples[samples.length - 1]!.t;
    const span = Math.max(t1 - t0, 1);
    const x = (t: number) => ((t - t0) / span) * width;
    const y = (v: number) =>
      height - ((v - extent.min) / (extent.max - extent.min)) * (height - 2) - 1;
    const runs = segments(samples);
    const line = runs
      .map((run) =>
        run
          .map(
            (sample, i) =>
              `${i === 0 ? 'M' : 'L'}${x(sample.t).toFixed(1)},${y(sample.v!).toFixed(1)}`,
          )
          .join(''),
      )
      .join('');
    const fill = runs
      .map((run) => {
        const first = run[0]!;
        const last = run[run.length - 1]!;
        return `${run.map((sample, i) => `${i === 0 ? 'M' : 'L'}${x(sample.t).toFixed(1)},${y(sample.v!).toFixed(1)}`).join('')}L${x(last.t).toFixed(1)},${height}L${x(first.t).toFixed(1)},${height}Z`;
      })
      .join('');
    const lastValue = valid[valid.length - 1]!.v!;
    const base = reference ?? valid[0]!.v!;
    const tone = lastValue > base ? 'positive' : lastValue < base ? 'negative' : 'neutral';
    return { line, fill, tone };
  }, [samples, reference, width, height, window]);

  if (!geometry) return <svg width={fluid ? '100%' : width} height={height} aria-hidden />;
  const stroke =
    geometry.tone === 'positive'
      ? 'var(--positive)'
      : geometry.tone === 'negative'
        ? 'var(--negative)'
        : 'var(--chart-neutral)';
  const fill =
    geometry.tone === 'positive'
      ? 'var(--positive-area)'
      : geometry.tone === 'negative'
        ? 'var(--negative-area)'
        : 'transparent';
  return (
    <svg
      width={fluid ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? 'none' : undefined}
      aria-hidden
      focusable="false"
      style={{ overflow: 'visible', display: 'block' }}
    >
      {area && <path d={geometry.fill} fill={fill} />}
      <path
        d={geometry.line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});
