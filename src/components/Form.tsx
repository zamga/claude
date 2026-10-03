import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { haptics } from '@/lib/haptics';
import { Check, ChevronDown, ICON_STROKE, TriangleAlert } from './icons';
import styles from './Form.module.css';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className={styles.error} id={id}>
      <TriangleAlert
        size={14}
        strokeWidth={ICON_STROKE}
        aria-hidden
        style={{ flex: 'none', marginTop: 2 }}
      />
      <span>{message}</span>
    </p>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  trailing?: ReactNode;
  prefix?: string;
  size?: 'default' | 'large';
}

/**
 * Labelled input with associated hint and error (spec pages 25, 38). Validation messages are set
 * by the form after blur or submit, never on every keystroke.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, trailing, prefix, size = 'default', id, className, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={[styles.field, className ?? ''].join(' ')}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      <div className={styles.control}>
        <input
          ref={ref}
          id={inputId}
          className={[
            styles.input,
            trailing ? styles.withTrailing : '',
            prefix ? styles.withPrefix : '',
          ].join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          data-size={size}
          {...rest}
        />
        {prefix && (
          <span
            className={[styles.prefix, size === 'large' ? styles.prefixLarge : ''].join(' ')}
            aria-hidden
          >
            {prefix}
          </span>
        )}
        {trailing && <span className={styles.trailing}>{trailing}</span>}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={styles.textarea}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
        }
        {...rest}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
});

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  hideLabel?: boolean;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, options, id, hideLabel, ...rest },
  ref,
) {
  const generated = useId();
  const selectId = id ?? generated;
  const errorId = `${selectId}-error`;
  return (
    <div className={styles.field}>
      <label className={hideLabel ? 'visually-hidden' : styles.label} htmlFor={selectId}>
        {label}
      </label>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.selectWrap}>
        <select
          ref={ref}
          id={selectId}
          className={styles.select}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={styles.selectChevron}
          size={18}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
});

/** Switch with role="switch": track and thumb update in 120 ms; the label never moves. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  busy,
  id,
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  id?: string;
  describedBy?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      aria-describedby={describedBy}
      disabled={disabled}
      className={styles.switch}
      onClick={() => {
        if (busy) return;
        haptics.selection();
        onChange(!checked);
      }}
    />
  );
}

export function SwitchRow({
  label,
  detail,
  checked,
  onChange,
  disabled,
  busy,
  icon,
}: {
  label: string;
  detail?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={styles.switchRow}>
      {icon}
      <div className={styles.switchText}>
        <div className={styles.switchLabel} id={`${id}-label`}>
          {label}
        </div>
        {detail && (
          <div className={styles.switchDetail} id={`${id}-detail`}>
            {detail}
          </div>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        label={label}
        disabled={disabled}
        busy={busy}
        describedBy={detail ? `${id}-detail` : undefined}
      />
    </div>
  );
}

export function CheckRow({
  label,
  detail,
  checked,
  onChange,
  name,
  value,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  name?: string;
  value?: string;
}) {
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        name={name}
        value={value}
        onChange={(event) => {
          haptics.selection();
          onChange(event.target.checked);
        }}
      />
      <span className={styles.box} aria-hidden>
        {checked && <Check size={14} strokeWidth={2.5} />}
      </span>
      <span className={styles.checkText}>
        {label}
        {detail && <span className={styles.checkDetail}>{detail}</span>}
      </span>
    </label>
  );
}

/**
 * Native range input: arrow keys move one step, the thumb follows the finger directly and grows
 * from 16 to 20 px while active; the value is announced by the input itself (spec pages 20, 36).
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  format,
  onChange,
  onCommit,
  scale,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  scale?: [string, string];
  hint?: ReactNode;
}) {
  const id = useId();
  const text = format ? format(value) : `${value}${unit}`;
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <output className={styles.sliderValue} htmlFor={id} aria-live="off">
          {text}
        </output>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
      <input
        id={id}
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
        onKeyUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
      />
      {scale && (
        <div className={styles.scale} aria-hidden>
          <span>{scale[0]}</span>
          <span>{scale[1]}</span>
        </div>
      )}
    </div>
  );
}

export function Fieldset({
  legend,
  children,
  className,
}: {
  legend: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={[styles.fieldset, className ?? ''].join(' ')}>
      <legend className={styles.legend}>{legend}</legend>
      {children}
    </fieldset>
  );
}

export const formStyles = styles;
