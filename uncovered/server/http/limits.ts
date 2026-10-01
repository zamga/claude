import { timingSafeEqual } from 'node:crypto';

/*
 * Who may start a run, and how often. Each run spends real money on the
 * model, so runs need an access code (unless the operator opened the
 * service), each address may start only a few an hour, and only a few run at
 * once.
 */

export function codeAccepted(given: string, codes: string[]): boolean {
  const a = Buffer.from(given.trim());
  let ok = false;
  for (const code of codes) {
    const b = Buffer.from(code);
    // Compare every code in constant time, so timing reveals nothing.
    if (a.length === b.length && timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

export class RateLimit {
  private readonly starts = new Map<string, number[]>();

  constructor(
    readonly perHour: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Whether this address may start another run now; records the start if so. */
  take(address: string): boolean {
    const hourAgo = this.now() - 3_600_000;
    const recent = (this.starts.get(address) ?? []).filter((t) => t > hourAgo);
    if (recent.length >= this.perHour) {
      this.starts.set(address, recent);
      return false;
    }
    recent.push(this.now());
    this.starts.set(address, recent);
    return true;
  }
}
