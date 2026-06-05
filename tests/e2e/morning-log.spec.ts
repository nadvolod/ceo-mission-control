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

    // First template supplement (Guanfacine 1mg by default) and first habit.
    await page.getByTestId('supp-toggle-0').click();
    await expect(page.getByTestId('supp-toggle-0')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('habit-toggle-0').click();

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
    await page.getByTestId('supp-toggle-0').click();
    await page.getByTestId('supp-dosage-0').fill('0');
    await expect(page.getByTestId('morning-log-save')).toBeDisabled();
    // Restoring a positive dosage re-enables save.
    await page.getByTestId('supp-dosage-0').fill('1');
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

  test('opening via the command palette focuses the morning log', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('cmdk-trigger').click();
    await expect(page.getByTestId('cmdk-dialog')).toBeVisible();
    await page.getByTestId('cmdk-input').fill('morning');
    await page.getByTestId('cmdk-action-0').click();
    await expect(page.getByTestId('morning-log-drawer')).toBeVisible();
  });
});
