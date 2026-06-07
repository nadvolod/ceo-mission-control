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

// These tests exercise the v2 dashboard (now the default at /dashboard
// after the v2-default route flip; the legacy dashboard moved to
// /dashboard/legacy) end-to-end:
//   1. Shell renders and opens the logging palette
//   2. ⌘K opens, filters, runs a temporal log → server persists it
//   3. Hover preset on a MetricCard logs to the focus-hours data source
//   4. Reflection drawer auto-saves an answer that survives a reload
//   5. The v2 card value matches the /api/focus-hours read (parity check)
//
// They use the shared test user from global-setup.ts (rows wiped each run).

test.describe('Mission Control v2', () => {
  // Serial because each test depends on prior DB state (the cmdK Enter
  // test logs +1h Temporal which the parity test then reads). We disable
  // retries for the same reason: Playwright's retry mechanism re-runs the
  // entire serial group from the start, but it does NOT reset DB state
  // between attempts. So the empty-user precondition test would always
  // fail on retry once any earlier attempt had logged data — a guaranteed
  // false negative that masked the real failure. Better to fail loudly on
  // the first run with the truthful error than to silently pass-on-retry.
  test.describe.configure({ mode: 'serial', retries: 0 });

  test('old /dashboard/v2 route redirects to the new default dashboard', async ({ page }) => {
    const response = await page.goto('/dashboard/v2');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('desktop-layout')).toBeVisible();
  });

  test('renders the new shell and opens the log command palette', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);

    // Brand mark + wordmark. Scope to the desktop tree — the mobile layout
    // also contains "Mission Control" and Playwright's strict mode rightly
    // refuses an ambiguous getByText.
    const desktop = page.getByTestId('desktop-layout');
    await expect(desktop.getByText('Mission Control', { exact: true })).toBeVisible();
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
    await page.goto('/dashboard');

    const focus = await readFocusHoursFromPage(page);
    const serverIsEmpty =
      (focus?.todaysMetrics?.totalHours ?? 0) === 0 &&
      (focus?.recentSessions?.length ?? 0) === 0;
    expect(serverIsEmpty).toBe(true);

    // Scope to the desktop tree — the mobile layout also renders an
    // <ActivityFeed> instance, so a top-level getByText('Activity') hits
    // both and fails Playwright strict mode.
    const desktop = page.getByTestId('desktop-layout');
    await expect(desktop.getByText('Activity', { exact: true })).toBeVisible();
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
    await page.goto('/dashboard');
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
    await page.goto('/dashboard');

    // Open palette, filter to "+1h temporal", press Enter.
    await page.getByTestId('cmdk-trigger').click();
    await page.getByTestId('cmdk-input').fill('+1h temporal');
    // CRITICAL: wait for the filtered list to settle on the +1h action BEFORE
    // pressing Enter. Without this, React's setQuery from the fill's onChange
    // may not have flushed yet, so `filtered[0]` is still the empty-query
    // default — the +0.5h Temporal action — and the test logs 0.5h instead.
    // (CI caught this; matches the wait pattern in the other ⌘K test above.)
    await expect(page.getByTestId('cmdk-action-0')).toContainText('+1h Temporal');
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

  test('hover preset on the Pipeline card logs +FU to focus-hours', async ({ page }) => {
    await page.goto('/dashboard');

    const card = page.getByTestId('metric-card-pipeline');
    await card.hover();
    const focusPost = waitForFocusHoursPost(page);
    await page.getByTestId('preset-pipeline-fu').click();
    await focusPost;

    // Server-side: the Revenue category got 0.5h.
    const body = await readFocusHoursFromPage(page);
    expect(body.todaysMetrics?.byCategory?.Revenue ?? 0).toBeGreaterThanOrEqual(0.5);
  });

  test('reflection drawer opens, autosaves an answer, and the answer survives reload', async ({ page }) => {
    await page.goto('/dashboard');
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

  test('parity: /dashboard shows the same temporal hours as /api/focus-hours returns', async ({ page }) => {
    await page.goto('/dashboard');
    // Read through the same browser session that renders the card. This keeps
    // the assertion tied to the owner-scoped data source the dashboard uses.
    const focus = await readFocusHoursFromPage(page);
    const expectedTemporalToday = focus?.todaysMetrics?.byCategory?.Temporal ?? 0;

    // Wait for the card to converge on the API value. After page.goto the
    // metric card mounts at 0h (empty initial state) while useDashboardData
    // fetches in parallel; a single textContent read could race that
    // fetch's re-render. Poll with a 5s budget so the assertion measures
    // the *settled* value, not whichever side won the race.
    await expect
      .poll(async () => {
        const text = await page.getByTestId('metric-card-temporal-value').textContent();
        const m = text?.match(/(\d+(?:\.\d+)?)h/);
        return m ? parseFloat(m[1]) : null;
      }, { timeout: 5_000 })
      .toBeCloseTo(expectedTemporalToday, 1);
  });

  test('timezone: client local date is what the server records', async ({ page }) => {
    // The bug class we're guarding against: at 9pm EST the UTC date is
    // already tomorrow, so a UTC-based server would file the log on the
    // wrong day. The client now sends its local YYYY-MM-DD in the POST
    // body. We intercept the call and assert the date matches the
    // browser's local computation, not UTC.
    await page.goto('/dashboard');

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
    // Wait for the filter to settle (same fill+Enter race as in the cmdK
    // Enter test above). The specific action label is checked elsewhere;
    // here we just need the list to have updated past the empty-query
    // default before Enter fires.
    await expect(page.getByTestId('cmdk-action-0')).toContainText('+1h Temporal');
    await page.keyboard.press('Enter');

    const sentDate = (await focusPost).postDataJSON().date;
    expect(sentDate).toBe(expectedLocal);
  });

  test('Insights tab swaps the body to the period selector + insight cards', async ({ page }) => {
    // The pre-fix bug: clicking Insights toggled the pill but the body never
    // changed. After PR B the tab gates the panels area, so the Insights body
    // (period selector + 4 cards) must show and the Overview panels must hide.
    await page.goto('/dashboard');
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
    await page.goto('/dashboard');
    await page.getByTestId('tab-review').click();
    await expect(page.getByTestId('review-tab-empty')).toBeVisible();
    await expect(page.getByText(/No monthly reviews yet/i)).toBeVisible();
  });

  test('Tasks panel was removed from the Overview body', async ({ page }) => {
    // The handoff dropped Tasks from the new dashboard ("we no longer need it").
    // The legacy /dashboard/legacy route still has its own task list — this
    // PR removes the panel from the new dashboard only.
    await page.goto('/dashboard');
    // No CollapsiblePanel titled "Tasks" should render on the Overview body.
    await expect(page.getByText('Tasks', { exact: true })).toHaveCount(0);
  });

  test('Money Moved with a note: typed description lands on the entry + shows in Activity', async ({ page }) => {
    // The user reported two related issues: (a) wanted to attach a note
    // like "Benepass" to a money entry, (b) money entries not visible
    // in the Activity feed. This test pins both.
    await page.goto('/dashboard');

    const note = `Benepass-${Date.now()}`;

    const card = page.getByTestId('metric-card-moneyMoved');
    await card.hover();

    const financialPost = page.waitForRequest((req) =>
      req.url().includes('/api/financial') && req.method() === 'POST',
    );

    await page.getByTestId('preset-moneyMoved-generated').click();
    await page.getByTestId('moneyMoved-amount-input').fill('500');
    await page.getByTestId('moneyMoved-amount-note').fill(note);
    await page.keyboard.press('Enter');

    // The POST body has the typed description, not the auto string.
    const body = (await financialPost).postDataJSON();
    expect(body.category).toBe('generated');
    expect(body.amount).toBe(500);
    expect(body.description).toBe(note);

    // The activity feed shows the new entry. Optimistic + server-side
    // entries both flow through deriveActivity; the note ends up in the
    // row's meta line. Scope to the desktop tree because the mobile
    // ActivityFeed also renders (just CSS-hidden at desktop width) and
    // Playwright's strict mode rejects ambiguous getByText matches.
    const desktop = page.getByTestId('desktop-layout');
    await expect(desktop.getByText(note)).toBeVisible({ timeout: 5_000 });
  });

  test('Money Moved card: click preset → type amount → log custom value', async ({ page }) => {
    // The user complaint: money entries were logging hardcoded amounts
    // ($250 / $500 / $100). Now the preset just selects the CATEGORY and
    // the user types the actual amount.
    await page.goto('/dashboard');

    const card = page.getByTestId('metric-card-moneyMoved');
    await card.hover();

    // Click "+ Generated" — should open the editor, NOT log immediately.
    const financialPost = page.waitForRequest((req) =>
      req.url().includes('/api/financial') && req.method() === 'POST',
    );

    await page.getByTestId('preset-moneyMoved-generated').click();
    await expect(page.getByTestId('moneyMoved-amount-editor')).toBeVisible();

    // Type a custom amount with formatting characters that should be
    // stripped: "$1,234.50" → 1234.5.
    await page.getByTestId('moneyMoved-amount-input').fill('$1,234.50');
    await page.keyboard.press('Enter');

    // Server received the typed amount + correct category.
    const body = (await financialPost).postDataJSON();
    expect(body.category).toBe('generated');
    expect(body.amount).toBe(1234.5);
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('Temporal Focus: label renamed + pencil opens editor + submit updates the goal', async ({ page }) => {
    // The Temporal card label is now "Temporal Focus". A pencil button
    // appears on hover/focus; clicking it opens an editor row; submit
    // POSTs /api/weekly-tracker with the new temporalTarget.
    await page.goto('/dashboard');

    const card = page.getByTestId('metric-card-temporal');
    await card.hover();

    // Verify the renamed label is visible. Scope to desktop to avoid the
    // mobile layout match.
    const desktop = page.getByTestId('desktop-layout');
    await expect(desktop.getByText('Temporal Focus')).toBeVisible();

    const weeklyPost = page.waitForRequest((req) =>
      req.url().includes('/api/weekly-tracker') && req.method() === 'POST',
    );

    await page.getByTestId('temporal-edit-goal').click();
    await expect(page.getByTestId('temporal-goal-editor-row')).toBeVisible();
    const input = page.getByTestId('temporal-goal-editor-input');
    await input.fill('8');
    await page.keyboard.press('Enter');

    const body = (await weeklyPost).postDataJSON();
    expect(body.action).toBe('submitReview');
    expect(body.temporalTarget).toBe(8);

    // After the refresh resolves, the new goal shows in the eyebrow.
    await expect(desktop.locator('text=/\\/8h/')).toBeVisible({ timeout: 5_000 });
  });

  test('Activity feed includes a money entry even when older cross-day entries exist', async ({ page }) => {
    // Regression for the user-reported "Money Moved entries not appearing
    // in Activity": the prior HH:MM-only sort pushed today's morning
    // entries below yesterday-evening clutter and off the 25-entry slice.
    // After the tsMs fix, today's entry sits at the top regardless of
    // what time-of-day prior entries had.
    await page.goto('/dashboard');

    const note = `regression-${Date.now()}`;

    const card = page.getByTestId('metric-card-moneyMoved');
    await card.hover();
    await page.getByTestId('preset-moneyMoved-cut').click();
    await page.getByTestId('moneyMoved-amount-input').fill('25');
    await page.getByTestId('moneyMoved-amount-note').fill(note);
    await page.keyboard.press('Enter');

    // The new entry's note should be visible in the desktop activity feed.
    const desktop = page.getByTestId('desktop-layout');
    await expect(desktop.getByText(note)).toBeVisible({ timeout: 5_000 });
  });

  test('Three to Thrive saved indicator does NOT show a CHARS count', async ({ page }) => {
    // The user asked for the noisy "· N CHARS" suffix removed. The status
    // badge should just read "● SAVED" once the answer is persisted.
    await page.goto('/dashboard');
    const input = page.getByTestId('t3t-inline-input-0');
    const phrase = `chars-removed-${Date.now()}`;
    await input.fill(phrase);
    // Wait for the SAVED transition (debounce 600ms + server round-trip).
    const status = page.getByTestId('t3t-inline-status-0');
    await expect(status).toHaveText('● SAVED', { timeout: 5_000 });
    // Belt-and-suspenders: explicit assertion that "CHARS" doesn't appear.
    await expect(status).not.toContainText(/CHARS/i);
  });
});

// Mobile-viewport coverage. The desktop tree is gated by `hidden md:flex`;
// at viewports below the md breakpoint the MobileLayout shell renders
// instead (hero card · snapshot strip · quick-log grid · bottom nav).
test.describe('Mission Control v2 — mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14-ish

  test('renders the mobile shell with hero, snapshot strip, quick log, bottom nav', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByTestId('mobile-layout')).toBeVisible();
    await expect(page.getByTestId('mobile-hero-temporal')).toBeVisible();
    await expect(page.getByTestId('mobile-snapshot-strip')).toBeVisible();
    await expect(page.getByTestId('mobile-quick-log')).toBeVisible();
    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();

    // The desktop tabs in the header are hidden at this viewport.
    await expect(page.getByTestId('tab-overview')).toBeHidden();
  });

  test('tapping a hero preset logs Temporal hours via /api/focus-hours', async ({ page }) => {
    await page.goto('/dashboard');
    const focusPost = page.waitForRequest((req) =>
      req.url().includes('/api/focus-hours') && req.method() === 'POST',
    );
    await page.getByTestId('mobile-hero-preset-0-5h').click();
    const body = (await focusPost).postDataJSON();
    expect(body.category).toBe('Temporal');
    expect(body.hours).toBe(0.5);
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('hero goal pencil opens editor and submits a weekly Temporal target', async ({ page }) => {
    await page.goto('/dashboard');

    const weeklyPost = page.waitForRequest((req) =>
      req.url().includes('/api/weekly-tracker') && req.method() === 'POST',
    );

    await page.getByTestId('mobile-temporal-edit-goal').click();
    await expect(page.getByTestId('mobile-temporal-goal-editor-row')).toBeVisible();
    await page.getByTestId('mobile-temporal-goal-editor-input').fill('9');
    await page.keyboard.press('Enter');

    const body = (await weeklyPost).postDataJSON();
    expect(body.action).toBe('submitReview');
    expect(body.temporalTarget).toBe(9);

    await expect(page.getByTestId('mobile-temporal-goal-readout')).toContainText('/ 9h', {
      timeout: 5_000,
    });
  });

  test('bottom-nav Reflect tap opens the reflection drawer', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('mobile-nav-reflect').click();
    await expect(page.getByTestId('reflection-drawer')).toBeVisible();
  });

  test('bottom-nav Insights and Review tabs render real content (no placeholder copy)', async ({ page }) => {
    // Flow 3: the pre-fix bug rendered a "Open the Insights/Review tab in the
    // bottom nav" placeholder on mobile. After the fix, tapping the bottom-nav
    // item swaps the body to the real InsightsTab / ReviewTab.
    await page.goto('/dashboard');
    // Both mobile-layout and desktop-layout render these content testids
    // (desktop is CSS-hidden but still in the DOM), so scope every content
    // assertion to the mobile layout to avoid strict-mode dual matches.
    const mobile = page.getByTestId('mobile-layout');
    await expect(mobile).toBeVisible();

    // Insights: tap the bottom-nav item, assert the placeholder is gone and the
    // real tab + its period selector render.
    await page.getByTestId('mobile-nav-insights').click();
    await expect(mobile.getByText(/open the Insights tab in the bottom nav/i)).toHaveCount(0);
    await expect(mobile.getByTestId('insights-tab')).toBeVisible();
    await expect(mobile.getByTestId('insights-period-selector')).toBeVisible();

    // Review: the test user has no monthly reviews (global-setup wipes them),
    // so the Review body shows its empty-state — NOT the bottom-nav placeholder.
    await page.getByTestId('mobile-nav-review').click();
    await expect(mobile.getByText(/Open the Review tab in the bottom nav/i)).toHaveCount(0);
    // Either the populated tab or the empty-state renders depending on data.
    const reviewTab = mobile.getByTestId('review-tab');
    const reviewEmpty = mobile.getByTestId('review-tab-empty');
    await expect(reviewTab.or(reviewEmpty)).toBeVisible();
  });

  test('Call/Demo quick actions are gone; + Train logs a training session', async ({ page, request }) => {
    // Flow 5: the old mobile quick-log grid had Call/Demo buttons. They were
    // removed. The remaining + Train button must actually persist (latch
    // today's `trained` true via /api/weekly-tracker addToDay).
    const today = await browserLocalDate(page);
    // Clean slate for today's weekly-tracker row so the increment is unambiguous.
    await request.post('/api/weekly-tracker', { data: { action: 'deleteDay', date: today } });

    await page.goto('/dashboard');
    await expect(page.getByTestId('mobile-quick-log')).toBeVisible();

    // The removed buttons must not exist anymore.
    await expect(page.getByTestId('mobile-quick-call')).toHaveCount(0);
    await expect(page.getByTestId('mobile-quick-demo')).toHaveCount(0);

    // Tap + Train and assert the server-side effect (mirrors the API-persistence
    // assertion style of weekly-tracker-quick-add.spec.ts).
    const trainPost = page.waitForResponse((res) =>
      res.url().includes('/api/weekly-tracker') &&
      res.request().method() === 'POST' &&
      res.status() === 200,
    );
    await page.getByTestId('mobile-quick-train').click();
    await trainPost;

    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.trained ?? null;
    }, { timeout: 10_000 }).toBe(true);
  });

  test('quick-log + Moved opens the amount editor and submits the typed value', async ({ page }) => {
    // Same custom-amount behavior on mobile: tap the money button →
    // editor appears → type the amount → submit.
    await page.goto('/dashboard');

    const financialPost = page.waitForRequest((req) =>
      req.url().includes('/api/financial') && req.method() === 'POST',
    );

    await page.getByTestId('mobile-quick-moved').click();
    await expect(page.getByTestId('mobile-quick-amount-editor-wrap')).toBeVisible();

    await page.getByTestId('mobile-quick-amount-input').fill('789');
    await page.keyboard.press('Enter');

    const body = (await financialPost).postDataJSON();
    expect(body.category).toBe('moved');
    expect(body.amount).toBe(789);
  });
});
