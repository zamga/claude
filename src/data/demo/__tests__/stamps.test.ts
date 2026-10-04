import { beforeAll, describe, expect, it } from 'vitest';
import { DEMO_START } from '../clock';

/** The tests run in Node: a minimal in-memory localStorage for the demo database and session. */
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe('demo content timestamps', () => {
  it('belong to the simulated session and stay strictly ordered while its clock stands still', async () => {
    const { DemoServer } = await import('../server');
    const { DEMO_EMAIL, DEMO_PASSWORD } = await import('../crypto');
    const server = new DemoServer();
    await server.signIn(DEMO_EMAIL, DEMO_PASSWORD, 'Vitest');
    const first = server.saveReport('rep_tsm_thesis', 1);
    const second = server.saveReport('rep_msft_thesis', 1);
    // Saved "21 Oct 2026" in the session, never the wall-clock date the test happens to run on.
    expect(Date.parse(first.savedAt)).toBe(DEMO_START);
    expect(Date.parse(second.savedAt)).toBe(DEMO_START + 1000);
  });
});
