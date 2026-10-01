import { proseOf } from '../../src/report/bindings';
import type { Breakdown, Line, Report, Section, Source } from '../../src/report/types';
import { longDate, moneyFor, num, pct } from '../../src/lib/format';
import type { History, Point } from './history';
import type { Identity, Ledger } from './ledger';
import type { ModelResult } from './model';
import type { Prose } from './write';

/*
 * The report, put together from the evidence and the model: reported lines
 * with a note on every cell, breakdowns, key facts and market data from the
 * ledger; assumptions from the model; words from the writer. Only passages
 * the report cites become sources, ordered by document so each document's
 * passages are numbered together.
 */

export interface AssemblyInput {
  id: string;
  date: string;
  request: { company: string; country: string; countryCode: string; question?: string };
  identity?: Identity;
  ledger: Ledger;
  history: History;
  model: ModelResult;
  prose: Prose;
  gaps: string[];
}

const FY = /^FY(\d{4})$/;
const reportPeriod = (p: string) => p.replace(FY, '$1A');

const MARKER = /\[\^([\w-]+)\]/g;

/** Notes follow their word: "€48.3m[^p4]", never "€48.3m [^p4]". */
export function tidyProse(text: string): string {
  return text
    .replace(/\s+(\[\^[\w-]+\])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function line(
  label: string,
  unit: Line['unit'],
  points: Record<string, Point>,
  derived: string[] = [],
  emphasis = false,
): Line | undefined {
  const entries = Object.entries(points);
  if (entries.length === 0) return undefined;
  return {
    label,
    unit,
    emphasis: emphasis || undefined,
    values: Object.fromEntries(entries.map(([p, v]) => [reportPeriod(p), v.value])),
    // A derived cell is arithmetic on two reported lines, not a figure any passage prints.
    sources: Object.fromEntries(
      entries.filter(([p]) => !derived.includes(p)).map(([p, v]) => [reportPeriod(p), v.passageId]),
    ),
  };
}

/** The latest breakdown of a kind, as the report's exhibit draws it. */
function breakdown(ledger: Ledger, kinds: ('region' | 'segment' | 'shareholder')[]) {
  for (const kind of kinds) {
    const items = ledger.breakdowns.filter((b) => b.kind === kind);
    if (items.length === 0) continue;
    const period = [...new Set(items.map((b) => b.period))].sort().at(-1)!;
    const chosen = items.filter((b) => b.period === period);
    const unit = chosen.every((b) => b.unit === 'amount') ? 'amount' : 'percent';
    return { kind, period, unit, items: chosen.filter((b) => b.unit === unit) };
  }
  return undefined;
}

export function assemble(input: AssemblyInput): Report {
  const { ledger, history: h, model, prose, identity } = input;
  const currency = identity?.currency ?? ledger.currency ?? 'EUR';
  const money = moneyFor(currency, model.basis);
  const baseYear = h.base.slice(2);
  const ev = identity?.evidence ?? {};

  // Reported lines, each cell with its note.
  const derivedLabel = h.derivedEbitda.length ? 'EBITDA (operating profit + D&A)' : 'EBITDA';
  const income = [
    line('Revenue', 'money-m', h.revenue, [], true),
    line(derivedLabel === 'EBITDA' ? 'EBITDA' : derivedLabel, 'money-m', h.ebitda, h.derivedEbitda),
    line('Operating profit (EBIT)', 'money-m', h.ebit),
    line('Net profit', 'money-m', h.netProfit, [], true),
    model.basis === 'share' ? line(`Dividend per share (${money.symbol})`, 'money', h.dividends) : undefined,
  ].filter((l): l is Line => l !== undefined);
  // The reader computes margins from lines named exactly "EBITDA".
  if (derivedLabel !== 'EBITDA') {
    const ebitda = income.find((l) => l.label === derivedLabel)!;
    ebitda.label = 'EBITDA';
  }

  const regions = breakdown(ledger, ['region', 'segment']);
  const holders = breakdown(ledger, ['shareholder']);
  const ownership: Breakdown[] = (holders?.items ?? [])
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((b) => ({ label: b.label, value: b.value, sourceId: b.passageId }));
  const held = ownership.reduce((s, o) => s + o.value, 0);
  if (ownership.length && held < 99.5)
    ownership.push({ label: 'Other shareholders', value: Math.round((100 - held) * 100) / 100 });

  const a = model.assumptions;
  const keyFacts: Report['keyFacts'] = [
    ...(identity?.founded ? [{ label: 'Founded', value: String(identity.founded), sourceId: ev.founded }] : []),
    ...(h.employees ? [{ label: 'Employees', value: num(h.employees.value, 0), sourceId: h.employees.passageId }] : []),
    ...(identity?.registration
      ? [{ label: 'Registration', value: identity.registration, sourceId: ev.registration_number }]
      : []),
    ...(model.basis === 'share' && h.price
      ? [{ label: 'Share price', value: money.amount(h.price.value), sourceId: h.price.passageId }]
      : []),
    ...(model.basis === 'share' && a.sharesM
      ? [{ label: 'Shares', value: `${num(a.sharesM, 2)}m`, sourceId: a.sharesSource }]
      : []),
    {
      label: `Revenue ${baseYear}`,
      value: money.millions(h.revenue[h.base]!.value),
      sourceId: h.revenue[h.base]!.passageId,
    },
    {
      label: `EBITDA margin ${baseYear}`,
      value: pct(h.ebitda[h.base]!.value / h.revenue[h.base]!.value),
      sourceId: h.derivedEbitda.includes(h.base) ? undefined : h.ebitda[h.base]!.passageId,
    },
    ...(h.netProfit[h.base]
      ? [
          {
            label: `Net profit ${baseYear}`,
            value: money.millions(h.netProfit[h.base]!.value),
            sourceId: h.netProfit[h.base]!.passageId,
          },
        ]
      : []),
    ...(h.cash
      ? [
          {
            label: a.netCash >= 0 ? 'Net cash' : 'Net debt',
            value: money.millions(Math.abs(a.netCash)),
            sourceId: h.cash.passageId,
          },
        ]
      : []),
  ];

  const sectionTitles: Record<string, string> = {
    business: 'The business',
    markets: 'Markets',
    financials: 'Financial performance',
    ownership: model.basis === 'share' ? 'Ownership and capital returns' : 'Ownership',
    valuation: 'Valuation',
    question: 'Your question',
  };
  const sections: Section[] = (['business', 'markets', 'financials', 'ownership', 'valuation', 'question'] as const)
    .map((id) => ({ id, title: sectionTitles[id]!, paragraphs: prose[id].map(tidyProse).filter(Boolean) }))
    .filter((s) => s.paragraphs.length > 0);

  const report: Report = {
    id: input.id,
    kind: 'engine',
    currency,
    company: {
      name: identity?.shortName ?? input.request.company,
      legalName: identity?.legalName || input.request.company,
      shortName: identity?.shortName || input.request.company,
      country: identity?.country || input.request.country,
      countryCode: input.request.countryCode,
      city: identity?.city,
      sector: identity?.sector || 'Company',
      founded: identity?.founded,
      employees: h.employees ? num(h.employees.value, 0) : undefined,
      listed: model.basis === 'share',
      ticker: identity?.ticker,
      exchange: identity?.exchange,
      isin: identity?.isin,
      registration: identity?.registration,
      website: identity?.website,
    },
    date: input.date,
    analyst: 'Uncovered Research',
    headline: prose.headline.trim(),
    summary: tidyProse(prose.summary),
    thesis: prose.thesis.map((t) => ({ title: t.title.trim(), body: tidyProse(t.body) })),
    keyFacts,
    base: {
      year: reportPeriod(h.base),
      revenue: h.revenue[h.base]!.value,
      ebitda: h.ebitda[h.base]!.value,
      netProfit: h.netProfit[h.base]?.value ?? 0,
    },
    income,
    regions: (regions?.items ?? []).map((b) => ({ label: b.label, value: b.value, sourceId: b.passageId })),
    regionsTitle: regions
      ? `${regions.kind === 'region' ? 'Sales by region' : 'Revenue by segment'}, ${regions.period.replace(FY, '$1')}`
      : undefined,
    regionsUnit: regions?.unit === 'percent' ? 'pct' : 'money-m',
    regionsNote: prose.regions_note.trim(),
    ownership,
    ownershipNote: prose.ownership_note.trim(),
    dividends:
      model.basis === 'share'
        ? Object.entries(h.dividends).map(([p, v]) => ({
            year: p.replace(FY, '$1'),
            dps: v.value,
            sourceId: v.passageId,
          }))
        : [],
    assumptions: a,
    market:
      model.basis === 'share' && h.price
        ? {
            price: h.price.value,
            priceDate: /^\d{4}-\d{2}-\d{2}$/.test(h.price.period) ? longDate(h.price.period) : h.price.period,
            priceSource: h.price.passageId,
            ...(h.high ? { high: h.high.value, highDate: h.high.period, highSource: h.high.passageId } : {}),
          }
        : undefined,
    sections,
    catalysts: prose.catalysts.map(tidyProse).filter(Boolean),
    risks: prose.risks.map((r) => ({ title: r.title.trim(), body: tidyProse(r.body), impact: r.impact })),
    sources: [],
    disclosures: [],
    question: input.request.question?.trim() || undefined,
  };
  report.sources = sourcesFor(report, ledger);
  report.disclosures = disclosuresFor(report, input);
  return report;
}

/** Every passage the report cites, in the order a reader meets them, grouped by document. */
export function citedIds(report: Report): string[] {
  const seen: string[] = [];
  const add = (id?: string) => {
    if (id && !seen.includes(id)) seen.push(id);
  };
  for (const t of proseOf(report)) for (const m of t.matchAll(MARKER)) add(m[1]);
  report.keyFacts.forEach((f) => add(f.sourceId));
  report.income.forEach((l) => Object.values(l.sources ?? {}).forEach(add));
  [...report.regions, ...report.ownership].forEach((b) => add(b.sourceId));
  report.dividends.forEach((d) => add(d.sourceId));
  const a = report.assumptions;
  add(a.netCashSource);
  add(a.sharesSource);
  for (const note of Object.values(a.rationale ?? {})) for (const m of (note ?? '').matchAll(MARKER)) add(m[1]);
  add(report.market?.priceSource);
  add(report.market?.highSource);
  return seen;
}

export function sourcesFor(report: Report, ledger: Ledger): Source[] {
  const ids = citedIds(report);
  const passages = ids.map((id) => ledger.passageById(id)).filter((p) => p !== undefined);
  // Documents in the order they are first cited; passages within each by page.
  const docOrder = [...new Set(passages.map((p) => p.documentId))];
  const ordered = docOrder.flatMap((d) =>
    passages
      .filter((p) => p.documentId === d)
      .sort((x, y) => (x.page ?? 0) - (y.page ?? 0) || ids.indexOf(x.id) - ids.indexOf(y.id)),
  );
  return ordered.map((p) => {
    const doc = ledger.documentOf(p);
    let host = '';
    try {
      host = new URL(doc.url).hostname.replace(/^www\./, '');
    } catch {
      // Supplied documents have no address.
    }
    return {
      id: p.id,
      title: doc.meta?.title ?? doc.title,
      publisher: doc.meta?.publisher || host || 'Supplied document',
      url: doc.origin === 'web' ? doc.url : '',
      date: doc.meta?.published,
      grade: ledger.gradeOf(p),
      quote: p.quote,
      quoted: 'verbatim' as const,
      page: p.page,
      document: doc.id,
      translation: p.translation,
      supplied: doc.origin === 'upload' || undefined,
    };
  });
}

function disclosuresFor(report: Report, input: AssemblyInput): string[] {
  const out: string[] = [];
  const reported = report.sources.filter((s) => s.grade === 'reported').length;
  if (reported)
    out.push(
      `${reported} of the ${report.sources.length} passages cited come from documents graded Reported (company releases, unaudited results, websites and the press) rather than filed or audited accounts.`,
    );
  out.push(...input.history.notes, ...input.model.notes, ...input.ledger.notes);
  if (input.gaps.length) out.push(`The research could not establish: ${input.gaps.join('; ')}.`);
  return [...new Set(out)];
}
