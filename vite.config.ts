/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const paper = '#F8F5ED';

/** Public, indexable routes. Account, settings and auth screens are private or transactional. */
const PUBLIC_ROUTES = [
  '/',
  '/market',
  '/search',
  '/earnings',
  '/ipos',
  '/research',
  '/archive',
  '/archive/performance',
  '/help',
  '/legal/terms',
  '/legal/privacy',
  '/legal/disclosures',
  '/legal/licences',
];

/**
 * The entry stylesheets are small (about 7 kB compressed) but render-blocking; inlining them in
 * index.html removes two round trips before the first paint on slow mobile connections. Each
 * inlined file keeps a `<link rel="stylesheet">` with a non-CSS type: browsers neither fetch nor
 * apply it, but Vite's chunk loader sees the file as present and does not download it again when
 * the first lazy route asks for it.
 */
function inlineEntryCss(): Plugin {
  return {
    name: 'stock-picks-inline-entry-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const bundle = context.bundle;
        if (!bundle) return html;
        return html.replace(
          /<link rel="stylesheet"[^>]*?href="\/(assets\/[^"]+\.css)"[^>]*>/g,
          (tag, file: string) => {
            const asset = bundle[file];
            if (!asset || asset.type !== 'asset') return tag;
            const css =
              typeof asset.source === 'string'
                ? asset.source
                : new TextDecoder().decode(asset.source);
            return `<style data-href="/${file}">${css}</style><link rel="stylesheet" type="text/x-inlined" href="/${file}">`;
          },
        );
      },
    },
  };
}

/**
 * robots.txt and sitemap.xml from APP_URL at build time. Without an absolute origin a sitemap
 * would be invalid, so it is skipped with a warning instead of guessed.
 */
function seoFiles(appUrl: string | undefined): Plugin {
  return {
    name: 'stock-picks-seo-files',
    apply: 'build',
    generateBundle() {
      const origin = appUrl?.replace(/\/$/, '');
      const valid =
        origin != null && /^https?:\/\/[^/]+$/.test(origin) && !origin.includes('localhost');
      const disallow = [
        '/auth/',
        '/account/',
        '/settings',
        '/alerts',
        '/portfolio',
        '/paper/',
        '/watchlists/',
        '/demo',
      ];
      const robots = [
        'User-agent: *',
        ...disallow.map((path) => `Disallow: ${path}`),
        valid ? `Sitemap: ${origin}/sitemap.xml` : '',
      ].filter(Boolean);
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.join('\n')}\n` });
      if (!valid) {
        this.warn('VITE_APP_URL is not a public origin; sitemap.xml was not generated.');
        return;
      }
      const urls = PUBLIC_ROUTES.map(
        (path) => `  <url><loc>${origin}${path === '/' ? '/' : path}</loc></url>`,
      ).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    seoFiles(loadEnv(mode, process.cwd(), '').VITE_APP_URL),
    inlineEntryCss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'fonts/*.txt'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        globIgnores: ['**/og-image.png'],
      },
      manifest: {
        id: '/',
        name: 'Stock Picks',
        short_name: 'Stock Picks',
        description:
          'Daily editorial stock picks with sourced theses, watchlists, alerts and a paper portfolio.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        lang: 'en',
        dir: 'ltr',
        background_color: paper,
        theme_color: paper,
        categories: ['finance', 'news', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: 'hidden',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/]react-router[\\/]/.test(id)) return 'router';
            if (/[\\/]@tanstack[\\/]/.test(id)) return 'query';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
  },
}));
