/** Storage helpers that never throw (private mode, blocked site data, previews). */
export function readJson<T>(storage: 'local' | 'session', key: string): T | null {
  try {
    const store = storage === 'local' ? window.localStorage : window.sessionStorage;
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(storage: 'local' | 'session', key: string, value: unknown): void {
  try {
    const store = storage === 'local' ? window.localStorage : window.sessionStorage;
    if (value === undefined || value === null) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is a convenience; the in-memory state still works.
  }
}

/** Form drafts survive navigation and reload for the session (spec pages 25, 38). */
export const draftKey = (name: string) => `stockpicks.draft.${name}`;
