import { test, expect } from '@playwright/test';
import { neon } from '@neondatabase/serverless';

/**
 * Quick-add buttons on the Weekly Performance Tracker.
 *
 * The new flow replaces the "Log Today" form with category-style buttons that
 * INCREMENT today's entry. The old form-save path silently overwrote, which
 * caused a real incident (a 4.5h entry was nuked back to 0h on accidental save).
 * Each test below clicks a real button and asserts the API persistence after
 * the click — not just element visibility.
 *
 * Tests are serial because they all mutate the same test-user weekly-tracker
 * row; parallel runs would race the read-modify-write storage.
 */

test.describe('Weekly Performance Tracker — additive quick-add', () => {
  test.describe.configure({ mode: 'serial' });

  // Local-date helper matches the client-side derivation in useDashboardData.
  const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // globalSetup wipes the test user's text_store rows for a clean slate, which
  // means DAILY_SCORECARD.md is missing on a fresh run and the dashboard renders
  // its "Cannot Load Workspace Data" guard instead of the tab body. The Weekly
  // Performance Tracker lives inside that branch, so its testid never appears
  // and these tests time out. Seed a minimal scorecard once before the suite so
  // the dashboard renders the tracker. We touch only this one text_store row;
  // every other assertion still goes through the real /api/weekly-tracker
  // endpoint.
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        '[weekly-tracker-quick-add] DATABASE_URL is required to seed the scorecard. ' +
          'Run `vercel env pull .env.local` then export it before invoking Playwright.',
      );
    }
    const sql = neon(process.env.DATABASE_URL);
    const users = await sql`SELECT id FROM users WHERE email = ${'test@ceo-mc.local'}`;
    if (users.length === 0) {
      throw new Error('[weekly-tracker-quick-add] Test user not seeded. Run `npm run db:migrate`.');
    }
    const userId = users[0].id as string;
    const scorecardMd = [
      '# Daily Scorecard',
      '',
      `- Date: ${todayLocal()}`,
      '- Target today: 5',
      '- Major money move today: e2e seed',
      '- Strategic project move today: e2e seed',
      '- Taxes / risk reduction move today: e2e seed',
      '- Biggest blocker: none',
      '',
      '## priorities',
      '- e2e-seed-priority',
      '',
    ].join('\n');
    await sql`
      INSERT INTO text_store (owner_id, key, content, updated_at)
      VALUES (${userId}, ${'DAILY_SCORECARD.md'}, ${scorecardMd}, NOW())
      ON CONFLICT (owner_id, key) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
    `;
  });

  test.beforeEach(async ({ request }) => {
    const date = todayLocal();
    // Reset today's row so each test starts from a clean slate.
    await request.post('/api/weekly-tracker', {
      data: { action: 'deleteDay', date },
    });
  });

  test('+30m Deep Work button creates a fresh day entry with 0.5h', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="weekly-tracker-quick-add"]', { timeout: 15_000 });

    await page.getByRole('button', { name: '+30m Deep Work' }).click();

    // Persistence: round-trip through the API to confirm the row hit storage.
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.deepWorkHours ?? null;
    }, { timeout: 10_000 }).toBe(0.5);

    const res = await (await request.get('/api/weekly-tracker')).json();
    expect(res.todaysEntry).toMatchObject({
      deepWorkHours: 0.5,
      pipelineActions: 0,
      trained: false,
    });
  });

  test('multiple clicks accumulate deepWorkHours additively (no overwrite)', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="weekly-tracker-quick-add"]', { timeout: 15_000 });

    // 0.5h + 1h + 2h = 3.5h after three clicks.
    await page.getByRole('button', { name: '+30m Deep Work' }).click();
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.deepWorkHours ?? null;
    }, { timeout: 10_000 }).toBe(0.5);

    await page.getByRole('button', { name: '+1h Deep Work' }).click();
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.deepWorkHours ?? null;
    }, { timeout: 10_000 }).toBe(1.5);

    await page.getByRole('button', { name: '+2h Deep Work' }).click();
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.deepWorkHours ?? null;
    }, { timeout: 10_000 }).toBe(3.5);
  });

  test('+1 Pipeline accumulates pipelineActions independently of deep work', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="weekly-tracker-quick-add"]', { timeout: 15_000 });

    await page.getByRole('button', { name: '+1h Deep Work' }).click();
    await page.getByRole('button', { name: '+1 Pipeline' }).click();
    await page.getByRole('button', { name: '+2 Pipeline' }).click();

    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.pipelineActions ?? null;
    }, { timeout: 10_000 }).toBe(3);

    const res = await (await request.get('/api/weekly-tracker')).json();
    expect(res.todaysEntry?.deepWorkHours).toBe(1); // untouched by pipeline clicks
  });

  test('✓ Trained latches true and stays true on subsequent additive clicks', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="weekly-tracker-quick-add"]', { timeout: 15_000 });

    await page.getByRole('button', { name: '✓ Trained' }).click();
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.trained ?? null;
    }, { timeout: 10_000 }).toBe(true);

    // Subsequent clicks on other buttons must not flip trained back to false —
    // the regression we're guarding is "click X, blank everything else."
    await page.getByRole('button', { name: '+30m Deep Work' }).click();
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.trained ?? null;
    }, { timeout: 10_000 }).toBe(true);

    const res = await (await request.get('/api/weekly-tracker')).json();
    expect(res.todaysEntry).toMatchObject({
      deepWorkHours: 0.5,
      trained: true,
    });
  });

  test('✓ Good Day tops up to (3h DW + 2 pipeline + trained) without lowering existing values', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="weekly-tracker-quick-add"]', { timeout: 15_000 });

    // Start with 4h deep work + 1 pipeline — Good Day must NOT bring DW down to 3.
    await page.getByRole('button', { name: '+2h Deep Work' }).click();
    await page.getByRole('button', { name: '+2h Deep Work' }).click();
    await page.getByRole('button', { name: '+1 Pipeline' }).click();
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.deepWorkHours ?? null;
    }, { timeout: 10_000 }).toBe(4);

    await page.getByRole('button', { name: '✓ Good Day' }).click();

    // Expected: DW unchanged (already ≥3), pipeline topped up to 2, trained latched true.
    await expect.poll(async () => {
      const res = await (await request.get('/api/weekly-tracker')).json();
      return res.todaysEntry?.pipelineActions ?? null;
    }, { timeout: 10_000 }).toBe(2);

    const res = await (await request.get('/api/weekly-tracker')).json();
    expect(res.todaysEntry).toMatchObject({
      deepWorkHours: 4, // not lowered
      pipelineActions: 2,
      trained: true,
    });
  });
});
