import { useId } from 'react';

/** The Plimsoll mark: a ring crossed by the load line. */
export function PlimsollMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="1.5" y1="16" x2="30.5" y2="16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * The Plimsoll glyph: one company at a glance. The line is your value; the
 * water is the price. Water above the line means you would be overloaded.
 * `ratio` is price / value, drawn on a log scale (½× at the bottom, 2× at the top).
 */
export function PlimsollGlyph({ ratio, size = 40, label }: { ratio: number; size?: number; label: string }) {
  const id = useId();
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 4;
  const y = Math.min(29, Math.max(3, 16 - Math.log2(r) * 12));
  const over = r > 1;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label={label}>
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx="16" cy="16" r="11" />
        </clipPath>
      </defs>
      <rect
        x="0"
        y={y}
        width="32"
        height={32 - y}
        clipPath={`url(#${id}-c)`}
        fill={over ? 'var(--water-1)' : 'var(--water-2)'}
      />
      <line
        x1="4"
        x2="28"
        y1={y}
        y2={y}
        stroke="var(--water-ink)"
        strokeWidth="1"
        clipPath={`url(#${id}-c)`}
        strokeDasharray={over ? 'none' : '2 1.5'}
      />
      <circle cx="16" cy="16" r="11" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <line x1="1" x2="31" y1="16" y2="16" stroke={over ? 'var(--signal)' : 'var(--ink)'} strokeWidth="1.8" />
    </svg>
  );
}
