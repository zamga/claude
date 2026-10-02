import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

/*
 * Scroll as one instrument: GSAP's ScrollTrigger for choreography tied to the
 * page's position, and Lenis for inertial scrolling with a mouse or trackpad.
 * Both load only when something asks for them, after the page is up. Lenis
 * is left out on touch screens (whose own scrolling is already physical) and
 * whenever a person prefers reduced motion; ScrollTrigger then reads native
 * scrolling. Lenis takes only vertical wheel scrolling, so tables that scroll
 * sideways keep their own; anything marked data-lenis-prevent keeps native
 * scrolling altogether.
 */

export interface ScrollKit {
  gsap: typeof Gsap;
  ScrollTrigger: typeof ScrollTriggerType;
  lenis: Lenis | null;
}

let kit: Promise<ScrollKit> | null = null;

const smoothWanted = () =>
  window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scrollKit(): Promise<ScrollKit> {
  kit ??= (async () => {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap.registerPlugin(ScrollTrigger);
    let lenis: Lenis | null = null;
    if (smoothWanted()) {
      const [{ default: LenisClass }] = await Promise.all([import('lenis'), import('lenis/dist/lenis.css')]);
      lenis = new LenisClass({ lerp: 0.12, wheelMultiplier: 0.9, anchors: false });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis!.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    return { gsap, ScrollTrigger, lenis };
  })();
  return kit;
}

/** Smooth scrolling starts with the first turn of the wheel, if this person's setup wants it: nothing loads before. */
export function startSmoothScroll() {
  if (typeof window === 'undefined' || !smoothWanted()) return;
  window.addEventListener('wheel', () => void scrollKit(), { once: true, passive: true });
}

/**
 * Run `start` with the scroll kit once `el` comes within `margin` of the viewport (a screen and a half
 * by default), so the choreography's code loads only for a person on their way to it. A section just
 * below the first screen passes a small margin, so nothing loads before anyone scrolls. Returns a
 * function that cancels.
 */
export function whenNear(el: Element, start: (kit: ScrollKit) => () => void, margin = '150%'): () => void {
  let stop = () => {};
  let cancelled = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void scrollKit().then((kit) => {
        if (!cancelled) stop = start(kit);
      });
    },
    { rootMargin: `${margin} 0px ${margin} 0px` },
  );
  io.observe(el);
  return () => {
    cancelled = true;
    io.disconnect();
    stop();
  };
}
