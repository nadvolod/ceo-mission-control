# Test plan

## Strategy

The browser regression tests the root cause directly: covered mobile dashboard
controls must compute to at least 16px. Chromium does not emulate iPhone
Safari's native focus-zoom animation, so a screenshot alone is not sufficient
proof. Computed-style assertions provide deterministic red-before and
green-after evidence; screenshots protect the resulting layout.

No new unit test is planned because the production change contains no
JavaScript logic. New coverage is browser-level integration coverage against
the real Next.js application. Existing unit and real-database integration tests
remain mandatory regression gates.

## Planned Playwright cases

### PW-1: Mobile form-size contract

At 390×844, open or activate each form surface and assert every rendered
`input`, `select`, and `textarea` in the active surface has a computed font size
of at least 16px:

1. Inline Temporal goal editor.
2. Inline money amount editor.
3. Reflection drawer.
4. Command palette portal.
5. Monthly Review.
6. Morning Log drawer, including numeric, date, text, and textarea controls.

Expected red-before result: at least one assertion reports a 12–14px computed
font size. Expected green-after result: all covered controls are at least 16px.

### PW-2: Focused Morning Log containment

At 390×844:

1. Open Morning Log from the mobile header.
2. Wait for real health-note data hydration.
3. Set deterministic date and metric values.
4. Focus and type into a number field.
5. Assert the focused field remains visible.
6. Assert `document.documentElement.scrollWidth <= window.innerWidth`.
7. Assert the drawer's scroll width does not exceed its client width.
8. Capture the iPhone visual baseline.

This flow does not submit data; existing Morning Log E2E tests already cover
real persistence, reload, validation, and API effects.

### PW-3: Paired visual baselines

- Desktop, 1440×900: focused Morning Log with deterministic values.
- iPhone, 390×844: the equivalent focused Morning Log state.
- Update the existing Monthly Review iPhone baseline because its control text
  changes to 16px.
- Re-run the existing Monthly Review desktop baseline and require no intentional
  visual change.

Generate committed PNGs on `ubuntu-latest` through
`.github/workflows/update-visual-baselines.yml`, matching CI font rendering.

## Existing functional coverage retained

- Morning Log saves metrics through the real API and reloads them.
- Supplement dosage validation disables and re-enables Save.
- Template edits persist across reloads.
- Reflection autosave succeeds and preserves rapid input.
- Inline amount and goal editors submit and persist values.
- Monthly Review saves through the real API.
- Mobile navigation and dashboard functionality remain operational.

## Edge cases

- Empty form values and placeholders.
- Disabled inputs, including untaken supplement dosage.
- Number, decimal, date, text, and multiline controls.
- Long labels and compact multi-control rows.
- Loading and empty states.
- Validation failure and disabled submit actions.
- Network/server save failure messaging.
- Portal-rendered controls outside the dashboard DOM tree.
- The exact 767px/768px responsive boundary.
- Desktop styles remaining component-defined.
- Non-dashboard pages remaining outside the selector scope.

## Commands

Load the repository's required secrets without printing their values, then run:

```bash
npm run lint
npx tsc --noEmit
npx jest --ci --reporters=default --testPathIgnorePatterns='integration|e2e|\.claude/worktrees'
npx jest --ci --reporters=default --testPathPattern='integration' --testPathIgnorePatterns='\.claude/worktrees'
npx jest --coverage --ci --reporters=default --testPathIgnorePatterns='integration|e2e|\.claude/worktrees'
npm run build
npx playwright test
```

Targeted red/green and visual checks:

```bash
npx playwright test tests/e2e/mobile-form-zoom-visual.spec.ts
npx playwright test tests/e2e/monthly-review-visual.spec.ts
```

Tests must fail clearly if a required environment variable is absent; none may
skip due to missing configuration.

## Requirement mapping

| Test/evidence | Requirements |
| --- | --- |
| PW-1 computed styles | REQ-1, REQ-2 |
| PW-2 focused containment | REQ-3, REQ-5 |
| PW-3 paired screenshots | REQ-3, REQ-4 |
| Existing functional E2E | REQ-6 |
| Source-scope review and unaffected suites | REQ-7 |
| Full verification commands and Vercel preview | REQ-1 through REQ-7 |
