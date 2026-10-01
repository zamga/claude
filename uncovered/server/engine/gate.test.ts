import { describe, expect, it } from 'vitest';
import { KRKA } from '../../src/report/krka';
import type { Report } from '../../src/report/types';
import { gate, sentences, withhold } from './gate';

const source = (id: string, quote: string) => ({
  id,
  title: 'T',
  publisher: 'P',
  url: 'https://x.si',
  grade: 'reported' as const,
  quote,
});

function report(over: Partial<Report>): Report {
  return {
    ...KRKA,
    headline: 'A steady compounder',
    summary: 'Revenue reached €48.3m[^a].',
    thesis: [
      { title: 'One', body: 'Fine.' },
      { title: 'Two', body: 'Fine.' },
      { title: 'Three', body: 'Fine.' },
    ],
    sections: [],
    risks: [1, 2, 3, 4].map((i) => ({ title: `Risk ${'abcd'[i - 1]}`, body: 'Text.', impact: 'low' as const })),
    catalysts: [],
    regionsNote: '',
    ownershipNote: '',
    sources: [source('a', 'Čisti prihodki 48.312.904 EUR'), source('b', 'Up 6,4 % on 2024')],
    ...over,
  };
}

const values = { 'fair.base': '€40m', g: '2.0%' };

describe('sentences', () => {
  it('splits at sentence ends, keeping notes with their sentence and not splitting at abbreviations', () => {
    expect(sentences('Primer d.o.o. grew.[^a] Revenue rose. Krka, d. d., Novo mesto pays. E.g. this.')).toEqual([
      'Primer d.o.o. grew.[^a]',
      'Revenue rose.',
      'Krka, d. d., Novo mesto pays.',
      'E.g. this.',
    ]);
  });
});

describe('the gate', () => {
  it('passes figures printed in the passages their sentence cites, and tokens', () => {
    expect(
      gate(report({ summary: 'Revenue was €48.3m[^a], up 6.4%[^b]. Value {{fair.base}} at {{g}} growth.' }), values),
    ).toEqual([]);
  });

  it('refuses a figure cited to a passage that does not print it', () => {
    const problems = gate(report({ summary: 'Revenue rose 6.4% to €48.3m[^a].' }), values);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.problem).toMatch(/"6.4%" is not printed/);
  });

  it('refuses a figure with no note, unknown notes and unknown tokens', () => {
    const problems = gate(report({ summary: 'Margins were 31.9%. See [^zz]. Worth {{fair.top}}.' }), values).map(
      (p) => p.problem,
    );
    expect(problems.some((p) => /has no source/.test(p))).toBe(true);
    expect(problems.some((p) => /\[\^zz\] is not a passage/.test(p))).toBe(true);
    expect(problems.some((p) => /\{\{fair.top\}\} is not one/.test(p))).toBe(true);
  });

  it('keeps titles free of figures and notes, and refuses ratings', () => {
    const problems = gate(
      report({
        headline: 'Revenue of €48m[^a]',
        summary: 'We rate the shares a buy; our target price is {{fair.base}}.',
      }),
      values,
    ).map((p) => `${p.where}: ${p.problem}`);
    expect(problems.some((p) => /^headline: Titles and notes are plain text/.test(p))).toBe(true);
    expect(problems.some((p) => /^summary: No ratings/.test(p))).toBe(true);
  });

  it('ignores years, dates and periods', () => {
    expect(
      gate(
        report({ summary: 'In 2025, and in H1 2026 and on 31 December 2025, nothing changed. The 2026E view holds.' }),
        values,
      ),
    ).toEqual([]);
  });

  it('withholds only the sentences whose figures cannot be traced', () => {
    const r = report({ summary: 'Revenue was €48.3m[^a]. Margins were 31.9%. Value is {{fair.base}}.' });
    const problems = gate(r, values);
    expect(withhold(r, problems)).toBe(1);
    expect(r.summary).toBe('Revenue was €48.3m[^a]. Value is {{fair.base}}.');
    expect(gate(r, values)).toEqual([]);
  });
});
