import { KRKA } from './krka';
import type { Report } from './types';

/*
 * The reports this page can show without asking the server: the sample, and a
 * report the server rendered into the page it sent (registered before the page
 * hydrates, so the markup matches). Any other report is fetched by id.
 */
const reports = new Map<string, Report>([[KRKA.id, KRKA]]);

/** On a server that renders many reports, keep only the most recent few in memory. */
const KEEP = 64;

export function registerReport(report: Report) {
  reports.delete(report.id);
  reports.set(report.id, report);
  for (const id of reports.keys()) {
    if (reports.size <= KEEP) break;
    if (id !== KRKA.id) reports.delete(id);
  }
}

export function findReport(id: string): Report | undefined {
  return reports.get(id);
}

/** A report id as it may appear in an address: lowercase letters, digits and hyphens. */
export const REPORT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** The id of the report an address shows, if it is a report's address. */
export function reportIdOf(path: string): string | undefined {
  const m = /^\/report\/([^/]+)$/.exec(path);
  return m && REPORT_ID.test(m[1]!) ? m[1] : undefined;
}

const pending = new Map<string, Promise<Report | null>>();

/** Fetch a report the engine has written, once per id. Null when there is no such report. */
export function fetchReport(id: string): Promise<Report | null> {
  let p = pending.get(id);
  if (!p) {
    p = fetch(`/api/reports/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } }).then(
      async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`The report could not be loaded (${res.status}).`);
        const report = (await res.json()) as Report;
        registerReport(report);
        return report;
      },
    );
    // A failed request can be retried later.
    p.catch(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}
