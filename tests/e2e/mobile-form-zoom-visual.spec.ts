import { test, expect, type Locator, type Page } from '@playwright/test';

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

async function openMorningLog(page: Page, viewport: 'desktop' | 'mobile'): Promise<Locator> {
  await page.goto('/dashboard');

  const trigger =
    viewport === 'mobile'
      ? page.getByTestId('mobile-morning-trigger')
      : page.getByTestId('morning-log-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawer = page.getByTestId('morning-log-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('morning-log-date')).not.toHaveValue('');
  return drawer;
}

async function focusMorningLogField(drawer: Locator): Promise<void> {
  const date = drawer.getByTestId('morning-log-date');
  await date.fill('2026-01-15');
  await expect(date).toHaveValue('2026-01-15');

  const sleepScore = drawer.getByTestId('metric-sleep-score');
  await sleepScore.fill('88');
  await sleepScore.focus();
  await expect(sleepScore).toBeFocused();
  await expect(sleepScore).toHaveValue('88');
}

async function expectNoHorizontalClipping(page: Page, drawer: Locator): Promise<void> {
  const overflow = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentScrollWidth, 'focused controls must not widen the document').toBeLessThanOrEqual(
    overflow.viewportWidth,
  );

  const drawerOverflow = await drawer.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(drawerOverflow.scrollWidth, 'focused controls must not widen the Morning Log drawer').toBeLessThanOrEqual(
    drawerOverflow.clientWidth,
  );

  const clipped = await drawer.locator('label, input, select, textarea').evaluateAll((elements) => {
    const drawerRect = elements[0]?.closest('[data-testid="morning-log-drawer"]')?.getBoundingClientRect();
    if (!drawerRect) return ['Morning Log drawer bounds unavailable'];

    const leftEdge = Math.max(0, drawerRect.left) - 1;
    const rightEdge = Math.min(window.innerWidth, drawerRect.right) + 1;
    return elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.left < leftEdge || rect.right > rightEdge);
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const name =
          element.getAttribute('data-testid') ||
          element.getAttribute('for') ||
          element.getAttribute('name') ||
          element.tagName.toLowerCase();
        return `${name}: ${rect.left.toFixed(1)}..${rect.right.toFixed(1)} outside ${leftEdge.toFixed(1)}..${rightEdge.toFixed(1)}`;
      });
  });
  expect(clipped, `Morning Log labels or fields are horizontally clipped:\n${clipped.join('\n')}`).toEqual([]);
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

test.describe('BUG-83 — focused Morning Log remains contained', () => {
  test('desktop: focused field at 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const drawer = await openMorningLog(page, 'desktop');
    await focusMorningLogField(drawer);
    await expectNoHorizontalClipping(page, drawer);

    await expect(drawer).toHaveScreenshot('desktop-morning-log-focused.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('iPhone: focused field at 390×844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const drawer = await openMorningLog(page, 'mobile');
    await focusMorningLogField(drawer);
    await expectNoHorizontalClipping(page, drawer);

    await expect(drawer).toHaveScreenshot('iphone-morning-log-focused.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
