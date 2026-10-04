import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/**
 * Press feedback (spec page 20): a local pressed state within one frame of a deliberate press,
 * cleared on pointer cancel, leaving the control, scroll takeover or the page being hidden.
 */
export function usePress<T extends HTMLElement>(disabled = false) {
  const [pressed, setPressed] = useState(false);
  const pointer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    pointer.current = null;
    origin.current = null;
    setPressed(false);
  }, []);

  useEffect(() => {
    if (!pressed) return;
    const onHide = () => clear();
    window.addEventListener('blur', onHide);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('scroll', onHide, { passive: true, capture: true });
    return () => {
      window.removeEventListener('blur', onHide);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('scroll', onHide, { capture: true });
    };
  }, [pressed, clear]);

  const handlers = {
    onPointerDown: (event: ReactPointerEvent<T>) => {
      if (disabled || event.button !== 0) return;
      pointer.current = event.pointerId;
      origin.current = { x: event.clientX, y: event.clientY };
      setPressed(true);
    },
    onPointerMove: (event: ReactPointerEvent<T>) => {
      if (pointer.current !== event.pointerId || !origin.current) return;
      const moved = Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y);
      if (moved > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };

  return { pressed, handlers };
}
