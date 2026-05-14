import { test as setup, expect } from '@playwright/test';

const STORAGE_STATE_PATH = 'tests/.auth/test-user.json';

setup('authenticate test user', async ({ page, context }) => {
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) {
    throw new Error('TEST_USER_PASSWORD is required for Playwright auth setup');
  }

  await page.goto('/login');

  // Form fields use autocomplete attributes that Playwright resolves reliably.
  await page.getByLabel('Email').fill('test@ceo-mc.local');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // After login the user is redirected to /dashboard. Assert that we got
  // there AND that the cookie was set, so we don't persist a broken session.
  await page.waitForURL(/\/dashboard/);
  await expect(page).toHaveURL(/\/dashboard/);

  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'cmc_session');
  if (!session) {
    throw new Error('Login appeared to succeed but cmc_session cookie was not set');
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`[playwright auth.setup] Saved storage state to ${STORAGE_STATE_PATH}`);
});
