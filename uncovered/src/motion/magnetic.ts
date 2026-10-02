/*
 * Primary actions lean towards the pointer a few pixels, the way a coin is
 * drawn to a magnet: one listener for the page, for every element marked
 * data-magnetic. Only with a mouse, and never when motion is reduced.
 */
export function startMagnetic() {
  if (typeof window === 'undefined') return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let active: HTMLElement | null = null;
  const settle = () => {
    if (active) active.style.translate = '';
    active = null;
  };
  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (active && active !== el) settle();
      if (!el) return;
      active = el;
      const r = el.getBoundingClientRect();
      const dx = Math.max(-7, Math.min(7, (e.clientX - (r.left + r.width / 2)) * 0.16));
      const dy = Math.max(-5, Math.min(5, (e.clientY - (r.top + r.height / 2)) * 0.3));
      el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', settle);
}
