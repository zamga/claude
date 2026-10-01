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

let webglChecked: boolean | null = null;

/**
 * True when a WebGL2 context can be created and the device is not asking
 * us to save resources. Low-memory devices and data-saver mode get the
 * flat chart, which carries the same information.
 */
export function canRender3D(): boolean {
  if (webglChecked !== null) return webglChecked;
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return (webglChecked = false);
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return (webglChecked = false);
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    webglChecked = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglChecked = false;
  }
  return webglChecked;
}
