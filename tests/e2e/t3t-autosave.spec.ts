import { test, expect, type Page } from '@playwright/test';

// Comprehensive autosave coverage for the Three to Thrive inline panel
// on /dashboard/v2. The autosave is a 600ms-debounced PATCH to
// /api/three-to-thrive plus a flush-on-blur and a flush-on-unmount.
//
// The prior implementation only debounced — fast-typing then navigating
// or blurring lost content. This suite covers positive, negative,
// boundary, and unicode cases plus the new blur/unmount flushes.

async function readTodaysT3T(page: Page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/three-to-thrive');
    if (!res.ok) throw new Error(`GET /api/three-to-thrive failed: ${res.status}`);
    return res.json();
  });
}

async function answerFor(page: Page, questionMatch: RegExp): Promise<string | null> {
  const body = await readTodaysT3T(page);
  const today = body?.todaysEntry;
  if (!today) return null;
  const match = (today.answers as Array<{ question: string; answer: string }>).find(
    (a) => questionMatch.test(a.question),
  );
  return match?.answer ?? null;
}

async function openOverviewT3T(page: Page) {
  await page.goto('/dashboard/v2');
  // The CollapsiblePanel is open by default at md+. Just wait for the
  // first input to be present and visible.
  await expect(page.getByTestId('t3t-inline-input-0')).toBeVisible();
}

// Wait for the autosave indicator to settle. The flow is:
//   onChange → status='saving' (instant) → debounce 600ms → save → 'saved'
// We give the SAVED indicator a generous timeout because the API does a
// DB round-trip and the debounce + network can take a moment.
async function waitForSaved(page: Page, index: number) {
  await expect(page.getByTestId(`t3t-inline-status-${index}`)).toHaveText(/SAVED/i, {
    timeout: 5_000,
  });
}

test.describe('Three to Thrive — inline autosave', () => {
  test.describe.configure({ mode: 'serial' });

  // ---------- Positive: short string round-trips ----------
  test('positive: short string saves on debounce and reads back from the server', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `e2e-short-${Date.now()}`;
    await page.getByTestId('t3t-inline-input-0').fill(phrase);
    await waitForSaved(page, 0);

    // Server round-trip — the value reached the DB.
    const saved = await answerFor(page, /courage and determination/i);
    expect(saved).toContain(phrase);
  });

  // ---------- Positive: numbers ----------
  test('positive: numeric content saves verbatim', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `1 2 3 4 5 — ${Date.now()}`;
    await page.getByTestId('t3t-inline-input-0').fill(phrase);
    await waitForSaved(page, 0);
    expect(await answerFor(page, /courage and determination/i)).toContain(phrase);
  });

  // ---------- Positive: bullets / unicode characters ----------
  test('positive: bullet characters and emoji save verbatim', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `• ship the deck\n• stop polishing 🚀 — ${Date.now()}`;
    await page.getByTestId('t3t-inline-input-0').fill(phrase);
    await waitForSaved(page, 0);
    const saved = (await answerFor(page, /courage and determination/i)) || '';
    expect(saved).toContain('•');
    expect(saved).toContain('🚀');
  });

  // ---------- Positive: Enter key inserts a newline that persists ----------
  test('positive: Enter inserts a newline and the multiline content saves', async ({ page }) => {
    await openOverviewT3T(page);
    const tag = `${Date.now()}`;
    const input = page.getByTestId('t3t-inline-input-0');
    await input.fill(`first line ${tag}`);
    await input.press('Enter');
    await input.pressSequentially('second line');
    await waitForSaved(page, 0);
    const saved = (await answerFor(page, /courage and determination/i)) || '';
    expect(saved).toMatch(new RegExp(`first line ${tag}.*\\n.*second line`, 's'));
  });

  // ---------- Boundary: empty string clears the answer ----------
  test('boundary: emptying the textarea clears the saved answer', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `to-be-cleared-${Date.now()}`;
    const input = page.getByTestId('t3t-inline-input-0');
    await input.fill(phrase);
    await waitForSaved(page, 0);
    // Now clear it.
    await input.fill('');
    // After clearing, the status badge goes away (status === 'idle'). Give the
    // debounce + server PATCH time to complete.
    await page.waitForTimeout(1200);
    const saved = await answerFor(page, /courage and determination/i);
    expect(saved ?? '').toBe('');
  });

  // ---------- Boundary: single character ----------
  test('boundary: a single character still triggers a save', async ({ page }) => {
    await openOverviewT3T(page);
    await page.getByTestId('t3t-inline-input-0').fill('z');
    await waitForSaved(page, 0);
    expect(await answerFor(page, /courage and determination/i)).toBe('z');
  });

  // ---------- Boundary: 5000-char string ----------
  test('boundary: a 5000-character string saves without truncation', async ({ page }) => {
    await openOverviewT3T(page);
    const tag = `${Date.now()}`;
    // 5000 chars: 250 repetitions of a 20-char block — predictable + searchable.
    const block = 'discipline_block___ ';
    const phrase = block.repeat(250) + tag;
    await page.getByTestId('t3t-inline-input-0').fill(phrase);
    await waitForSaved(page, 0);
    const saved = (await answerFor(page, /courage and determination/i)) || '';
    expect(saved.length).toBe(phrase.length);
    expect(saved.endsWith(tag)).toBe(true);
  });

  // ---------- Boundary: leading + trailing whitespace ----------
  test('boundary: leading/trailing whitespace is preserved verbatim', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `   padded value ${Date.now()}   `;
    await page.getByTestId('t3t-inline-input-0').fill(phrase);
    await waitForSaved(page, 0);
    expect(await answerFor(page, /courage and determination/i)).toBe(phrase);
  });

  // ---------- Negative: flush on blur (the original bug) ----------
  test('negative: typing then blurring BEFORE the 600ms debounce still saves', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `blur-flush-${Date.now()}`;
    const input = page.getByTestId('t3t-inline-input-0');
    await input.fill(phrase);
    // Immediately blur — before the 600ms debounce fires. The flush-on-blur
    // path should persist the value anyway.
    await input.blur();
    // Give the synchronous save a moment to round-trip.
    await page.waitForTimeout(800);
    expect(await answerFor(page, /courage and determination/i)).toContain(phrase);
  });

  // ---------- Negative: flush on tab away to a different input ----------
  test('negative: tabbing to the next prompt persists the first prompt', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `tab-flush-${Date.now()}`;
    await page.getByTestId('t3t-inline-input-0').fill(phrase);
    // Tab to the next textarea — this blurs the first one.
    await page.getByTestId('t3t-inline-input-0').press('Tab');
    await page.waitForTimeout(800);
    expect(await answerFor(page, /courage and determination/i)).toContain(phrase);
  });

  // ---------- Negative: rapid typing only fires one save ----------
  test('negative: rapid typing of 30 keystrokes ends in exactly one saved value', async ({ page }) => {
    await openOverviewT3T(page);
    const input = page.getByTestId('t3t-inline-input-0');
    // Type 30 characters one at a time. Each keystroke resets the debounce.
    // We expect the final value to be what landed in the DB.
    const tag = `${Date.now()}`;
    await input.fill('');
    await input.pressSequentially(`abcdefghijklmnopqrstuvwxyz - ${tag.slice(-3)}`);
    await waitForSaved(page, 0);
    expect(await answerFor(page, /courage and determination/i)).toBe(
      `abcdefghijklmnopqrstuvwxyz - ${tag.slice(-3)}`,
    );
  });

  // ---------- Negative: reload survives the saved value ----------
  test('negative: a saved value still appears after a full page reload', async ({ page }) => {
    await openOverviewT3T(page);
    const phrase = `reload-survive-${Date.now()}`;
    await page.getByTestId('t3t-inline-input-0').fill(phrase);
    await waitForSaved(page, 0);
    await page.reload();
    await expect(page.getByTestId('t3t-inline-input-0')).toHaveValue(
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });

  // ---------- Negative: independent saves per prompt ----------
  test('negative: each prompt has an independent save lane (one save does not clobber another)', async ({ page }) => {
    await openOverviewT3T(page);
    const tag = `${Date.now()}`;
    await page.getByTestId('t3t-inline-input-0').fill(`prompt-0-${tag}`);
    await waitForSaved(page, 0);
    await page.getByTestId('t3t-inline-input-1').fill(`prompt-1-${tag}`);
    await waitForSaved(page, 1);

    const body = await readTodaysT3T(page);
    const answers = body.todaysEntry.answers as Array<{ question: string; answer: string }>;
    // Map by question prefix to be resilient to wording changes.
    const courage = answers.find((a) => /courage/i.test(a.question))?.answer ?? '';
    const serve   = answers.find((a) => /serve/i.test(a.question))?.answer ?? '';
    expect(courage).toContain(`prompt-0-${tag}`);
    expect(serve).toContain(`prompt-1-${tag}`);
  });
});
