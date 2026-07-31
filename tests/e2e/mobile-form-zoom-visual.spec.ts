import { test, expect, type Locator } from '@playwright/test';

type FontFinding = {
  surface: string;
  control: string;
  fontSize: number;
};

async function collectFontFindings(surface: string, scope: Locator): Promise<FontFinding[]> {
  const controls = scope.locator('input, select, textarea');
  const rendered = await controls.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        control:
          element.getAttribute('data-testid') ||
          element.getAttribute('id') ||
          element.getAttribute('name') ||
          element.tagName.toLowerCase(),
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      })),
  );

  expect(rendered.length, `${surface} should expose at least one rendered form control`).toBeGreaterThan(0);
  return rendered.map((finding) => ({ surface, ...finding }));
}

test.describe('BUG-83 — mobile dashboard form controls do not trigger Safari focus zoom', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('all current dashboard form surfaces render controls at 16px or larger', async ({ page }) => {
    await page.goto('/dashboard');

    const findings: FontFinding[] = [];
    const mobile = page.getByTestId('mobile-layout');
    await expect(mobile).toBeVisible();

    await mobile.getByTestId('mobile-temporal-edit-goal').click();
    const goalEditor = mobile.getByTestId('mobile-temporal-goal-editor-row');
    await expect(goalEditor).toBeVisible();
    findings.push(...(await collectFontFindings('Temporal goal editor', goalEditor)));
    await goalEditor.getByTestId('mobile-temporal-goal-editor-cancel').click();

    await mobile.getByTestId('mobile-quick-moved').click();
    const amountEditor = mobile.getByTestId('mobile-quick-amount-editor-wrap');
    await expect(amountEditor).toBeVisible();
    findings.push(...(await collectFontFindings('Money amount editor', amountEditor)));
    await amountEditor.getByTestId('mobile-quick-amount-cancel').click();

    await mobile.getByTestId('mobile-nav-reflect').click();
    const reflection = page.getByTestId('reflection-drawer');
    await expect(reflection).toBeVisible();
    findings.push(...(await collectFontFindings('Reflection drawer', reflection)));
    await reflection.getByTestId('reflection-close').click();

    await page.keyboard.press('Control+k');
    const commandPalette = page.getByTestId('cmdk-dialog');
    await expect(commandPalette).toBeVisible();
    findings.push(...(await collectFontFindings('Command palette', commandPalette)));
    await commandPalette.getByTestId('cmdk-input').press('Escape');
    await expect(commandPalette).not.toBeVisible();

    await mobile.getByTestId('mobile-nav-review').click();
    const monthlyReview = mobile.getByTestId('review-tab');
    await expect(monthlyReview).toBeVisible();
    findings.push(...(await collectFontFindings('Monthly Review', monthlyReview)));

    await mobile.getByTestId('mobile-morning-trigger').click();
    const morningLog = page.getByTestId('morning-log-drawer');
    await expect(morningLog).toBeVisible();
    await expect(morningLog.getByTestId('morning-log-date')).not.toHaveValue('');
    findings.push(...(await collectFontFindings('Morning Log', morningLog)));

    const tooSmall = findings.filter(({ fontSize }) => fontSize < 16);
    expect(
      tooSmall,
      `iPhone Safari zooms controls below 16px:\n${tooSmall
        .map(({ surface, control, fontSize }) => `- ${surface}: ${control} = ${fontSize}px`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
