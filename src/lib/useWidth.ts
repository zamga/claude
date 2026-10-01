import { useEffect, useRef, useState } from 'react';

/**
 * Track an element's content width so SVG charts can be drawn at their real
 * size: text stays at its set size instead of scaling with the viewBox.
 */
export function useWidth<T extends HTMLElement>(fallback = 640, min = 240) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(min, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, width] as const;
}
