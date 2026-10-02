/*
 * The HTML around a rendered page: its title and description, the styles and
 * code of the page it shows, canonical links, structured data and, for a
 * report written after the build, the report itself. Used by the prerender at
 * build time and by the server for reports rendered on request.
 */

export interface ManifestEntry {
  file: string;
  css?: string[];
  imports?: string[];
  isEntry?: boolean;
}

export type Manifest = Record<string, ManifestEntry>;

/** The page module an address loads lazily, whose styles and code the page should carry. */
export function pageModule(address: string): string | undefined {
  const [path = address] = address.split('?');
  if (/^\/report\/[^/]+$/.test(path)) return 'src/pages/Report.tsx';
  if (path === '/initiate') return 'src/pages/Initiate.tsx';
  if (path === '/method') return 'src/pages/Method.tsx';
  if (path === '/404') return 'src/pages/NotFound.tsx';
  return undefined;
}

/** A chunk's own file, its static imports and every stylesheet among them. */
export function assetsFor(manifest: Manifest, source: string): { js: string[]; css: string[] } {
  const js = new Set<string>();
  const css = new Set<string>();
  const visit = (key: string) => {
    const entry = manifest[key];
    if (!entry || js.has(entry.file)) return;
    js.add(entry.file);
    (entry.css ?? []).forEach((f) => css.add(f));
    (entry.imports ?? []).forEach(visit);
  };
  visit(source);
  return { js: [...js], css: [...css] };
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON safe to place inside a script element. */
export const scriptJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export interface ShellOptions {
  /** The address the page was rendered from, such as "/report/krka" or "/initiate?run=…". */
  path: string;
  html: string;
  title: string;
  description: string;
  manifest: Manifest;
  siteUrl?: string;
  structuredData?: Record<string, unknown>;
  /** Data the client needs to hydrate the page without asking again, by the id of the element that carries it. */
  embeds?: Record<string, unknown>;
  /** A page for one visitor's errand, such as a run in progress, which search engines should leave alone. */
  noindex?: boolean;
  /** The card shown where the page's address is shared. */
  image?: { path: string; alt: string };
}

export function fillShell(template: string, o: ShellOptions): string {
  const source = pageModule(o.path);
  const { js, css } = source ? assetsFor(o.manifest, source) : { js: [], css: [] };
  const entryCss = new Set(
    Object.values(o.manifest)
      .filter((e) => e.isEntry)
      .flatMap((e) => e.css ?? []),
  );
  const site = o.siteUrl?.replace(/\/+$/, '');
  const address = `${site}${o.path === '/' ? '/' : o.path}`;
  const head = [
    ...css.filter((f) => !entryCss.has(f)).map((f) => `<link rel="stylesheet" crossorigin href="/${f}">`),
    ...js.map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`),
    ...(o.noindex ? ['<meta name="robots" content="noindex">'] : []),
    // The address search engines should treat as the page's own, when the deployment names it.
    ...(site && o.path !== '/404' && !o.noindex
      ? [
          `<link rel="canonical" href="${escapeHtml(address)}">`,
          `<meta property="og:url" content="${escapeHtml(address)}">`,
        ]
      : []),
    // The card shown where the address is shared: absolute when the deployment names its address, as the
    // networks require, and root-relative otherwise for the hosts that resolve it.
    ...(o.image
      ? [
          `<meta property="og:image" content="${escapeHtml(`${site ?? ''}${o.image.path}`)}">`,
          '<meta property="og:image:width" content="1200">',
          '<meta property="og:image:height" content="630">',
          `<meta property="og:image:alt" content="${escapeHtml(o.image.alt)}">`,
          '<meta name="twitter:card" content="summary_large_image">',
        ]
      : []),
    ...(o.structuredData ? [`<script type="application/ld+json">${scriptJson(o.structuredData)}</script>`] : []),
    ...Object.entries(o.embeds ?? {}).map(
      ([id, data]) => `<script type="application/json" id="${escapeHtml(id)}">${scriptJson(data)}</script>`,
    ),
  ].join('\n    ');
  const page = template
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(o.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escapeHtml(o.description)}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${escapeHtml(o.title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${escapeHtml(o.description)}" />`,
    )
    .replace('</head>', head ? `  ${head}\n  </head>` : '</head>')
    .replace('<div id="root"></div>', `<div id="root" data-path="${escapeHtml(o.path)}">${o.html}</div>`);
  if (!page.includes(`data-path="${escapeHtml(o.path)}"`)) throw new Error(`No root element to fill for ${o.path}`);
  return page;
}
