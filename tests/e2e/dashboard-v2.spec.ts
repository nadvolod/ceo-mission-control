import { test, expect } from '@playwright/test';

// These tests exercise the new /dashboard/v2 surface end-to-end:
//   1. Page renders with the new shell
//   2. ⌘K opens, filters, runs a temporal log → server persists it
//   3. Hover preset on a MetricCard logs to the same data source as /dashboard
//   4. Reflection drawer auto-saves an answer that survives a reload
//   5. Same data shows on /dashboard and /dashboard/v2 (parity check)
//
// They use the shared test user from global-setup.ts (rows wiped each run).

test.describe('Mission Control v2', () => {
  test.describe.configure({ mode: 'serial' });

  test('renders the new shell with the OrbitStar header and the metric grid', async ({ page }) => {
    const response = await page.goto('/dashboard/v2');
    expect(response?.status()).toBeLessThan(400);

    // Brand mark + wordmark
    await expect(page.getByText('Mission Control', { exact: true })).toBeVisible();
    // The CTA pair
    await expect(page.getByTestId('cmdk-trigger')).toBeVisible();
    await expect(page.getByTestId('log-button')).toBeVisible();
    // Tabs
    await expect(page.getByTestId('tab-overview')).toBeVisible();
    await expect(page.getByTestId('tab-insights')).toBeVisible();
    await expect(page.getByTestId('tab-review')).toBeVisible();
    // 6-card metric grid
    for (const id of ['cash', 'netWorth', 'temporal', 'pipeline', 'deepWork', 'moneyMoved']) {
      await expect(page.getByTestId(`metric-card-${id}`)).toBeVisible();
    }
  });

  test('⌘K opens the palette, filters by keyword, and Esc closes it', async ({ page }) => {
    await page.goto('/dashboard/v2');
    await page.getByTestId('cmdk-trigger').click();

    const dialog = page.getByTestId('cmdk-dialog');
    await expect(dialog).toBeVisible();

    const input = page.getByTestId('cmdk-input');
    await input.fill('temporal');
    // First filtered action carries the default-on-Enter chip
    await expect(page.getByTestId('cmdk-action-0')).toContainText(/temporal/i);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('⌘K Enter logs +1h Temporal — server records the session', async ({ page, request }) => {
    await page.goto('/dashboard/v2');

    // Open palette, filter to "+1h temporal", press Enter.
    await page.getByTestId('cmdk-trigger').click();
    await page.getByTestId('cmdk-input').fill('+1h temporal');
    await page.keyboard.press('Enter');

    // The dialog closes when the action runs.
    await expect(page.getByTestId('cmdk-dialog')).not.toBeVisible();

    // The temporal endpoint persisted the hour.
    const res = await request.get('/api/temporal');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    expect(body.dailyTotals[today]).toBeGreaterThanOrEqual(1);
  });

  test('hover preset on the Pipeline card logs +Call to focus-hours', async ({ page, request }) => {
    await page.goto('/dashboard/v2');

    const card = page.getByTestId('metric-card-pipeline');
    await card.hover();
    await page.getByTestId('preset-pipeline-call').click();

    // Server-side: the Revenue category got 0.5h.
    await page.waitForTimeout(500);
    const res = await request.get('/api/focus-hours');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.todaysMetrics?.byCategory?.Revenue ?? 0).toBeGreaterThanOrEqual(0.5);
  });

  test('reflection drawer opens, autosaves an answer, and the answer survives reload', async ({
    page,
    request,
  }) => {
    await page.goto('/dashboard/v2');
    await page.getByTestId('open-reflection').click();
    await expect(page.getByTestId('reflection-drawer')).toBeVisible();

    const phrase = `e2e v2 reflection ${Date.now()}`;
    await page.getByTestId('reflection-input-0').fill(phrase);

    // Auto-save debounce is 600ms; give it room.
    await page.waitForTimeout(1200);

    // Server confirms persistence.
    const res = await request.get('/api/three-to-thrive');
    const body = await res.json();
    const today = body.todaysEntry;
    expect(today).toBeTruthy();
    const found = today.answers.some(
      (a: { answer: string }) => a.answer.includes(phrase),
    );
    expect(found).toBe(true);

    // Reload and confirm the textarea still has it.
    await page.getByTestId('reflection-close').click();
    await page.reload();
    await page.getByTestId('open-reflection').click();
    await expect(page.getByTestId('reflection-input-0')).toHaveValue(
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });

  test('parity: /dashboard/v2 shows the same temporal hours as /dashboard', async ({
    page,
    request,
  }) => {
    // Read what the old dashboard would see.
    const focus = await request.get('/api/focus-hours').then((r) => r.json());
    const expectedTemporalToday = focus?.todaysMetrics?.byCategory?.Temporal ?? 0;

    await page.goto('/dashboard/v2');
    // The Temporal card surfaces today's Temporal hours in its main value.
    const card = page.getByTestId('metric-card-temporal');
    // The value renders as "Nh" or "0h" — read text and parse the integer hours.
    const text = await card.textContent();
    expect(text).not.toBeNull();
    const match = text!.match(/(\d+(?:\.\d+)?)h/);
    expect(match).not.toBeNull();
    const shownTemporal = parseFloat(match![1]);
    // Both should round-trip through the same number; allow a small tolerance.
    expect(Math.abs(shownTemporal - expectedTemporalToday)).toBeLessThan(0.05);
  });
});
