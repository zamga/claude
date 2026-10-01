import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contains, searchable } from '../normalize';
import { extractHtml, parts } from './html';
import { extractPdf, layout } from './pdf';

const FIXTURE = fileURLToPath(new URL('../../fixtures/primer-letno-porocilo-2025.pdf', import.meta.url));

describe('PDF text', () => {
  it('reads every page in order, with table rows as rows', async () => {
    const pdf = await extractPdf(new Uint8Array(await readFile(FIXTURE)));
    expect(pdf.pageCount).toBe(2);
    expect(pdf.pages[0]).toContain('Letno poročilo 2025');
    expect(pdf.pages[1]).toContain('Čisti prihodki od prodaje | 48.312.904 | 45.407.211');
    // A quotation of the row with plain spaces is found, as is one across a wrapped line.
    const page2 = searchable(pdf.pages[1]!);
    expect(contains(page2, 'Čisti prihodki od prodaje 48.312.904 45.407.211')).toBe(true);
    expect(contains(page2, 'finančne obveznosti do bank pa 3.100.000 EUR.')).toBe(true);
  });

  it('joins words on a line and marks wide gaps as columns', () => {
    const at = (str: string, x: number, width: number, eol = false) => ({ str, x, y: 700, width, size: 10, eol });
    expect(layout([at('Net', 0, 15), at('sales', 17, 25), at('2,041.0', 300, 30), at('1,909.5', 400, 30, true)])).toBe(
      'Net sales | 2,041.0 | 1,909.5',
    );
  });
});

describe('HTML text', () => {
  const html = `<!doctype html><html><head><title>Investors &ndash; Primer d.o.o.</title>
    <script>var x = "not text";</script><style>p{}</style></head>
    <body><nav><a href="/en/">Home</a></nav>
    <h1>Annual&nbsp;reports</h1>
    <p>Primer d.o.o. was founded in 1991.<br>Registration number 1234567.</p>
    <table><tr><th>Year</th><th>Revenue</th></tr><tr><td>2025</td><td>48.3</td></tr></table>
    <ul><li><a href="docs/letno-porocilo-2025.pdf#page=2">Annual report 2025 (PDF)</a></li>
    <li><a href="mailto:ir@primer.si">Email</a></li></ul></body></html>`;

  it('keeps the visible words, lines and table cells', () => {
    const page = extractHtml(html, 'https://www.primer.si/en/investors/');
    expect(page.title).toBe('Investors – Primer d.o.o.');
    expect(page.text).not.toContain('not text');
    expect(page.text).toContain('Annual reports');
    expect(page.text).toContain('Primer d.o.o. was founded in 1991.\nRegistration number 1234567.');
    expect(page.text).toContain('Year | Revenue\n2025 | 48.3');
  });

  it('resolves links and drops fragments and non-web schemes', () => {
    const page = extractHtml(html, 'https://www.primer.si/en/investors/');
    expect(page.links).toContainEqual({
      url: 'https://www.primer.si/en/investors/docs/letno-porocilo-2025.pdf',
      text: 'Annual report 2025 (PDF)',
    });
    expect(page.links.some((l) => l.url.startsWith('mailto:'))).toBe(false);
  });

  it('splits long text at line ends', () => {
    const long = Array.from({ length: 50 }, (_, i) => `Line ${i} `.repeat(20)).join('\n');
    const chunks = parts(long, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 2000)).toBe(true);
    const words = (t: string) => t.split(/\s+/).filter(Boolean);
    expect(words(chunks.join('\n'))).toEqual(words(long));
  });
});
