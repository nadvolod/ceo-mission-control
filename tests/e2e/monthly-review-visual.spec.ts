import { test, expect, type Locator } from '@playwright/test';

// BUG-80 visual acceptance coverage.
//
// The Monthly Review form is a light-themed white card that renders inside the
// dark-by-design v2 dashboard container (`.mc-root`). A global rule
// `.mc-root input,select,textarea { color: var(--color-mc-ink) }` (#F5F1FF,
// near-white) was bleeding onto the white card, so typed text was near-white on
// white and unreadable. The fix scopes a higher-specificity override onto the
// card's `.mc-light-surface` wrapper restoring dark (#171717) text.
//
// These tests type real text into the fields (so the color is actually captured)
// then:
//   1. assert the computed input color is dark #171717 — a deterministic
//      red-before / green-after guard, independent of pixel rendering, and
//   2. take desktop + iPhone screenshot snapshots of the white form card, per
//      AGENTS.md rules 13/14 (paired desktop + mobile visual baselines).
//
// The test user's rows are wiped by global-setup, so the New Review tab shows
// the empty editor. We set a fixed month + fixed field values so the baseline is
// stable month-to-month and independent of any DB state below the form card.

const DARK_INK = 'rgb(23, 23, 23)'; // #171717 — the readable, fixed color
const NEAR_WHITE_INK = 'rgb(245, 241, 255)'; // #F5F1FF — the buggy inherited color

const SAMPLE = {
  month: '2026-01',
  hours: '160',
  temporal: '40',
  timeAllocation: 'Deep work on the platform, hiring loops, and customer calls.',
};

// Fill the New Review form with deterministic values. Month is filled first
// (mirrors the app's own load-then-prefill order) so later field fills win.
async function fillReviewForm(scope: Locator) {
  await scope.getByTestId('monthly-review-month-input').fill(SAMPLE.month);
  await scope.locator('#mr-hours').fill(SAMPLE.hours);
  await scope.locator('#mr-temporal').fill(SAMPLE.temporal);
  await scope.locator('#mr-time-alloc').fill(SAMPLE.timeAllocation);
}

async function expectDarkInk(scope: Locator) {
  // The input value text must be dark — NOT the near-white #F5F1FF that made the
  // Monthly Review fields unreadable on their white card (BUG-80).
  const color = await scope.locator('#mr-time-alloc').evaluate(
    (el) => getComputedStyle(el).color,
  );
  expect(color, `input text color should be readable dark ink, not ${NEAR_WHITE_INK}`).toBe(
    DARK_INK,
  );
}

test.describe('BUG-80 — Monthly Review input text is readable (dark on white)', () => {
  test('desktop: readable field text on the white review card @1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');

    // Scope to the desktop layout — the mobile tree is also in the DOM at
    // desktop width, which would trip Playwright strict mode if unscoped.
    const desktop = page.getByTestId('desktop-layout');
    await expect(desktop).toBeVisible();
    await desktop.getByTestId('tab-review').click();

    await expect(desktop.getByRole('heading', { name: 'Monthly Review' })).toBeVisible();
    await fillReviewForm(desktop);
    await expectDarkInk(desktop);

    // Snapshot just the white form card (the `.mc-light-surface` wrapper) so the
    // baseline excludes the DB-driven current-month / trend / recent panels below.
    const card = desktop.locator('.mc-light-surface');
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('desktop-monthly-review.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('iPhone: readable field text on the white review card @390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14-ish
    await page.goto('/dashboard');

    const mobile = page.getByTestId('mobile-layout');
    await expect(mobile).toBeVisible();
    await mobile.getByTestId('mobile-nav-review').click();

    await expect(mobile.getByTestId('review-tab')).toBeVisible();
    await expect(mobile.getByRole('heading', { name: 'Monthly Review' })).toBeVisible();
    await fillReviewForm(mobile);
    await expectDarkInk(mobile);

    const card = mobile.locator('.mc-light-surface');
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('iphone-monthly-review.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
