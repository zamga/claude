import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunRecord } from '../../src/lib/run';
import type { Report } from '../../src/report/types';
import type { Audit, EngineEvent } from '../engine/pipeline';

/*
 * Runs and the reports they produce, kept as JSON files under the data
 * directory and in memory while the server runs. A file is written whole and
 * renamed into place, so a crash never leaves half a report. Documents the
 * requester uploads are never written to disk.
 */

export type JobStatus = 'running' | 'done' | 'failed';

export interface StoredEvent {
  at: string;
  event: EngineEvent;
}

/** A run as stored: what was asked (without the uploaded files' contents) and every event. */
export type Job = RunRecord;

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

async function writeJson(file: string, value: unknown) {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value));
  await rename(tmp, file);
}

export class Store {
  private readonly jobs = new Map<string, Job>();
  private readonly listeners = new Map<string, Set<(e: StoredEvent) => void>>();
  private writes = new Map<string, Promise<void>>();

  constructor(readonly dir: string) {}

  /** Load past runs. A run the server was in the middle of when it stopped is marked failed. */
  async open() {
    for (const sub of ['jobs', 'reports', 'audits']) await mkdir(join(this.dir, sub), { recursive: true });
    for (const name of await readdir(join(this.dir, 'jobs'))) {
      if (!name.endsWith('.json')) continue;
      try {
        const job = JSON.parse(await readFile(join(this.dir, 'jobs', name), 'utf8')) as Job;
        if (job.status === 'running') {
          job.status = 'failed';
          job.error = 'The server restarted while this report was being researched. Please start it again.';
          job.events.push({ at: new Date().toISOString(), event: { type: 'failed', message: job.error } });
          await writeJson(join(this.dir, 'jobs', name), job);
        }
        this.jobs.set(job.id, job);
      } catch {
        // A damaged file is skipped, not fatal.
      }
    }
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  running(): number {
    let n = 0;
    for (const j of this.jobs.values()) if (j.status === 'running') n++;
    return n;
  }

  create(job: Job) {
    this.jobs.set(job.id, job);
    this.persist(job);
  }

  /** Record an event, tell anyone watching, and save. */
  push(id: string, event: EngineEvent) {
    const job = this.jobs.get(id);
    if (!job) return;
    const stored = { at: new Date().toISOString(), event };
    job.events.push(stored);
    if (event.type === 'done') job.status = 'done';
    if (event.type === 'failed') {
      job.status = 'failed';
      job.error = event.message;
    }
    this.listeners.get(id)?.forEach((l) => l(stored));
    this.persist(job);
  }

  /** Follow a run's events; returns a function that stops following. */
  watch(id: string, listener: (e: StoredEvent) => void): () => void {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(id);
    };
  }

  /** Writes to one file happen one after another, the last one winning. */
  private persist(job: Job) {
    const file = join(this.dir, 'jobs', `${job.id}.json`);
    const previous = this.writes.get(file) ?? Promise.resolve();
    const next = previous.then(() => writeJson(file, job)).catch(() => {});
    this.writes.set(file, next);
  }

  async flush() {
    await Promise.all(this.writes.values());
  }

  async saveReport(report: Report, audit: Audit) {
    await writeJson(join(this.dir, 'reports', `${report.id}.json`), report);
    await writeJson(join(this.dir, 'audits', `${report.id}.json`), audit);
  }

  async report(id: string): Promise<Report | undefined> {
    if (!ID.test(id)) return undefined;
    try {
      return JSON.parse(await readFile(join(this.dir, 'reports', `${id}.json`), 'utf8')) as Report;
    } catch {
      return undefined;
    }
  }
}

/** An id for a new report: the company's name, readable in an address, and a random tail. */
export function newId(company: string, random: () => string): string {
  const slug = company
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\b(?:d\.?\s?o\.?\s?o|d\.?\s?d|ltd|plc|gmbh|ag|s\.?a|inc|llc)\.?\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return `${slug || 'company'}-${random()}`;
}
