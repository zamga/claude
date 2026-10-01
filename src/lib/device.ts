import { useSyncExternalStore } from 'react';

function mediaStore(query: string) {
  const mql = typeof window !== 'undefined' ? window.matchMedia(query) : null;
  return {
    subscribe(cb: () => void) {
      mql?.addEventListener('change', cb);
      return () => mql?.removeEventListener('change', cb);
    },
    get: () => mql?.matches ?? false,
  };
}

const reducedMotion = mediaStore('(prefers-reduced-motion: reduce)');
const coarsePointer = mediaStore('(pointer: coarse)');
const narrow = mediaStore('(max-width: 47.99rem)');

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(reducedMotion.subscribe, reducedMotion.get, () => false);
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(coarsePointer.subscribe, coarsePointer.get, () => false);
}

export function useNarrow(): boolean {
  return useSyncExternalStore(narrow.subscribe, narrow.get, () => false);
}

/*
 * WebGL capability, checked once in idle time (creating a test context is
 * not free) and shared through a tiny store: null while unknown, then the
 * answer. Software rasterisers (SwiftShader, llvmpipe) count as incapable:
 * they would spend the main thread drawing what the flat chart shows for free.
 */
let webglChecked: boolean | null = null;
const capabilityListeners = new Set<() => void>();
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software/i;

function detect(): boolean {
  try {
    if (readForce()) return true;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return false;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !SOFTWARE.test(renderer);
  } catch {
    return false;
  }
}

/** Developers can force relief on software GL with localStorage "plimsoll:gl" = "force". */
function readForce() {
  try {
    return window.localStorage.getItem('plimsoll:gl') === '"force"';
  } catch {
    return false;
  }
}

/*
 * The probe runs in a worker on an OffscreenCanvas, so creating a test
 * context (slow on some machines) never blocks the page. Browsers without
 * OffscreenCanvas WebGL fall back to a main-thread check in idle time.
 */
const PROBE = `self.onmessage = () => {
  let ok = false, renderer = '';
  try {
    const gl = new OffscreenCanvas(1, 1).getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) {
      ok = true;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch (e) {}
  self.postMessage({ ok, renderer });
};`;

function settle(value: boolean) {
  if (webglChecked !== null) return;
  webglChecked = value;
  capabilityListeners.forEach((l) => l());
}

function preflight(): boolean | null {
  if (readForce()) return true;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return false;
  return null;
}

let probing = false;

function scheduleCheck() {
  if (webglChecked !== null || probing || typeof window === 'undefined') return;
  probing = true;
  const early = preflight();
  if (early !== null) {
    queueMicrotask(() => settle(early));
    return;
  }
  const onMainThread = () => {
    const run = () => settle(detect());
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1200 });
    else window.setTimeout(run, 50);
  };
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return onMainThread();
  try {
    const url = URL.createObjectURL(new Blob([PROBE], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const done = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    const timer = window.setTimeout(() => {
      done();
      settle(false);
    }, 4000);
    worker.onmessage = (e: MessageEvent<{ ok: boolean; renderer: string }>) => {
      window.clearTimeout(timer);
      done();
      settle(e.data.ok && !SOFTWARE.test(e.data.renderer));
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      done();
      onMainThread();
    };
    worker.postMessage(null);
  } catch {
    onMainThread();
  }
}

function subscribeCapability(listener: () => void) {
  capabilityListeners.add(listener);
  scheduleCheck();
  return () => capabilityListeners.delete(listener);
}

/** WebGL capability as a hook: null until known (always null on the server and during hydration). */
export function useCanRender3D(): boolean | null {
  return useSyncExternalStore(
    subscribeCapability,
    () => webglChecked,
    () => null,
  );
}

/** Synchronous check, for code that needs an answer now. */
export function canRender3D(): boolean {
  if (webglChecked === null) {
    if (typeof document === 'undefined') return false;
    webglChecked = detect();
  }
  return webglChecked;
}
