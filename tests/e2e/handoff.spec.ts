import { test, expect } from '@playwright/test';

// The Playwright setup project logs in as the test user, so by default our
// browser context already has a non-admin session. These tests explicitly
// opt-out to either anonymous or admin-credentialed flows.

test.describe('Admin handoff (CSRF / role gating)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('POST /api/admin/handoff returns 401 without a session', async ({ request }) => {
    const res = await request.post('/api/admin/handoff', { data: { as: 'demo' } });
    expect(res.status()).toBe(401);
  });

  test('GET /as/demo/dashboard redirects unauthenticated visitors to /login', async ({ page }) => {
    await page.goto('/as/demo/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Non-admin user cannot impersonate', () => {
  // Authenticated as test user via the setup project's storageState.
  test('test user POSTing /api/admin/handoff returns 403', async ({ request }) => {
    const res = await request.post('/api/admin/handoff', { data: { as: 'demo' } });
    expect(res.status()).toBe(403);
  });

  test('test user navigating /as/demo/dashboard gets redirected back to /dashboard', async ({ page }) => {
    await page.goto('/as/demo/dashboard');
    // /dashboard URL (no /as prefix) signals the redirect fired.
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
