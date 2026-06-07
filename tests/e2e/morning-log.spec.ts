import { test, expect, type Page } from '@playwright/test';

// E2E coverage for the v2 Morning Log drawer on /dashboard. These exercise
// real behavior end-to-end: open the drawer, fill the form, save, and verify
// the values persisted by reading them back through /api/health-notes (the
// same API the legacy dashboard uses). The drawer binds to the existing
// useHealthData() hook, so a successful save is a real DB round-trip for the
// authenticated test user.

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function readNote(page: Page, date: string) {
  return page.evaluate(async (d) => {
    const res = await fetch('/api/health-notes');
    if (!res.ok) throw new Error(`GET /api/health-notes failed: ${res.status}`);
    const body = await res.json();
    return body.notes?.[d] ?? null;
  }, date);
}

async function openMorningLog(page: Page) {
  await page.goto('/dashboard');
  await expect(page.getByTestId('morning-log-trigger')).toBeVisible();
  await page.getByTestId('morning-log-trigger').click();
  await expect(page.getByTestId('morning-log-drawer')).toBeVisible();
  // Wait for the form to hydrate (date input gets today's value once data loads).
  await expect(page.getByTestId('morning-log-date')).toHaveValue(todayKey());
}

test.describe('Morning Log drawer', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens from the header button and renders the form', async ({ page }) => {
    await openMorningLog(page);
    await expect(page.getByTestId('metric-sleep-score')).toBeVisible();
    await expect(page.getByTestId('metric-duration-hours')).toBeVisible();
    await expect(page.getByTestId('metric-body-battery')).toBeVisible();
    await expect(page.getByTestId('metric-resting-hr')).toBeVisible();
    await expect(page.getByTestId('metric-hrv')).toBeVisible();
    await expect(page.getByTestId('morning-log-save')).toBeVisible();
  });

  test('saves the five sleep metrics and persists them to the API', async ({ page }) => {
    await openMorningLog(page);

    const score = 70 + (Date.now() % 25); // 70–94, in range
    const rhr = 50 + (Date.now() % 15);
    const hrv = 40 + (Date.now() % 40);

    await page.getByTestId('metric-sleep-score').fill(String(score));
    await page.getByTestId('metric-duration-hours').fill('7');
    await page.getByTestId('metric-duration-minutes').fill('32');
    await page.getByTestId('metric-body-battery').fill('80');
    await page.getByTestId('metric-resting-hr').fill(String(rhr));
    await page.getByTestId('metric-hrv').fill(String(hrv));

    await page.getByTestId('morning-log-save').click();
    await expect(page.getByTestId('morning-log-status')).toHaveText(/SAVED/i, { timeout: 5_000 });

    // Real round-trip: the metrics reached the DB.
    const note = await readNote(page, todayKey());
    expect(note).not.toBeNull();
    expect(note.sleepMetrics).toEqual({
      sleepScore: score,
      durationMinutes: 7 * 60 + 32,
      bodyBattery: 80,
      restingHeartRate: rhr,
      hrv,
    });
  });

  test('saved sleep score survives a full reload (hydrates from the server)', async ({ page }) => {
    await openMorningLog(page);
    const score = 60 + (Date.now() % 30);
    await page.getByTestId('metric-sleep-score').fill(String(score));
    await page.getByTestId('morning-log-save').click();
    await expect(page.getByTestId('morning-log-status')).toHaveText(/SAVED/i, { timeout: 5_000 });

    await page.reload();
    await page.getByTestId('morning-log-trigger').click();
    await expect(page.getByTestId('morning-log-drawer')).toBeVisible();
    await expect(page.getByTestId('metric-sleep-score')).toHaveValue(String(score));
  });

  test('toggles a supplement + habit and persists them', async ({ page }) => {
    await openMorningLog(page);

    // Ensure the first supplement + habit are ON regardless of any state
    // persisted by earlier serial tests (they share today's note for the
    // test user). Clicking unconditionally would toggle an already-on row off.
    const supp = page.getByTestId('supp-toggle-0');
    if ((await supp.getAttribute('aria-checked')) !== 'true') await supp.click();
    await expect(supp).toHaveAttribute('aria-checked', 'true');

    const habit = page.getByTestId('habit-toggle-0');
    if ((await habit.getAttribute('aria-checked')) !== 'true') await habit.click();
    await expect(habit).toHaveAttribute('aria-checked', 'true');

    await page.getByTestId('morning-log-save').click();
    await expect(page.getByTestId('morning-log-status')).toHaveText(/SAVED/i, { timeout: 5_000 });

    const note = await readNote(page, todayKey());
    const takenSupp = note.supplements.find((s: { taken: boolean }) => s.taken);
    expect(takenSupp).toBeTruthy();
    expect(takenSupp.dosageMg).toBeGreaterThan(0);
    const doneHabit = note.habits.find((h: { done: boolean }) => h.done);
    expect(doneHabit).toBeTruthy();
  });

  test('Save is disabled when a taken supplement has a 0 dosage', async ({ page }) => {
    await openMorningLog(page);
    // Ensure the first supplement is taken regardless of any state persisted by
    // earlier tests (serial mode shares today's note for the test user). The
    // dosage input is only editable while the supplement is toggled on.
    const toggle = page.getByTestId('supp-toggle-0');
    if ((await toggle.getAttribute('aria-checked')) !== 'true') {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    const dosage = page.getByTestId('supp-dosage-0');
    await dosage.fill('0');
    await expect(page.getByTestId('morning-log-save')).toBeDisabled();
    // Restoring a positive dosage re-enables save.
    await dosage.fill('1');
    await expect(page.getByTestId('morning-log-save')).toBeEnabled();
  });

  test('adds a custom environment field that persists into the template', async ({ page }) => {
    await openMorningLog(page);
    const fieldName = `blackout-${Date.now()}`;
    await page.getByTestId('env-add-name').fill(fieldName);
    await page.getByTestId('env-add-button').click();

    // The new toggle appears immediately. Save, then confirm it survives a reload
    // (proves it persisted to the server-side environment template).
    await page.getByTestId('morning-log-save').click();
    await expect(page.getByTestId('morning-log-status')).toHaveText(/SAVED/i, { timeout: 5_000 });

    await page.reload();
    await page.getByTestId('morning-log-trigger').click();
    await expect(page.getByTestId('morning-log-drawer')).toBeVisible();
    await expect(page.getByText(fieldName)).toBeVisible();
  });

  // --- Unified activity feed flows (Task 9) ------------------------------

  test('morning log appears in the activity feed and opens a detail sheet with the sleep score', async ({ page }) => {
    // Flow 1: save a morning log, then verify it surfaces as a row in the
    // unified Activity feed and that clicking it opens the read-only detail
    // sheet showing the entered sleep score.
    await openMorningLog(page);

    const score = 80 + (Date.now() % 15); // 80–94, in range
    await page.getByTestId('metric-sleep-score').fill(String(score));
    await page.getByTestId('metric-duration-hours').fill('7');
    await page.getByTestId('metric-duration-minutes').fill('15');
    await page.getByTestId('morning-log-save').click();
    await expect(page.getByTestId('morning-log-status')).toHaveText(/SAVED/i, { timeout: 5_000 });

    // Round-trip: confirm the note really persisted before asserting the feed.
    const note = await readNote(page, todayKey());
    expect(note?.sleepMetrics?.sleepScore).toBe(score);

    // Close the drawer so the activity feed underneath is interactable.
    await page.getByTestId('morning-log-done').click();
    await expect(page.getByTestId('morning-log-drawer')).not.toBeVisible();

    // The derived row id is `morning-${date}` (derive.ts). Scope to the
    // desktop tree — the mobile ActivityFeed also renders (CSS-hidden) and a
    // bare getByTestId would hit both under Playwright strict mode.
    const desktop = page.getByTestId('desktop-layout');
    const row = desktop.getByTestId(`activity-row-morning-${todayKey()}`);
    await expect(row).toBeVisible({ timeout: 5_000 });
    await expect(row).toContainText('Morning Log');
    await expect(row).toContainText(`Sleep ${score}`);

    // Click it → the read-only detail sheet opens and shows the sleep score.
    await row.click();
    const sheet = page.getByTestId('activity-detail-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Sleep score');
    await expect(sheet).toContainText(String(score));
  });

  test('a saved reflection appears in the activity feed', async ({ page }) => {
    // Flow 2: answer one reflection question (autosaves), then verify a
    // "Reflection" row surfaces in the unified Activity feed.
    await page.goto('/dashboard');
    await page.getByTestId('open-reflection').click();
    await expect(page.getByTestId('reflection-drawer')).toBeVisible();

    const phrase = `e2e reflection feed ${Date.now()}`;
    await page.getByTestId('reflection-input-0').fill(phrase);

    // Reflection autosaves (debounced). Wait for the server to record the EXACT
    // phrase we typed — matching only "any non-empty answer" could pass on a
    // stale answer even if this phrase never persisted.
    await expect.poll(async () => {
      return page.evaluate(async (expected) => {
        const res = await fetch('/api/three-to-thrive');
        if (!res.ok) return false;
        const body = await res.json();
        return (body.todaysEntry?.answers ?? []).some(
          (a: { answer: string }) => a.answer.includes(expected),
        );
      }, phrase);
    }, { timeout: 8_000 }).toBe(true);

    // Close the drawer and confirm the derived `reflection-${date}` row shows
    // in the desktop activity feed.
    await page.getByTestId('reflection-close').click();
    const desktop = page.getByTestId('desktop-layout');
    const row = desktop.getByTestId(`activity-row-reflection-${todayKey()}`);
    await expect(row).toBeVisible({ timeout: 5_000 });
    await expect(row).toContainText('Reflection');
  });

  test('edit then remove a supplement persists across reloads', async ({ page }) => {
    // Flow 4: add a uniquely-named supplement, rename it via the inline edit
    // control, reload + reopen to confirm the rename persisted to the template,
    // then remove it and confirm it's gone after another reload. Each step is a
    // real /api/health-notes template round-trip (updateTemplate).
    const original = `E2EMag-${Date.now()}`;
    const renamed = `${original}-RN`;

    await openMorningLog(page);

    // Add the supplement (template add). The add row needs a name + a dosage.
    await page.getByTestId('supp-add-name').fill(original);
    await page.getByTestId('supp-add-dosage').fill('200');
    await page.getByTestId('supp-add-button').click();

    // The new supplement renders as the last supp row. Compute its index from
    // the rendered toggles rather than hard-coding it.
    await expect(page.getByText(original, { exact: true })).toBeVisible();
    const newIdx = (await page.getByTestId(/^supp-toggle-\d+$/).count()) - 1;

    // Rename via the inline edit control: pencil → input → save (check).
    // newIdx is valid here (pre-reload; DOM hasn't changed since the add).
    await page.getByTestId(`supp-edit-${newIdx}`).click();
    const input = page.getByTestId(`supp-edit-input-${newIdx}`);
    await input.fill(renamed);
    await page.getByTestId(`supp-edit-save-${newIdx}`).click();
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();

    // Reload + reopen → the rename survived (persisted to the template).
    await page.reload();
    await page.getByTestId('morning-log-trigger').click();
    await expect(page.getByTestId('morning-log-drawer')).toBeVisible();
    await expect(page.getByTestId('morning-log-date')).toHaveValue(todayKey());
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();
    await expect(page.getByText(original, { exact: true })).toHaveCount(0);

    // Remove it. Locate the row by its unique name label + the presence of a
    // supp-toggle control (distinguishes supplement rows from the AddRow and
    // other sections). Because supplement names are unique in the template, this
    // resolves to exactly one element without depending on the row's index or
    // DOM nesting after a reload.
    const suppRow = page
      .locator('div', { hasText: renamed })
      .filter({ has: page.locator('[data-testid^="supp-toggle-"]') })
      .last(); // .last() guards against ancestor divs that also match hasText
    await suppRow.getByTestId(/^supp-remove-\d+$/).click();
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);

    // Reload + reopen → it stays gone (template delete persisted). This also
    // serves as cleanup so the added template item leaves no residue.
    await page.reload();
    await page.getByTestId('morning-log-trigger').click();
    await expect(page.getByTestId('morning-log-drawer')).toBeVisible();
    await expect(page.getByTestId('morning-log-date')).toHaveValue(todayKey());
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
  });

  test('exposes a morning-log command in the command palette', async ({ page }) => {
    // Mirrors the suite's other CmdK tests: assert the command surfaces and
    // that running it dismisses the palette. (The drawer-opens flow is covered
    // by the header-button test; asserting a cross-dialog handoff here is
    // timing-fragile.)
    await page.goto('/dashboard');
    await page.getByTestId('cmdk-trigger').click();
    await expect(page.getByTestId('cmdk-dialog')).toBeVisible();
    await page.getByTestId('cmdk-input').fill('morning');
    await expect(page.getByTestId('cmdk-action-0')).toContainText(/morning log/i);
    await page.getByTestId('cmdk-input').press('Enter');
    await expect(page.getByTestId('cmdk-dialog')).not.toBeVisible();
  });
});
