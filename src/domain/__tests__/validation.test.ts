import { describe, expect, it } from 'vitest';
import {
  normalizeName,
  validateEmail,
  validateNewPassword,
  validateWatchlistName,
} from '../validation';

describe('watchlist names', () => {
  const lists = [{ id: 'a', name: 'High conviction' }];

  it('trims, requires 1–40 characters and preserves Unicode', () => {
    expect(validateWatchlistName('   ', lists)).toEqual({
      ok: false,
      message: 'Name this watchlist.',
    });
    expect(validateWatchlistName('x'.repeat(41), lists).ok).toBe(false);
    const ok = validateWatchlistName('  Žaljske delnice  ', lists);
    expect(ok).toMatchObject({ ok: true, value: 'Žaljske delnice' });
  });

  it('detects duplicates by normalised name and offers the existing list', () => {
    expect(validateWatchlistName('high   CONVICTION', lists)).toEqual({
      ok: false,
      message: 'This list already exists.',
      duplicateOf: 'a',
    });
    expect(validateWatchlistName('High conviction', lists, 'a').ok).toBe(true);
    expect(normalizeName('Ｈigh')).toBe('high');
  });
});

describe('account inputs', () => {
  it('validates email and the 12–128 character password rule', () => {
    expect(validateEmail('alex@example.com')).toBeUndefined();
    expect(validateEmail('alex@')).toBeDefined();
    expect(validateNewPassword('short')).toBe('Use at least 12 characters.');
    expect(validateNewPassword('a sufficiently long passphrase')).toBeUndefined();
  });
});
