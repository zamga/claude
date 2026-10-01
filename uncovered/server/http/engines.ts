import { readFile } from 'node:fs/promises';
import { anthropicClient } from '../engine/claude';
import { runEngine } from '../engine/pipeline';
import { primerClient, primerPdf } from '../fixtures/primer';
import type { Engine } from './api';
import type { Config } from './config';

/** The engine itself: Claude, through the pipeline. */
export function liveEngine(config: Config): Engine {
  const client = anthropicClient(config.apiKey);
  return (request, signal, emit) => runEngine(request, { client, userAgent: config.userAgent, signal }, emit);
}

/**
 * The scripted engine, for demonstrations and end-to-end tests without an API
 * key. Whatever is asked, it researches the fictional Primer d.o.o. from its
 * test annual report, at a human pace, and says so in the report.
 */
export function fixtureEngine(config: Config, pace = config.fixturePace): Engine {
  return async (request, signal, emit) => {
    const bytes = new Uint8Array(await readFile(primerPdf(config.root)));
    const scripted = {
      ...request,
      listing: 'private' as const,
      uploads: [{ name: 'primer-letno-porocilo-2025.pdf', type: 'application/pdf', bytes }],
    };
    const result = await runEngine(scripted, { client: primerClient(pace), userAgent: config.userAgent, signal }, emit);
    result.report.disclosures = [
      'This report was produced by the engine’s scripted test run, from the annual report of Primer d.o.o., a fictional company made for testing. It is not research on any real company.',
      ...(result.report.disclosures ?? []),
    ];
    return result;
  };
}
