/**
 * Input rules (spec pages 25, 38, 55). Messages explain the action needed in plain language.
 */

export const WATCHLIST_NAME_MAX = 40;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** Normalised identity for duplicate detection; the display name keeps the user's Unicode. */
export function normalizeName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
}

export type NameCheck =
  | { ok: true; value: string; normalized: string }
  | { ok: false; message: string; duplicateOf?: string };

export function validateWatchlistName(
  input: string,
  existing: readonly { id: string; name: string }[],
  ignoreId?: string,
): NameCheck {
  const value = input.trim().replace(/\s+/gu, ' ');
  if (value.length === 0) return { ok: false, message: 'Name this watchlist.' };
  const length = [...value].length;
  if (length > WATCHLIST_NAME_MAX) {
    return { ok: false, message: `Use ${WATCHLIST_NAME_MAX} characters or fewer.` };
  }
  const normalized = normalizeName(value);
  const duplicate = existing.find(
    (list) => list.id !== ignoreId && normalizeName(list.name) === normalized,
  );
  if (duplicate) {
    return { ok: false, message: 'This list already exists.', duplicateOf: duplicate.id };
  }
  return { ok: true, value, normalized };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export function validateEmail(input: string): string | undefined {
  const value = input.trim();
  if (value === '') return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(value)) return 'Enter an email address like name@example.com.';
  return undefined;
}

export function validateNewPassword(input: string): string | undefined {
  const length = [...input].length;
  if (length === 0) return 'Create a password.';
  if (length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  return undefined;
}

export function validateExistingPassword(input: string): string | undefined {
  return input.length === 0 ? 'Enter your password.' : undefined;
}

export function validateClock(input: string): string | undefined {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(input.trim())
    ? undefined
    : 'Use a 24-hour time like 07:00.';
}

export function validateDisplayName(input: string): string | undefined {
  const value = input.trim();
  if (value.length === 0) return 'Enter a display name.';
  if ([...value].length > 60) return 'Use 60 characters or fewer.';
  return undefined;
}

export function validateNote(input: string, max = 2000): string | undefined {
  const value = input.trim();
  if (value.length === 0) return 'Write a note before saving.';
  if ([...value].length > max) return `Use ${max} characters or fewer.`;
  return undefined;
}
