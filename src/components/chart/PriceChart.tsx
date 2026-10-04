import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { computeChange } from '@/domain/change';
import {
  HOLD_MS,
  inspectedKey,
  REST,
  transition,
  type GestureEffect,
  type GestureEvent,
  type GestureState,
  type PointerKind,
} from '@/domain/chartGesture';
import {
  formatClockWithZone,
  formatDayMonth,
  formatMoney,
  formatNumber,
  formatPercent,
  formatWeekdayDate,
  zoneLabel,
} from '@/domain/format';
import {
  lastValidIndex,
  lowerBound,
  nearestValidIndex,
  nearestValidOrdinal,
  niceTicks,
  segments,
  stepValid,
  validCount,
  valueExtent,
  type Sample,
} from '@/domain/series';
import type { Series } from '@/data/types';
import { useAnnouncer } from '@/lib/announcer';
import { haptics } from '@/lib/haptics';
import { useInspection, type InspectionStore } from './inspectionStore';
import styles from './PriceChart.module.css';

interface Geometry {
  width: number;
  height: number;
  plotW: number;
  plotH: number;
  top: number;
  line: string;
  area: string;
  tone: 'positive' | 'negative' | 'neutral';
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  refY: number | null;
  compLine: string | null;
  markerY: number | null;
  single: { x: number; y: number } | null;
  xOf: (index: number) => number;
  yOf: (value: number) => number;
}

const MARGIN_TOP = 12;

export function sampleLabel(sample: Sample, series: Series): string {
  if (series.interval === '1d') return formatWeekdayDate(sample.t, series.timeZone);
  if (series.range === '1W')
    return `${formatWeekdayDate(sample.t, series.timeZone)}, ${formatClockWithZone(sample.t, series.timeZone)}`;
  return formatClockWithZone(sample.t, series.timeZone);
}

export function changeAgainstReference(sample: Sample | null, series: Series) {
  if (!sample || sample.v == null) return null;
  return computeChange(String(sample.v), series.reference.value);
}

interface GeometryExtras {
  comparison: Sample[] | null;
  marker: number | null;
  percent: boolean;
}

function percentTick(value: number, digits: number): string {
  const body = `${formatNumber(Math.abs(value), digits, digits)}%`;
  return value > 0 ? `+${body}` : value < 0 ? `−${body}` : body;
}

function buildGeometry(
  series: Series,
  width: number,
  height: number,
  showAxes: boolean,
  referenceLine: boolean,
  extras: GeometryExtras = { comparison: null, marker: null, percent: false },
): Geometry {
  const right = showAxes ? 44 : 0;
  const bottom = showAxes ? 24 : 0;
  const plotW = Math.max(width - right, 10);
  const plotH = Math.max(height - MARGIN_TOP - bottom, 10);
  const samples = series.samples;
  const reference = series.reference.value == null ? null : Number(series.reference.value);
  const valuesForExtent: Sample[] = [
    ...samples,
    ...(referenceLine && reference != null ? [{ t: 0, v: reference }] : []),
    ...(extras.comparison ?? []),
    ...(extras.marker != null ? [{ t: 0, v: extras.marker }] : []),
  ];
  const extent = valueExtent(valuesForExtent) ?? { min: 0, max: 1 };
  const n = samples.length;
  const window = series.axis === 'time' ? series.window : null;
  const span = window ? Math.max(window.end - window.start, 1) : 1;
  const xOf = (index: number) => {
    if (window) return ((samples[index]!.t - window.start) / span) * plotW;
    return n <= 1 ? plotW / 2 : (index / (n - 1)) * plotW;
  };
  const yOf = (value: number) =>
    MARGIN_TOP + plotH - ((value - extent.min) / (extent.max - extent.min)) * plotH;

  const indexOf = new Map(samples.map((sample, index) => [sample.t, index]));
  const runs = segments(samples);
  const line = runs
    .map((run) =>
      run
        .map(
          (sample, i) =>
            `${i === 0 ? 'M' : 'L'}${xOf(indexOf.get(sample.t)!).toFixed(2)},${yOf(sample.v!).toFixed(2)}`,
        )
        .join(''),
    )
    .join('');
  const area = runs
    .filter((run) => run.length > 1)
    .map((run) => {
      const first = indexOf.get(run[0]!.t)!;
      const last = indexOf.get(run[run.length - 1]!.t)!;
      const body = run
        .map(
          (sample, i) =>
            `${i === 0 ? 'M' : 'L'}${xOf(indexOf.get(sample.t)!).toFixed(2)},${yOf(sample.v!).toFixed(2)}`,
        )
        .join('');
      return `${body}L${xOf(last).toFixed(2)},${MARGIN_TOP + plotH}L${xOf(first).toFixed(2)},${MARGIN_TOP + plotH}Z`;
    })
    .join('');

  let compLine: string | null = null;
  if (extras.comparison && extras.comparison.length > 1) {
    const xFor = (t: number) => {
      if (window) return ((t - window.start) / span) * plotW;
      const index = indexOf.get(t);
      return index == null ? null : xOf(index);
    };
    compLine = segments(extras.comparison)
      .map((run) =>
        run
          .map((sample) => ({ x: xFor(sample.t), y: yOf(sample.v!) }))
          .filter((point): point is { x: number; y: number } => point.x != null)
          .map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
          .join(''),
      )
      .join('');
  }

  const lastIndex = lastValidIndex(samples);
  const lastValue = lastIndex >= 0 ? samples[lastIndex]!.v! : null;
  const base = reference ?? samples.find((sample) => sample.v != null)?.v ?? null;
  const tone =
    lastValue == null || base == null
      ? 'neutral'
      : lastValue > base
        ? 'positive'
        : lastValue < base
          ? 'negative'
          : 'neutral';

  const ticks = niceTicks(extent.min, extent.max, 4).filter(
    (tick) => tick >= extent.min && tick <= extent.max,
  );
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  const yTicks = ticks.map((tick) => ({
    y: yOf(tick),
    label: extras.percent
      ? percentTick(tick, step >= 1 ? 0 : 1)
      : formatNumber(tick, step >= 1 ? 0 : 2, step >= 1 ? 0 : 2),
  }));

  const xTicks: { x: number; label: string }[] = [];
  if (showAxes && n > 1) {
    if (window) {
      const tz = series.timeZone;
      const first = Math.ceil(window.start / (90 * 60_000)) * 90 * 60_000;
      for (let t = first; t <= window.end; t += 90 * 60_000) {
        const x = ((t - window.start) / span) * plotW;
        if (x > 18 && x < plotW - 18)
          xTicks.push({ x, label: formatClockWithZone(t, tz).replace(` ${zoneLabel(t, tz)}`, '') });
      }
    } else {
      const count = Math.min(4, n);
      for (let i = 0; i < count; i += 1) {
        const index = Math.round((i / Math.max(count - 1, 1)) * (n - 1));
        const sample = samples[index]!;
        const label =
          series.range === '1W'
            ? formatWeekdayDate(sample.t, series.timeZone).split(' ')[0]!
            : formatDayMonth(sample.t, series.timeZone);
        xTicks.push({ x: xOf(index), label });
      }
    }
  }

  const valid = validCount(samples);
  const single =
    valid === 1 && lastIndex >= 0 ? { x: xOf(lastIndex), y: yOf(samples[lastIndex]!.v!) } : null;
  return {
    width,
    height,
    plotW,
    plotH,
    top: MARGIN_TOP,
    line,
    area,
    tone,
    yTicks,
    xTicks,
    refY: referenceLine && reference != null ? yOf(reference) : null,
    compLine,
    markerY: extras.marker != null ? yOf(extras.marker) : null,
    single,
    xOf,
    yOf,
  };
}

function findSample(series: Series, key: number | null): { sample: Sample; index: number } | null {
  if (key == null) return null;
  const index = lowerBound(series.samples, key);
  const sample = series.samples[index];
  return sample && sample.t === key && sample.v != null ? { sample, index } : null;
}

export interface PriceChartProps {
  series: Series;
  store: InspectionStore;
  label: string;
  height?: number;
  loading?: boolean;
  loadingLabel?: string;
  showAxes?: boolean;
  referenceLine?: boolean;
  /** Called when a different range commits (to announce and clear pins). */
  onRangeCommitted?: (range: string) => void;
  /** Values are percentages (performance charts) rather than prices. */
  format?: 'money' | 'percent';
  /** A second, dashed line on the same time keys (for example a benchmark). */
  comparison?: { samples: Sample[]; label: string } | null;
  /** Name of the main line when a comparison is shown. */
  primaryLabel?: string;
  /** A horizontal reference level such as the average entry price. */
  marker?: { value: number; label: string } | null;
}

/**
 * The main stock chart (spec pages 21–23, 27, 39).
 * REST shows the latest quote. A short tap pins the nearest real sample; a 180 ms hold or a
 * horizontal drag scrubs; vertical movement yields to page scrolling. Mouse hover inspects and
 * click pins. Left/Right, Home/End, Enter and Escape operate it from the keyboard.
 */
export const PriceChart = memo(function PriceChart({
  series,
  store,
  label,
  height = 240,
  loading = false,
  loadingLabel,
  showAxes = true,
  referenceLine = true,
  format = 'money',
  comparison = null,
  primaryLabel,
  marker = null,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [displayed, setDisplayed] = useState(series);
  const [previous, setPrevious] = useState<{ geometry: Geometry; id: number } | null>(null);
  const queued = useRef<Series | null>(null);
  const gesture = useRef<GestureState>(REST);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedRef = useRef(displayed);
  // Timers and document listeners dispatch through this ref; it always holds the latest dispatcher.
  const dispatchRef = useRef<(event: GestureEvent) => void>(() => undefined);
  useLayoutEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);
  const announcer = useAnnouncer();
  const summaryId = useId();
  const [showTable, setShowTable] = useState(false);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setWidth(Math.round(element.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const percent = format === 'percent';
  const comparisonSamples = comparison?.samples ?? null;
  const markerValue = marker?.value ?? null;
  const geometry = useMemo(
    () =>
      width > 0
        ? buildGeometry(
            displayed,
            width,
            height,
            showAxes,
            referenceLine && (percent || displayed.reference.kind === 'previousClose'),
            {
              comparison: comparisonSamples,
              marker: markerValue,
              percent,
            },
          )
        : null,
    [displayed, width, height, showAxes, referenceLine, percent, comparisonSamples, markerValue],
  );
  const formatValue = useCallback(
    (value: number, current: Series) =>
      percent ? formatPercent(value) : formatMoney(String(value), current.currency),
    [percent],
  );
  const comparisonAt = useCallback(
    (t: number) => {
      if (!comparisonSamples) return null;
      const index = lowerBound(comparisonSamples, t);
      const sample = comparisonSamples[index];
      return sample && sample.t === t ? sample.v : null;
    },
    [comparisonSamples],
  );
  const geometryRef = useRef(geometry);
  useLayoutEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  const describe = useCallback(
    (sample: Sample | null, current: Series) => {
      if (!sample || sample.v == null) {
        const last = current.samples[lastValidIndex(current.samples)];
        return last
          ? `Showing latest: ${formatValue(last.v!, current)} at ${sampleLabel(last, current)}`
          : 'No data';
      }
      const change = percent ? null : changeAgainstReference(sample, current);
      const other = comparison ? comparisonAt(sample.t) : null;
      return `${sampleLabel(sample, current)}: ${primaryLabel ? `${primaryLabel} ` : ''}${formatValue(sample.v, current)}${
        change?.percent ? `, ${formatPercent(change.percent)} ${current.reference.label}` : ''
      }${comparison ? `, ${comparison.label} ${other == null ? 'unavailable' : formatValue(other, current)}` : ''}`;
    },
    [comparison, comparisonAt, formatValue, percent, primaryLabel],
  );

  const scheduleAnnounce = useCallback(
    (sample: Sample | null) => {
      if (announceTimer.current) clearTimeout(announceTimer.current);
      announceTimer.current = setTimeout(
        () => announcer.polite(describe(sample, displayedRef.current)),
        300,
      );
    },
    [announcer, describe],
  );

  const syncStore = useCallback(
    (state: GestureState) => {
      const found = findSample(displayedRef.current, inspectedKey(state));
      if (!found) {
        if (!store.get().fading) store.set({ sample: null, mode: 'rest', fading: false });
        return;
      }
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      store.set({
        sample: found.sample,
        mode: state.mode === 'pinned' ? 'pinned' : 'inspecting',
        fading: false,
      });
    },
    [store],
  );

  const applyQueued = useCallback(() => {
    if (queued.current) {
      const next = queued.current;
      queued.current = null;
      setDisplayed(next);
    }
  }, []);

  const runEffects = useCallback(
    (effects: GestureEffect[], event: GestureEvent) => {
      const element = surfaceRef.current;
      for (const effect of effects) {
        switch (effect) {
          case 'startHold':
            if (holdTimer.current) clearTimeout(holdTimer.current);
            holdTimer.current = setTimeout(
              () => dispatchRef.current({ type: 'hold', t: performance.now() }),
              HOLD_MS,
            );
            break;
          case 'clearHold':
            if (holdTimer.current) clearTimeout(holdTimer.current);
            holdTimer.current = null;
            break;
          case 'capture':
            if (element && 'pointerId' in gesture.current) {
              try {
                element.setPointerCapture(gesture.current.pointerId);
              } catch {
                // The pointer may already be gone.
              }
            }
            break;
          case 'release':
            if (element && 'pointerId' in event && element.hasPointerCapture(event.pointerId)) {
              element.releasePointerCapture(event.pointerId);
            }
            break;
          case 'hapticSelection':
            haptics.selection();
            break;
          case 'fadeOut': {
            const last = store.get().sample;
            store.set({ sample: last, mode: 'rest', fading: true });
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
            fadeTimer.current = setTimeout(() => {
              if (store.get().fading) store.set({ sample: null, mode: 'rest', fading: false });
            }, 120);
            break;
          }
          case 'announce':
            scheduleAnnounce(
              findSample(displayedRef.current, inspectedKey(gesture.current))?.sample ?? null,
            );
            break;
        }
      }
    },
    [scheduleAnnounce, store],
  );

  const dispatch = useCallback(
    (event: GestureEvent) => {
      const before = gesture.current.mode;
      const { state, effects } = transition(gesture.current, event);
      gesture.current = state;
      runEffects(effects, event);
      if (event.type === 'move' && state.mode === 'scrubbing') {
        // Update crosshair, marker, labels and quote together on the next frame.
        if (frame.current == null) {
          frame.current = requestAnimationFrame(() => {
            frame.current = null;
            syncStore(gesture.current);
          });
        }
      } else if (!effects.includes('fadeOut')) {
        syncStore(state);
      }
      const active = state.mode === 'pending' || state.mode === 'scrubbing';
      if (!active && (before === 'pending' || before === 'scrubbing')) applyQueued();
    },
    [applyQueued, runEffects, syncStore],
  );
  useLayoutEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  // Incoming data during an active gesture is queued so the selected time never moves under the finger.
  useEffect(() => {
    const active = gesture.current.mode === 'pending' || gesture.current.mode === 'scrubbing';
    if (active) {
      queued.current = series;
      return;
    }
    setDisplayed(series);
  }, [series]);

  // Range changes crossfade (180 ms) and clear a pin; a pin missing from new data is cleared.
  const previousGeometry = useRef<Geometry | null>(null);
  const lastRange = useRef(displayed.range);
  useEffect(() => {
    if (displayed.range !== lastRange.current) {
      if (geometryRef.current && previousGeometry.current)
        setPrevious({ geometry: previousGeometry.current, id: Date.now() });
      lastRange.current = displayed.range;
      if (gesture.current.mode !== 'rest') {
        dispatch({ type: 'reset' });
        announcer.polite(`Range changed to ${displayed.range}. Selection cleared.`);
      }
      store.set({ sample: null, mode: 'rest', fading: false });
      return;
    }
    const key = inspectedKey(gesture.current);
    if (key != null && !findSample(displayed, key)) {
      dispatch({ type: 'reset' });
      announcer.polite('The selected point is no longer in this range. Selection cleared.');
    } else {
      syncStore(gesture.current);
    }
  }, [displayed, dispatch, announcer, store, syncStore]);

  useEffect(() => {
    previousGeometry.current = geometry;
  }, [geometry]);
  useEffect(() => {
    if (!previous) return;
    const timer = setTimeout(() => setPrevious(null), 200);
    return () => clearTimeout(timer);
  }, [previous]);

  // Prevent page scroll only while actively scrubbing (after a hold or horizontal drag).
  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const onTouchMove = (event: TouchEvent) => {
      if (gesture.current.mode === 'scrubbing' && event.cancelable) event.preventDefault();
    };
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => element.removeEventListener('touchmove', onTouchMove);
  }, []);

  // Tap outside clears a pin.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (gesture.current.mode !== 'pinned') return;
      if (containerRef.current?.contains(event.target as Node)) return;
      dispatchRef.current({ type: 'outside' });
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (frame.current) cancelAnimationFrame(frame.current);
      if (announceTimer.current) clearTimeout(announceTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      store.set({ sample: null, mode: 'rest', fading: false });
    },
    [store],
  );

  const keyAt = useCallback((clientX: number): number | null => {
    const element = surfaceRef.current;
    const geo = geometryRef.current;
    const current = displayedRef.current;
    if (!element || !geo || current.samples.length === 0) return null;
    const rect = element.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), geo.plotW);
    let index: number;
    if (current.axis === 'time' && current.window) {
      const t =
        current.window.start + (x / geo.plotW) * (current.window.end - current.window.start);
      index = nearestValidIndex(current.samples, t);
    } else {
      index = nearestValidOrdinal(current.samples, (x / geo.plotW) * (current.samples.length - 1));
    }
    return index >= 0 ? current.samples[index]!.t : null;
  }, []);

  const pointerKind = (type: string): PointerKind =>
    type === 'mouse' ? 'mouse' : type === 'pen' ? 'pen' : 'touch';

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dispatch({
      type: 'down',
      pointerId: event.pointerId,
      kind: pointerKind(event.pointerType),
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: performance.now(),
      key: keyAt(event.clientX),
      button: event.button,
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dispatch({
      type: 'move',
      pointerId: event.pointerId,
      kind: pointerKind(event.pointerType),
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: performance.now(),
      key: keyAt(event.clientX),
      buttons: event.buttons,
    });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dispatch({
      type: 'up',
      pointerId: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: performance.now(),
      key: keyAt(event.clientX),
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = displayedRef.current;
    const selected = findSample(current, store.get().sample?.t ?? null);
    const from = selected?.index ?? -1;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = from < 0 ? lastValidIndex(current.samples) : stepValid(current.samples, from, -1);
        break;
      case 'ArrowRight':
        next = from < 0 ? lastValidIndex(current.samples) : stepValid(current.samples, from, 1);
        break;
      case 'Home':
        next = stepValid(current.samples, -1, 1);
        break;
      case 'End':
        next = lastValidIndex(current.samples);
        break;
      case 'Enter':
      case ' ':
        if (selected) {
          event.preventDefault();
          dispatch({ type: 'select', key: selected.sample.t });
        }
        return;
      case 'Escape':
        if (gesture.current.mode !== 'rest') {
          event.preventDefault();
          dispatch({ type: 'escape' });
          dispatch({ type: 'leave', kind: 'mouse' });
        }
        return;
      default:
        return;
    }
    if (next < 0) return;
    event.preventDefault();
    const key = current.samples[next]!.t;
    // Keyboard inspection behaves like hover: temporary until Enter pins it.
    dispatch({
      type: 'move',
      pointerId: -1,
      kind: 'mouse',
      x: 0,
      y: 0,
      t: performance.now(),
      key,
      buttons: 0,
    });
  };

  const valid = validCount(displayed.samples);
  const lastIndex = lastValidIndex(displayed.samples);
  const lastSample = lastIndex >= 0 ? displayed.samples[lastIndex]! : null;
  const firstSample = displayed.samples.find((sample) => sample.v != null) ?? null;
  const summary = useMemo(() => {
    if (!lastSample || !firstSample) return 'No price data is available for this range.';
    let high = -Infinity;
    let low = Infinity;
    for (const sample of displayed.samples) {
      if (sample.v == null) continue;
      high = Math.max(high, sample.v);
      low = Math.min(low, sample.v);
    }
    const change = percent
      ? { percent: null }
      : computeChange(String(lastSample.v), displayed.reference.value);
    const other = comparison ? comparisonAt(lastSample.t) : null;
    return `${displayed.range} range from ${sampleLabel(firstSample, displayed)} to ${sampleLabel(lastSample, displayed)}. Latest ${
      primaryLabel ? `${primaryLabel} ` : ''
    }${formatValue(lastSample.v!, displayed)}${change.percent ? `, ${formatPercent(change.percent)} ${displayed.reference.label}` : ''}${
      comparison
        ? `, ${comparison.label} ${other == null ? 'unavailable' : formatValue(other, displayed)}`
        : ''
    }. High ${formatValue(high, displayed)}, low ${formatValue(low, displayed)}.${marker ? ` ${marker.label}.` : ''}`;
  }, [
    displayed,
    firstSample,
    lastSample,
    percent,
    comparison,
    comparisonAt,
    formatValue,
    primaryLabel,
    marker,
  ]);

  const stroke = geometry
    ? `var(--${geometry.tone === 'neutral' ? 'chart-neutral' : geometry.tone})`
    : 'var(--chart-neutral)';
  const areaFill =
    geometry?.tone === 'negative'
      ? 'var(--negative-area)'
      : geometry?.tone === 'positive'
        ? 'var(--positive-area)'
        : 'transparent';

  return (
    <figure className={styles.figure} aria-label={label}>
      <div ref={containerRef} className={styles.container} style={{ height }}>
        {geometry && valid > 0 && (
          <svg
            className={styles.svg}
            width={geometry.width}
            height={geometry.height}
            aria-hidden
            focusable="false"
          >
            <defs>
              <linearGradient id={`${summaryId}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={areaFill} stopOpacity={1} />
                <stop offset="100%" stopColor={areaFill} stopOpacity={0} />
              </linearGradient>
            </defs>
            {geometry.yTicks.map((tick) => (
              <g key={tick.label}>
                <line x1={0} x2={geometry.plotW} y1={tick.y} y2={tick.y} className={styles.grid} />
                {showAxes && (
                  <text
                    x={geometry.plotW + 8}
                    y={tick.y}
                    className={styles.axisLabel}
                    dominantBaseline="middle"
                  >
                    {tick.label}
                  </text>
                )}
              </g>
            ))}
            {geometry.xTicks.map((tick) => (
              <text
                key={`${tick.x}-${tick.label}`}
                x={tick.x}
                y={geometry.height - 6}
                className={styles.axisLabel}
                textAnchor={tick.x < 24 ? 'start' : tick.x > geometry.plotW - 24 ? 'end' : 'middle'}
              >
                {tick.label}
              </text>
            ))}
            {geometry.refY != null && (
              <line
                x1={0}
                x2={geometry.plotW}
                y1={geometry.refY}
                y2={geometry.refY}
                className={styles.reference}
              />
            )}
            {geometry.markerY != null && marker && (
              <line
                x1={0}
                x2={geometry.plotW}
                y1={geometry.markerY}
                y2={geometry.markerY}
                className={styles.markerLine}
              />
            )}
            {geometry.compLine && (
              <path d={geometry.compLine} className={styles.comparison} fill="none" />
            )}
            {previous && (
              <g className={styles.fadeOutGroup} key={previous.id}>
                <path d={previous.geometry.area} fill={areaFill} opacity={0.6} />
                <path d={previous.geometry.line} fill="none" stroke={stroke} strokeWidth={1.75} />
              </g>
            )}
            <g
              className={previous ? styles.fadeInGroup : undefined}
              key={`${displayed.range}-${displayed.instrumentId}`}
            >
              <path d={geometry.area} fill={`url(#${summaryId}-fill)`} />
              <path
                d={geometry.line}
                fill="none"
                stroke={stroke}
                strokeWidth={1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {geometry.single && (
                <circle cx={geometry.single.x} cy={geometry.single.y} r={4} fill={stroke} />
              )}
            </g>
            {/* The marker label sits above the series, its halo keeping it legible where they cross. */}
            {geometry.markerY != null && marker && (
              <text
                x={geometry.plotW - 6}
                y={geometry.markerY - 6}
                className={styles.markerLabel}
                textAnchor="end"
              >
                {marker.label}
              </text>
            )}
          </svg>
        )}
        {width > 0 && valid === 0 && (
          <div className={styles.unavailable} role="note">
            No price data is available for this range.
          </div>
        )}
        {geometry && valid === 1 && lastSample && (
          <div className={styles.singleNote}>
            Only one observation: {sampleLabel(lastSample, displayed)}
          </div>
        )}
        {geometry && (
          <ChartOverlay
            store={store}
            series={displayed}
            geometry={geometry}
            formatValue={formatValue}
            percent={percent}
            primaryLabel={primaryLabel}
            comparison={comparison ? { label: comparison.label, at: comparisonAt } : null}
          />
        )}
        <ChartSurface
          surfaceRef={surfaceRef}
          store={store}
          series={displayed}
          width={geometry?.plotW}
          label={label}
          summaryId={summaryId}
          describe={describe}
          handlers={{
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: (event) => dispatch({ type: 'cancel', pointerId: event.pointerId }),
            onPointerLeave: (event) => {
              if (event.pointerType === 'mouse') dispatch({ type: 'leave', kind: 'mouse' });
            },
            onLostPointerCapture: (event) => {
              if (gesture.current.mode === 'scrubbing')
                dispatch({ type: 'cancel', pointerId: event.pointerId });
            },
            onKeyDown,
            onBlur: () => {
              if (gesture.current.mode === 'hover') dispatch({ type: 'leave', kind: 'mouse' });
            },
            onContextMenu: (event) => event.preventDefault(),
          }}
        />
        {loading && <span className={styles.loading}>{loadingLabel ?? 'Loading…'}</span>}
      </div>
      <p id={summaryId} className="visually-hidden">
        {summary}
      </p>
      <div className={styles.tableToggle}>
        <button
          type="button"
          className={styles.tableButton}
          aria-expanded={showTable}
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
      </div>
      {comparison && primaryLabel && (
        <div className={styles.legend} aria-hidden>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: stroke }} />
            {primaryLabel}
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDash} />
            {comparison.label}
          </span>
        </div>
      )}
      {showTable && (
        <ChartTable
          series={displayed}
          formatValue={formatValue}
          percent={percent}
          comparison={comparison ? { label: comparison.label, at: comparisonAt } : null}
          primaryLabel={primaryLabel}
        />
      )}
    </figure>
  );
});

interface SurfaceHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onBlur: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * The focusable interaction layer. As a slider its value text follows keyboard inspection, so
 * screen readers hear each step; pointer scrubbing is announced separately after a pause.
 */
function ChartSurface({
  surfaceRef,
  store,
  series,
  width,
  label,
  summaryId,
  describe,
  handlers,
}: {
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  store: InspectionStore;
  series: Series;
  width: number | undefined;
  label: string;
  summaryId: string;
  describe: (sample: Sample | null, series: Series) => string;
  handlers: SurfaceHandlers;
}) {
  const state = useInspection(store);
  const found = state.sample ? findSample(series, state.sample.t) : null;
  const lastIndex = lastValidIndex(series.samples);
  return (
    <div
      ref={surfaceRef}
      className={styles.surface}
      style={width ? { width } : undefined}
      tabIndex={0}
      role="slider"
      aria-label={`${label}. Use left and right arrows to inspect, Enter to pin, Escape to clear.`}
      aria-describedby={summaryId}
      aria-valuemin={0}
      aria-valuemax={Math.max(series.samples.length - 1, 0)}
      aria-valuenow={found ? found.index : Math.max(lastIndex, 0)}
      aria-valuetext={describe(found?.sample ?? null, series)}
      {...handlers}
    />
  );
}

interface ComparisonLookup {
  label: string;
  at: (t: number) => number | null;
}

function ChartOverlay({
  store,
  series,
  geometry,
  formatValue,
  percent,
  primaryLabel,
  comparison,
}: {
  store: InspectionStore;
  series: Series;
  geometry: Geometry;
  formatValue: (value: number, series: Series) => string;
  percent: boolean;
  primaryLabel?: string;
  comparison: ComparisonLookup | null;
}) {
  const state = useInspection(store);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ w: 150, h: 52 });
  const found = state.sample ? findSample(series, state.sample.t) : null;

  const visible = found != null;
  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setTooltipSize((current) =>
        Math.abs(rect.width - current.w) > 1 || Math.abs(rect.height - current.h) > 1
          ? { w: rect.width, h: rect.height }
          : current,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  if (!found) return null;
  const { sample, index } = found;
  const x = geometry.xOf(index);
  const y = geometry.yOf(sample.v!);
  const hairline = 1 / (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const change = percent ? null : changeAgainstReference(sample, series);
  const other = comparison ? comparison.at(sample.t) : null;
  // Tooltip: at least 24 px above the point, clamped 8 px inside, flipped below if it would cover it.
  const inset = 8;
  let left = x - tooltipSize.w / 2;
  left = Math.min(Math.max(left, inset), geometry.width - tooltipSize.w - inset);
  let top = y - 24 - tooltipSize.h;
  if (top < inset) top = Math.min(y + 24, geometry.height - tooltipSize.h - inset);

  return (
    <div className={styles.overlay} data-fading={state.fading} aria-hidden>
      <div
        className={styles.crosshair}
        style={{
          transform: `translateX(${x}px)`,
          width: hairline,
          top: geometry.top,
          height: geometry.plotH,
        }}
      />
      <div className={styles.halo} style={{ transform: `translate(${x - 9}px, ${y - 9}px)` }} />
      <div className={styles.marker} style={{ transform: `translate(${x - 3}px, ${y - 3}px)` }} />
      <div
        ref={tooltipRef}
        className={styles.tooltip}
        style={{ transform: `translate(${left}px, ${top}px)` }}
      >
        <span className={styles.tooltipPrice}>
          {primaryLabel && comparison ? (
            <span className={styles.tooltipKey}>{primaryLabel} </span>
          ) : null}
          {formatValue(sample.v!, series)}
        </span>
        {comparison && (
          <span className={styles.tooltipMeta}>
            {comparison.label} {other == null ? '—' : formatValue(other, series)}
          </span>
        )}
        <span className={styles.tooltipMeta}>
          {sampleLabel(sample, series)}
          {series.status === 'demo' ? ' / sample' : ''}
        </span>
        {change?.percent && (
          <span className={styles.tooltipMeta}>
            {formatPercent(change.percent)} {series.reference.label}
          </span>
        )}
      </div>
    </div>
  );
}

function ChartTable({
  series,
  formatValue,
  percent,
  comparison,
  primaryLabel,
}: {
  series: Series;
  formatValue: (value: number, series: Series) => string;
  percent: boolean;
  comparison: ComparisonLookup | null;
  primaryLabel?: string;
}) {
  const rows = series.samples.filter((sample) => sample.v != null);
  return (
    <div
      className={styles.tableWrap}
      tabIndex={0}
      role="region"
      aria-label={`${series.range} price data table`}
    >
      <table className={styles.table}>
        <caption className="visually-hidden">
          {percent
            ? `Returns in percent, ${series.reference.label}`
            : `Prices in ${series.currency}, ${series.reference.label}`}
          . {series.source}.
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">{percent ? (primaryLabel ?? 'Return') : 'Price'}</th>
            <th scope="col">{comparison ? comparison.label : 'Change'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sample) => {
            const change = percent ? null : changeAgainstReference(sample, series);
            const other = comparison ? comparison.at(sample.t) : null;
            return (
              <tr key={sample.t}>
                <th scope="row">{sampleLabel(sample, series)}</th>
                <td>{formatValue(sample.v!, series)}</td>
                <td>
                  {comparison
                    ? other == null
                      ? '—'
                      : formatValue(other, series)
                    : formatPercent(change?.percent ?? null)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
