/**
 * POST /api/telemetry
 *
 * Collector for the field telemetry sent by src/lib/telemetry.ts. Each batch
 * is validated and trimmed (see parseBatch), stamped with the receive time and
 * the visitor's country from the edge network's geolocation header (the IP
 * address itself is never read or kept), and written to the function log as
 * one JSON line per record, ready for a log drain. When TELEMETRY_FORWARD_URL
 * is set, the same lines are also posted there as NDJSON.
 *
 * Environment:
 *   TELEMETRY_FORWARD_URL    optional NDJSON ingest endpoint, e.g. a log-analytics dataset
 *   TELEMETRY_FORWARD_TOKEN  optional bearer token for that endpoint
 */
import { MAX_BATCH_BYTES, parseBatch } from '../src/lib/telemetry-schema.ts';

const done = (status: number) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  // Beacons from this site only. Browsers always send Origin on a cross-site POST.
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null' && new URL(origin).host !== new URL(request.url).host) return done(403);

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BATCH_BYTES) return done(413);
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BATCH_BYTES) return done(413);

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return done(400);
  }
  const batch = parseBatch(raw);
  if (!batch) return done(422);

  const received = new Date().toISOString();
  const country = request.headers.get('x-vercel-ip-country');
  const lines = batch.records.map((record) =>
    JSON.stringify({
      type: 'plimsoll.telemetry',
      received,
      ...(country ? { country } : {}),
      view: batch.view,
      build: batch.build,
      device: batch.device,
      ...record,
    }),
  );
  for (const line of lines) console.log(line);

  const forward = process.env.TELEMETRY_FORWARD_URL;
  if (forward) {
    const token = process.env.TELEMETRY_FORWARD_TOKEN;
    try {
      const res = await fetch(forward, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-ndjson',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: lines.join('\n') + '\n',
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) console.warn(`telemetry forward: ${res.status}`);
    } catch (error) {
      console.warn(`telemetry forward: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // The beacon does not read the answer; 204 keeps it to headers.
  return done(204);
}
