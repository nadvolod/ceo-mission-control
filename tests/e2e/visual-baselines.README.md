# Page Visual Baselines

Every page needs paired Playwright visual coverage:

- one desktop baseline
- one iPhone/mobile baseline

When a page changes, update the correct baseline snapshot first, then verify the
feature against that baseline in CI. Visual tests must use Playwright
`toHaveScreenshot(...)` assertions against committed PNG baselines at both
viewports. Do not use visibility-only smoke tests or geometry-only assertions as
visual coverage.

Recommended test names include `desktop` and `iPhone` or `mobile` so CI can
identify the paired baseline coverage.

Update baselines intentionally with:

```bash
npx playwright test --update-snapshots
```
