import { expect, test as base, type Page } from '@playwright/test';

export const CONDITIONS_KEY = 'stockpicks.demo.network.v1';

/** Every test starts with an instant demo network unless it changes the conditions itself. */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, provide) => {
    await page.addInitScript((key) => {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(
          key,
          JSON.stringify({ offline: false, slow: false, nextWrite: 'normal', instant: true }),
        );
      }
    }, CONDITIONS_KEY);
    await provide(page);
  },
});

export { expect };

export async function signIn(page: Page, returnTo = '/'): Promise<void> {
  await page.goto(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole('button', { name: 'Fill in the demo account' }).click();
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
}

/** Set the demo network conditions for the next requests (same tab). */
export async function setNetwork(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ([key, value]) => {
      const current = JSON.parse(sessionStorage.getItem(key as string) ?? '{}') as Record<
        string,
        unknown
      >;
      sessionStorage.setItem(
        key as string,
        JSON.stringify({ ...current, ...(value as Record<string, unknown>) }),
      );
    },
    [CONDITIONS_KEY, patch],
  );
}

export function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}
