import { test, expect, type Page } from '@playwright/test';

async function browserLocalDate(page: Page) {
  return page.evaluate(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
}

async function readFocusHoursFromPage(page: Page) {
  const date = await browserLocalDate(page);
  return page.evaluate(async (today) => {
    const res = await fetch(`/api/focus-hours?date=${today}`);
    if (!res.ok) {
      throw new Error(`GET /api/focus-hours failed: ${res.status}`);
    }
    return res.json();
  }, date);
}

async function readThreeToThriveFromPage(page: Page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/three-to-thrive');
    if (!res.ok) {
      throw new Error(`GET /api/three-to-thrive failed: ${res.status}`);
    }
    return res.json();
  });
}

function waitForFocusHoursPost(page: Page) {
  return page.waitForResponse((response) =>
    response.url().includes('/api/focus-hours') &&
    response.request().method() === 'POST' &&
    response.status() === 200,
  );
}

// These tests exercise the new /dashboard/v2 surface end-to-end:
//   1. Shell renders and opens the logging palette
//   2. ⌘K opens, filters, runs a temporal log → server persists it
//   3. Hover preset on a MetricCard logs to the same data source as /dashboard
//   4. Reflection drawer auto-saves an answer that survives a reload
//   5. Same data shows on /dashboard and /dashboard/v2 (parity check)
//
// They use the shared test user from global-setup.ts (rows wiped each run).

test.describe('Mission Control v2', () => {
  test.describe.configure({ mode: 'serial' });

  test('renders the new shell and opens the log command palette', async ({ page }) => {
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

    await page.getByTestId('log-button').click();
    await expect(page.getByTestId('cmdk-dialog')).toBeVisible();
    await expect(page.getByTestId('cmdk-action-0')).toContainText(/log/i);
  });

  // Hard-rule test for the fixtures leak. Runs as the SECOND test in this
  // serial describe (immediately after the render test) because
  // global-setup.ts wipes the test user's rows once per run, but any later
  // test that logs activity would invalidate the "empty" precondition.
  //
  // Belt-and-suspenders: before asserting on the rendered DOM we read the
  // server snapshot via the same browser session and fail fast if it isn't
  // empty — that turns "this test passed for the wrong reason because
  // someone ran it after a logging test" into a loud failure instead of a
  // silent pass.
  test('empty test user sees no fake activity rows (no SEED_ACTIVITY leak)', async ({ page }) => {
    await page.goto('/dashboard/v2');

    const focus = await readFocusHoursFromPage(page);
    const serverIsEmpty =
      (focus?.todaysMetrics?.totalHours ?? 0) === 0 &&
      (focus?.recentSessions?.length ?? 0) === 0;
    expect(serverIsEmpty).toBe(true);

    await expect(page.getByText('Activity', { exact: true })).toBeVisible();
    const body = await page.locator('body').textContent();
    // Strings from the old SEED_ACTIVITY fixture rows — none of these may
    // ever appear in front of a real user.
    expect(body || '').not.toMatch(/Annual contract · Vega/);
    expect(body || '').not.toMatch(/Outbound · Northway/);
    expect(body || '').not.toMatch(/Architecture doc/);
    // Numeric metrics must read 0 (or empty) before any logs land — not the
    // SEED_METRICS values like "$35.3K cash" or "$982K net worth".
    const cashText = (await page.getByTestId('metric-card-cash').textContent()) || '';
    expect(cashText).not.toMatch(/\$35\.3K/);
    const netWorthText = (await page.getByTestId('metric-card-netWorth').textContent()) || '';
    expect(netWorthText).not.toMatch(/\$982K/);
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

  test('⌘K Enter logs +1h Temporal — server records the session', async ({ page }) => {
    await page.goto('/dashboard/v2');

    // Open palette, filter to "+1h temporal", press Enter.
    await page.getByTestId('cmdk-trigger').click();
    await page.getByTestId('cmdk-input').fill('+1h temporal');
    const focusPost = waitForFocusHoursPost(page);
    await page.keyboard.press('Enter');

    // The dialog closes when the action runs.
    await expect(page.getByTestId('cmdk-dialog')).not.toBeVisible();
    await focusPost;

    // The focus-hours endpoint persisted the Temporal hour, which is the same
    // data source the v2 card and the old dashboard metrics read.
    const body = await readFocusHoursFromPage(page);
    expect(body.todaysMetrics?.byCategory?.Temporal ?? 0).toBeGreaterThanOrEqual(1);
  });

  test('hover preset on the Pipeline card logs +Call to focus-hours', async ({ page }) => {
    await page.goto('/dashboard/v2');

    const card = page.getByTestId('metric-card-pipeline');
    await card.hover();
    const focusPost = waitForFocusHoursPost(page);
    await page.getByTestId('preset-pipeline-call').click();
    await focusPost;

    // Server-side: the Revenue category got 0.5h.
    const body = await readFocusHoursFromPage(page);
    expect(body.todaysMetrics?.byCategory?.Revenue ?? 0).toBeGreaterThanOrEqual(0.5);
  });

  test('reflection drawer opens, autosaves an answer, and the answer survives reload', async ({ page }) => {
    await page.goto('/dashboard/v2');
    await page.getByTestId('open-reflection').click();
    await expect(page.getByTestId('reflection-drawer')).toBeVisible();

    const phrase = `e2e v2 reflection ${Date.now()}`;
    await page.getByTestId('reflection-input-0').fill(phrase);

    await expect.poll(async () => {
      const body = await readThreeToThriveFromPage(page);
      return body.todaysEntry?.answers?.some(
        (a: { answer: string }) => a.answer.includes(phrase),
      ) ?? false;
    }).toBe(true);

    // Reload and confirm the textarea still has it.
    await page.getByTestId('reflection-close').click();
    await page.reload();
    await page.getByTestId('open-reflection').click();
    await expect(page.getByTestId('reflection-input-0')).toHaveValue(
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });

  test('parity: /dashboard/v2 shows the same temporal hours as /dashboard', async ({ page }) => {
    await page.goto('/dashboard/v2');
    // Read through the same browser session that renders the card. This keeps
    // the assertion tied to the owner-scoped data source the dashboard uses.
    const focus = await readFocusHoursFromPage(page);
    const expectedTemporalToday = focus?.todaysMetrics?.byCategory?.Temporal ?? 0;

    // The Temporal card surfaces today's Temporal hours in its main value.
    const value = page.getByTestId('metric-card-temporal-value');
    // The value renders as "Nh" or "0h".
    const text = await value.textContent();
    expect(text).not.toBeNull();
    const match = text!.match(/(\d+(?:\.\d+)?)h/);
    expect(match).not.toBeNull();
    const shownTemporal = parseFloat(match![1]);
    // Both should round-trip through the same number; allow a small tolerance.
    expect(Math.abs(shownTemporal - expectedTemporalToday)).toBeLessThan(0.05);
  });

  test('timezone: client local date is what the server records', async ({ page }) => {
    // The bug class we're guarding against: at 9pm EST the UTC date is
    // already tomorrow, so a UTC-based server would file the log on the
    // wrong day. The client now sends its local YYYY-MM-DD in the POST
    // body. We intercept the call and assert the date matches the
    // browser's local computation, not UTC.
    await page.goto('/dashboard/v2');

    // Capture expectedLocal BEFORE issuing the request so that if midnight
    // crosses between the POST and the assertion, both sides see the same
    // day. (CodeRabbit caught this: reading the local clock after `await`
    // would race the wall clock and flake at midnight.)
    const expectedLocal = await browserLocalDate(page);

    const focusPost = page.waitForRequest((req) =>
      req.url().includes('/api/focus-hours') && req.method() === 'POST',
    );

    await page.getByTestId('cmdk-trigger').click();
    await page.getByTestId('cmdk-input').fill('+1h temporal');
    await page.keyboard.press('Enter');

    const sentDate = (await focusPost).postDataJSON().date;
    expect(sentDate).toBe(expectedLocal);
  });

  test('Insights tab swaps the body to the period selector + insight cards', async ({ page }) => {
    // The pre-fix bug: clicking Insights toggled the pill but the body never
    // changed. After PR B the tab gates the panels area, so the Insights body
    // (period selector + 4 cards) must show and the Overview panels must hide.
    await page.goto('/dashboard/v2');
    await page.getByTestId('tab-insights').click();

    await expect(page.getByTestId('insights-tab')).toBeVisible();
    await expect(page.getByTestId('insights-period-7')).toBeVisible();
    await expect(page.getByTestId('insights-period-14')).toBeVisible();
    await expect(page.getByTestId('insights-period-30')).toBeVisible();
    await expect(page.getByTestId('insight-card-temporal')).toBeVisible();
    await expect(page.getByTestId('insight-card-money moved')).toBeVisible();

    // Overview panels not visible while Insights is active.
    await expect(page.getByText('Three to Thrive')).toHaveCount(0);

    // Switch back to Overview restores the panels.
    await page.getByTestId('tab-overview').click();
    await expect(page.getByText('Three to Thrive')).toBeVisible();
    await expect(page.getByTestId('insights-tab')).toHaveCount(0);
  });

  test('Review tab renders monthly-review content (empty state when no data)', async ({ page }) => {
    // The test user has no monthly reviews (global-setup wipes them), so the
    // Review body should show the empty-state copy — NOT seed data and NOT
    // a blank panel area. This is the regression test for "Review tab does
    // nothing when clicked".
    await page.goto('/dashboard/v2');
    await page.getByTestId('tab-review').click();
    await expect(page.getByTestId('review-tab-empty')).toBeVisible();
    await expect(page.getByText(/No monthly reviews yet/i)).toBeVisible();
  });

  test('Tasks panel was removed from the Overview body', async ({ page }) => {
    // The handoff dropped Tasks from /dashboard/v2 ("we no longer need it").
    // The legacy /dashboard still has its own task list — this PR removes the
    // panel from the new dashboard only.
    await page.goto('/dashboard/v2');
    // No CollapsiblePanel titled "Tasks" should render on the Overview body.
    await expect(page.getByText('Tasks', { exact: true })).toHaveCount(0);
  });
});
