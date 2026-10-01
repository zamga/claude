import { describe, expect, it } from 'vitest';
import { bindings } from '../../src/report/bindings';
import { valueReport } from '../../src/report/valuation';
import { primerClient, primerRequest } from '../fixtures/primer';
import { gate } from './gate';
import { runEngine, type EngineEvent } from './pipeline';

describe('an initiation from request to checked report', () => {
  it('researches, models, writes, catches a misattributed figure and publishes a traced report', async () => {
    const client = primerClient();
    const events: EngineEvent[] = [];
    const { report, audit } = await runEngine(await primerRequest(), { client, userAgent: 'Uncovered-test' }, (e) =>
      events.push(e),
    );

    // Every stage ran, in order, and the run ended well.
    const stages = events.filter((e) => e.type === 'stage').map((e) => `${e.stage}:${e.status}`);
    expect(stages).toEqual([
      'research:active',
      'research:done',
      'model:active',
      'model:done',
      'write:active',
      'write:done',
      'check:active',
      'check:done',
    ]);
    expect(events.at(-1)).toEqual({ type: 'done', reportId: 'primer-test' });

    // The first draft cited 6.4% to a passage that does not print it; the redraft passed.
    expect(audit.writeRounds).toBe(2);
    expect(audit.withheld).toBe(0);
    expect(events.some((e) => e.type === 'activity' && /1 problem sent back/.test(e.text))).toBe(true);

    // A private company is valued as a whole, in euros, from verified figures converted in code.
    expect(report.kind).toBe('engine');
    expect(report.assumptions.basis).toBe('equity');
    expect(report.base).toEqual({ year: '2025A', revenue: 48.312904, ebitda: 5.73122 + 2.104556, netProfit: 4.402118 });
    expect(report.assumptions.netCash).toBeCloseTo(6.2184 - 3.1, 6);
    const v = valueReport(report);
    expect(v.methods.map((m) => m.id)).toEqual(['dcf', 'ev']);
    expect(v.fair.low).toBeLessThan(v.fair.high);

    // Nothing unsupported got through, and every cited passage is verbatim, with its page.
    expect(gate(report, bindings(report))).toEqual([]);
    expect(report.sources.length).toBeGreaterThan(5);
    for (const s of report.sources) {
      expect(s.quoted).toBe('verbatim');
      expect(s.page).toBeGreaterThan(0);
      expect(s.supplied).toBe(true);
      // The document was called an audited report without a passage to show it, so it stays reported.
      expect(s.grade).toBe('reported');
    }
    // EBITDA is derived (operating profit plus depreciation), so the report says so.
    expect(report.disclosures?.some((d) => /operating profit plus depreciation/.test(d))).toBe(true);
    expect(report.disclosures?.some((d) => /could not establish: the main customers/.test(d))).toBe(true);
    expect(report.question).toBe('Could the company take on more bank debt?');
    expect(report.sections.map((s) => s.id)).toContain('question');
    expect(audit.usage.calls).toBe(client.calls.length);
  });

  it('refuses to model a company with no reported revenue', async () => {
    const request = await primerRequest();
    const client = primerClient();
    // A run whose research records nothing: finish at once.
    const quiet = {
      ...client,
      async send(params: Parameters<typeof client.send>[0], signal?: AbortSignal) {
        if (params.tools?.length) {
          const reply = await client.send(params, signal);
          return {
            ...reply,
            message: {
              ...reply.message,
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu_x',
                  name: 'finish_research',
                  input: { summary: 'Nothing found.', gaps: [] },
                  caller: { type: 'direct' },
                },
              ],
              stop_reason: 'tool_use',
            },
          } as typeof reply;
        }
        return client.send(params, signal);
      },
    };
    await expect(runEngine(request, { client: quiet, userAgent: 'Uncovered-test' }, () => {})).rejects.toThrow(
      /No reported revenue/,
    );
  });
});
