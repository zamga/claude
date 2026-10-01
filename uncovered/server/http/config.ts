import { resolve } from 'node:path';

/*
 * Everything the server reads from its environment, in one place, with the
 * rules that keep a misconfigured server from spending money: a live engine
 * needs access codes unless the operator opens it on purpose.
 */

export type EngineMode = 'live' | 'fixture' | 'off';

export interface Config {
  port: number;
  host: string;
  root: string;
  dataDir: string;
  siteUrl?: string;
  engine: EngineMode;
  apiKey?: string;
  accessCodes: string[];
  open: boolean;
  maxConcurrent: number;
  perHour: number;
  runMinutes: number;
  trustProxy: boolean;
  userAgent: string;
  /** For the scripted engine: milliseconds each scripted model call takes. */
  fixturePace: number;
}

export class ConfigError extends Error {}

const int = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export function readConfig(env: NodeJS.ProcessEnv = process.env, root = process.cwd()): Config {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || undefined;
  const requested = env.UNCOVERED_ENGINE?.trim().toLowerCase();
  const engine: EngineMode =
    requested === 'fixture' || requested === 'off' || requested === 'live' ? requested : apiKey ? 'live' : 'off';
  if (engine === 'live' && !apiKey) throw new ConfigError('UNCOVERED_ENGINE=live needs ANTHROPIC_API_KEY.');
  const accessCodes = (env.UNCOVERED_ACCESS_CODES ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const open = env.UNCOVERED_OPEN === '1';
  if (engine === 'live' && accessCodes.length === 0 && !open)
    throw new ConfigError(
      'A live engine spends money on every request. Set UNCOVERED_ACCESS_CODES (comma-separated), or UNCOVERED_OPEN=1 to accept requests from anyone.',
    );
  const siteUrl = env.SITE_URL?.trim().replace(/\/+$/, '') || undefined;
  return {
    port: int(env.PORT, 8080),
    host: env.HOST?.trim() || '0.0.0.0',
    root,
    dataDir: resolve(root, env.UNCOVERED_DATA_DIR?.trim() || 'data'),
    siteUrl,
    engine,
    apiKey,
    accessCodes,
    open,
    maxConcurrent: int(env.UNCOVERED_MAX_CONCURRENT, 2),
    perHour: int(env.UNCOVERED_RATE_LIMIT, 3),
    runMinutes: int(env.UNCOVERED_RUN_MINUTES, 30),
    trustProxy: env.UNCOVERED_TRUST_PROXY === '1',
    userAgent: `Uncovered/1.0 (research engine${siteUrl ? `; +${siteUrl}/method` : ''})`,
    fixturePace: int(env.UNCOVERED_FIXTURE_PACE, 450),
  };
}
