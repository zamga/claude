import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

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
      cssCodeSplit: !artifact,
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
