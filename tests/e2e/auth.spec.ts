import { test, expect } from '@playwright/test';

// These tests must run WITHOUT the saved storage state — they exercise
// the un-authenticated flows. The storageState is set globally by the
// chromium project; opting out per-test via { storageState: undefined }
// gives us a clean cookie jar.

test.describe('Auth flows (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects unauthenticated /dashboard visit to /login with next param', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login(\?next=.*)?$/);
  });

  test('login with wrong password shows generic error and does not redirect', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@ceo-mc.local');
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Generic error message — never leaks whether the email exists
    await expect(page.getByRole('alert')).toHaveText(/Incorrect email or password/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with unknown email also shows the same generic error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.invalid');
    await page.getByLabel('Password').fill('any-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Identical message — defense against email-enumeration.
    await expect(page.getByRole('alert')).toHaveText(/Incorrect email or password/i);
  });

  test('API routes return 401 when called without a session', async ({ request }) => {
    const res = await request.get('/api/weekly-tracker');
    expect(res.status()).toBe(401);
  });
});

test.describe('Auth flows (authenticated as test user)', () => {
  // Uses the storageState from auth.setup.ts via the chromium project config.

  test('dashboard loads for the test user', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('test user weekly tracker starts empty on a fresh run', async ({ request }) => {
    // global-setup wipes the test user's rows before each run, so this
    // should return an empty payload — anything else means we are reading
    // someone else's data (defense in depth check).
    const res = await request.get('/api/weekly-tracker');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.todaysEntry).toBeNull();
    expect(body.recentReviews).toEqual([]);
  });

  test('test user can log a day and read it back (round-trip to DB)', async ({ request }) => {
    const create = await request.post('/api/weekly-tracker', {
      data: { action: 'logDay', deepWorkHours: 2.5, pipelineActions: 3, trained: true },
    });
    expect(create.status()).toBe(200);
    const created = await create.json();
    expect(created.success).toBe(true);
    expect(created.entry.deepWorkHours).toBe(2.5);

    const fetch = await request.get('/api/weekly-tracker');
    const body = await fetch.json();
    expect(body.todaysEntry).not.toBeNull();
    expect(body.todaysEntry.deepWorkHours).toBe(2.5);
    expect(body.todaysEntry.pipelineActions).toBe(3);
    expect(body.todaysEntry.trained).toBe(true);
  });

  test('logout clears the session', async ({ page, context }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Fire logout via the route, then reload — should bounce to /login.
    const res = await page.request.post('/api/auth/logout');
    expect(res.status()).toBe(200);
    const cookies = (await context.cookies()).find((c) => c.name === 'cmc_session');
    // Cookie cleared (either removed or zero-value).
    expect(cookies?.value ?? '').toBe('');

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login(\?next=.*)?$/);
  });
});
