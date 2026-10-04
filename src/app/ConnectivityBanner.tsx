import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getConditions,
  isEffectivelyOffline,
  setConditions,
  subscribeConditions,
} from '@/data/transport';
import { queryClient } from '@/data/queryClient';
import { WifiOff } from '@/components/icons';
import styles from './Shell.module.css';

function useOffline(): boolean {
  const [browserOffline, setBrowserOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  useEffect(() => {
    const update = () => setBrowserOffline(navigator.onLine === false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const simulated = useSyncExternalStore(
    subscribeConditions,
    () => getConditions().offline,
    () => false,
  );
  return browserOffline || simulated;
}

/** App-wide offline status: last values stay visible and labelled; writes wait for a connection. */
export function ConnectivityBanner() {
  const offline = useOffline();
  const simulated = useSyncExternalStore(
    subscribeConditions,
    () => getConditions().offline,
    () => false,
  );
  if (!offline) return null;
  return (
    <div className={styles.offline} role="status">
      <WifiOff size={16} strokeWidth={1.75} aria-hidden />
      <span>You’re offline. Saved copies stay readable; changes need a connection.</span>
      <button
        type="button"
        className={styles.offlineAction}
        onClick={() => {
          if (simulated) setConditions({ offline: false });
          if (!isEffectivelyOffline()) void queryClient.refetchQueries({ type: 'active' });
        }}
      >
        Try again
      </button>
    </div>
  );
}
