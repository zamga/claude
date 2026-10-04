import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import {
  Check,
  ICON_STROKE,
  Share,
  Smartphone,
  SquarePlus,
  type LucideIcon,
} from '@/components/icons';
import { Row } from '@/components/List';
import { Sheet } from '@/components/Sheet';
import { Notice } from '@/components/Status';
import { isIos, isStandalone, isTouchDevice } from '@/lib/platform';
import { readJson, writeJson } from '@/lib/storage';
import styles from './Install.module.css';

/**
 * Installing the app (spec page 57): an install action only where the browser offers one,
 * accurate instructions where it does not (iPhone and iPad), and nothing once it is installed or
 * in builds that cannot be installed (the static preview has no manifest or service worker).
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'none';

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Call before the first render: browsers fire `beforeinstallprompt` once, early. */
export function listenForInstall(): void {
  if (typeof window === 'undefined' || import.meta.env.VITE_PWA === 'off') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    // The app offers its own Install action, so the browser's mini-infobar stays away.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

function installMode(): InstallMode {
  if (import.meta.env.VITE_PWA === 'off') return 'none';
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'none';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstall(): { mode: InstallMode; install: () => Promise<boolean> } {
  const mode = useSyncExternalStore(subscribe, installMode, () => 'none' as const);
  const install = async () => {
    const event = deferred;
    if (!event) return false;
    deferred = null;
    await event.prompt();
    const choice = await event.userChoice;
    notify();
    return choice.outcome === 'accepted';
  };
  return { mode, install };
}

const STEPS: { icon: LucideIcon; title: string; detail: string }[] = [
  {
    icon: Share,
    title: 'Tap Share',
    detail: 'The square with an arrow: in Safari’s toolbar, or under ••• beside the address.',
  },
  {
    icon: SquarePlus,
    title: 'Choose Add to Home Screen',
    detail: 'Scroll down the list if you don’t see it.',
  },
  {
    icon: Check,
    title: 'Tap Add',
    detail:
      'Stock Picks then opens from its own icon, full screen and offline. Alert notifications need iOS 16.4 or later.',
  },
];

/** iPhone and iPad: Safari has no install button, so show the three taps it takes. */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add Stock Picks to your Home Screen"
      size="auto"
      footer={
        <Button full onClick={onClose}>
          Done
        </Button>
      }
    >
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
            <step.icon className={styles.icon} size={22} strokeWidth={ICON_STROKE} aria-hidden />
            <span className={styles.body}>
              <span className={styles.title}>{step.title}</span>
              <span className={styles.detail}>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

/**
 * Profile row: Install on browsers that offer it, the Home Screen steps on iPhone and iPad. The
 * row goes in a list and the sheet outside it, so the list keeps only list items.
 */
export function useInstallRow(): { row: ReactNode; sheet: ReactNode } {
  const { mode, install } = useInstall();
  const [open, setOpen] = useState(false);
  if (mode !== 'prompt' && mode !== 'ios') return { row: null, sheet: null };
  return {
    row: (
      <Row
        icon={Smartphone}
        title="Install the app"
        detail={
          mode === 'ios'
            ? 'Add Stock Picks to your Home Screen'
            : 'Full screen, offline and with notifications'
        }
        onPress={() => (mode === 'ios' ? setOpen(true) : void install())}
      />
    ),
    sheet: <InstallSheet open={open} onClose={() => setOpen(false)} />,
  };
}

const DISMISSED_KEY = 'stockpicks.install.dismissed.v1';

/** A one-time card on phones and tablets in the browser; "Not now" hides it on this device. */
export function InstallBanner() {
  const { mode, install } = useInstall();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => readJson<boolean>('local', DISMISSED_KEY) === true,
  );
  if (dismissed || (mode !== 'prompt' && mode !== 'ios') || !isTouchDevice()) return null;
  const dismiss = () => {
    writeJson('local', DISMISSED_KEY, true);
    setDismissed(true);
  };
  return (
    <div className={styles.banner}>
      <Notice
        icon={Smartphone}
        title="Use Stock Picks as an app"
        actions={
          <>
            <Button size="small" onClick={() => (mode === 'ios' ? setOpen(true) : void install())}>
              {mode === 'ios' ? 'How to install' : 'Install'}
            </Button>
            <Button size="small" variant="text" onClick={dismiss}>
              Not now
            </Button>
          </>
        }
      >
        <p className={styles.bannerText}>
          {mode === 'ios'
            ? 'Add it to your Home Screen: full screen, offline, with alert notifications.'
            : 'Install it on this device: full screen, offline, with alert notifications.'}
        </p>
      </Notice>
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
