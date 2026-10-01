import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * `vite preview` mirrors production hosting: prerendered pages are served as
 * files, and any other path gets the unrendered shell (dist/app.html), so a
 * page is never hydrated against another page's HTML.
 */
const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function spaFallback(): Plugin {
  return {
    name: 'plimsoll:spa-fallback',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const [url = '/', query] = (req.url ?? '/').split('?');
        const isAsset = /\.[a-z0-9]+$/i.test(url) || url.startsWith('/api/') || url.startsWith('/assets/');
        // A missing file is a 404, as in production, never the app shell.
        if (isAsset && !url.startsWith('/api/') && !existsSync(join('dist', safeDecode(url)))) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        if (!isAsset && url !== '/') {
          const page = `${url.replace(/\/$/, '')}.html`;
          const target = existsSync(join('dist', page)) ? page : existsSync('dist/app.html') ? '/app.html' : null;
          if (target) req.url = target + (query ? `?${query}` : '');
        }
        next();
      });
    },
  };
}

/**
 * `vite preview` also sends production's response headers from vercel.json,
 * Content-Security-Policy included, so end-to-end tests run under the real
 * policy and a violation fails them.
 */
function productionHeaders(): Plugin {
  return {
    name: 'plimsoll:production-headers',
    configurePreviewServer(server) {
      const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
        headers: { source: string; headers: { key: string; value: string }[] }[];
      };
      const rules = config.headers.map((r) => ({ match: new RegExp(`^${r.source}$`), headers: r.headers }));
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0] ?? '/';
        for (const rule of rules) {
          if (rule.match.test(path)) for (const h of rule.headers) res.setHeader(h.key, h.value);
        }
        next();
      });
    },
  };
}

/**
 * Two build targets share one codebase:
 *  - `production` (default): code-split, hashed assets, History-API routing.
 *    Deploy to any edge CDN with an SPA fallback (see vercel.json).
 *  - `artifact`: one self-contained HTML file (JS, CSS, fonts inlined) with
 *    hash routing, for hosts that cannot rewrite deep links.
 */
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';

  // Telemetry tags every batch with the deploy it came from, so a regression points at a release.
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'dev').slice(0, 7);

  return {
    base: artifact ? './' : '/',
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      productionHeaders(),
      spaFallback(),
      ...(artifact
        ? [
            {
              // Font preloads would emit the fonts as separate files; in a
              // single-file build they are inlined into the stylesheet instead.
              name: 'plimsoll:strip-preloads',
              transformIndexHtml: {
                order: 'pre' as const,
                handler: (html: string) => html.replace(/\s*<link rel="preload"[^>]*>/g, ''),
              },
            },
            viteSingleFile({ removeViteModuleLoader: true }),
          ]
        : []),
    ],
    build: {
      target: 'es2022',
      outDir: artifact ? 'dist-artifact' : 'dist',
      emptyOutDir: true,
      sourcemap: !artifact,
      // One small stylesheet in <head>: prerendered pages must never paint before their styles arrive.
      cssCodeSplit: false,
      assetsInlineLimit: artifact ? Number.MAX_SAFE_INTEGER : 4096,
      chunkSizeWarningLimit: 700,
    },
    worker: {
      format: 'es',
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'api/**/*.test.ts', 'scripts/**/*.test.ts'],
    },
  };
});
