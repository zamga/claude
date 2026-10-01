import { describe, expect, it } from 'vitest';
import { EMPTY_RUN, fold, renderedAddress, runAddress, runProgress } from './run';

describe('run addresses', () => {
  it('render the request page for the run it follows, and ignore other parameters', () => {
    const at = (path: string, search = '') => renderedAddress(path, new URLSearchParams(search));
    expect(at('/initiate', '?run=primer-3f9a2c')).toBe('/initiate?run=primer-3f9a2c');
    expect(at('/initiate', '?run=primer-3f9a2c&utm_source=mail')).toBe(runAddress('primer-3f9a2c'));
    expect(at('/initiate', '?run=')).toBe('/initiate');
    expect(at('/initiate')).toBe('/initiate');
    expect(at('/report/krka', '?utm_source=mail')).toBe('/report/krka');
    expect(at('/', '?run=primer-3f9a2c')).toBe('/');
    expect(runAddress('a b')).toBe('/initiate?run=a%20b');
  });
});

describe('a run folded from its events', () => {
  it('counts the evidence, keeps the newest notes first and ends where the run ended', () => {
    const view = [
      { type: 'stage', stage: 'research', status: 'active' },
      { type: 'activity', stage: 'research', text: 'Searched' },
      { type: 'evidence', documents: 1, passages: 4, figures: 2, rejected: 1 },
      { type: 'activity', stage: 'research', text: 'Read the annual report' },
      { type: 'stage', stage: 'research', status: 'done' },
      { type: 'done', reportId: 'primer-3f9a2c' },
    ].reduce((v, e, i) => fold(v, e as Parameters<typeof fold>[1], `2026-10-01T12:00:0${i}.000Z`), EMPTY_RUN);
    expect(view.evidence).toEqual({ documents: 1, passages: 4, figures: 2, rejected: 1 });
    expect(view.activity.map((a) => a.text)).toEqual(['Read the annual report', 'Searched']);
    expect(view).toMatchObject({ status: 'done', reportId: 'primer-3f9a2c', endedAt: '2026-10-01T12:00:05.000Z' });
    expect(runProgress(view)).toBe(1);
    expect(runProgress(EMPTY_RUN)).toBeLessThan(0.1);
  });
});
