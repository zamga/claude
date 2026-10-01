import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'dist-artifact', 'test-results', 'playwright-report', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      // Restated on purpose: Safari drops list semantics from unstyled lists, and
      // tables restacked as blocks on phones lose theirs without explicit roles.
      'jsx-a11y/no-redundant-roles': [
        'error',
        {
          nav: ['navigation'],
          ul: ['list'],
          ol: ['list'],
          table: ['table'],
          thead: ['rowgroup'],
          tbody: ['rowgroup'],
          tr: ['row'],
          th: ['columnheader', 'rowheader'],
          td: ['cell'],
        },
      ],
      'jsx-a11y/no-interactive-element-to-noninteractive-role': [
        'error',
        { tr: ['none', 'presentation'], canvas: ['img'], td: ['cell'] },
      ],
      // Scrollable regions must be reachable by keyboard.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'] }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'vite.config.ts', 'playwright.config.ts', 'e2e/**/*.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
