import { TOKEN } from '../../src/report/bindings';
import type { Report } from '../../src/report/types';
import { agrees, proseNumbers, sourceNumbers } from './normalize';

/*
 * The gate every engine report passes before anyone reads it. It holds the
 * report to the house rules in code: every note resolves to a quoted passage,
 * every model figure is a computed token, every other number in a sentence is
 * printed in a passage that sentence cites, titles carry no figures, and
 * nothing reads as a rating or a target price.
 */

export interface Problem {
  where: string;
  text: string;
  problem: string;
  /** A sentence whose figures cannot be traced, which can be withheld as a last resort. */
  sentence?: string;
}

const MARKER = /\[\^([\w-]+)\]/g;

/** Splits prose into sentences, keeping each sentence's trailing notes with it. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  const boundary = /[.!?](?:\[\^[\w-]+\])*(?=\s+[A-Z0-9“"‘'(])/g;
  let start = 0;
  for (const m of text.matchAll(boundary)) {
    const end = (m.index ?? 0) + m[0].length;
    const head = text.slice(start, end);
    // Abbreviations and initials do not end a sentence.
    if (
      /\b(?:d\.o\.o|d\.d|e\.g|i\.e|etc|inc|ltd|no|vs|approx|co|corp|mr|ms|dr|st|nos|cca|[A-Z])\.$/i.test(
        head.replace(/\[\^[\w-]+\]$/, ''),
      )
    )
      continue;
    out.push(head.trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

const RATING =
  /\b(?:buy|sell|hold|accumulate|reduce)[- ]rated\b|\b(?:buy|sell|hold|outperform|underperform|overweight|underweight|neutral) (?:rating|recommendation)\b|\btarget price\b|\bprice target\b|\bwe (?:recommend|rate)\b|\b(?:strong buy|outperform|underperform|overweight|underweight)\b/i;

const MARKDOWN = /\*\*|__|^#|\]\(|https?:\/\/|<\/?[a-z]/im;

interface Text {
  where: string;
  text: string;
  /** Titles and notes are shown as plain text: no notes, tokens or figures. */
  plain?: boolean;
}

export function textsOf(report: Report): Text[] {
  const texts: Text[] = [
    { where: 'headline', text: report.headline, plain: true },
    { where: 'summary', text: report.summary },
    ...report.thesis.flatMap((t, i) => [
      { where: `thesis ${i + 1} title`, text: t.title, plain: true },
      { where: `thesis ${i + 1}`, text: t.body },
    ]),
    ...report.sections.flatMap((s) => s.paragraphs.map((p, i) => ({ where: `${s.id} paragraph ${i + 1}`, text: p }))),
    ...report.risks.flatMap((r, i) => [
      { where: `risk ${i + 1} title`, text: r.title, plain: true },
      { where: `risk ${i + 1}`, text: r.body },
    ]),
    ...report.catalysts.map((c, i) => ({ where: `catalyst ${i + 1}`, text: c })),
    { where: 'regions note', text: report.regionsNote, plain: true },
    { where: 'ownership note', text: report.ownershipNote, plain: true },
  ];
  return texts.filter((t) => t.text.trim());
}

export function gate(report: Report, values: Record<string, string>): Problem[] {
  const problems: Problem[] = [];
  const quotes = new Map(report.sources.map((s) => [s.id, sourceNumbers(s.quote ?? '')]));

  for (const { where, text, plain } of textsOf(report)) {
    const add = (problem: string, sentence?: string) => problems.push({ where, text, problem, sentence });
    if (MARKDOWN.test(text)) add('Plain text only: no markdown, links or HTML.');
    if (RATING.test(text)) add('No ratings, recommendations or target prices.');
    for (const m of text.matchAll(MARKER))
      if (!quotes.has(m[1]!)) add(`The note [^${m[1]}] is not a passage in the dossier.`);
    for (const m of text.matchAll(TOKEN))
      if (values[m[1]!] === undefined) add(`The token {{${m[1]}}} is not one the model computes.`);
    if (plain) {
      if (/\[\^|\{\{/.test(text)) add('Titles and notes are plain text: no notes or tokens.');
      const numbers = proseNumbers(text);
      if (numbers.length)
        add(`Titles and notes carry no figures; found ${numbers.map((n) => `"${n.text.trim()}"`).join(', ')}.`);
      continue;
    }
    if (/^\s*\[\^/.test(text)) add('A note must follow the word it supports.');
    for (const sentence of sentences(text)) {
      const numbers = proseNumbers(sentence);
      if (numbers.length === 0) continue;
      const cited = [...sentence.matchAll(MARKER)].map((m) => m[1]!);
      const printed = cited.flatMap((id) => quotes.get(id) ?? []);
      for (const n of numbers) {
        if (agrees(n, printed)) continue;
        add(
          cited.length
            ? `"${n.text.trim()}" is not printed in the passage${cited.length > 1 ? 's' : ''} this sentence cites (${cited.map((c) => `[^${c}]`).join(', ')}). Cite the passage that prints it, or write the model's token if the model computes it.`
            : `"${n.text.trim()}" has no source in this sentence. Add the note of the passage that prints it, or write the model's token if the model computes it.`,
          sentence,
        );
      }
    }
  }

  if (!report.summary.trim()) problems.push({ where: 'summary', text: '', problem: 'The summary is empty.' });
  if (report.thesis.length < 2 || report.thesis.length > 4)
    problems.push({ where: 'thesis', text: '', problem: 'Give three thesis points.' });
  if (report.risks.length < 3) problems.push({ where: 'risks', text: '', problem: 'Give at least four risks.' });
  if (report.headline.split(/\s+/).length > 14)
    problems.push({ where: 'headline', text: report.headline, problem: 'Keep the headline to twelve words or fewer.' });
  return problems;
}

/** The problems as the writer will read them. */
export function describeProblems(problems: Problem[]): string {
  return problems
    .map((p) => `- ${p.where}: ${p.problem}${p.sentence ? `\n  Sentence: "${p.sentence}"` : ''}`)
    .join('\n');
}

/** Problems that withholding a sentence can cure, as the last resort. */
export function curable(problems: Problem[]): boolean {
  return problems.every((p) => p.sentence !== undefined);
}

/** Remove the sentences named in problems from the report's prose. Returns how many were withheld. */
export function withhold(report: Report, problems: Problem[]): number {
  const bad = new Set(problems.map((p) => p.sentence).filter((s): s is string => Boolean(s)));
  if (bad.size === 0) return 0;
  let removed = 0;
  const clean = (text: string) => {
    const kept = sentences(text).filter((s) => {
      const drop = bad.has(s);
      if (drop) removed++;
      return !drop;
    });
    return kept.join(' ');
  };
  report.summary = clean(report.summary);
  report.thesis = report.thesis.map((t) => ({ ...t, body: clean(t.body) }));
  report.sections = report.sections.map((s) => ({ ...s, paragraphs: s.paragraphs.map(clean).filter((p) => p.trim()) }));
  report.risks = report.risks.map((r) => ({ ...r, body: clean(r.body) })).filter((r) => r.body.trim());
  report.catalysts = report.catalysts.map(clean).filter((c) => c.trim());
  return removed;
}
