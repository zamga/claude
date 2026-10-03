import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { haptics } from '@/lib/haptics';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

function moveFocus<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  items: TabItem<T>[],
  current: T,
  onChange: (value: T) => void,
) {
  const enabled = items.filter((item) => !item.disabled);
  const index = enabled.findIndex((item) => item.value === current);
  let next = -1;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    next = (index - 1 + enabled.length) % enabled.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = enabled.length - 1;
  if (next < 0) return;
  event.preventDefault();
  const value = enabled[next]!.value;
  onChange(value);
  const container = event.currentTarget;
  requestAnimationFrame(() =>
    container.querySelector<HTMLElement>(`[data-value="${value}"]`)?.focus(),
  );
}

/**
 * Underline tabs for collections and sections (All / Earnings / IPOs). The selected tab and the
 * visible collection change together; `pending` marks a requested tab whose data is loading.
 */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  pending,
  controls,
  size = 'md',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  pending?: T | null;
  controls?: string;
  /**
   * 'sm' (14 px) and 'lg' (18 px) where a photo sets the tabs consistently smaller (Today's picks)
   * or larger (the alert inbox, research history) than the shared 16 px.
   */
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={styles.underline}
      data-size={size}
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => moveFocus(event, items, value, onChange)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-value={item.value}
            className={styles.tab}
            aria-selected={selected}
            aria-controls={controls}
            data-pending={pending === item.value && !selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => {
              if (!selected) haptics.selection();
              onChange(item.value);
            }}
          >
            {item.label}
            {item.count != null && <span className={styles.count}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Single-choice segmented control with radio semantics (Days / Weeks / Months, 1M … 1Y). */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'solid',
  size = 'md',
  pending,
  className,
}: {
  items: TabItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  variant?: 'solid' | 'accent' | 'ghost';
  /** 'sm' (13 px, the control floor): the chart range row under the S02 chart. */
  size?: 'md' | 'sm';
  pending?: T | null;
  className?: string;
}) {
  return (
    <div
      className={[styles.segmented, className ?? ''].join(' ')}
      role="radiogroup"
      aria-label={label}
      data-variant={variant}
      data-size={size}
      onKeyDown={(event) => moveFocus(event, items, value ?? items[0]!.value, onChange)}
    >
      {items.map((item) => {
        const checked = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            data-value={item.value}
            className={styles.segment}
            aria-checked={checked}
            data-pending={pending === item.value && !checked}
            tabIndex={checked || (value == null && item === items[0]) ? 0 : -1}
            disabled={item.disabled}
            onClick={() => {
              if (!checked) haptics.selection();
              onChange(item.value);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
