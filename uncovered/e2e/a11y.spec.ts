import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/report/krka', '/initiate', '/method', '/no-such-page'];

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`${path} has no WCAG 2.2 AA violations in ${theme === 'dark' ? 'UV' : 'daylight'}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('uncovered:theme', t), theme);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Let entrance animations finish so contrast is measured on the settled page.
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
      }));
      expect(summary).toEqual([]);
    });
  }
}
