import { DOCUMENT_KINDS, FILED_KINDS, type DocumentKind, type DocumentStore, type StoredDocument } from './documents';
import {
  contains,
  norm,
  parsePrinted,
  printedDecimals,
  quotationProblem,
  searchable,
  type DecimalMark,
} from './normalize';

/*
 * The evidence ledger: every passage the engine has found word for word, and
 * every figure, breakdown and fact that rests on one. Nothing enters the
 * ledger without a quotation that the document as read contains, and no
 * figure enters without its number appearing in that quotation. Conversions
 * (thousands to millions, percent to a fraction) are done here, in code.
 */

export type Scope = 'group' | 'company';
export type Scale = 'units' | 'thousands' | 'millions' | 'billions';
export const SCALES: Scale[] = ['units', 'thousands', 'millions', 'billions'];
const SCALE: Record<Scale, number> = { units: 1, thousands: 1e3, millions: 1e6, billions: 1e9 };

type LineKind = 'flow' | 'stock' | 'per-share' | 'market' | 'employees' | 'shares' | 'rate';

export const LINES = {
  revenue: { kind: 'flow', label: 'Revenue' },
  ebitda: { kind: 'flow', label: 'EBITDA' },
  ebit: { kind: 'flow', label: 'Operating profit (EBIT)' },
  depreciation_amortisation: { kind: 'flow', label: 'Depreciation and amortisation' },
  net_profit: { kind: 'flow', label: 'Net profit' },
  capex: { kind: 'flow', label: 'Capital expenditure' },
  cash: { kind: 'stock', label: 'Cash and cash equivalents' },
  short_term_investments: { kind: 'stock', label: 'Short-term financial investments' },
  financial_debt: { kind: 'stock', label: 'Financial debt' },
  lease_liabilities: { kind: 'stock', label: 'Lease liabilities' },
  equity: { kind: 'stock', label: 'Equity' },
  total_assets: { kind: 'stock', label: 'Total assets' },
  employees: { kind: 'employees', label: 'Employees' },
  shares_outstanding: { kind: 'shares', label: 'Shares in issue' },
  treasury_shares: { kind: 'shares', label: 'Treasury shares' },
  dividend_per_share: { kind: 'per-share', label: 'Dividend per share' },
  eps: { kind: 'per-share', label: 'Earnings per share' },
  share_price: { kind: 'market', label: 'Share price' },
  high_52w: { kind: 'market', label: '52-week high' },
  risk_free_rate: { kind: 'rate', label: 'Risk-free rate' },
  equity_risk_premium: { kind: 'rate', label: 'Equity risk premium' },
  country_risk_premium: { kind: 'rate', label: 'Country risk premium' },
} satisfies Record<string, { kind: LineKind; label: string }>;

export type LineKey = keyof typeof LINES;
export const LINE_KEYS = Object.keys(LINES) as LineKey[];

const MONEY_KINDS = new Set<LineKind>(['flow', 'stock', 'per-share', 'market']);

export const TOPICS = [
  'history',
  'business',
  'products',
  'markets',
  'customers',
  'strategy',
  'operations',
  'ownership',
  'management',
  'capital',
  'risk',
  'outlook',
  'industry',
  'other',
] as const;
export type Topic = (typeof TOPICS)[number];

export interface Evidence {
  document_id: string;
  /** Page in the document as read; 0 when the document has no pages. */
  page: number;
  quote: string;
  /** English translation of a quotation in another language; empty for English. */
  translation: string;
}

export interface Passage {
  id: string;
  documentId: string;
  page?: number;
  quote: string;
  translation?: string;
  topic?: Topic;
}

export interface Figure {
  line: LineKey;
  /** FY2025, H1 2026, Q3 2026, 9M 2026, or an ISO date. */
  period: string;
  scope: Scope;
  /** Millions for money flows and stocks and for share counts; units for per-share money; a fraction for rates. */
  value: number;
  currency?: string;
  printed: string;
  decimals: number;
  passageId: string;
  /** Other passages that state the same value. */
  corroborations: string[];
  order: number;
}

export interface BreakdownItem {
  kind: 'region' | 'segment' | 'shareholder';
  label: string;
  period: string;
  unit: 'percent' | 'amount';
  value: number;
  passageId: string;
}

export type IdentityField =
  'legal_name' | 'founded' | 'city' | 'registration_number' | 'listed' | 'isin' | 'ticker' | 'sector' | 'description';

export interface Identity {
  legalName: string;
  shortName: string;
  country: string;
  city?: string;
  sector: string;
  description?: string;
  founded?: number;
  registration?: string;
  website?: string;
  listed: boolean;
  exchange?: string;
  ticker?: string;
  isin?: string;
  currency: string;
  fiscalYearEnd?: string;
  /** The passage behind each fact that has one. */
  evidence: Partial<Record<IdentityField, string>>;
}

export interface Outcome {
  ok: boolean;
  message: string;
}

/* ---------- Inputs, as the model records them ---------- */

export interface DocumentInput {
  document_id: string;
  title: string;
  publisher: string;
  published: string;
  kind: DocumentKind;
  language: string;
  /** For a filed kind: a passage of the document showing that it is one (an auditor's opinion, a filing stamp). */
  evidence_quote: string;
  evidence_page: number;
}

export interface FigureInput extends Evidence {
  line: LineKey;
  period: string;
  as_printed: string;
  decimal_mark: DecimalMark;
  scale: Scale;
  currency: string;
  scope: Scope;
}

export interface BreakdownInput extends Evidence {
  kind: 'region' | 'segment' | 'shareholder';
  label: string;
  period: string;
  as_printed: string;
  decimal_mark: DecimalMark;
  unit: 'percent' | 'amount';
  scale: Scale;
  currency: string;
}

export interface PassageInput extends Evidence {
  topic: Topic;
}

export interface CompanyInput {
  legal_name: string;
  short_name: string;
  country: string;
  city: string;
  sector: string;
  description: string;
  founded: string;
  registration_number: string;
  website: string;
  listed: boolean;
  exchange: string;
  ticker: string;
  isin: string;
  reporting_currency: string;
  fiscal_year_end: string;
  evidence: (Evidence & { field: IdentityField })[];
}

const FLOW_PERIOD = /^(?:FY\d{4}|H[12] \d{4}|Q[1-4] \d{4}|9M \d{4})$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const CURRENCY = /^[A-Z]{3}$/;

function periodProblem(kind: LineKind, period: string): string | undefined {
  if (kind === 'flow' || kind === 'per-share') {
    if (!FLOW_PERIOD.test(period))
      return `Period "${period}" is not FY2025, H1 2026, Q3 2026 or 9M 2026 form; flows and per-share figures belong to a period.`;
    return undefined;
  }
  if (kind === 'employees' && FLOW_PERIOD.test(period)) return undefined;
  if (!DATE.test(period) && !/^FY\d{4}$/.test(period))
    return `Period "${period}" must be a date (2025-12-31) or a fiscal year end (FY2025) for a balance, a count, a price or a rate.`;
  return undefined;
}

export class Ledger {
  readonly passages: Passage[] = [];
  readonly figures: Figure[] = [];
  readonly breakdowns: BreakdownItem[] = [];
  readonly notes: string[] = [];
  identity?: Identity;
  /** The reporting currency every money figure must be in. */
  currency?: string;
  private order = 0;

  constructor(readonly docs: DocumentStore) {}

  passageById(id: string): Passage | undefined {
    return this.passages.find((p) => p.id === id);
  }

  documentOf(passage: Passage): StoredDocument {
    return this.docs.get(passage.documentId)!;
  }

  /** Lines of a document that contain a printed value, to help the model quote the right one. */
  private hint(doc: StoredDocument, printed: string): string {
    const n = norm(printed);
    if (n.length < 3) return '';
    const lines: string[] = [];
    doc.pages.forEach((text, i) => {
      for (const line of text.split('\n'))
        if (lines.length < 4 && norm(line).includes(n))
          lines.push(`${doc.paged ? `page ${i + 1}` : `part ${i + 1}`}: "${line.slice(0, 200)}"`);
    });
    return lines.length ? ` Lines where ${printed} appears: ${lines.join('; ')}.` : '';
  }

  /** Check a quotation against the document it claims to come from. */
  passage(e: Evidence, topic?: Topic, printed?: string): { passage: Passage } | { problem: string } {
    const doc = this.docs.get(e.document_id);
    if (!doc) return { problem: `No document ${e.document_id} has been read; read it with read_document first.` };
    const problem = quotationProblem(e.quote);
    if (problem) return { problem };
    const page = this.docs.locate(doc, e.quote, doc.paged ? e.page : undefined);
    if (page === undefined)
      return {
        problem: `The quotation is not in ${doc.id} as written (every ${doc.paged ? 'page' : 'part'} was searched). Copy the words exactly as they appear in the text you read.${printed ? this.hint(doc, printed) : ''}`,
      };
    const key = norm(e.quote);
    const existing = this.passages.find((p) => p.documentId === doc.id && norm(p.quote) === key);
    if (existing) return { passage: existing };
    const passage: Passage = {
      id: `p${this.passages.length + 1}`,
      documentId: doc.id,
      page: doc.paged ? page : undefined,
      quote: e.quote.trim(),
      translation: e.translation.trim() || undefined,
      topic,
    };
    this.passages.push(passage);
    return { passage };
  }

  recordDocument(input: DocumentInput): Outcome {
    const doc = this.docs.get(input.document_id);
    if (!doc) return { ok: false, message: `No document ${input.document_id} has been read.` };
    if (!DOCUMENT_KINDS.includes(input.kind)) return { ok: false, message: `Unknown kind ${input.kind}.` };
    let filed = false;
    let note = '';
    if (FILED_KINDS.has(input.kind)) {
      if (!input.evidence_quote.trim())
        note = ' Kept as reported: no passage was given to show it is filed or audited.';
      else if (this.docs.locate(doc, input.evidence_quote, doc.paged ? input.evidence_page : undefined) === undefined)
        note = ' Kept as reported: the passage given to show it is filed or audited is not in the document as written.';
      else filed = true;
    }
    doc.meta = {
      title: input.title.trim() || doc.title,
      publisher: input.publisher.trim(),
      published: input.published.trim() || undefined,
      kind: input.kind,
      language: input.language.trim().toLowerCase() || 'en',
      filed,
    };
    return {
      ok: true,
      message: `${doc.id} described as ${input.kind.replace(/_/g, ' ')} (${filed ? 'filed' : 'reported'}).${note}`,
    };
  }

  recordCompany(input: CompanyInput): Outcome[] {
    const outcomes: Outcome[] = [];
    const evidence: Partial<Record<IdentityField, string>> = {};
    const values: Partial<Record<IdentityField, string>> = {
      legal_name: input.legal_name,
      founded: input.founded,
      city: input.city,
      registration_number: input.registration_number,
      isin: input.isin,
      ticker: input.ticker,
      sector: input.sector,
      description: input.description,
    };
    for (const e of input.evidence) {
      const checked = this.passage(e, 'history');
      if ('problem' in checked) {
        outcomes.push({ ok: false, message: `${e.field}: ${checked.problem}` });
        continue;
      }
      // Facts with a value of their own must appear in the quotation.
      const value = values[e.field]?.trim();
      const literal =
        e.field === 'founded' || e.field === 'registration_number' || e.field === 'isin' || e.field === 'ticker';
      if (literal && value && !contains(searchable(e.quote), value)) {
        outcomes.push({ ok: false, message: `${e.field}: "${value}" does not appear in the quotation given for it.` });
        continue;
      }
      evidence[e.field] = checked.passage.id;
      outcomes.push({ ok: true, message: `${e.field}: supported by ${checked.passage.id}.` });
    }
    const currency = input.reporting_currency.trim().toUpperCase();
    if (!CURRENCY.test(currency))
      outcomes.push({ ok: false, message: 'reporting_currency must be an ISO code such as EUR.' });
    const year = Number(input.founded);
    const listedShown = Boolean(evidence.ticker || evidence.isin || evidence.listed);
    this.identity = {
      legalName: input.legal_name.trim(),
      shortName: input.short_name.trim() || input.legal_name.trim(),
      country: input.country.trim(),
      city: input.city.trim() || undefined,
      sector: input.sector.trim(),
      description: input.description.trim() || undefined,
      // Facts that need a source are kept only with one.
      founded:
        evidence.founded && Number.isInteger(year) && year > 1500 && year <= new Date().getFullYear()
          ? year
          : undefined,
      registration: evidence.registration_number ? input.registration_number.trim() : undefined,
      website: input.website.trim() || undefined,
      listed: input.listed && listedShown,
      exchange: input.listed && listedShown ? input.exchange.trim() || undefined : undefined,
      ticker: evidence.ticker ? input.ticker.trim() : undefined,
      isin: evidence.isin ? input.isin.trim() : undefined,
      currency: CURRENCY.test(currency) ? currency : (this.currency ?? 'EUR'),
      fiscalYearEnd: /^\d{2}-\d{2}$/.test(input.fiscal_year_end) ? input.fiscal_year_end : undefined,
      evidence,
    };
    if (input.listed && !listedShown)
      outcomes.push({
        ok: false,
        message:
          'Recorded as not listed: give a quotation showing the ticker, the ISIN or the listing to record it as listed.',
      });
    if (!this.currency) this.currency = this.identity.currency;
    return outcomes;
  }

  recordFigure(input: FigureInput): Outcome {
    const info = LINES[input.line];
    if (!info) return { ok: false, message: `Unknown line ${input.line}.` };
    const what = `${input.line} ${input.period}`;
    const period = periodProblem(info.kind, input.period.trim());
    if (period) return { ok: false, message: `${what}: ${period}` };
    const value = parsePrinted(input.as_printed, input.decimal_mark);
    if (value === undefined)
      return {
        ok: false,
        message: `${what}: "${input.as_printed}" does not read as a number with "${input.decimal_mark}" as the decimal mark. Give the number exactly as printed and the document's decimal mark.`,
      };
    if (!contains(searchable(input.quote), input.as_printed))
      return { ok: false, message: `${what}: "${input.as_printed}" does not appear in the quotation.` };
    const money = MONEY_KINDS.has(info.kind);
    let currency: string | undefined;
    if (money) {
      currency = input.currency.trim().toUpperCase();
      if (!CURRENCY.test(currency))
        return { ok: false, message: `${what}: give the currency as an ISO code such as EUR.` };
      this.currency ??= currency;
      if (currency !== this.currency)
        return {
          ok: false,
          message: `${what}: recorded figures must all be in the reporting currency, ${this.currency}; this one is in ${currency}.`,
        };
    }
    if (info.kind === 'rate' && input.scale !== 'units')
      return { ok: false, message: `${what}: give rates in percent, as printed, with scale "units".` };
    const checked = this.passage(input, undefined, input.as_printed);
    if ('problem' in checked) return { ok: false, message: `${what}: ${checked.problem}` };

    const raw = value * SCALE[input.scale];
    const converted =
      info.kind === 'flow' || info.kind === 'stock' || info.kind === 'shares'
        ? raw / 1e6
        : info.kind === 'rate'
          ? value / 100
          : info.kind === 'employees'
            ? Math.round(raw)
            : raw;
    if (info.kind === 'rate' && (converted < -0.05 || converted > 0.3))
      return { ok: false, message: `${what}: ${input.as_printed}% is outside any plausible range for a rate.` };
    if ((input.line === 'revenue' || info.kind === 'shares' || info.kind === 'market') && converted <= 0)
      return { ok: false, message: `${what}: must be positive.` };

    const scope = input.scope;
    const decimals = printedDecimals(input.as_printed, input.decimal_mark);
    const same = this.figures.find(
      (f) => f.line === input.line && f.period === input.period.trim() && f.scope === scope,
    );
    const figure: Figure = {
      line: input.line,
      period: input.period.trim(),
      scope,
      value: converted,
      currency,
      printed: input.as_printed.trim(),
      decimals,
      passageId: checked.passage.id,
      corroborations: [],
      order: ++this.order,
    };
    if (same) {
      const close = Math.abs(same.value - converted) <= Math.max(Math.abs(same.value), 1) * 1e-6;
      if (close) {
        if (same.passageId !== checked.passage.id && !same.corroborations.includes(checked.passage.id))
          same.corroborations.push(checked.passage.id);
        return { ok: true, message: `${what}: already recorded; ${checked.passage.id} also supports it.` };
      }
      this.figures.push(figure);
      return {
        ok: true,
        message: `${what}: recorded as ${checked.passage.id}, but it differs from the ${same.printed} recorded from ${this.passageById(same.passageId)?.documentId}. Both are kept; the report prefers filed and more recent sources and says so.`,
      };
    }
    this.figures.push(figure);
    return {
      ok: true,
      message: `${what}: recorded as ${checked.passage.id} (${describe(input.line, converted, currency)}).`,
    };
  }

  recordBreakdown(input: BreakdownInput): Outcome {
    const what = `${input.kind} "${input.label}"`;
    if (input.kind === 'shareholder' && input.unit !== 'percent')
      return { ok: false, message: `${what}: give shareholdings as a percentage of the company.` };
    const value = parsePrinted(input.as_printed, input.decimal_mark);
    if (value === undefined)
      return {
        ok: false,
        message: `${what}: "${input.as_printed}" does not read as a number with "${input.decimal_mark}" decimals.`,
      };
    if (!contains(searchable(input.quote), input.as_printed))
      return { ok: false, message: `${what}: "${input.as_printed}" does not appear in the quotation.` };
    if (input.unit === 'percent' && (value <= 0 || value > 100))
      return { ok: false, message: `${what}: a share must be between 0 and 100 percent.` };
    if (input.unit === 'amount') {
      const currency = input.currency.trim().toUpperCase();
      this.currency ??= currency;
      if (currency !== this.currency)
        return { ok: false, message: `${what}: amounts must be in the reporting currency, ${this.currency}.` };
    }
    const checked = this.passage(input, input.kind === 'shareholder' ? 'ownership' : 'markets', input.as_printed);
    if ('problem' in checked) return { ok: false, message: `${what}: ${checked.problem}` };
    const amount = input.unit === 'amount' ? (value * SCALE[input.scale]) / 1e6 : value;
    const existing = this.breakdowns.findIndex(
      (b) => b.kind === input.kind && b.period === input.period && norm(b.label) === norm(input.label),
    );
    const item: BreakdownItem = {
      kind: input.kind,
      label: input.label.trim(),
      period: input.period.trim(),
      unit: input.unit,
      value: amount,
      passageId: checked.passage.id,
    };
    if (existing >= 0) this.breakdowns[existing] = item;
    else this.breakdowns.push(item);
    return { ok: true, message: `${what}: recorded as ${checked.passage.id}.` };
  }

  recordPassage(input: PassageInput): Outcome {
    const checked = this.passage(input, input.topic);
    if ('problem' in checked) return { ok: false, message: checked.problem };
    return { ok: true, message: `Recorded as ${checked.passage.id} (${input.topic}).` };
  }

  /** The grade a passage carries: filed when its document shows that it is filed. */
  gradeOf(passage: Passage): 'filed' | 'reported' {
    return this.documentOf(passage).meta?.filed ? 'filed' : 'reported';
  }

  /** A short account of what has been recorded so far, for the model and for progress. */
  summary(): string {
    const byLine = new Map<string, string[]>();
    for (const f of this.figures) {
      const list = byLine.get(f.line) ?? [];
      list.push(`${f.period}${f.scope === 'company' ? ' (company)' : ''}`);
      byLine.set(f.line, list);
    }
    const lines = [...byLine].map(([k, periods]) => `${k}: ${periods.join(', ')}`);
    return [
      `Documents read: ${this.docs.list().length}. Passages: ${this.passages.length}. Figures: ${this.figures.length}. Breakdowns: ${this.breakdowns.length}.`,
      ...lines,
    ].join('\n');
  }
}

function describe(line: LineKey, value: number, currency?: string): string {
  const kind = LINES[line].kind;
  if (kind === 'rate') return `${(value * 100).toFixed(2)}%`;
  if (kind === 'employees') return `${value} people`;
  if (kind === 'shares') return `${value.toFixed(3)} million shares`;
  if (kind === 'per-share' || kind === 'market') return `${value} ${currency ?? ''}`.trim();
  return `${value.toFixed(3)} million ${currency ?? ''}`.trim();
}
