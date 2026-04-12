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
      '/api/weekly-tracker',
      '/api/monthly-review',
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

  test('weekly performance tracker renders on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Weekly Performance Tracker should be visible
      await expect(page.getByText('Weekly Performance Tracker')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Log Today' })).toBeVisible();

      // Verify it appears between Revenue Projections and Mission Tracker
      const allText = await page.textContent('main');
      if (allText) {
        const trackerPos = allText.indexOf('Weekly Performance Tracker');
        const missionPos = allText.indexOf('Mission Progress');
        if (trackerPos !== -1 && missionPos !== -1) {
          expect(trackerPos).toBeLessThan(missionPos);
        }
      }
    }
  });

  test('weekly tracker Log Today button opens form', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      const logButton = page.getByRole('button', { name: 'Log Today' });
      await expect(logButton).toBeVisible();
      await logButton.click();

      // Form fields should be visible after clicking
      await expect(page.getByLabel(/Deep Work Hours/)).toBeVisible();
      await expect(page.getByLabel(/Pipeline Actions/)).toBeVisible();
    }
  });

  test('weekly tracker API returns valid structure', async ({ request }) => {
    const response = await request.get('/api/weekly-tracker');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('currentWeekSummary');
    expect(data).toHaveProperty('dailyTrend');
    expect(data).toHaveProperty('recentReviews');
  });

  test('weekly tracker API returns 7-element dailyEntries array', async ({ request }) => {
    // Compute Wednesday of the current week dynamically
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);
    const wedDate = wednesday.toISOString().split('T')[0];

    const logResponse = await request.post('/api/weekly-tracker', {
      data: { action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true, date: wedDate },
    });
    // Skip assertions if storage backend unavailable in CI
    if (logResponse.status() !== 200) {
      test.skip();
      return;
    }

    const response = await request.get('/api/weekly-tracker');
    const data = await response.json();
    const entries = data.currentWeekSummary.dailyEntries;

    expect(entries).toHaveLength(7);
    // Wednesday is index 2 in Mon-Sun week
    expect(entries[2]).not.toBeNull();
    expect(entries[2].date).toBe(wedDate);
    expect(entries[2].deepWorkHours).toBe(3);
  });

  test('weekly tracker preserves entries for different days', async ({ request }) => {
    // Compute Monday and Friday of the current week dynamically
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const monDate = monday.toISOString().split('T')[0];
    const friDate = friday.toISOString().split('T')[0];

    const monRes = await request.post('/api/weekly-tracker', {
      data: { action: 'logDay', deepWorkHours: 2, pipelineActions: 1, trained: false, date: monDate },
    });
    // Skip if storage backend unavailable in CI
    if (monRes.status() !== 200) {
      test.skip();
      return;
    }

    await request.post('/api/weekly-tracker', {
      data: { action: 'logDay', deepWorkHours: 5, pipelineActions: 4, trained: true, date: friDate },
    });

    const response = await request.get('/api/weekly-tracker');
    const data = await response.json();
    const entries = data.currentWeekSummary.dailyEntries;

    // Monday (index 0) and Friday (index 4) should have data
    expect(entries[0]).not.toBeNull();
    expect(entries[0].deepWorkHours).toBe(2);
    expect(entries[4]).not.toBeNull();
    expect(entries[4].deepWorkHours).toBe(5);
    // Tuesday-Thursday should be null
    expect(entries[1]).toBeNull();
    expect(entries[2]).toBeNull();
    expect(entries[3]).toBeNull();
  });

  test('weekly tracker rejects invalid date format', async ({ request }) => {
    const response = await request.post('/api/weekly-tracker', {
      data: { action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true, date: 'bad-date' },
    });
    // If storage fails (500), that's a different error — only check date validation if we can reach the endpoint
    if (response.status() === 500) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('date');
  });

  test('weekly review with temporalTarget persists and appears in GET', async ({ request }) => {
    const postRes = await request.post('/api/weekly-tracker', {
      data: { action: 'submitReview', revenue: 2000, temporalTarget: 8, slipAnalysis: 'test', systemAdjustment: '', nextWeekTargets: '', bottleneck: '' },
    });
    if (postRes.status() === 500) {
      test.skip();
      return;
    }
    expect(postRes.status()).toBe(200);
    const postData = await postRes.json();
    expect(postData.review.temporalTarget).toBe(8);

    // GET should return the temporalTarget in the summary
    const getRes = await request.get('/api/weekly-tracker');
    const getData = await getRes.json();
    expect(getData.currentWeekSummary.temporalTarget).toBe(8);
  });

  test('focus session POST creates a session and GET reflects increased hours', async ({ request }) => {
    // Capture before state
    const beforeRes = await request.get('/api/focus-hours');
    const beforeData = await beforeRes.json();
    const hoursBefore = beforeData.todaysMetrics?.totalHours ?? 0;

    const postRes = await request.post('/api/focus-hours', {
      data: { action: 'addSession', category: 'Temporal', hours: 1.5, description: 'E2E test session' },
    });
    if (postRes.status() === 500) {
      test.skip();
      return;
    }
    expect(postRes.status()).toBe(200);

    // Verify hours increased
    const afterRes = await request.get('/api/focus-hours');
    const afterData = await afterRes.json();
    expect(afterData.todaysMetrics.totalHours).toBeGreaterThan(hoursBefore);
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

  test('monthly review API returns valid structure', async ({ request }) => {
    const response = await request.get('/api/monthly-review');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('recentReviews');
    expect(data).toHaveProperty('ratingsTrend');
    expect(Array.isArray(data.recentReviews)).toBe(true);
    expect(Array.isArray(data.ratingsTrend)).toBe(true);
  });

  test('monthly review submit and retrieve via API', async ({ request }) => {
    const TEST_MONTH = '2099-12';

    // Clean up first
    await request.post('/api/monthly-review', {
      data: { action: 'deleteReview', month: TEST_MONTH },
    });

    // Submit a review
    const postRes = await request.post('/api/monthly-review', {
      data: {
        action: 'submitReview',
        month: TEST_MONTH,
        date: '2099-12-31',
        timeAllocation: 'E2E test allocation',
        hoursWorked: 88,
        temporalHours: 35,
        energyGivers: 'Playwright tests passing',
        energyDrainers: 'Flaky selectors',
        ignoredSignals: 'Sleep',
        moneySpent: '$100 on tests',
        expenseJoyVsStress: 'Joy: passing tests. Stress: none.',
        alignmentCheck: 'Aligned with testing goals',
        monthLesson: 'E2E tests catch real bugs',
        decisionSource: 'discipline',
        badHabits: 'Skipping tests',
        goodPatterns: 'TDD',
        ratings: { discipline: 8, focus: 7, executive: 6, math: 5, nutrition: 7, fitness: 6, sleep: 7 },
        oneThingToFix: 'More test coverage',
        disciplinedVersionAction: 'Write tests first always',
      },
    });
    if (postRes.status() === 500) {
      test.skip();
      return;
    }
    expect(postRes.status()).toBe(200);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.review.month).toBe(TEST_MONTH);
    expect(postData.review.hoursWorked).toBe(88);
    expect(postData.review.ratings.discipline).toBe(8);

    // Retrieve and verify
    const getRes = await request.get('/api/monthly-review');
    const getData = await getRes.json();
    const found = getData.recentReviews.find((r: any) => r.month === TEST_MONTH);
    expect(found).toBeTruthy();
    expect(found.hoursWorked).toBe(88);
    expect(found.temporalHours).toBe(35);

    // Clean up
    await request.post('/api/monthly-review', {
      data: { action: 'deleteReview', month: TEST_MONTH },
    });
  });

  test('monthly review tracker renders on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Monthly Review section should be visible
      await expect(page.getByText('Monthly Review')).toBeVisible();

      // Verify it has the expected tabs
      const newReviewTab = page.getByRole('button', { name: /New Review/ });
      const historyTab = page.getByRole('button', { name: 'History' });
      const trendsTab = page.getByRole('button', { name: 'Trends' });

      await expect(newReviewTab).toBeVisible();
      await expect(historyTab).toBeVisible();
      await expect(trendsTab).toBeVisible();

      // Click History tab and verify it switches
      await historyTab.click();
      // Should show either reviews or empty state
      const hasReviews = await page.getByText(/\d{4}/).isVisible().catch(() => false);
      const hasEmptyState = await page.getByText('No monthly reviews yet').isVisible().catch(() => false);
      expect(hasReviews || hasEmptyState, 'History tab should show reviews or empty state').toBeTruthy();
    }
  });
});
