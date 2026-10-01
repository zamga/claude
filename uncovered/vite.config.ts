import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Routes published in the sitemap. */
const ROUTES = ['/', '/report/krka', '/method', '/initiate'];

/**
 * Preload the fonts the first screen is set in. The app renders on the client,
 * so without this the browser only discovers its fonts after the script has
 * run, and the late swap moves the hero.
 */
function preloadFonts(patterns: RegExp[]): Plugin {
  return {
    name: 'uncovered:preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const files = Object.keys(ctx.bundle).filter((f) => f.endsWith('.woff2') && patterns.some((p) => p.test(f)));
        return files.map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${file}`, crossorigin: '' },
          injectTo: 'head' as const,
        }));
      },
    },
  };
}

/** A sitemap, and its line in robots.txt, when the deployment names its address in SITE_URL. */
function sitemap(siteUrl: string | undefined): Plugin {
  return {
    name: 'uncovered:sitemap',
    apply: 'build',
    generateBundle() {
      if (!siteUrl) return;
      const base = siteUrl.replace(/\/+$/, '');
      const urls = ROUTES.map((r) => `  <url><loc>${base}${r === '/' ? '/' : r}</loc></url>`).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
      });
    },
  };
}

/**
 * Two targets from one codebase:
 *  - production (default): code-split, hashed assets, history routing;
 *  - artifact: one self-contained HTML file with hash routing, for previews.
 */
export default defineConfig(({ mode, isSsrBuild }) => {
  const artifact = mode === 'artifact';
  return {
    base: artifact ? './' : '/',
    plugins: [
      react(),
      ...(artifact
        ? [viteSingleFile({ removeViteModuleLoader: true })]
        : isSsrBuild
          ? []
          : [
              preloadFonts([
                /hanken-grotesk-latin-wght-normal/,
                /bodoni-moda-latin-opsz-normal/,
                /bodoni-moda-latin-opsz-italic/,
              ]),
              sitemap(process.env.SITE_URL),
            ]),
    ],
    build: {
      target: 'es2022',
      outDir: artifact ? 'dist-artifact' : 'dist',
      emptyOutDir: true,
      sourcemap: !artifact && !isSsrBuild,
      // The prerender reads the manifest to give each page its own styles and code.
      manifest: !artifact && !isSsrBuild,
      // Each lazily loaded page brings its own styles in production; the preview is one file.
      cssCodeSplit: !artifact,
      assetsInlineLimit: artifact ? Number.MAX_SAFE_INTEGER : 4096,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
