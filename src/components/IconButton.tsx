import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { ICON_STROKE, type LucideIcon } from './icons';
import styles from './IconButton.module.css';
import { usePress } from './usePress';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Accessible name; icons are never the only label (spec page 4). */
  label: string;
  /** Toggle state (bookmark saved, bell armed). Renders aria-pressed and a filled glyph. */
  active?: boolean;
  /** Small unread dot. */
  badge?: boolean;
  busy?: boolean;
  size?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon: Icon,
    label,
    active,
    badge,
    busy,
    size = 22,
    className,
    disabled,
    onClick,
    type = 'button',
    ...rest
  },
  ref,
) {
  const { pressed, handlers } = usePress<HTMLButtonElement>(Boolean(disabled) || Boolean(busy));
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      aria-busy={busy || undefined}
      aria-disabled={disabled || undefined}
      title={label}
      data-pressed={pressed}
      className={[styles.iconButton, busy ? styles.busy : '', className ?? ''].join(' ')}
      onClick={(event) => {
        if (disabled || busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...handlers}
      {...rest}
    >
      <Icon
        size={size}
        strokeWidth={ICON_STROKE}
        aria-hidden
        fill={active ? 'currentColor' : 'none'}
      />
      {badge && <span className={styles.badge} aria-hidden />}
    </button>
  );
});
