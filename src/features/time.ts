import { useSyncExternalStore } from 'react';
import { useSession } from '@/app/session';
import { demoNow } from '@/data/api';
import { usePreferences } from '@/data/queries';

const DEVICE_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Ljubljana';
  } catch {
    return 'Europe/Ljubljana';
  }
})();

/** The person's chosen IANA zone (account), or the documented default for guests. */
export function useUserTimeZone(): string {
  const { signedIn } = useSession();
  const preferences = usePreferences(signedIn);
  return preferences.data?.regional.timeZone ?? 'Europe/Ljubljana';
}

export function deviceTimeZone(): string {
  return DEVICE_ZONE;
}

const listeners = new Set<() => void>();
export function notifyDemoClock(): void {
  listeners.forEach((listener) => listener());
}

/** The demo market clock ("now" for market-relative labels). */
export function useDemoNow(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => demoNow(),
    () => demoNow(),
  );
}
