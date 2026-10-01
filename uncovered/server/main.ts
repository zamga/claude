import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { engineMeta, type EngineStatus } from '../src/lib/run';
import { ConfigError, readConfig } from './http/config';
import { fixtureEngine, liveEngine } from './http/engines';
import { RateLimit } from './http/limits';
import { ReportRenderer } from './http/render';
import { createApp } from './http/server';
import { StaticSite } from './http/static';
import { Store } from './http/store';

/*
 * Uncovered's server: the site, the research engine's API and engine reports.
 * Configured from the environment; see README.md.
 */

async function main() {
  const config = readConfig();
  const store = new Store(config.dataDir);
  await store.open();
  const engine =
    config.engine === 'live' ? liveEngine(config) : config.engine === 'fixture' ? fixtureEngine(config) : undefined;
  const status: EngineStatus | undefined = engine
    ? { engine: config.engine, access: config.accessCodes.length && !config.open ? 'code' : 'open' }
    : undefined;
  // Every page says whether this server runs the engine, so the request page knows without asking,
  // and the request page itself is rendered for this server: its first paint already shows the engine.
  const head = status ? engineMeta(status) : '';
  const renderer = await ReportRenderer.load(config.root, config.siteUrl, head, status);
  const pages: Record<string, string> = status ? { 'initiate.html': await renderer.route('/initiate') } : {};
  const site = new StaticSite(join(config.root, 'dist'), head, pages);
  await site.warm();
  const app = createApp({
    config,
    store,
    limits: new RateLimit(config.perHour),
    engine,
    site,
    renderer,
    random: () => randomBytes(4).toString('hex').slice(0, 6),
  });
  const server = createServer((req, res) => void app(req, res));
  // Runs stream progress for many minutes; keep their connections open.
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  server.listen(config.port, config.host, () => {
    console.info(
      `[uncovered] listening on http://${config.host}:${config.port} · engine ${config.engine}${config.engine === 'fixture' ? ' (scripted test run)' : ''} · access ${config.accessCodes.length && !config.open ? 'by code' : 'open'} · data in ${config.dataDir}`,
    );
  });
  const stop = () => {
    console.info('[uncovered] stopping');
    server.close();
    void store.flush().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e: unknown) => {
  console.error(e instanceof ConfigError ? `[uncovered] ${e.message}` : e);
  process.exit(1);
});
