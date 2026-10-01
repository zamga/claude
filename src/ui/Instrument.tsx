import { useId, useState, type ReactNode } from 'react';
import styles from './Instrument.module.css';

export type Unit = 'pct' | 'x' | 'years' | 'usd';

interface Marker {
  value: number;
  label: string;
  /** Market-implied markers are drawn in water blue, italic. */
  kind: 'today' | 'market';
}

export interface InstrumentProps {
  label: string;
  hint?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** In display units (percentage points for 'pct'). */
  step: number;
  unit: Unit;
  markers?: Marker[];
  disabled?: boolean;
}

const toDisplay = (v: number, unit: Unit) => (unit === 'pct' ? v * 100 : v);
const fromDisplay = (v: number, unit: Unit) => (unit === 'pct' ? v / 100 : v);
const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

function spoken(v: number, unit: Unit, d: number) {
  const n = v.toFixed(d);
  if (unit === 'pct') return `${n} percent`;
  if (unit === 'x') return `${n} times`;
  if (unit === 'years') return `${n} years`;
  return `${n} dollars`;
}

const SUFFIX: Record<Unit, string> = { pct: '%', x: '×', years: 'yrs', usd: '' };

/**
 * One assumption: a labelled slider, an exact-entry field and markers for
 * where the company is today and what the market price implies. The thumb
 * is a small Plimsoll mark.
 */
export function Instrument({ label, hint, value, onChange, min, max, step, unit, markers = [], disabled }: InstrumentProps) {
  const id = useId();
  const d = decimals(step);
  const shown = toDisplay(value, unit);
  // While typing, the field holds its own text; otherwise it mirrors the value.
  const [draft, setDraft] = useState<string | null>(null);

  const lo = toDisplay(min, unit);
  const hi = toDisplay(max, unit);
  const frac = (v: number) => (Math.min(hi, Math.max(lo, toDisplay(v, unit))) - lo) / (hi - lo);
  const pos = (v: number) => `${(frac(v) * 100).toFixed(2)}%`;

  // Keep marker labels legible: lift the second of two close labels above
  // the track, and anchor labels at the ends so they never leave the panel.
  const placed = [...markers]
    .sort((a, b) => frac(a.value) - frac(b.value))
    .map((m, i, all) => {
      const f = frac(m.value);
      const prev = i > 0 ? frac(all[i - 1]!.value) : -1;
      return {
        ...m,
        f,
        lift: i > 0 && f - prev < 0.22,
        align: f < 0.12 ? 'start' : f > 0.88 ? 'end' : 'center',
      };
    });

  const commit = () => {
    if (draft !== null) {
      const n = Number(draft.replace(/[^\d.-]/g, ''));
      if (draft.trim() !== '' && Number.isFinite(n)) onChange(fromDisplay(Math.min(hi, Math.max(lo, n)), unit));
    }
    setDraft(null);
  };

  return (
    <div className={styles.instrument} data-disabled={disabled ? 'true' : undefined}>
      <div className={styles.head}>
        <label htmlFor={`${id}-range`} className={styles.label}>
          {label}
        </label>
        <span className={styles.entry}>
          <input
            id={`${id}-num`}
            className={styles.number}
            inputMode="decimal"
            aria-label={`${label}, exact value`}
            value={draft ?? shown.toFixed(d)}
            disabled={disabled}
            onFocus={(e) => {
              setDraft(shown.toFixed(d));
              e.currentTarget.select();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setDraft(null);
                e.currentTarget.blur();
              }
            }}
          />
          <span className={styles.suffix} aria-hidden="true">
            {SUFFIX[unit]}
          </span>
        </span>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.track}>
        <input
          id={`${id}-range`}
          type="range"
          className={styles.range}
          min={lo}
          max={hi}
          step={step}
          value={Math.min(hi, Math.max(lo, shown))}
          disabled={disabled}
          aria-valuetext={spoken(shown, unit, d)}
          onChange={(e) => onChange(fromDisplay(Number(e.target.value), unit))}
          style={{ ['--fill' as string]: pos(value) }}
        />
        {placed.map((m) => (
          <span
            key={m.kind}
            className={styles.marker}
            data-kind={m.kind}
            data-lift={m.lift ? 'true' : undefined}
            data-align={m.align}
            style={{ left: `${(m.f * 100).toFixed(2)}%` }}
            title={m.label}
            aria-hidden="true"
          >
            <span className={styles.markerLabel}>{m.label}</span>
          </span>
        ))}
      </div>
      {markers.length > 0 && (
        <p className="visually-hidden">{markers.map((m) => m.label).join('. ')}</p>
      )}
    </div>
  );
}
