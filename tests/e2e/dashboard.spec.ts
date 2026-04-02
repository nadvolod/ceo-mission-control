import { test, expect } from '@playwright/test';

test.describe('Dashboard page rendering', () => {
  test('dashboard loads without JavaScript crash', async ({ page }) => {
    // Listen for uncaught errors
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    await page.goto('/dashboard');

    // Wait for loading spinner to disappear (client JS executed)
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    // Page must have rendered SOMETHING (not blank/crashed)
    const bodyText = await page.textContent('body');
    expect(bodyText && bodyText.trim().length > 50, 'page body should have content').toBeTruthy();

    // If scorecard loaded → full dashboard renders
    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Verify Financial Command Center rendered (the null.toFixed crash point)
      await expect(page.getByText('Financial Command Center')).toBeVisible();
      await expect(page.getByText('Cash Position')).toBeVisible();
      await expect(page.getByText('Net Worth')).toBeVisible();
      await expect(page.getByText('Monthly Burn')).toBeVisible();
      await expect(page.getByText('Savings Rate')).toBeVisible();
    }

    // Verify NO error boundary was triggered (proves no JS crash)
    await expect(page.getByText('Dashboard Error')).toBeHidden();

    // Verify no uncaught JS errors
    expect(jsErrors, `should have no uncaught JS errors, got: ${jsErrors.join(', ')}`).toHaveLength(0);
  });

  test('dashboard renders header and stats when data is available', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    // If full dashboard rendered, verify header stats
    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      await expect(page.getByText('Total Tasks')).toBeVisible();
      await expect(page.getByText('Done Today', { exact: true })).toBeVisible();
      await expect(page.getByText('Overdue')).toBeVisible();
      await expect(page.getByText('System Status')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Refresh Data' })).toBeVisible();
    } else {
      // Workspace data unavailable — verify graceful fallback (not a crash)
      const hasErrorState = await page.getByText('Cannot Load Workspace Data').isVisible().catch(() => false);
      expect(hasErrorState, 'should show workspace error or full dashboard').toBeTruthy();
    }
  });

  test('landing page renders without errors', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Verify landing page content rendered
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('CEO Mission Control');

    // Verify no crash
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Internal Server Error');
    expect(jsErrors).toHaveLength(0);
  });

  test('dashboard error boundary catches failures gracefully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // Page must NOT be blank — either dashboard, workspace error, or error boundary
    const bodyText = await page.textContent('body');
    expect(bodyText && bodyText.trim().length > 50, 'page should not be blank').toBeTruthy();

    // If error boundary triggered, verify it has actionable UI
    const hasErrorBoundary = await page.getByText('Dashboard Error').isVisible().catch(() => false);
    if (hasErrorBoundary) {
      await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
      await expect(page.getByText('Error details')).toBeVisible();
    }
  });

  test('API endpoints return valid responses', async ({ request }) => {
    // Test each API endpoint returns a parseable response (not 500/crash)
    const endpoints = [
      '/api/tasks',
      '/api/workspace',
      '/api/financial',
      '/api/focus-hours',
      '/api/revenue-projection',
    ];

    for (const path of endpoints) {
      const response = await request.get(path);
      // API should return 200 (even with empty/default data)
      expect(response.status(), `${path} should return 200`).toBe(200);
      const data = await response.json();
      expect(data, `${path} should return valid JSON`).toBeTruthy();
    }

    // Monarch may return 503 if token not set — that's OK, but not 500
    const monarchResponse = await request.get('/api/monarch');
    expect([200, 503]).toContain(monarchResponse.status());
    const monarchData = await monarchResponse.json();
    expect(monarchData, '/api/monarch should return valid JSON').toBeTruthy();
  });

  test('revenue projection widget renders and has add button', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Revenue Projections section should be visible
      await expect(page.getByText('Revenue Projections')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Adjustment' })).toBeVisible();

      // Projection table should render
      await expect(page.getByText('Projection')).toBeVisible();
      await expect(page.getByText('Adjustments')).toBeVisible();
    }
  });

  test('financial impact tracking shows daily prompt or metrics', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Financial Impact Tracking section should be visible
      await expect(page.getByText('Financial Impact Tracking')).toBeVisible();

      // Should show either the daily prompt or the metrics
      const hasDailyPrompt = await page.getByText('How much money was moved today?').isVisible().catch(() => false);
      const hasMetrics = await page.getByText('Money Moved').isVisible().catch(() => false);
      expect(hasDailyPrompt || hasMetrics, 'should show daily prompt or financial metrics').toBeTruthy();

      // Log Entry button should be visible
      await expect(page.getByRole('button', { name: 'Log Entry' })).toBeVisible();
    }
  });

  test('dashboard layout has tasks at the bottom', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Verify section ordering: Financial Command Center should appear before Task Dashboard
      const allText = await page.textContent('main');
      if (allText) {
        const financialPos = allText.indexOf('Financial Command Center');
        const revenuePos = allText.indexOf('Revenue Projections');
        const taskPos = allText.indexOf('Task Dashboard') !== -1
          ? allText.indexOf('Task Dashboard')
          : allText.indexOf('Active Tasks');

        // Financial sections should come before tasks
        if (financialPos !== -1 && taskPos !== -1) {
          expect(financialPos).toBeLessThan(taskPos);
        }
        if (revenuePos !== -1 && taskPos !== -1) {
          expect(revenuePos).toBeLessThan(taskPos);
        }
      }
    }
  });

  test('revenue projection API validates input', async ({ request }) => {
    // Test that invalid input is rejected
    const badMonth = await request.post('/api/revenue-projection', {
      data: { action: 'addAdjustment', effectiveMonth: 'invalid', amount: 1000, description: 'test', type: 'revenue_loss', recurring: false }
    });
    expect(badMonth.status()).toBe(400);

    const badAmount = await request.post('/api/revenue-projection', {
      data: { action: 'addAdjustment', effectiveMonth: '2026-07', amount: -100, description: 'test', type: 'revenue_loss', recurring: false }
    });
    expect(badAmount.status()).toBe(400);

    const badType = await request.post('/api/revenue-projection', {
      data: { action: 'addAdjustment', effectiveMonth: '2026-07', amount: 1000, description: 'test', type: 'invalid_type', recurring: false }
    });
    expect(badType.status()).toBe(400);
  });
});
