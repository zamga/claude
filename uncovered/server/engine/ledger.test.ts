import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DocumentStore, parsePages } from './documents';
import { extractPdf } from './extract/pdf';
import { Ledger, type FigureInput } from './ledger';

const FIXTURE = fileURLToPath(new URL('../fixtures/primer-letno-porocilo-2025.pdf', import.meta.url));

let store: DocumentStore;
let ledger: Ledger;

beforeAll(async () => {
  const raw = new Uint8Array(await readFile(FIXTURE));
  const pdf = await extractPdf(raw);
  store = new DocumentStore();
  store.add({
    url: 'upload:letno-porocilo-2025.pdf',
    origin: 'upload',
    format: 'pdf',
    title: 'letno-porocilo-2025.pdf',
    pages: pdf.pages,
    paged: true,
    pageCount: pdf.pageCount,
    links: [],
    raw,
  });
});

const revenue = (over: Partial<FigureInput> = {}): FigureInput => ({
  line: 'revenue',
  period: 'FY2025',
  as_printed: '48.312.904',
  decimal_mark: ',',
  scale: 'units',
  currency: 'EUR',
  scope: 'company',
  document_id: 'u1',
  page: 2,
  quote: 'Čisti prihodki od prodaje 48.312.904 45.407.211',
  translation: 'Net sales revenue 48,312,904 45,407,211',
  ...over,
});

describe('the evidence ledger', () => {
  beforeAll(() => {
    ledger = new Ledger(store);
  });

  it('records a figure whose quotation and number are in the document, converted in code', () => {
    const out = ledger.recordFigure(revenue());
    expect(out.ok).toBe(true);
    const f = ledger.figures[0]!;
    expect(f.value).toBeCloseTo(48.312904, 9);
    expect(ledger.passages[0]).toMatchObject({ id: 'p1', documentId: 'u1', page: 2 });
  });

  it('finds the right page when the model gives the wrong one', () => {
    const out = ledger.recordFigure(
      revenue({
        line: 'cash',
        period: '2025-12-31',
        as_printed: '6.218.400',
        page: 1,
        quote: 'Denarna sredstva na dan 31. 12. 2025 so znašala 6.218.400 EUR',
        translation: 'Cash at 31 December 2025 amounted to EUR 6,218,400',
      }),
    );
    expect(out.ok).toBe(true);
    expect(ledger.passages.at(-1)!.page).toBe(2);
  });

  it('refuses a quotation the document does not contain, and shows where the number is', () => {
    const out = ledger.recordFigure(revenue({ quote: 'Net sales in 2025 were EUR 48.312.904.' }));
    expect(out.ok).toBe(false);
    expect(out.message).toMatch(/not in u1 as written/);
    expect(out.message).toMatch(/page 2: "Čisti prihodki od prodaje \| 48.312.904 \| 45.407.211"/);
  });

  it('refuses a number that is not in its own quotation', () => {
    const out = ledger.recordFigure(revenue({ as_printed: '48.312.905' }));
    expect(out).toMatchObject({ ok: false });
    expect(out.message).toMatch(/does not appear in the quotation/);
  });

  it('refuses a number that does not read under the decimal mark given', () => {
    expect(ledger.recordFigure(revenue({ decimal_mark: '.' })).message).toMatch(/does not read as a number/);
  });

  it('refuses a second currency and malformed periods', () => {
    expect(ledger.recordFigure(revenue({ currency: 'USD', period: 'FY2024' })).message).toMatch(/reporting currency/);
    expect(ledger.recordFigure(revenue({ period: '2025' })).message).toMatch(/not FY2025/);
  });

  it('notes corroboration and keeps conflicting values side by side', () => {
    expect(ledger.recordFigure(revenue()).message).toMatch(/already recorded/);
    const conflict = ledger.recordFigure(
      revenue({ as_printed: '45.407.211', quote: 'Čisti prihodki od prodaje 48.312.904 45.407.211' }),
    );
    expect(conflict.message).toMatch(/differs/);
    expect(ledger.figures.filter((f) => f.line === 'revenue' && f.period === 'FY2025')).toHaveLength(2);
    ledger.figures.pop();
  });

  it('keeps a filed kind only when a passage shows it', () => {
    const plain = ledger.recordDocument({
      document_id: 'u1',
      title: 'Letno poročilo 2025',
      publisher: 'Primer d.o.o.',
      published: '2026-04',
      kind: 'audited_annual_report',
      language: 'sl',
      evidence_quote: '',
      evidence_page: 0,
    });
    expect(plain.message).toMatch(/Kept as reported/);
    expect(ledger.gradeOf(ledger.passages[0]!)).toBe('reported');
  });

  it('records identity facts only with a quotation that contains them', () => {
    const outcomes = ledger.recordCompany({
      legal_name: 'Primer d.o.o.',
      short_name: 'Primer',
      country: 'Slovenia',
      city: 'Novo mesto',
      sector: 'Industrial components',
      description: 'Maker of industrial components.',
      founded: '1991',
      registration_number: '7654321',
      website: 'https://www.primer.si',
      listed: true,
      exchange: 'Ljubljana Stock Exchange',
      ticker: 'PRMG',
      isin: '',
      reporting_currency: 'EUR',
      fiscal_year_end: '12-31',
      evidence: [
        {
          field: 'founded',
          document_id: 'u1',
          page: 1,
          quote: 'Družba Primer d.o.o. je bila ustanovljena leta 1991 v Novem mestu.',
          translation: 'Primer d.o.o. was founded in 1991 in Novo mesto.',
        },
      ],
    });
    expect(outcomes.some((o) => /not listed/.test(o.message))).toBe(true);
    expect(ledger.identity).toMatchObject({ founded: 1991, listed: false, registration: undefined, ticker: undefined });
  });
});

describe('page ranges', () => {
  it('reads lists and ranges within the document', () => {
    expect(parsePages('3, 7, 40-42', 41)).toEqual([3, 7, 40, 41]);
    expect(parsePages('0-2', 10)).toBeUndefined();
    expect(parsePages('a', 10)).toBeUndefined();
  });
});
