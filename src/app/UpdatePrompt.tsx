import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/Button';
import styles from './Shell.module.css';

/**
 * Service-worker updates wait for a stable moment: the old version keeps running until the person
 * chooses to reload. Drafts live in session storage and survive the reload (spec page 57).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.warn('Service worker registration failed', error);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className={styles.update} role="status" data-surface="charcoal">
      <span>An update is available.</span>
      <div className={styles.updateActions}>
        <Button variant="text" size="small" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button size="small" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
      </div>
    </div>
  );
}
