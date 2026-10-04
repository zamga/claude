import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMediaQuery } from '@/lib/hooks';
import { readJson, writeJson } from '@/lib/storage';
import type { Preferences } from '@/data/types';
import { usePreferences } from '@/data/queries';
import { useSession } from './session';

/**
 * Display settings (S22): appearance, text size, reduced motion and contrast. Signed-in values
 * come from the account; signed-out values stay on this device. The settings screen previews a
 * draft reversibly until it is saved.
 */
export type DisplaySettings = Preferences['display'];

const DEVICE_KEY = 'stockpicks.display.v1';
const DEFAULTS: DisplaySettings = {
  appearance: 'editorial',
  textScale: 1,
  reduceMotion: 'system',
  increaseContrast: false,
  keepPrivateOffline: false,
};

interface DisplayContextValue {
  committed: DisplaySettings;
  effective: DisplaySettings;
  setPreview: (draft: DisplaySettings | null) => void;
  saveDevice: (next: DisplaySettings) => void;
  resolved: { reducedMotion: boolean; night: boolean };
}

const DisplayContext = createContext<DisplayContextValue | null>(null);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const { signedIn } = useSession();
  const preferences = usePreferences(signedIn);
  const [device, setDevice] = useState<DisplaySettings>(() => ({
    ...DEFAULTS,
    ...(readJson<DisplaySettings>('local', DEVICE_KEY) ?? {}),
  }));
  const [preview, setPreview] = useState<DisplaySettings | null>(null);
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const systemContrast = useMediaQuery('(prefers-contrast: more)');
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');

  const committed = signedIn && preferences.data ? preferences.data.display : device;
  const effective = preview ?? committed;
  const reducedMotion =
    effective.reduceMotion === 'reduce' || (effective.reduceMotion === 'system' && systemReduce);
  const night =
    effective.appearance === 'night' || (effective.appearance === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = reducedMotion ? 'reduced' : 'full';
    root.dataset.contrast = effective.increaseContrast || systemContrast ? 'more' : 'standard';
    if (night) root.dataset.appearance = 'night';
    else delete root.dataset.appearance;
    root.style.setProperty('--text-scale', String(effective.textScale));
  }, [effective, reducedMotion, night, systemContrast]);

  const saveDevice = useCallback((next: DisplaySettings) => {
    setDevice(next);
    writeJson('local', DEVICE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ committed, effective, setPreview, saveDevice, resolved: { reducedMotion, night } }),
    [committed, effective, saveDevice, reducedMotion, night],
  );
  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
}

export function useDisplay(): DisplayContextValue {
  const value = useContext(DisplayContext);
  if (!value) throw new Error('useDisplay must be used inside DisplayProvider');
  return value;
}

export const TEXT_SCALES = [
  { value: 0.9, label: 'Smaller' },
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
  { value: 1.5, label: 'Largest' },
];
