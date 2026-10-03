import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useDelayedFlag } from '@/lib/hooks';
import { ICON_STROKE, type LucideIcon } from './icons';
import styles from './Button.module.css';
import { usePress } from './usePress';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'accent' | 'danger' | 'text';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: 'default' | 'small';
  full?: boolean;
  /** Label left, icon right (mock "Explore thesis ↗"). */
  between?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'start' | 'end';
  /** Pending: one submission in flight. Progress shows after 150 ms; width stays stable. */
  pending?: boolean;
  /** Explains why the control is unavailable (rendered for assistive tech and as a title). */
  disabledReason?: string;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'default',
    full = false,
    between = false,
    icon: Icon,
    iconPosition = 'end',
    pending = false,
    disabled,
    disabledReason,
    className,
    onClick,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  const unavailable = Boolean(disabled) || Boolean(disabledReason);
  const { pressed, handlers } = usePress<HTMLButtonElement>(unavailable || pending);
  const showProgress = useDelayedFlag(pending, 150);
  const classes = [
    styles.button,
    styles[variant],
    size === 'small' ? styles.small : '',
    full ? styles.full : '',
    between ? styles.between : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const icon = Icon ? (
    <Icon className={styles.icon} size={18} strokeWidth={ICON_STROKE} aria-hidden />
  ) : null;
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      data-pressed={pressed}
      aria-disabled={unavailable || undefined}
      aria-busy={pending || undefined}
      title={disabledReason}
      onClick={(event) => {
        if (unavailable || pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...handlers}
      {...rest}
    >
      <span className={styles.content} data-hidden={showProgress || undefined}>
        {iconPosition === 'start' && icon}
        <span>{children}</span>
        {iconPosition === 'end' && icon}
      </span>
      {showProgress && <span className={styles.spinner} aria-hidden />}
      {disabledReason && <span className="visually-hidden">. {disabledReason}</span>}
    </button>
  );
});
