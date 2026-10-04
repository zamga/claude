import { useSyncExternalStore } from 'react';
import type { Sample } from '@/domain/series';

/**
 * Shared inspection state between a chart and its hero quote. Only subscribers re-render while
 * scrubbing; tooltip movement never re-renders the screen (spec page 39).
 */
export interface InspectionState {
  sample: Sample | null;
  mode: 'rest' | 'inspecting' | 'pinned';
  fading: boolean;
}

export interface InspectionStore {
  get: () => InspectionState;
  set: (next: InspectionState) => void;
  subscribe: (listener: () => void) => () => void;
}

const REST: InspectionState = { sample: null, mode: 'rest', fading: false };

export function createInspectionStore(): InspectionStore {
  let state = REST;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      if (
        next.sample?.t === state.sample?.t &&
        next.mode === state.mode &&
        next.fading === state.fading
      )
        return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useInspection(store: InspectionStore): InspectionState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
