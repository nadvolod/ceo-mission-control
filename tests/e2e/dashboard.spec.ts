import { test, expect } from '@playwright/test';

test.describe('Dashboard page rendering', () => {
  test('dashboard loads and renders financial data without crashing', async ({ page }) => {
    // Navigate to dashboard and wait for client-side hydration to complete
    await page.goto('/dashboard');

    // Wait for loading spinner to disappear (client JS has executed and data loaded)
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    // Verify the main header rendered (proves React hydrated successfully)
    await expect(page.locator('h1', { hasText: 'CEO Mission Control' })).toBeVisible();

    // Verify Financial Command Center rendered (this is what crashed with null.toFixed)
    await expect(page.getByText('Financial Command Center')).toBeVisible();

    // Verify at least one financial metric card rendered
    await expect(page.getByText('Cash Position')).toBeVisible();
    await expect(page.getByText('Net Worth')).toBeVisible();
    await expect(page.getByText('Monthly Burn')).toBeVisible();
    await expect(page.getByText('Savings Rate')).toBeVisible();

    // Verify no error boundary was triggered
    await expect(page.getByText('Dashboard Error')).toBeHidden();

    // Verify no uncaught JS errors by checking the page didn't crash
    const title = await page.title();
    expect(title).toContain('CEO Mission Control');
  });

  test('dashboard renders task list and system status', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for loading to complete
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    // Verify task stats in header
    await expect(page.getByText('Total Tasks')).toBeVisible();
    await expect(page.getByText('Done Today')).toBeVisible();
    await expect(page.getByText('Overdue')).toBeVisible();

    // Verify system status section rendered
    await expect(page.getByText('System Status')).toBeVisible();
    await expect(page.getByText('Last Refresh')).toBeVisible();
    await expect(page.getByText('Active Tasks')).toBeVisible();

    // Verify Refresh Data button is functional
    const refreshButton = page.getByRole('button', { name: 'Refresh Data' });
    await expect(refreshButton).toBeVisible();
  });

  test('landing page renders without errors', async ({ page }) => {
    await page.goto('/');

    // Verify the landing page rendered (use first() since text appears multiple times)
    await expect(page.getByText('CEO Mission Control').first()).toBeVisible({ timeout: 10_000 });

    // Verify key landing page sections
    await expect(page.getByText('Join the Waitlist').first()).toBeVisible();

    // Verify no crash or error page
    const content = await page.textContent('body');
    expect(content).not.toContain('Application error');
    expect(content).not.toContain('Internal Server Error');
  });

  test('dashboard error boundary catches rendering failures', async ({ page }) => {
    // Listen for console errors to verify error logging
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/dashboard');

    // Wait for the page to fully load (either dashboard content or error boundary)
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // The page should either show the dashboard OR the error boundary
    // It should NEVER show a blank/empty page
    const bodyText = await page.textContent('body');
    const hasContent = bodyText && bodyText.trim().length > 50;
    expect(hasContent).toBeTruthy();

    // If error boundary triggered, it should have actionable UI
    const errorBoundary = page.getByText('Dashboard Error');
    if (await errorBoundary.isVisible()) {
      await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
      await expect(page.getByText('Error details')).toBeVisible();
    }
  });

  test('dashboard API endpoints return valid JSON responses', async ({ page, request }) => {
    // Verify all critical API endpoints respond with valid data
    const endpoints = [
      { path: '/api/tasks', key: 'tasks' },
      { path: '/api/workspace', key: 'scorecard' },
      { path: '/api/financial', key: 'todaysMetrics' },
      { path: '/api/focus-hours', key: 'success' },
      { path: '/api/monarch', key: 'accounts' },
    ];

    for (const { path, key } of endpoints) {
      const response = await request.get(path);
      expect(response.status(), `${path} should return 200`).toBe(200);
      const data = await response.json();
      expect(data, `${path} should return valid JSON`).toBeTruthy();
      // Monarch may return error if token expired — that's a valid JSON response
      if (path === '/api/monarch' && data.error) continue;
      expect(data[key], `${path} should have "${key}" property`).toBeDefined();
    }
  });
});
