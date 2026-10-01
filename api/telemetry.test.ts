import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './telemetry';
import { MAX_BATCH_BYTES, parseBatch, routeTemplate } from '../src/lib/telemetry-schema';

const batch = {
  v: 1,
  view: '3f0c1d5e-7a2b-4c9d-8e1f-0a1b2c3d4e5f',
  build: 'abc1234',
  device: { viewport: 's', memory: 4, network: '4g', userAgent: 'should be dropped' },
  records: [
    {
      kind: 'vital',
      t: 2400.4,
      route: '/chart/nvda?s=SECRETTOKEN',
      name: 'LCP',
      value: 1830,
      rating: 'good',
      metricId: 'v5-1-1',
      navigation: 'navigate',
      target: 'main>h1',
    },
    { kind: 'action', t: 9000, route: '/chart/nvda', name: 'story', detail: 'breakout' },
    { kind: 'action', t: 9100, route: '/chart/nvda', name: 'not-an-action' },
    { kind: 'error', t: 12000, route: '/survey', message: 'x is undefined', source: '/assets/index.js', line: 1, col: 99 },
  ],
};

const post = (body: string, headers: Record<string, string> = {}) =>
  POST(
    new Request('https://plimsoll.test/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8', origin: 'https://plimsoll.test', ...headers },
      body,
    }),
  );

describe('routeTemplate', () => {
  it('keeps known routes and strips tokens', () => {
    expect(routeTemplate('/')).toBe('/');
    expect(routeTemplate('/Atlas/')).toBe('/atlas');
    expect(routeTemplate('/chart/NVDA?s=abc')).toBe('/chart/nvda');
    expect(routeTemplate('/chart/brk.b')).toBe('/chart/brk.b');
    expect(routeTemplate('/chart/custom~TOKEN')).toBe('/chart/custom');
  });

  it('folds anything else into a fixed set', () => {
    expect(routeTemplate('/chart/<script>')).toBe('/chart/*');
    expect(routeTemplate('/users/jane.doe@example.com')).toBe('/404');
  });
});

describe('parseBatch', () => {
  it('drops unknown fields and records, and templates routes', () => {
    const parsed = parseBatch(batch);
    expect(parsed).not.toBeNull();
    expect(parsed!.device).toEqual({ viewport: 's', memory: 4, network: '4g' });
    expect(parsed!.records).toHaveLength(3);
    expect(parsed!.records[0]).toMatchObject({ route: '/chart/nvda', t: 2400, name: 'LCP' });
    expect(JSON.stringify(parsed)).not.toContain('SECRETTOKEN');
  });

  it('rejects the wrong version, a missing view, or no valid records', () => {
    expect(parseBatch({ ...batch, v: 2 })).toBeNull();
    expect(parseBatch({ ...batch, view: '' })).toBeNull();
    expect(parseBatch({ ...batch, records: [{ kind: 'vital', name: 'FID', value: 3 }] })).toBeNull();
    expect(parseBatch('nonsense')).toBeNull();
  });

  it('caps long strings', () => {
    const long = { kind: 'error', t: 1, route: '/', message: 'm'.repeat(5000), stack: 's'.repeat(5000) };
    const parsed = parseBatch({ ...batch, records: [long] });
    const record = parsed!.records[0]!;
    expect(record.kind === 'error' && record.message.length).toBe(300);
    expect(record.kind === 'error' && record.stack?.length).toBe(1200);
  });
});

describe('POST /api/telemetry', () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('logs one line per valid record and answers 204', async () => {
    const res = await post(JSON.stringify(batch), { 'x-vercel-ip-country': 'NO' });
    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(3);
    const first = JSON.parse(String(log.mock.calls[0]![0]));
    expect(first).toMatchObject({ type: 'plimsoll.telemetry', country: 'NO', build: 'abc1234', name: 'LCP' });
    expect(first.received).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('refuses other sites, oversized and malformed bodies', async () => {
    expect((await post(JSON.stringify(batch), { origin: 'https://elsewhere.test' })).status).toBe(403);
    expect((await post('x'.repeat(MAX_BATCH_BYTES + 1))).status).toBe(413);
    expect((await post('{not json')).status).toBe(400);
    expect((await post(JSON.stringify({ v: 1, view: 'a', records: [] }))).status).toBe(422);
    expect(log).not.toHaveBeenCalled();
  });

  it('forwards NDJSON with a bearer token when configured', async () => {
    vi.stubEnv('TELEMETRY_FORWARD_URL', 'https://ingest.test/v1/events');
    vi.stubEnv('TELEMETRY_FORWARD_TOKEN', 'secret');
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const res = await post(JSON.stringify(batch));
    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ingest.test/v1/events');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret');
    expect(String(init.body).trim().split('\n')).toHaveLength(3);
  });

  it('still answers 204 when forwarding fails', async () => {
    vi.stubEnv('TELEMETRY_FORWARD_URL', 'https://ingest.test/v1/events');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    expect((await post(JSON.stringify(batch))).status).toBe(204);
  });
});
