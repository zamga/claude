import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

/*
 * Text from a PDF, page by page, in the order the document draws it. Words on
 * one line are joined with spaces; a wide gap between them, as between the
 * columns of a financial statement, becomes " | ", so a table row reads as
 * "Revenue | 48.312.904 | 45.407.211". The evidence checks treat " | " as a
 * space, so a quotation of the row matches either way.
 */

const require = createRequire(import.meta.url);
const ROOT = dirname(require.resolve('pdfjs-dist/package.json'));

/** More pages than any filing needs; a larger file is cut off with a note. */
export const MAX_PDF_PAGES = 800;

export interface PdfText {
  pages: string[];
  title?: string;
  /** Pages the document has, which can exceed the pages read. */
  pageCount: number;
}

interface Glyphs {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
  eol: boolean;
}

function glyphs(item: TextItem): Glyphs {
  const [a = 0, b = 0, , , e = 0, f = 0] = item.transform as number[];
  return {
    str: item.str,
    x: e,
    y: f,
    width: item.width,
    size: Math.max(1, Math.hypot(a, b) || item.height || 10),
    eol: item.hasEOL,
  };
}

/** Lay out one page's text items as lines. */
export function layout(items: Glyphs[]): string {
  let out = '';
  let prev: Glyphs | undefined;
  for (const it of items) {
    const blank = it.str.trim() === '';
    if (prev) {
      const sameLine = Math.abs(it.y - prev.y) < Math.max(2, Math.min(it.size, prev.size) * 0.5);
      if (!sameLine) {
        if (!out.endsWith('\n')) out += '\n';
      } else {
        const gap = it.x - (prev.x + prev.width);
        if (gap > Math.max(it.size, prev.size) * 1.5) {
          if (!out.endsWith(' | ')) out = `${out.replace(/ +$/, '')} | `;
        } else if (gap > it.size * 0.15 && !/\s$/.test(out) && !it.str.startsWith(' ')) out += ' ';
      }
    }
    if (blank) {
      // A wide run of spaces is a column gap; a narrow one is a space.
      if (it.width > it.size * 1.5) {
        if (!out.endsWith(' | ') && !out.endsWith('\n') && out.length > 0) out = `${out.replace(/ +$/, '')} | `;
      } else if (!/\s$/.test(out) && out.length > 0) out += ' ';
    } else out += it.str;
    if (it.eol) {
      if (!out.endsWith('\n')) out += '\n';
      prev = undefined;
    } else prev = blank ? { ...it, str: ' ' } : it;
  }
  return tidy(out);
}

/** Trim each line, drop separators at line ends and runs of blank lines. */
export function tidy(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^(?:\s*\|\s*)+/, '')
        .replace(/(?:\s*\|\s*)+$/, '')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractPdf(bytes: Uint8Array, maxPages = MAX_PDF_PAGES): Promise<PdfText> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    // pdf.js takes ownership of the buffer it is given; pass a copy.
    data: bytes.slice(),
    cMapUrl: join(ROOT, 'cmaps') + '/',
    cMapPacked: true,
    standardFontDataUrl: join(ROOT, 'standard_fonts') + '/',
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    const count = Math.min(doc.numPages, maxPages);
    for (let p = 1; p <= count; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is TextItem => 'str' in i).map(glyphs);
      pages.push(layout(items));
      page.cleanup();
      // Let other requests run between pages of a long document.
      await new Promise((resolve) => setImmediate(resolve));
    }
    let title: string | undefined;
    try {
      const { info } = await doc.getMetadata();
      const t = (info as { Title?: unknown }).Title;
      if (typeof t === 'string' && t.trim() && !/^(untitled|microsoft word|document)/i.test(t.trim()))
        title = t.trim().slice(0, 200);
    } catch {
      // Metadata is optional.
    }
    return { pages, title, pageCount: doc.numPages };
  } finally {
    await task.destroy();
  }
}
