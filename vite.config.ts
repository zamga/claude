import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * `vite preview` mirrors production hosting: prerendered pages are served as
 * files, and any other path gets the unrendered shell (dist/app.html), so a
 * page is never hydrated against another page's HTML.
 */
function spaFallback(): Plugin {
  return {
    name: 'plimsoll:spa-fallback',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [url = '/', query] = (req.url ?? '/').split('?');
        const isAsset = /\.[a-z0-9]+$/i.test(url) || url.startsWith('/api/');
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
 * Two build targets share one codebase:
 *  - `production` (default): code-split, hashed assets, History-API routing.
 *    Deploy to any edge CDN with an SPA fallback (see vercel.json).
 *  - `artifact`: one self-contained HTML file (JS, CSS, fonts inlined) with
 *    hash routing, for hosts that cannot rewrite deep links.
 */
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';

  return {
    base: artifact ? './' : '/',
    plugins: [
      react(),
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
