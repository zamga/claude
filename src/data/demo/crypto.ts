/**
 * Password hashing for the demo identity store (PBKDF2-SHA-256 via WebCrypto). The demo keeps
 * credentials in this browser only; a live build uses the managed provider (spec page 55).
 */
const ITERATIONS = 120_000;

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomHex(bytes = 16): string {
  const buffer = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buffer);
  return toHex(buffer);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromHex(saltHex) as BufferSource,
      iterations: ITERATIONS,
    },
    key,
    256,
  );
  return toHex(bits);
}

/** Constant-time comparison of two hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Precomputed hash of the published demo password so first load needs no key derivation. */
export const DEMO_EMAIL = 'alex@example.com';
export const DEMO_PASSWORD = 'stockpicks-demo';
export const DEMO_SALT = '5f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';
export const DEMO_PASSWORD_HASH =
  '107b4453e37a0aa4a088f7cb312008505cd2a91d477f38d02f58ae91900ae6a6';
