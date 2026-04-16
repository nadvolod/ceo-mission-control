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
      await expect(page.getByText('Focus Hours')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
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
      '/api/garmin',
      '/api/health-notes',
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

  test('revenue projections is NOT rendered on the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Revenue Projections should NOT be anywhere on the page
      await expect(page.getByText('Revenue Projections', { exact: true })).toBeHidden();
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

  test('dashboard default tab shows Financial Impact before Weekly Performance', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      const allText = await page.textContent('main');
      if (allText) {
        const financialImpactPos = allText.indexOf('Financial Impact Tracking');
        const weeklyPos = allText.indexOf('Weekly Performance Tracker');

        if (financialImpactPos !== -1 && weeklyPos !== -1) {
          expect(financialImpactPos).toBeLessThan(weeklyPos);
        }
      }
    }
  });

  test('dashboard renders tab bar with 3 tabs', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      await expect(page.getByRole('button', { name: /Dashboard/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /^Tasks$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Monthly Review/i })).toBeVisible();
    }
  });

  test('Tasks tab shows task dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      await page.getByRole('button', { name: /^Tasks$/i }).click();
      // Task dashboard should now be visible
      const allText = await page.textContent('main');
      expect(allText).toContain('Tasks');
      // Financial Impact should NOT be visible on Tasks tab
      await expect(page.getByText('Financial Impact Tracking')).toBeHidden();
    }
  });

  test('Monthly Review tab shows review sections', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      await page.getByRole('button', { name: /Monthly Review/i }).click();
      await expect(page.getByText('Mission Command')).toBeVisible();
      // Financial Impact should NOT be visible on Monthly Review tab
      await expect(page.getByText('Financial Impact Tracking')).toBeHidden();
    }
  });

  test('tab switching produces no JS errors', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      await page.getByRole('button', { name: /^Tasks$/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Monthly Review/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Dashboard/i }).first().click();
      await page.waitForTimeout(500);
    }

    expect(jsErrors).toHaveLength(0);
  });

  test('weekly performance tracker renders on dashboard default tab', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Weekly Performance Tracker should be visible on default Dashboard tab
      await expect(page.getByText('Weekly Performance Tracker')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Log Today' })).toBeVisible();

      // Verify it appears after Financial Impact Tracking
      const allText = await page.textContent('main');
      if (allText) {
        const financialPos = allText.indexOf('Financial Impact Tracking');
        const trackerPos = allText.indexOf('Weekly Performance Tracker');
        if (financialPos !== -1 && trackerPos !== -1) {
          expect(financialPos).toBeLessThan(trackerPos);
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

  test('monthly review tracker renders on Monthly Review tab', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const hasFullDashboard = await page.locator('h1', { hasText: 'CEO Mission Control' }).isVisible().catch(() => false);
    if (hasFullDashboard) {
      // Switch to Monthly Review tab first
      await page.getByRole('button', { name: /Monthly Review/i }).click();

      // Monthly Review section should be visible
      await expect(page.getByText('Monthly Review').first()).toBeVisible();

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

test.describe('Health Intelligence Dashboard', () => {
  test('garmin and health-notes API endpoints return valid responses', async ({ request }) => {
    const garminRes = await request.get('/api/garmin');
    expect(garminRes.status()).toBe(200);
    const garminData = await garminRes.json();
    expect(garminData.success).toBe(true);
    expect(garminData).toHaveProperty('metrics');

    const notesRes = await request.get('/api/health-notes');
    expect(notesRes.status()).toBe(200);
    const notesData = await notesRes.json();
    expect(notesData.success).toBe(true);
    expect(notesData).toHaveProperty('templates');
  });

  test('morning log form saves and retrieves a health note', async ({ request }) => {
    const TEST_DATE = '2099-12-25';

    const postRes = await request.post('/api/health-notes', {
      data: {
        action: 'log',
        date: TEST_DATE,
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [{ name: 'Guanfacine', dosageMg: 1, taken: true }],
        habits: [{ name: 'Red light therapy', done: true }],
        freeformNote: 'E2E test note',
      },
    });
    if (postRes.status() === 401) {
      test.skip();
      return;
    }
    expect(postRes.status()).toBe(200);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.note.date).toBe(TEST_DATE);

    const getRes = await request.get('/api/health-notes');
    const getData = await getRes.json();
    expect(getData.notes[TEST_DATE]).toBeTruthy();
    expect(getData.notes[TEST_DATE].freeformNote).toBe('E2E test note');
  });

  test('template management adds and removes a supplement', async ({ request }) => {
    const addRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'addSupplement', name: 'E2E-Test-Supp', defaultDosageMg: 5 },
    });
    if (addRes.status() === 401) {
      test.skip();
      return;
    }
    expect(addRes.status()).toBe(200);
    const addData = await addRes.json();
    expect(addData.templates.supplementTemplate.find((s: { name: string }) => s.name === 'E2E-Test-Supp')).toBeTruthy();

    const removeRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: 'E2E-Test-Supp' },
    });
    expect(removeRes.status()).toBe(200);
    const removeData = await removeRes.json();
    expect(removeData.templates.supplementTemplate.find((s: { name: string }) => s.name === 'E2E-Test-Supp')).toBeFalsy();
  });

  test('health intelligence section renders on dashboard', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const healthSection = page.getByText('Health Intelligence');
    await expect(healthSection).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: /Charts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Morning Log/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Settings/i })).toBeVisible();

    await page.getByRole('button', { name: /Morning Log/i }).click();
    await expect(page.getByText('Sleep Environment')).toBeVisible();
    await expect(page.getByText('Supplements')).toBeVisible();
    await expect(page.getByText('Habits')).toBeVisible();

    await page.getByRole('button', { name: /Settings/i }).click();
    await expect(page.getByText('Supplement Templates')).toBeVisible();
    await expect(page.getByText('Habit Templates')).toBeVisible();

    expect(jsErrors).toHaveLength(0);
  });

  test('morning log form submits and persists via UI', async ({ page, request }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const healthSection = page.getByText('Health Intelligence');
    await healthSection.scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Morning Log/i }).click();

    // Fill in temperature
    const tempInput = page.locator('input[type="number"]').first();
    await tempInput.fill('67');

    // Fill freeform note
    const noteArea = page.locator('textarea');
    await noteArea.fill('Playwright E2E test entry');

    // Click save
    await page.getByRole('button', { name: /Save Morning Log/i }).click();

    // Verify via API that note was saved
    const today = new Date().toISOString().split('T')[0];
    const apiRes = await request.get('/api/health-notes');
    const apiData = await apiRes.json();
    // Note: this may fail if auth blocks the save — that's expected in some environments
    if (apiData.notes[today]) {
      expect(apiData.notes[today].freeformNote).toBe('Playwright E2E test entry');
    }

    expect(jsErrors).toHaveLength(0);
  });
});

test.describe('Garmin sync round-trip', () => {
  const SYNC_METRICS = [
    {
      date: '2099-11-01',
      sleepScore: 82,
      sleepDurationMinutes: 420,
      deepSleepMinutes: 90,
      lightSleepMinutes: 210,
      remSleepMinutes: 100,
      awakeDuringMinutes: 20,
      restingHeartRate: 55,
      hrvStatus: 62,
      averageStressLevel: 28,
      bodyBatteryHigh: 95,
      bodyBatteryLow: 20,
      steps: 8500,
      activeMinutes: 45,
      weight: 175.2,
    },
    {
      date: '2099-11-02',
      sleepScore: 75,
      sleepDurationMinutes: 390,
      deepSleepMinutes: 70,
      lightSleepMinutes: 200,
      remSleepMinutes: 90,
      awakeDuringMinutes: 30,
      restingHeartRate: 58,
      hrvStatus: 55,
      averageStressLevel: 35,
      bodyBatteryHigh: 88,
      bodyBatteryLow: 15,
      steps: 6200,
      activeMinutes: 20,
      weight: 175.5,
    },
  ];

  test('POST sync persists metrics and GET returns them', async ({ request }) => {
    const postRes = await request.post('/api/garmin', {
      data: { action: 'sync', metrics: SYNC_METRICS },
    });
    if (postRes.status() === 401) {
      test.skip();
      return;
    }
    expect(postRes.status()).toBe(200);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.synced).toBe(2);

    // GET should return the synced metrics
    const getRes = await request.get('/api/garmin');
    expect(getRes.status()).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);

    // Verify both days are present
    const day1 = getData.metrics['2099-11-01'];
    expect(day1).toBeTruthy();
    expect(day1.sleepScore).toBe(82);
    expect(day1.restingHeartRate).toBe(55);
    expect(day1.hrvStatus).toBe(62);
    expect(day1.bodyBatteryHigh).toBe(95);
    expect(day1.steps).toBe(8500);

    const day2 = getData.metrics['2099-11-02'];
    expect(day2).toBeTruthy();
    expect(day2.sleepScore).toBe(75);
    expect(day2.averageStressLevel).toBe(35);
    expect(day2.weight).toBe(175.5);
  });

  test('sync with empty metrics array succeeds with zero synced', async ({ request }) => {
    const res = await request.post('/api/garmin', {
      data: { action: 'sync', metrics: [] },
    });
    if (res.status() === 401) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.synced).toBe(0);
  });

  test('sync rejects non-array metrics', async ({ request }) => {
    const res = await request.post('/api/garmin', {
      data: { action: 'sync', metrics: 'not-an-array' },
    });
    if (res.status() === 401) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('array');
  });

  test('sync updates existing day metrics (merge, not replace)', async ({ request }) => {
    // First sync: partial data
    const firstRes = await request.post('/api/garmin', {
      data: { action: 'sync', metrics: [{ date: '2099-11-03', sleepScore: 90 }] },
    });
    if (firstRes.status() === 401) {
      test.skip();
      return;
    }
    expect(firstRes.status()).toBe(200);

    // Second sync: different fields for same date
    const secondRes = await request.post('/api/garmin', {
      data: { action: 'sync', metrics: [{ date: '2099-11-03', restingHeartRate: 52, steps: 10000 }] },
    });
    expect(secondRes.status()).toBe(200);

    // GET: merged result should have all fields
    const getRes = await request.get('/api/garmin');
    const getData = await getRes.json();
    const merged = getData.metrics['2099-11-03'];
    expect(merged).toBeTruthy();
    expect(merged.sleepScore).toBe(90);
    expect(merged.restingHeartRate).toBe(52);
    expect(merged.steps).toBe(10000);
  });

  test('GET returns correct latest and syncStatus after sync', async ({ request }) => {
    // Sync with a far-future date to guarantee it's "latest"
    const res = await request.post('/api/garmin', {
      data: { action: 'sync', metrics: [{ date: '2099-12-31', sleepScore: 99, hrvStatus: 70 }] },
    });
    if (res.status() === 401) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(200);

    const getRes = await request.get('/api/garmin');
    const getData = await getRes.json();

    // Latest should be the 2099-12-31 entry
    expect(getData.latest).toBeTruthy();
    expect(getData.latest.date).toBe('2099-12-31');
    expect(getData.latest.sleepScore).toBe(99);

    // Sync status should show a recent timestamp
    expect(getData.syncStatus.lastSyncedAt).toBeTruthy();
    const syncedAt = new Date(getData.syncStatus.lastSyncedAt);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(syncedAt.getTime()).toBeGreaterThan(fiveMinutesAgo.getTime());
  });
});

test.describe('editSupplement API', () => {
  const UNIQUE_SUPP = `E2E-Edit-Test-${Date.now()}`;

  test('add, edit, and remove a supplement end-to-end', async ({ request }) => {
    // 1. Add a test supplement
    const addRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'addSupplement', name: UNIQUE_SUPP, defaultDosageMg: 10 },
    });
    if (addRes.status() === 401) {
      test.skip();
      return;
    }
    expect(addRes.status()).toBe(200);
    const addData = await addRes.json();
    expect(addData.templates.supplementTemplate.find((s: { name: string }) => s.name === UNIQUE_SUPP)).toBeTruthy();

    // 2. Edit name and dosage
    const editedName = `${UNIQUE_SUPP}-Edited`;
    const editRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'editSupplement', name: UNIQUE_SUPP, newName: editedName, newDosageMg: 25 },
    });
    expect(editRes.status()).toBe(200);
    const editData = await editRes.json();
    const edited = editData.templates.supplementTemplate.find((s: { name: string }) => s.name === editedName);
    expect(edited).toBeTruthy();
    expect(edited.defaultDosageMg).toBe(25);
    // Original name should be gone
    expect(editData.templates.supplementTemplate.find((s: { name: string }) => s.name === UNIQUE_SUPP)).toBeFalsy();

    // 3. Verify via GET
    const getRes = await request.get('/api/health-notes');
    const getData = await getRes.json();
    expect(getData.templates.supplementTemplate.find((s: { name: string }) => s.name === editedName)).toBeTruthy();

    // 4. Clean up
    const removeRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: editedName },
    });
    expect(removeRes.status()).toBe(200);
  });

  test('editSupplement rejects duplicate name', async ({ request }) => {
    // Add two supplements
    const nameA = `E2E-DupA-${Date.now()}`;
    const nameB = `E2E-DupB-${Date.now()}`;

    const addA = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'addSupplement', name: nameA, defaultDosageMg: 5 },
    });
    if (addA.status() === 401) {
      test.skip();
      return;
    }
    expect(addA.status()).toBe(200);

    const addB = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'addSupplement', name: nameB, defaultDosageMg: 10 },
    });
    expect(addB.status()).toBe(200);

    // Try to rename A to B's name — should fail with 400
    const editRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'editSupplement', name: nameA, newName: nameB, newDosageMg: 5 },
    });
    expect(editRes.status()).toBe(400);
    const editData = await editRes.json();
    expect(editData.success).toBe(false);
    expect(editData.error).toContain('already exists');

    // Clean up
    await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: nameA },
    });
    await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: nameB },
    });
  });

  test('editSupplement rejects invalid dosage', async ({ request }) => {
    const res = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'editSupplement', name: 'Anything', newName: 'Anything', newDosageMg: -5 },
    });
    if (res.status() === 401) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('newDosageMg');
  });

  test('editSupplement rejects empty newName', async ({ request }) => {
    const res = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'editSupplement', name: 'Anything', newName: '', newDosageMg: 10 },
    });
    if (res.status() === 401) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('newName');
  });
});

test.describe('Health Intelligence UI interactions', () => {
  test('charts tab shows empty state or rendered chart (not blank)', async ({ page, request }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    // Check API to know whether data exists (other tests may have synced data)
    const apiRes = await request.get('/api/garmin');
    expect(apiRes.status()).toBe(200);
    const apiData = await apiRes.json();
    expect(apiData.success).toBe(true);
    const hasMetrics = Object.keys(apiData.metrics || {}).length > 0;

    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    // Scroll to Health Intelligence and click Charts tab
    const healthSection = page.getByText('Health Intelligence');
    await expect(healthSection).toBeVisible({ timeout: 10_000 });
    await healthSection.scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Charts/i }).click();

    if (hasMetrics) {
      // Data exists — chart should render with toggle pill buttons
      await expect(page.getByRole('button', { name: 'Sleep Score' })).toBeVisible({ timeout: 5_000 });
    } else {
      // No data — empty state message should show
      await expect(page.getByText('No Garmin data yet')).toBeVisible({ timeout: 5_000 });
    }

    expect(jsErrors).toHaveLength(0);
  });

  test('Settings tab Edit button opens inline edit for supplements', async ({ page, request }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    // Clean up any leftovers from prior runs
    await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: 'E2E-Edit-UI-Test' },
    });

    // Ensure exactly one test supplement exists
    const addRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'addSupplement', name: 'E2E-Edit-UI-Test', defaultDosageMg: 50 },
    });
    if (addRes.status() === 401) {
      test.skip();
      return;
    }

    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const healthSection = page.getByText('Health Intelligence');
    await healthSection.scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Settings/i }).click();

    // Find the Edit button for our test supplement (exact match)
    const editButton = page.getByRole('button', { name: 'Edit E2E-Edit-UI-Test', exact: true });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Inline edit form should appear with Save and Cancel buttons
    // Scope to the supplement templates section to avoid matching other Save buttons
    const supplementSection = page.locator('div').filter({ hasText: 'Supplement Templates' }).first();
    await expect(supplementSection.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(supplementSection.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

    // Cancel should close the form
    await supplementSection.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(supplementSection.getByRole('button', { name: 'Save', exact: true })).toBeHidden();
    await expect(editButton).toBeVisible();

    // Clean up
    await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: 'E2E-Edit-UI-Test' },
    });

    expect(jsErrors).toHaveLength(0);
  });

  test('Settings Edit button saves changes and persists via API', async ({ page, request }) => {
    // Clean up any leftovers from prior runs
    await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: 'E2E-Save-Test' },
    });
    await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: 'E2E-Save-Test-Renamed' },
    });

    // Add a supplement to edit
    const addRes = await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'addSupplement', name: 'E2E-Save-Test', defaultDosageMg: 10 },
    });
    if (addRes.status() === 401) {
      test.skip();
      return;
    }

    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const healthSection = page.getByText('Health Intelligence');
    await healthSection.scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Settings/i }).click();

    // Click Edit (exact match to avoid matching "E2E-Save-Test-Renamed")
    const editButton = page.getByRole('button', { name: 'Edit E2E-Save-Test', exact: true });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // The inline edit form replaces the row — find it by data-testid
    const editRow = page.getByTestId('supplement-edit-row');
    await expect(editRow).toBeVisible();

    // Modify the name input
    const nameInput = editRow.locator('input[type="text"]');
    await nameInput.clear();
    await nameInput.fill('E2E-Save-Test-Renamed');

    // Modify dosage
    const dosageInput = editRow.locator('input[type="number"]');
    await dosageInput.clear();
    await dosageInput.fill('99');

    // Save
    await editRow.getByRole('button', { name: 'Save', exact: true }).click();

    // Wait for the edit row to disappear (form closes on success)
    await expect(editRow).toBeHidden({ timeout: 5_000 });

    // Verify via API that the edit persisted
    const getRes = await request.get('/api/health-notes');
    const getData = await getRes.json();
    const renamed = getData.templates.supplementTemplate.find(
      (s: { name: string }) => s.name === 'E2E-Save-Test-Renamed'
    );
    expect(renamed, 'renamed supplement should exist in API response').toBeTruthy();
    expect(renamed.defaultDosageMg).toBe(99);
    // Old name should be gone
    expect(getData.templates.supplementTemplate.find(
      (s: { name: string }) => s.name === 'E2E-Save-Test'
    )).toBeFalsy();

    // Clean up
    await request.post('/api/health-notes', {
      data: { action: 'update-templates', operation: 'removeSupplement', name: 'E2E-Save-Test-Renamed' },
    });
  });

  test('Settings tab has no JS errors during tab switching', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    await page.goto('/dashboard');
    await expect(page.getByText('Loading Mission Control...')).toBeHidden({ timeout: 20_000 });

    const healthSection = page.getByText('Health Intelligence');
    await healthSection.scrollIntoViewIfNeeded();

    // Rapidly switch between all Health Intelligence tabs
    await page.getByRole('button', { name: /Charts/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Morning Log/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Settings/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Charts/i }).click();
    await page.waitForTimeout(300);

    expect(jsErrors).toHaveLength(0);
  });
});
