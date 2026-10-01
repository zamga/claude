import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from './storage';

/**
 * Three-state theme: follow the system, or force Day chart / Night watch.
 * The attribute lives on <html> so tokens switch in one place; an inline
 * script in index.html applies the stored choice before first paint.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

let preference: ThemePreference = readStored<ThemePreference>(KEY) ?? 'system';

function resolve(): ResolvedTheme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return media?.matches ? 'dark' : 'light';
}

let resolved: ResolvedTheme = typeof document !== 'undefined' ? resolve() : 'light';

function notify() {
  const next = resolve();
  resolved = next;
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  media?.addEventListener('change', notify);
  // The host page (or another tab's toggle) may also change the attribute.
  new MutationObserver(notify).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  writeStored(KEY, next);
  if (next === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', next);
  notify();
}

export function getThemePreference(): ThemePreference {
  return preference;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribe,
    () => resolved,
    () => 'light',
  );
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'system',
  );
}

/** Read a design token's current value, e.g. token('--signal'). */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
