import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { X } from './icons';
import styles from './Sheet.module.css';

const CLOSE_TRAVEL_RATIO = 0.25;
const CLOSE_VELOCITY = 0.65; // px/ms
const MIN_VELOCITY_TRAVEL = 48;

function durationVar(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return Number.parseFloat(value) || 0;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  footerColumns?: 1 | 2;
  size?: 'auto' | 'compact' | 'tall';
  /** A dirty form asks before discarding (spec page 25). */
  dirty?: boolean;
  /** Called when a dirty sheet is dismissed; return true to allow closing. */
  confirmDiscard?: () => Promise<boolean>;
  describedBy?: string;
}

/**
 * Modal sheet on the native <dialog> top layer: focus stays inside, the page behind is inert,
 * Escape and backdrop dismiss a clean sheet, and focus returns to the opening control.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  footerColumns = 1,
  size = 'auto',
  dirty = false,
  confirmDiscard,
  describedBy,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [state, setState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const drag = useRef<{
    startY: number;
    startT: number;
    lastY: number;
    lastT: number;
    pointer: number;
  } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finishClose = useCallback(() => {
    const dialog = ref.current;
    if (dialog?.open) dialog.close();
    setState('closed');
    setDragY(0);
    document.documentElement.style.overflow = '';
    const target = opener.current;
    opener.current = null;
    if (target && document.contains(target)) requestAnimationFrame(() => target.focus());
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
      setState('opening');
      const timer = setTimeout(() => setState('open'), durationVar('--dur-sheet-open'));
      return () => clearTimeout(timer);
    }
    if (!open && dialog.open && state !== 'closing') {
      setState('closing');
      const timer = setTimeout(finishClose, durationVar('--dur-sheet-close'));
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = '';
    },
    [],
  );

  const requestClose = useCallback(async () => {
    if (dirty && confirmDiscard) {
      const discard = await confirmDiscard();
      if (!discard) {
        setDragY(0);
        return;
      }
    }
    onClose();
  }, [dirty, confirmDiscard, onClose]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) return;
    drag.current = {
      startY: event.clientY,
      startT: performance.now(),
      lastY: event.clientY,
      lastT: performance.now(),
      pointer: event.pointerId,
    };
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    current.lastY = event.clientY;
    current.lastT = performance.now();
    setDragY(Math.max(0, event.clientY - current.startY));
  };
  const onPointerEnd = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    const travel = Math.max(0, event.clientY - current.startY);
    const elapsed = Math.max(performance.now() - current.startT, 1);
    const velocity = travel / elapsed;
    const height = ref.current?.getBoundingClientRect().height ?? 1;
    if (
      travel > height * CLOSE_TRAVEL_RATIO ||
      (velocity > CLOSE_VELOCITY && travel >= MIN_VELOCITY_TRAVEL)
    ) {
      void requestClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-size={size}
      data-state={state}
      data-dragging={dragging}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      style={
        dragY
          ? { transform: `translateY(${dragY}px)`, ['--drag-y' as string]: `${dragY}px` }
          : undefined
      }
      onCancel={(event) => {
        event.preventDefault();
        void requestClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) void requestClose();
      }}
    >
      <div
        className={styles.handle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        aria-hidden
      />
      <div
        className={styles.header}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <IconButton icon={X} label="Close" onClick={() => void requestClose()} />
      </div>
      <div className={styles.body}>{state === 'closed' ? null : children}</div>
      {footer && state !== 'closed' && (
        <div className={styles.footer} data-columns={footerColumns}>
          {footer}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Confirmation dialog with a named purpose and clear actions. Returns a promise so callers can
 * await the decision; the covered page cannot receive taps while it is open.
 */
export function useConfirm() {
  const [request, setRequest] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const element = request ? (
    <ConfirmDialog
      {...request}
      onResult={(value) => {
        request.resolve(value);
        setRequest(null);
      }}
    />
  ) : null;

  return { confirm, element };
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  onResult,
}: ConfirmOptions & { onResult: (value: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    opener.current = document.activeElement as HTMLElement | null;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      const target = opener.current;
      if (target && document.contains(target)) requestAnimationFrame(() => target.focus());
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.confirm}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onResult(false);
      }}
    >
      <h2 className={styles.confirmTitle} id={titleId}>
        {title}
      </h2>
      <div className={styles.confirmBody} id={bodyId}>
        {body}
      </div>
      <div className={styles.confirmActions}>
        <Button variant={destructive ? 'danger' : 'primary'} full onClick={() => onResult(true)}>
          {confirmLabel}
        </Button>
        <Button ref={cancelRef} variant="quiet" full onClick={() => onResult(false)}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
