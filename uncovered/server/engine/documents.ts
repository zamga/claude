import { createHash } from 'node:crypto';
import type { PageLink } from './extract/html';
import { contains, searchable, type Searchable } from './normalize';

/*
 * The documents a run has read, as the text the model saw. Quotations are
 * checked against exactly this text, so what the model read and what the
 * checks compare against cannot differ.
 */

export type DocumentKind =
  | 'audited_annual_report'
  | 'registry_filing'
  | 'exchange_filing'
  | 'interim_report'
  | 'results_release'
  | 'company_website'
  | 'press'
  | 'market_data'
  | 'reference_data'
  | 'other';

export const DOCUMENT_KINDS: DocumentKind[] = [
  'audited_annual_report',
  'registry_filing',
  'exchange_filing',
  'interim_report',
  'results_release',
  'company_website',
  'press',
  'market_data',
  'reference_data',
  'other',
];

/** Kinds that count as filed evidence, when the document shows that it is one. */
export const FILED_KINDS = new Set<DocumentKind>(['audited_annual_report', 'registry_filing', 'exchange_filing']);

export interface DocumentMeta {
  title: string;
  publisher: string;
  /** ISO date, year-month or year, as far as known. */
  published?: string;
  kind: DocumentKind;
  /** ISO 639-1. */
  language: string;
  /** A filed kind whose status a quoted passage of the document confirms. */
  filed: boolean;
}

export interface StoredDocument {
  id: string;
  /** The web address read, or upload:<file name> for a supplied document. */
  url: string;
  origin: 'web' | 'upload';
  format: 'pdf' | 'html' | 'text';
  title: string;
  /** Text by page for a PDF; by part, in reading order, for anything else. */
  pages: string[];
  /** True when pages are the document's own pages, so page numbers can be cited. */
  paged: boolean;
  /** Pages the document has, which can exceed the pages read. */
  pageCount: number;
  links: PageLink[];
  retrievedAt: string;
  bytes: number;
  sha256: string;
  meta?: DocumentMeta;
}

export type NewDocument = Omit<StoredDocument, 'id' | 'sha256' | 'retrievedAt' | 'bytes'> & { raw: Uint8Array };

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Page ranges such as "12-18" or "3, 7, 40-42", within 1..count. */
export function parsePages(spec: string, count: number): number[] | undefined {
  const pages: number[] = [];
  for (const part of spec
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) return undefined;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from) return undefined;
    for (let p = from; p <= Math.min(to, count); p++) if (!pages.includes(p)) pages.push(p);
  }
  return pages.length ? pages : undefined;
}

export class DocumentStore {
  private readonly docs = new Map<string, StoredDocument>();
  private readonly byUrl = new Map<string, string>();
  private readonly bySha = new Map<string, string>();
  private readonly search = new Map<string, Searchable[]>();
  private web = 0;
  private uploads = 0;

  /** Add a document, or return the one already read from the same address or with the same bytes. */
  add(input: NewDocument): { doc: StoredDocument; added: boolean } {
    const sha256 = createHash('sha256').update(input.raw).digest('hex');
    const known = this.byUrl.get(input.url) ?? this.bySha.get(sha256);
    if (known) {
      const doc = this.docs.get(known)!;
      this.byUrl.set(input.url, doc.id);
      return { doc, added: false };
    }
    const id = input.origin === 'upload' ? `u${++this.uploads}` : `d${++this.web}`;
    const { raw, ...rest } = input;
    const doc: StoredDocument = { ...rest, id, sha256, retrievedAt: new Date().toISOString(), bytes: raw.byteLength };
    this.docs.set(id, doc);
    this.byUrl.set(doc.url, id);
    this.bySha.set(sha256, id);
    return { doc, added: true };
  }

  get(id: string): StoredDocument | undefined {
    return this.docs.get(id);
  }

  findByUrl(url: string): StoredDocument | undefined {
    const id = this.byUrl.get(url);
    return id ? this.docs.get(id) : undefined;
  }

  list(): StoredDocument[] {
    return [...this.docs.values()];
  }

  private pagesOf(doc: StoredDocument): Searchable[] {
    let s = this.search.get(doc.id);
    if (!s) {
      s = doc.pages.map(searchable);
      this.search.set(doc.id, s);
    }
    return s;
  }

  /**
   * The page (1-based) a quotation is on: the page given if it is there,
   * otherwise any page of the document. Undefined when the document does not
   * contain it.
   */
  locate(doc: StoredDocument, quote: string, hint?: number): number | undefined {
    const pages = this.pagesOf(doc);
    if (hint && hint >= 1 && hint <= pages.length && contains(pages[hint - 1]!, quote)) return hint;
    const i = pages.findIndex((p) => contains(p, quote));
    return i < 0 ? undefined : i + 1;
  }

  /** Lines of the document that contain any of the terms, for finding one's way in a long document. */
  find(doc: StoredDocument, terms: string[], limit = 40): { page: number; line: string }[] {
    const wanted = terms
      .map(fold)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    const hits: { page: number; line: string }[] = [];
    doc.pages.forEach((text, i) => {
      for (const line of text.split('\n')) {
        if (hits.length >= limit) return;
        const f = fold(line);
        if (wanted.some((t) => f.includes(t))) hits.push({ page: i + 1, line: line.slice(0, 240) });
      }
    });
    return hits;
  }
}
