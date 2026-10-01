import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RunRecord } from '../../src/lib/run';
import type { Report } from '../../src/report/types';
import { runEngine, type EngineRequest } from '../engine/pipeline';
import { primerClient, primerPdf } from '../fixtures/primer';
import type { Engine } from './api';
import { readConfig } from './config';
import { RateLimit } from './limits';
import { createApp } from './server';
import { StaticSite } from './static';
import { newId, Store } from './store';

let dir: string;
let server: Server;
let store: Store;
let base = '';
const received: EngineRequest[] = [];
const script = `export const lines = [${Array.from({ length: 400 }, (_, i) => `'line ${i}'`).join(', ')}];\n`;

/** The engine, scripted: whatever is asked, it researches the fixture company from its test PDF. */
const engine: Engine = async (request, signal, emit) => {
  received.push(request);
  const pdf = new Uint8Array(await readFile(primerPdf()));
  return runEngine(
    { ...request, uploads: [{ name: 'primer-letno-porocilo-2025.pdf', type: 'application/pdf', bytes: pdf }] },
    { client: primerClient(), userAgent: 'Uncovered-test', signal },
    emit,
  );
};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uncovered-'));
  const built = join(dir, 'dist');
  await mkdir(join(built, 'assets'), { recursive: true });
  await writeFile(join(built, '404.html'), '<!doctype html><title>Not found</title>');
  await writeFile(join(built, 'index.html'), '<!doctype html><head><title>Home</title></head>');
  await writeFile(join(built, 'initiate.html'), '<!doctype html><head><title>Built for a static host</title></head>');
  await writeFile(join(built, 'assets', 'app-4f2a.js'), script);
  const site = new StaticSite(built, '<meta name="uncovered-engine" content="fixture" data-access="code">', {
    'initiate.html': '<!doctype html><head><title>Rendered for this server</title></head>',
  });
  expect(await site.warm()).toBe(4);
  const config = readConfig(
    // One run an hour per address: refused requests do not count against it.
    { UNCOVERED_ENGINE: 'fixture', UNCOVERED_ACCESS_CODES: 'beta-2026', UNCOVERED_RATE_LIMIT: '1' },
    dir,
  );
  store = new Store(join(dir, 'data'));
  await store.open();
  let n = 0;
  const app = createApp({
    config,
    store,
    limits: new RateLimit(config.perHour),
    engine,
    site,
    random: () => `t${++n}`,
  });
  server = createServer((req, res) => void app(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await store.flush();
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
});

function form(fields: Record<string, string>, file?: { name: string; bytes: Uint8Array<ArrayBuffer> }) {
  const f = new FormData();
  const all = {
    company: 'Primer d.o.o.',
    country: 'Slovenia',
    listing: 'private',
    purpose: 'Credit',
    code: 'beta-2026',
    ...fields,
  };
  for (const [k, v] of Object.entries(all)) f.set(k, v);
  if (file) f.append('files', new Blob([new Uint8Array(file.bytes)], { type: 'application/pdf' }), file.name);
  return f;
}

/** Every event of a run, read from its stream until it ends (only those after `after`, if given). */
async function events(id: string, after?: number): Promise<{ type: string; reportId?: string }[]> {
  const res = await fetch(`${base}/api/initiations/${id}/events${after === undefined ? '' : `?after=${after}`}`);
  expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
  const text = await res.text();
  return text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)) as { type: string; reportId?: string });
}

describe('the server', () => {
  it('says what it can do', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(await res.json()).toMatchObject({ engine: 'fixture', access: 'code' });
  });

  it('says so in every page, and serves the pages it rendered for itself', async () => {
    expect(await (await fetch(`${base}/`)).text()).toContain('<meta name="uncovered-engine" content="fixture"');
    const initiate = await (await fetch(`${base}/initiate`)).text();
    expect(initiate).toContain('Rendered for this server');
    expect(initiate).not.toContain('Built for a static host');
  });

  it('sends text compressed, and keeps hashed assets for a year', async () => {
    const res = await fetch(`${base}/assets/app-4f2a.js`, { headers: { 'accept-encoding': 'br' } });
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await res.text()).toBe(script);
    const plain = await fetch(`${base}/assets/app-4f2a.js`, { headers: { 'accept-encoding': 'identity' } });
    expect(plain.headers.get('content-encoding')).toBeNull();
    expect(Number(plain.headers.get('content-length'))).toBe(Buffer.byteLength(script));
  });

  it('refuses a wrong access code before anything else', async () => {
    const res = await fetch(`${base}/api/initiations`, { method: 'POST', body: form({ code: 'guess', company: '' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ field: 'code' });
  });

  it('says which field is wrong', async () => {
    const res = await fetch(`${base}/api/initiations`, { method: 'POST', body: form({ company: 'X' }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ field: 'company' });
    const country = await fetch(`${base}/api/initiations`, { method: 'POST', body: form({ country: 'Atlantis' }) });
    expect(await country.json()).toMatchObject({ field: 'country' });
  });

  it('runs a request with its files, streams the run and serves the report', async () => {
    const pdf = new Uint8Array(await readFile(primerPdf()));
    const res = await fetch(`${base}/api/initiations`, {
      method: 'POST',
      body: form({ focus: 'Could it borrow more?' }, { name: 'letno-porocilo.pdf', bytes: pdf }),
    });
    expect(res.status).toBe(202);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^primer-t\d+$/);
    // The file reached the engine whole.
    expect(received.at(-1)?.uploads.map((u) => [u.name, u.bytes.length])).toEqual([['letno-porocilo.pdf', pdf.length]]);
    expect(received.at(-1)?.question).toBe('Could it borrow more?');

    const stream = await events(id);
    expect(stream[0]).toMatchObject({ type: 'stage' });
    expect(stream.at(-1)).toMatchObject({ type: 'done', reportId: id });

    const run = (await (await fetch(`${base}/api/initiations/${id}`)).json()) as RunRecord;
    expect(run.status).toBe('done');
    expect(run.request.files).toEqual([{ name: 'letno-porocilo.pdf', size: pdf.length }]);
    const report = (await (await fetch(`${base}/api/reports/${id}`)).json()) as Report;
    expect(report).toMatchObject({ id, kind: 'engine', company: { legalName: 'Primer d.o.o.' } });
    // A finished run's stream replays it and ends; a page showing some of it asks only for the rest.
    expect((await events(id)).at(-1)).toMatchObject({ type: 'done' });
    expect(await events(id, stream.length - 3)).toEqual(stream.slice(-2));
    expect(await events(id, stream.length - 1)).toEqual([]);
  });

  it('limits how many runs one address starts, counting only runs it accepted', async () => {
    const res = await fetch(`${base}/api/initiations`, { method: 'POST', body: form({}) });
    expect(res.status).toBe(429);
  });

  it('answers unknown runs, reports and pages with 404', async () => {
    expect((await fetch(`${base}/api/initiations/nothing-here`)).status).toBe(404);
    expect((await fetch(`${base}/api/reports/nothing-here`)).status).toBe(404);
    expect((await fetch(`${base}/api/reports/..%2F..%2Fetc`)).status).toBe(404);
    const page = await fetch(`${base}/no/such/page`);
    expect(page.status).toBe(404);
    expect(await page.text()).toContain('Not found');
  });
});

describe('ids', () => {
  it('reads as the company name with a random tail', () => {
    expect(newId('Krka, d. d., Novo mesto', () => 'abc123')).toBe('krka-novo-mesto-abc123');
    expect(newId('Pošta Slovenije d.o.o.', () => 'x1')).toBe('posta-slovenije-x1');
    expect(newId('***', () => 'x1')).toBe('company-x1');
  });
});

describe('configuration', () => {
  it('will not run a live engine that anyone could spend', () => {
    expect(() => readConfig({ ANTHROPIC_API_KEY: 'sk-test' })).toThrow(/UNCOVERED_ACCESS_CODES/);
    expect(readConfig({ ANTHROPIC_API_KEY: 'sk-test', UNCOVERED_OPEN: '1' }).engine).toBe('live');
    expect(readConfig({}).engine).toBe('off');
  });
});
