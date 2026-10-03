import { expect, signIn, test } from './fixtures';

/**
 * The specification's user journeys (J01–J08), end to end against the demo service. Each test
 * follows the journey's legs in order; the server-side legs (push after the app is closed, a second
 * real device) need live services and are not part of the demo.
 */

test('J01 first use: a guest saves a pick after signing in, and it stays saved', async ({
  page,
  context,
}) => {
  await page.goto('/stocks/KORA');
  await page.getByRole('button', { name: 'Add to watchlist' }).click();
  const prompt = page.getByRole('dialog', { name: 'Save it to your account.' });
  await prompt.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=%2Fstocks%2FKORA$/);
  await page.getByRole('button', { name: 'Fill in the demo account' }).click();
  await page.getByRole('button', { name: /^Sign in/ }).click();
  // Back on the same pick, signed in: the save goes to the first list.
  await expect(page).toHaveURL(/\/stocks\/KORA$/);
  await page.getByRole('button', { name: 'Add to watchlist' }).click();
  await expect(page.getByRole('button', { name: 'In High conviction' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'In High conviction' })).toBeVisible();
  // A second tab (the demo's second device) shows the same saved company.
  const second = await context.newPage();
  await second.goto('/watchlist');
  await expect(second.getByRole('link', { name: /^KORA, / })).toBeVisible();
});

test('J02 research: search, filter, thesis, source, valuation edit, saved scenario', async ({
  page,
}) => {
  await signIn(page, '/search');
  await page.goto('/search');
  await page.getByPlaceholder('Company, ticker or theme').fill('semi');
  await page.getByRole('button', { name: /^Filters/ }).click();
  const filters = page.getByRole('dialog', { name: 'Refine results' });
  await filters.getByRole('radio', { name: 'US', exact: true }).click();
  await filters.getByRole('button', { name: /^Show \d+ results?$/ }).click();
  await expect(page).toHaveURL(/region=US/);
  await page
    .getByRole('link', { name: /^NVDA, NVIDIA/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/stocks\/NVDA$/);

  await page.getByRole('link', { name: /^Catalyst: / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The investment case.' })).toBeVisible();
  await page.getByRole('button', { name: /^Source: Quarterly report/ }).click();
  const source = page.getByRole('dialog', { name: /Quarterly report/ });
  await expect(source.getByText('Regulatory filing')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(source).toHaveCount(0);

  await page.goto('/stocks/NVDA/valuation');
  await page.getByLabel('Revenue growth (%)').fill('30');
  await page.getByRole('button', { name: 'Save base scenario' }).click();
  // Saved in the simulated session, against the reference price and time it was computed with.
  const saved = page.getByText('Saved 21 Oct 2026 against $142.80 at 14:25 ET, 21 Oct 2026.');
  await expect(saved).toBeVisible();
  await page.goto('/stocks/NVDA');
  await page.goto('/stocks/NVDA/valuation');
  await expect(page.getByLabel('Revenue growth (%)')).toHaveValue('30');
  await expect(saved).toBeVisible();
});

test('J03 catalyst: calendar, event, reminder; an unknown time reads as unconfirmed', async ({
  page,
}) => {
  await signIn(page, '/earnings');
  await page.goto('/earnings');
  await page.getByRole('radio', { name: /^Thu 22 Oct/ }).click();
  await expect(page.getByRole('link', { name: /^AMD, AMD, .*Time unconfirmed/ })).toBeVisible();
  await page.getByRole('link', { name: /^COST, Costco/ }).click();
  await expect(page).toHaveURL(/\/earnings\/ern_cost_q1fy27$/);
  await page.getByRole('button', { name: /Remind me/ }).click();
  await expect(page).toHaveURL(
    /\/alerts\/new\?instrument=COST&type=earnings&event=ern_cost_q1fy27/,
  );
  await expect(
    page.getByText(/The reminder arrives 24 hours before a confirmed release/),
  ).toBeVisible();
  // Preview, then confirm: the release is under a day away, so the reminder goes out on saving.
  await page.getByRole('button', { name: 'Create alert' }).click();
  const confirm = page.getByRole('dialog', { name: 'Confirm this alert' });
  await expect(confirm.getByText(/the reminder is sent as soon as you save/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Create alert' }).click();
  await expect(page.getByText(/^Alert created: COST earnings reminder/)).toBeVisible();
  // The editor closes itself (Back); let that navigation land before opening the rules.
  await page.waitForURL((url) => !url.pathname.startsWith('/alerts/new'));
  await page.goto('/alerts');
  await expect(page.getByRole('link', { name: /^COST earnings reminder\./ })).toBeVisible();
});

test('J05 paper tracking: buy, cost, journal, partial sell, return; the ledger survives reload', async ({
  page,
}) => {
  await signIn(page, '/portfolio');
  // Insufficient simulated cash is refused with the amounts.
  await page.goto('/paper/transactions/new?instrument=ASML');
  await page.getByLabel('Quantity').fill('1000');
  await page.getByRole('button', { name: 'Save paper buy' }).click();
  await expect(
    page.getByText(/Not enough simulated cash: this needs \$[\d,.]+, available/),
  ).toBeVisible();
  await page.getByLabel('Quantity').fill('10');
  await page.getByRole('button', { name: 'Save paper buy' }).click();
  await expect(page).toHaveURL(/\/portfolio\/ASML$/);
  await expect(page.getByText('Average entry', { exact: true })).toBeVisible();
  await expect(page.getByText('€626.72', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add a note' }).first().click();
  await page.getByLabel('New note').fill('Adding on strength after the guidance raise.');
  await page.getByRole('button', { name: /^Save note/ }).click();
  await expect(page.getByText(/^21 Oct 2026 \/ note$/i)).toBeVisible();
  await expect(page.getByText('Adding on strength after the guidance raise.')).toBeVisible();

  await page.goto('/paper/transactions/new?instrument=ASML&side=sell');
  await page.getByLabel('Quantity').fill('5');
  await page.getByRole('button', { name: 'Save paper sale' }).click();
  await expect(page).toHaveURL(/\/portfolio\/ASML$/);
  await page.reload();
  await expect(page.getByText('Sold 5 ASML at €648.20')).toBeVisible();
  await expect(page.getByText('Bought 10 ASML at €648.20')).toBeVisible();
  await expect(page.getByText(/^Realized$/)).toBeVisible();
  await expect(page.getByText('+$104.86')).toBeVisible();

  await page.goto('/portfolio');
  await expect(page.getByText('Benchmark', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Return$/i).first()).toBeVisible();
});

test('J06 honest history: a losing pick, its original thesis, the revision and the benchmark', async ({
  page,
}) => {
  await page.goto('/archive?period=all');
  // Incomplete windows stay pending and a delisted instrument stays in the record.
  await expect(page.getByRole('link', { name: /^ONTO, published 14 Oct, pending/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^HLRB, .*delisted$/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Outcome' }).selectOption('negative');
  await page.getByRole('link', { name: /^AMD, published 7 Sept, −5\.1%/ }).click();
  await expect(page).toHaveURL(/\/archive\/arc_2026_09_07_amd$/);
  await expect(
    page.getByText(/S&P 500 \+1\.9% over the same sessions · difference −7\.0 pp/),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Read the research as published' }).click();
  await expect(page).toHaveURL(/rep_arc_2026_09_07_amd\?v=1$/);
  await expect(page.getByText('You are reading version 1 of 2.', { exact: false })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: /^Version 2, 1 Oct 2026/ }).click();
  await expect(page).toHaveURL(/rep_arc_2026_09_07_amd\?v=2$/);
  await expect(page.getByText('Thesis closed.', { exact: false }).first()).toBeVisible();
});

test('J07 recovery: a save attempted offline is explained, then works once reconnected', async ({
  page,
  context,
}) => {
  await signIn(page, '/research/rep_tsm_thesis');
  await page.goto('/research/rep_tsm_thesis');
  const save = page.getByRole('button', { name: /^Save to research/ }).last();
  await expect(save).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline.' })).toBeVisible();
  await expect(save).toHaveAccessibleName(/Needs a connection/);
  // The button stays focusable and explains itself when pressed (it is aria-disabled, not inert).
  await save.click({ force: true });
  await expect(page.getByText('Reconnect to change saved research.')).toBeVisible();
  await context.setOffline(false);
  await expect(save).toHaveAccessibleName('Save to research');
  await save.click();
  await expect(page.getByRole('button', { name: 'Saved (version 1)' })).toBeVisible();
});

test('J08 account lifecycle: change email, export, delete; the account cannot sign in again', async ({
  page,
}) => {
  await signIn(page, '/account/edit');
  await page.goto('/account/edit');
  await page.getByLabel('New email address').fill('alex.new@example.com');
  await page.getByRole('button', { name: /^Send verification link/ }).click();
  await expect(page.getByText('Waiting for alex.new@example.com to be verified.')).toBeVisible();
  await page
    .getByRole('region', { name: 'Demo mailbox' })
    .getByRole('button', { name: 'Verify email' })
    .first()
    .click();
  await expect(page.getByText('alex.new@example.com is confirmed.')).toBeVisible();
  await page.goto('/account/edit');
  await expect(
    page.getByText(/Current address: alex\.new@example\.com \(verified\)/),
  ).toBeVisible();

  await page.goto('/account/data');
  await page.getByRole('button', { name: 'Request an export' }).click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: /Download/ })
    .first()
    .click({ timeout: 15_000 });
  expect((await download).suggestedFilename()).toMatch(/^stock-picks-export-.*\.json$/);

  await page.goto('/account/delete');
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: /^Delete account for/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: /^Profile/ }).first()).toBeVisible();
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill('alex.new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('stockpicks-demo');
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(
    page.getByText('That email and password combination is not recognised.'),
  ).toBeVisible();
});

test('signing out anywhere leaves no signed-in state on screen', async ({ page }) => {
  await signIn(page, '/');
  // From the sign-in screen while signed in: the form appears at once.
  await page.goto('/auth/sign-in');
  await page.getByRole('button', { name: 'Sign in with a different account' }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByText(/You’re signed in as/)).toHaveCount(0);
  // From Profile: the unread-alerts dot in the navigation goes with the account.
  await signIn(page, '/profile');
  await page.goto('/profile');
  const primary = page.getByRole('navigation', { name: 'Primary' });
  await expect(primary.getByRole('link', { name: /unread alerts/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(primary.getByRole('link', { name: /unread alerts/ })).toHaveCount(0);
});

test('the skip link moves focus to the content without changing the address', async ({ page }) => {
  await page.goto('/market');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL(/\/market$/);
});
