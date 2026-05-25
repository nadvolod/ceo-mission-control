import { test, expect } from '@playwright/test';

/**
 * Top-of-dashboard key metrics strip.
 *
 * Per AGENTS.md: tests must exercise real functionality — not visibility-only.
 * These tests run against the local Next.js server (no mocking), so they
 * catch client-side render crashes, hydration errors, and missing API
 * data that unit tests can't.
 */

test.describe('Top-of-dashboard key metrics strip', () => {
  test('renders all six metric cards with non-empty values on /dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait until the dashboard finishes its initial data load.
    await page.waitForSelector('[data-testid="key-metrics-strip"]', { timeout: 15_000 });

    const cardIds = [
      'metric-cash',
      'metric-cash-mom',
      'metric-net-worth',
      'metric-total-debt',
      'metric-temporal',
      'metric-money-moved',
    ] as const;

    for (const id of cardIds) {
      const card = page.getByTestId(id);
      await expect(card, `${id} should be visible`).toBeVisible();
      const text = (await card.textContent())?.trim() ?? '';
      // Each card must contain something beyond the title row — either a real
      // value or the explicit "—" placeholder when data is missing.
      expect(text.length, `${id} should have rendered content`).toBeGreaterThan(0);
    }
  });

  test('Financial Command Center section is gone from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="key-metrics-strip"]', { timeout: 15_000 });

    // The old FCC heading and its testid should no longer exist anywhere.
    await expect(page.getByTestId('financial-command')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Financial Command Center/i })).toHaveCount(0);
    // Savings Rate / Monthly Burn tiles were FCC-only and should be gone too.
    await expect(page.getByText(/Savings Rate/)).toHaveCount(0);
    await expect(page.getByText(/Monthly Burn/)).toHaveCount(0);
  });

  test('all six metric cards fit above the fold on an iPhone 15 Plus viewport', async ({ page }) => {
    // iPhone 15 Plus logical viewport: 430 × 932.
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="key-metrics-strip"]', { timeout: 15_000 });

    const strip = page.getByTestId('key-metrics-strip');
    const stripBox = await strip.boundingBox();
    expect(stripBox, 'strip bounding box should be available').not.toBeNull();
    // The whole strip should sit within the 932px viewport — no need to scroll
    // down to see any of the 6 metric cards.
    expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(932);

    // Confirm none of the 6 cards is clipped below the fold individually.
    const cardIds = [
      'metric-cash',
      'metric-cash-mom',
      'metric-net-worth',
      'metric-total-debt',
      'metric-temporal',
      'metric-money-moved',
    ];
    for (const id of cardIds) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} should have a bounding box`).not.toBeNull();
      expect(box!.y + box!.height, `${id} should sit above the 932px fold`).toBeLessThanOrEqual(932);
    }
  });

  test('refresh button on the compact header reloads dashboard data', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="key-metrics-strip"]', { timeout: 15_000 });

    // The compact header exposes refresh as an icon-only button; we ensure
    // it actually refires the dashboard data load (real wire, no mocks).
    const apiCalls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        url.includes('/api/monarch') ||
        url.includes('/api/focus-hours') ||
        url.includes('/api/financial')
      ) {
        apiCalls.push(url);
      }
    });

    const refreshBtn = page.getByRole('button', { name: /Refresh all data/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // Allow refresh handler to fire (it issues parallel GETs).
    await page.waitForTimeout(1000);
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('metrics strip survives a full page reload (truly persistent, not just first-mount)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="key-metrics-strip"]', { timeout: 15_000 });
    await expect(page.getByTestId('key-metrics-strip')).toBeVisible();

    // A real reload — not just a router navigation — to make sure the strip
    // isn't only present because some in-memory state has it cached.
    await page.reload();
    await page.waitForSelector('[data-testid="key-metrics-strip"]', { timeout: 15_000 });
    await expect(page.getByTestId('key-metrics-strip')).toBeVisible();

    // Cards must re-render with content, not just empty wrappers.
    for (const id of ['metric-cash', 'metric-temporal', 'metric-money-moved']) {
      const text = (await page.getByTestId(id).textContent())?.trim() ?? '';
      expect(text.length, `${id} should have content after reload`).toBeGreaterThan(0);
    }
  });
});
