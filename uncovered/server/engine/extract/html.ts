import { Parser } from 'htmlparser2';
import { tidy } from './pdf';

/*
 * Text from a web page: the words a reader sees, with headings, paragraphs
 * and list items on their own lines and table cells separated by " | ". Links
 * are kept, resolved to absolute addresses, because a company's investor page
 * is mostly a list of links to the documents that matter.
 */

export interface PageLink {
  url: string;
  text: string;
}

export interface HtmlText {
  title?: string;
  text: string;
  links: PageLink[];
}

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object', 'select']);
const BLOCK = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'thead',
  'tfoot',
  'tr',
  'ul',
]);

export const MAX_LINKS = 400;

export function extractHtml(html: string, pageUrl: string): HtmlText {
  let base = pageUrl;
  let skipDepth = 0;
  let inTitle = false;
  let title = '';
  let ogTitle: string | undefined;
  let text = '';
  const links = new Map<string, string>();
  let link: { url: string; text: string } | undefined;

  const resolve = (href: string): string | undefined => {
    try {
      const u = new URL(href, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
      u.hash = '';
      return u.toString();
    } catch {
      return undefined;
    }
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (SKIP.has(name)) {
          skipDepth++;
          return;
        }
        if (name === 'title') inTitle = true;
        if (name === 'base' && attribs.href) base = resolve(attribs.href) ?? base;
        if (name === 'meta' && (attribs.property === 'og:title' || attribs.name === 'og:title') && attribs.content)
          ogTitle = attribs.content.trim();
        if (skipDepth) return;
        if (BLOCK.has(name)) text += '\n';
        if (name === 'td' || name === 'th') text += ' | ';
        if (name === 'img' && attribs.alt?.trim()) text += ` ${attribs.alt.trim()} `;
        if (name === 'a' && attribs.href) {
          const url = resolve(attribs.href);
          if (url) link = { url, text: '' };
        }
      },
      ontext(data) {
        if (inTitle) {
          title += data;
          return;
        }
        if (skipDepth) return;
        text += data;
        if (link) link.text += data;
      },
      onclosetag(name) {
        if (SKIP.has(name)) {
          skipDepth = Math.max(0, skipDepth - 1);
          return;
        }
        if (name === 'title') inTitle = false;
        if (skipDepth) return;
        if (BLOCK.has(name)) text += '\n';
        if (name === 'a' && link) {
          const label = link.text.replace(/\s+/g, ' ').trim().slice(0, 140);
          if (!links.has(link.url) && links.size < MAX_LINKS) links.set(link.url, label);
          link = undefined;
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();

  // Inside a line, runs of spaces (including non-breaking ones) are one space.
  const lines = text
    .split('\n')
    .map((l) => l.replace(/[\s\u00A0]+/g, ' '))
    .join('\n');
  const cleanTitle = (ogTitle ?? title).replace(/\s+/g, ' ').trim();
  return {
    title: cleanTitle || undefined,
    // Paragraph breaks carry no meaning here; one line per block keeps pages short.
    text: tidy(lines).replace(/\n{2,}/g, '\n'),
    links: [...links].map(([url, t]) => ({ url, text: t })),
  };
}

/** Split long text into parts of at most `size` characters, at line ends where possible. */
export function parts(text: string, size = 12_000): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
