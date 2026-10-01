import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { DOCUMENT_KINDS, parsePages, type DocumentStore, type StoredDocument } from './documents';
import { extractHtml, parts } from './extract/html';
import { extractPdf } from './extract/pdf';
import { decodeText, fetchDocument, FetchError, type FetchOptions, type RobotsCache } from './fetch';
import { LINE_KEYS, SCALES, TOPICS, type Ledger, type Outcome } from './ledger';

/*
 * The tools Claude researches with. web_search runs on Anthropic's side;
 * everything else runs here, so the engine holds the text of every document
 * Claude reads and checks every quotation it records against that text.
 *
 * Every tool's input schema is strict: the API guarantees inputs match it,
 * and each input is validated again here before anything runs.
 */

/* ---------- Schemas ---------- */

const evidence = {
  document_id: z.string().describe('The id read_document gave the document, such as d3 or u1.'),
  page: z
    .number()
    .int()
    .describe('The page the quotation is on, as shown when you read it; 0 for documents without pages.'),
  quote: z
    .string()
    .describe(
      'The passage, copied exactly as it appears in the text you read: one continuous sentence or table row, nothing skipped or changed.',
    ),
  translation: z.string().describe('An English translation of the quotation; empty if it is already in English.'),
};

const printed = {
  as_printed: z
    .string()
    .describe('The number exactly as the document prints it, such as "48.312.904" or "2,041.0" or "(1.234)".'),
  decimal_mark: z.enum(['.', ',']).describe('The decimal mark the document uses.'),
  scale: z
    .enum(SCALES)
    .describe('The scale the document states for this number: units, thousands, millions or billions.'),
};

export const READ = z.object({
  url: z.string().describe('The address to read. Empty when reading a document already read, by its id.'),
  document_id: z.string().describe('The id of a document already read. Empty when reading a new address.'),
  pages: z
    .string()
    .describe('Pages (or parts) to show, such as "12-18" or "3, 40-42". Empty for the opening view of a document.'),
});

export const SEARCH = z.object({
  document_id: z.string(),
  terms: z.array(z.string()).describe('Words to look for, in the document’s language and in English.'),
});

export const DOCUMENT = z.object({
  document_id: z.string(),
  title: z.string().describe('The document’s title, in its own language.'),
  publisher: z.string().describe('Who published it: the company, the register, the exchange, a newspaper.'),
  published: z.string().describe('Publication date as YYYY-MM-DD, YYYY-MM or YYYY; empty if unknown.'),
  kind: z.enum(DOCUMENT_KINDS as [string, ...string[]]),
  language: z.string().describe('ISO 639-1 code of the document’s language, such as sl or en.'),
  evidence_quote: z
    .string()
    .describe(
      'For an audited annual report, a registry filing or an exchange filing: a passage of the document that shows it (the auditor’s opinion, the register’s or exchange’s filing details). Empty otherwise.',
    ),
  evidence_page: z.number().int().describe('Page of that passage; 0 if none.'),
});

export const COMPANY = z.object({
  legal_name: z.string(),
  short_name: z.string().describe('The name the company is known by, such as Krka.'),
  country: z.string(),
  city: z.string().describe('Seat of the company; empty if unknown.'),
  sector: z.string().describe('A short description of the sector, such as "Generic pharmaceuticals".'),
  description: z.string().describe('One sentence on what the company does.'),
  founded: z.string().describe('Founding year, such as 1954; empty if unknown.'),
  registration_number: z.string().describe('Number in the national business register; empty if unknown.'),
  website: z.string(),
  listed: z.boolean().describe('Whether the company’s shares trade on a stock exchange.'),
  exchange: z.string(),
  ticker: z.string(),
  isin: z.string(),
  reporting_currency: z.string().describe('ISO code of the currency of its financial statements, such as EUR.'),
  fiscal_year_end: z.string().describe('Month and day the fiscal year ends, as MM-DD; empty if unknown.'),
  evidence: z.array(
    z.object({
      field: z.enum([
        'legal_name',
        'founded',
        'city',
        'registration_number',
        'listed',
        'isin',
        'ticker',
        'sector',
        'description',
      ]),
      ...evidence,
    }),
  ),
});

export const FIGURES = z.object({
  figures: z.array(
    z.object({
      line: z.enum(LINE_KEYS as [string, ...string[]]),
      period: z
        .string()
        .describe(
          'FY2025 for a fiscal year (the year it ends), H1 2026, Q3 2026 or 9M 2026 for interim periods; a date such as 2025-12-31 for balances, share counts, prices and rates.',
        ),
      ...printed,
      currency: z.string().describe('ISO currency code for money; empty for counts and rates.'),
      scope: z.enum(['group', 'company']).describe('Consolidated group figures, or the company alone.'),
      ...evidence,
    }),
  ),
});

export const BREAKDOWNS = z.object({
  items: z.array(
    z.object({
      kind: z.enum(['region', 'segment', 'shareholder']),
      label: z.string().describe('The region, segment or shareholder, in English.'),
      period: z.string().describe('FY2025, or a date for shareholdings.'),
      ...printed,
      unit: z.enum(['percent', 'amount']),
      currency: z.string().describe('ISO code for amounts; empty for percentages.'),
      ...evidence,
    }),
  ),
});

export const PASSAGES = z.object({
  passages: z.array(z.object({ topic: z.enum(TOPICS), ...evidence })),
});

export const FINISH = z.object({
  summary: z.string().describe('What the evidence covers, in two or three sentences.'),
  gaps: z.array(z.string()).describe('What could not be found or read, one item each.'),
});

/** Keywords strict schemas do not support; zod still enforces them on every input here. */
const UNSUPPORTED = new Set([
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'multipleOf',
  'pattern',
]);

/** A JSON schema without the keywords strict tool use rejects. */
export function strictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(strictSchema);
  if (schema && typeof schema === 'object')
    return Object.fromEntries(
      Object.entries(schema)
        .filter(([k]) => !UNSUPPORTED.has(k))
        .map(([k, v]) => [
          k,
          k === 'properties'
            ? Object.fromEntries(Object.entries(v as object).map(([p, s]) => [p, strictSchema(s)]))
            : strictSchema(v),
        ]),
    );
  return schema;
}

/** A strict tool definition from a zod schema. */
function tool(name: string, description: string, schema: z.ZodObject): Anthropic.Tool {
  return {
    name,
    description,
    strict: true,
    input_schema: strictSchema(z.toJSONSchema(schema)) as Anthropic.Tool.InputSchema,
  };
}

export const SEARCH_LIMIT = 24;

/**
 * Every tool the research stage offers. Web search is called directly, not
 * from code: the engine must see every result, because only addresses that
 * appeared in results, in the request or in pages already read may be read.
 */
export function researchTools(country?: string): Anthropic.Messages.ToolUnion[] {
  return [
    {
      type: 'web_search_20260209',
      name: 'web_search',
      allowed_callers: ['direct'],
      max_uses: SEARCH_LIMIT,
      ...(country && /^[A-Z]{2}$/.test(country) && country !== 'XX'
        ? { user_location: { type: 'approximate' as const, country } }
        : {}),
    },
    tool(
      'read_document',
      'Read a web page or PDF by address, or show more pages of a document already read. Call it for any document you want to cite: only documents read here can be cited. Addresses must have appeared in search results, in the request or in a page already read. The first view of a long PDF shows an outline of its pages; ask for the pages you need.',
      READ,
    ),
    tool(
      'search_document',
      'Find the lines of a document already read that contain any of the given words, with their page numbers. Use it to find the income statement, the balance sheet or a figure in a long report before reading those pages.',
      SEARCH,
    ),
    tool(
      'record_document',
      'Describe a document you have read and will cite: its title, publisher, date, language and kind. Call it once for every document you cite.',
      DOCUMENT,
    ),
    tool(
      'record_company',
      'Record who the company is, with a quotation for each fact that needs one. Call it once you know, and again to correct it.',
      COMPANY,
    ),
    tool(
      'record_figures',
      'Record reported figures, each with its quotation. The number must appear in the quotation exactly as printed; the engine converts units and checks every quotation against the document. Rejected figures come back with the reason.',
      FIGURES,
    ),
    tool(
      'record_breakdowns',
      'Record revenue by region or segment and the main shareholders, each with its quotation.',
      BREAKDOWNS,
    ),
    tool(
      'record_passages',
      'Record passages the report can cite for what the company does, its markets, strategy, risks and outlook.',
      PASSAGES,
    ),
    tool(
      'finish_research',
      'Close the research when the essentials are recorded or the budget is nearly spent, saying what could not be found.',
      FINISH,
    ),
  ];
}

/* ---------- Where the model may read ---------- */

/** Addresses the model may ask the engine to read: from the request, search results and pages already read. */
export class Leads {
  private readonly urls = new Set<string>();

  static key(raw: string): string | undefined {
    try {
      const u = new URL(raw.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      return undefined;
    }
  }

  add(raw: string) {
    const k = Leads.key(raw);
    if (k) this.urls.add(k);
  }

  has(raw: string): boolean {
    const k = Leads.key(raw);
    return k !== undefined && this.urls.has(k);
  }

  get size() {
    return this.urls.size;
  }
}

/** Collect the addresses in a response's search results. */
export function searchResultUrls(content: Anthropic.ContentBlock[]): { query?: string; urls: string[] }[] {
  const out: { query?: string; urls: string[] }[] = [];
  const queries = new Map<string, string>();
  for (const block of content) {
    if (block.type === 'server_tool_use' && block.name === 'web_search') {
      const q = (block.input as { query?: unknown }).query;
      if (typeof q === 'string') queries.set(block.id, q);
    }
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content))
      out.push({ query: queries.get(block.tool_use_id), urls: block.content.map((r) => r.url) });
  }
  return out;
}

/* ---------- Showing documents ---------- */

/** Characters of document text one read returns: about nine thousand tokens. */
export const READ_BUDGET = 36_000;

const KEYWORDS =
  /investor|annual|report|financ|result|statement|sharehold|governance|dividend|about|history|company|letno|poro[cč]il|rezultat|delni[cč]ar|vlagatel|o-nas|zgodovin|izkaz|ir\b|\.pdf/i;

function header(doc: StoredDocument): string {
  const size = doc.paged ? `${doc.pageCount} pages` : `${doc.pages.length} part${doc.pages.length === 1 ? '' : 's'}`;
  const cut =
    doc.paged && doc.pageCount > doc.pages.length ? ` (only the first ${doc.pages.length} pages were read)` : '';
  return `Document ${doc.id}: "${doc.meta?.title ?? doc.title}" · ${doc.format.toUpperCase()}, ${size}${cut} · ${doc.origin === 'upload' ? 'supplied by the requester' : doc.url}`;
}

function linksOf(doc: StoredDocument, limit = 150): string {
  if (doc.links.length === 0) return '';
  const host = (() => {
    try {
      return new URL(doc.url).hostname;
    } catch {
      return '';
    }
  })();
  const scored = doc.links.map((l, i) => {
    let score = 0;
    try {
      if (new URL(l.url).hostname === host) score += 1;
    } catch {
      // Unreadable links sort last.
    }
    if (KEYWORDS.test(l.url) || KEYWORDS.test(l.text)) score += 2;
    if (/\.pdf($|\?)/i.test(l.url)) score += 2;
    return { l, score, i };
  });
  const chosen = scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .sort((a, b) => a.i - b.i)
    .map(({ l }) => `- ${l.text || '(no text)'} → ${l.url}`);
  return `\n\nLinks on this page (${chosen.length} of ${doc.links.length}):\n${chosen.join('\n')}`;
}

/** The text of chosen pages, within the read budget. */
export function showPages(doc: StoredDocument, pages: number[]): string {
  let out = header(doc);
  let shown = 0;
  for (const p of pages) {
    const text = doc.pages[p - 1] ?? '';
    const block = `\n\n--- ${doc.paged ? 'page' : 'part'} ${p} of ${doc.pages.length} ---\n${text || '(no text on this page)'}`;
    if (shown > 0 && out.length + block.length > READ_BUDGET) {
      out += `\n\n[Stopped before ${doc.paged ? 'page' : 'part'} ${p} to keep this read short. Ask for "${p}-${pages.at(-1)}" to continue.]`;
      return out;
    }
    out += block.length > READ_BUDGET ? `${block.slice(0, READ_BUDGET)}\n[…the rest of this page is cut]` : block;
    shown++;
  }
  return out;
}

/** What a first read shows: the start of the document, an outline of a long one, and a page's links. */
export function openingView(doc: StoredDocument): string {
  if (!doc.paged)
    return (
      showPages(doc, [1]) + (doc.pages.length > 1 ? `\n\n[${doc.pages.length - 1} more parts.]` : '') + linksOf(doc)
    );
  if (doc.pages.length <= 4)
    return showPages(
      doc,
      doc.pages.map((_, i) => i + 1),
    );
  const outline = doc.pages
    .map((t, i) => `p${i + 1}: ${(t.split('\n').find((l) => l.trim().length > 3) ?? '').slice(0, 70)}`)
    .join('\n')
    .slice(0, 9_000);
  return `${showPages(doc, [1, 2])}\n\nOutline (first line of each page):\n${outline}\n\n[Use search_document to find a statement or a figure, then read those pages.]`;
}

/* ---------- Running the tools ---------- */

export interface ToolContext {
  store: DocumentStore;
  ledger: Ledger;
  leads: Leads;
  robots: RobotsCache;
  fetch: Omit<FetchOptions, 'accept' | 'maxBytes'>;
  /** A line of progress for the person waiting. */
  activity: (text: string) => void;
  finished?: z.infer<typeof FINISH>;
  rejected: number;
}

const ACCEPT = ['text/html', 'application/xhtml+xml', 'application/pdf', 'text/plain', 'text/xml', 'application/xml'];
export const MAX_PDF_BYTES = 60 * 1024 * 1024;

async function readNew(ctx: ToolContext, url: string): Promise<StoredDocument> {
  if (!(await ctx.robots.allows(url)))
    throw new FetchError('The site’s robots.txt asks not to read this address.', 'robots');
  const fetched = await fetchDocument(url, { ...ctx.fetch, accept: ACCEPT, maxBytes: MAX_PDF_BYTES });
  ctx.leads.add(fetched.url);
  const isPdf =
    fetched.contentType === 'application/pdf' || Buffer.from(fetched.bytes.subarray(0, 5)).toString() === '%PDF-';
  if (isPdf) {
    const pdf = await extractPdf(fetched.bytes);
    if (pdf.pages.every((p) => p.trim() === ''))
      throw new FetchError(
        'This PDF has no text layer (a scanned document?), so nothing in it can be quoted.',
        'unsupported',
      );
    return ctx.store.add({
      url: fetched.url,
      origin: 'web',
      format: 'pdf',
      title: pdf.title ?? decodeURIComponent(new URL(fetched.url).pathname.split('/').pop() ?? fetched.url),
      pages: pdf.pages,
      paged: true,
      pageCount: pdf.pageCount,
      links: [],
      raw: fetched.bytes,
    }).doc;
  }
  const text = decodeText(fetched.bytes, fetched.charset);
  const html = /html|xml/.test(fetched.contentType) || /<html|<body|<div/i.test(text.slice(0, 2000));
  const page = html ? extractHtml(text, fetched.url) : { title: undefined, text, links: [] };
  if (!page.text.trim())
    throw new FetchError('The page has no readable text (it may need a browser to show it).', 'unsupported');
  for (const l of page.links) ctx.leads.add(l.url);
  const chunks = parts(page.text);
  return ctx.store.add({
    url: fetched.url,
    origin: 'web',
    format: html ? 'html' : 'text',
    title: page.title ?? new URL(fetched.url).hostname,
    pages: chunks,
    paged: false,
    pageCount: chunks.length,
    links: page.links,
    raw: fetched.bytes,
  }).doc;
}

const report = (outcomes: Outcome[]) => outcomes.map((o) => `${o.ok ? '✓' : '✗'} ${o.message}`).join('\n');

/** Run one client tool. Returns the text for its tool_result, and whether it is an error. */
export async function runTool(
  ctx: ToolContext,
  name: string,
  input: unknown,
): Promise<{ content: string; error?: boolean }> {
  try {
    switch (name) {
      case 'read_document': {
        const args = READ.parse(input);
        if (args.document_id.trim()) {
          const doc = ctx.store.get(args.document_id.trim());
          if (!doc) return { content: `No document ${args.document_id} has been read.`, error: true };
          if (!args.pages.trim()) return { content: openingView(doc) };
          const pages = parsePages(args.pages, doc.pages.length);
          if (!pages)
            return { content: `"${args.pages}" is not a page range within 1–${doc.pages.length}.`, error: true };
          ctx.activity(`Read ${doc.meta?.title ?? doc.title}, ${doc.paged ? 'pages' : 'parts'} ${args.pages}`);
          return { content: showPages(doc, pages) };
        }
        const url = args.url.trim();
        const known = ctx.store.findByUrl(url);
        if (known) return { content: openingView(known) };
        if (!ctx.leads.has(url))
          return {
            content:
              'This address has not appeared in search results, in the request or in a page already read, so it cannot be read. Search for the document, or open the page that links to it.',
            error: true,
          };
        const doc = await readNew(ctx, url);
        ctx.activity(
          `Read ${doc.title}${doc.paged ? ` (PDF, ${doc.pageCount} pages)` : ''} · ${new URL(doc.url).hostname}`,
        );
        return { content: openingView(doc) };
      }
      case 'search_document': {
        const args = SEARCH.parse(input);
        const doc = ctx.store.get(args.document_id.trim());
        if (!doc) return { content: `No document ${args.document_id} has been read.`, error: true };
        const hits = ctx.store.find(doc, args.terms);
        if (hits.length === 0)
          return { content: `No lines of ${doc.id} contain ${args.terms.map((t) => `"${t}"`).join(', ')}.` };
        return {
          content: `${hits.length} lines of ${doc.id}:\n${hits.map((h) => `${doc.paged ? 'p' : 'part '}${h.page}: ${h.line}`).join('\n')}`,
        };
      }
      case 'record_document':
        return {
          content: report([
            ctx.ledger.recordDocument(DOCUMENT.parse(input) as Parameters<Ledger['recordDocument']>[0]),
          ]),
        };
      case 'record_company': {
        const outcomes = ctx.ledger.recordCompany(COMPANY.parse(input));
        ctx.rejected += outcomes.filter((o) => !o.ok).length;
        return { content: report(outcomes) || 'Recorded.' };
      }
      case 'record_figures': {
        const { figures } = FIGURES.parse(input);
        const outcomes = figures.map((f) => ctx.ledger.recordFigure(f as Parameters<Ledger['recordFigure']>[0]));
        const ok = outcomes.filter((o) => o.ok).length;
        ctx.rejected += outcomes.length - ok;
        ctx.activity(
          `Checked ${figures.length} figure${figures.length === 1 ? '' : 's'}: ${ok} verified${ok < figures.length ? `, ${figures.length - ok} sent back` : ''}`,
        );
        return { content: report(outcomes) };
      }
      case 'record_breakdowns': {
        const { items } = BREAKDOWNS.parse(input);
        const outcomes = items.map((b) => ctx.ledger.recordBreakdown(b));
        ctx.rejected += outcomes.filter((o) => !o.ok).length;
        return { content: report(outcomes) };
      }
      case 'record_passages': {
        const { passages } = PASSAGES.parse(input);
        const outcomes = passages.map((p) => ctx.ledger.recordPassage(p));
        ctx.rejected += outcomes.filter((o) => !o.ok).length;
        return { content: report(outcomes) };
      }
      case 'finish_research': {
        ctx.finished = FINISH.parse(input);
        return { content: `Research closed.\n${ctx.ledger.summary()}` };
      }
      default:
        return { content: `There is no tool called ${name}.`, error: true };
    }
  } catch (e) {
    if (e instanceof z.ZodError)
      return { content: `The input does not match the tool’s schema: ${e.message}`, error: true };
    if (e instanceof FetchError) return { content: e.message, error: true };
    // A document pdf.js cannot open, or anything else unexpected in one tool: report it, keep researching.
    return { content: `The tool failed: ${e instanceof Error ? e.message : String(e)}`, error: true };
  }
}
