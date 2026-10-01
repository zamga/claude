import { useSyncExternalStore } from 'react';

const never = () => () => {};

/**
 * False while the server and the first client render must agree (prerender
 * and hydration), true afterwards and on every client-side navigation.
 * Anything personal (saved charts, share links, stored preferences) waits
 * for it, so hydration never sees a mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}
