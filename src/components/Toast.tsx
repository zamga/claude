import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ICON_STROKE, X } from './icons';
import styles from './Toast.module.css';

/**
 * Transient confirmation (spec pages 18, 26): enter 160 ms, exit 120 ms, ~4 s dwell, paused while
 * hovered or focused. Toasts supplement persistent state; they never stand in for it.
 */
export interface ToastOptions {
  message: string;
  action?: { label: string; onAction: () => void };
  tone?: 'default' | 'error';
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  leaving: boolean;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [
      ...current.slice(-1).map((item) => ({ ...item, leaving: true })),
      { ...options, id, leaving: false },
    ]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
    );
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 160);
  }, []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {items.map((item) => (
          <Toast key={item.id} item={item} onDone={() => remove(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || item.leaving) return;
    const timer = setTimeout(onDone, item.durationMs ?? 4000);
    return () => clearTimeout(timer);
  }, [paused, item.leaving, item.durationMs, onDone]);
  return (
    <div
      className={styles.toast}
      data-leaving={item.leaving}
      data-tone={item.tone ?? 'default'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.message}>{item.message}</span>
      {item.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            item.action!.onAction();
            onDone();
          }}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        className={`${styles.action} ${styles.dismiss}`}
        aria-label="Dismiss"
        onClick={onDone}
      >
        <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
