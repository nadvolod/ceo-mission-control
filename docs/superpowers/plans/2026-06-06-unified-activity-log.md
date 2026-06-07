# Unified Home-Screen Activity Log + Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard-v2 home page the single chronological place to see all activity (financial, focus, morning log, reflections) with tap-to-expand read-only detail, plus targeted fixes (editable categories, icon swap, removed Call/Demo quick actions, working mobile Insights/Review tabs).

**Architecture:** Extend the existing `deriveActivity()` pipeline to fold morning-log and reflection records into one `ActivityEntry[]` feed rendered by `ActivityFeed` (desktop) and `RecentActivity` (mobile). Each entry carries a lightweight `source` + `refKey`; tapping resolves the full record from data the page already holds and shows it in a read-only `ActivityDetailSheet`. Backend template edit/remove is mostly already present in `health-notes-tracker.ts`/`route.ts`; only habit/env-field rename is missing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Radix Dialog, lucide-react, Jest + Testing Library (unit), Playwright (E2E). Test runner: `npm test` (jest), `npm run test:e2e:playwright`.

**Spec:** `docs/superpowers/specs/2026-06-06-unified-activity-log-design.md`

**Branch:** `feat/unified-activity-log` (already created off `main`; carries the spec commit).

---

## File Structure

**Phase 1 — Independent fixes (each commit shippable on its own):**
- Modify `src/components/dashboard/v2/MorningLogDrawer.tsx` — icon `Moon`→`NotebookPen`.
- Modify `src/components/dashboard/v2/MobileLayout.tsx` — icon swap; remove Call/Demo from `QUICK_ACTIONS`; render real Insights/Review tabs.
- Modify `src/app/dashboard/page.tsx` — pass tab data into `MobileLayout`; add `NotebookPen` to desktop Morning button.
- Modify `src/components/dashboard/v2/MetricCard.tsx` — drop Call/Demo pipeline presets (keep `+ FU`).
- Modify `src/components/dashboard/v2/CmdK.tsx` — drop `+call`/`+demo` commands.
- Modify `src/components/dashboard/v2/__tests__/MobileLayout.test.tsx`, `__tests__/useMissionStore.test.tsx` — drop Call/Demo references.

**Phase 2 — Editable categories:**
- Modify `src/lib/health-notes-tracker.ts` — add `editHabit`, `editEnvironmentField`.
- Modify `src/app/api/health-notes/route.ts` — add `editHabit`, `editEnvironmentField` operations.
- Create `src/app/api/health-notes/route.editremove.test.ts` — integration tests.
- Create `src/components/dashboard/v2/EditableItemList.tsx` — reusable edit/remove list row.
- Modify `src/components/dashboard/v2/MorningLogDrawer.tsx` — wire edit/remove into Supplements / Habits / Environment sections.

**Phase 3 — Unified feed + detail:**
- Modify `src/components/dashboard/v2/types.ts` — extend `ActivityEntry` (`source`, `refKey`).
- Modify `src/components/dashboard/v2/derive.ts` — `morningToActivity`, `reflectionToActivity`, extend `deriveActivity`.
- Modify `src/components/dashboard/v2/__tests__/derive.test.ts` — unit tests for new mappers.
- Create `src/components/dashboard/v2/ActivityDetailSheet.tsx` — read-only detail sheet.
- Create `src/components/dashboard/v2/__tests__/ActivityDetailSheet.test.tsx` — unit tests.
- Modify `src/components/dashboard/v2/ActivityFeed.tsx` — make rows clickable (`onOpenDetail`).
- Modify `src/components/dashboard/v2/MobileLayout.tsx` — make `RecentActivity` rows clickable; render detail sheet.
- Modify `src/app/dashboard/page.tsx` — feed morning+reflection into `deriveActivity`; hold detail state; render `ActivityDetailSheet`.

**Phase 4 — E2E:**
- Modify `tests/e2e/morning-log.spec.ts` and/or `tests/e2e/dashboard-v2.spec.ts` — add the 5 required E2E flows.

---

## PHASE 1 — Independent fixes

### Task 1: Swap the Morning Log icon (Moon → NotebookPen)

**Files:**
- Modify: `src/components/dashboard/v2/MorningLogDrawer.tsx` (import line 5; usages)
- Modify: `src/components/dashboard/v2/MobileLayout.tsx` (import line 4; `MobileHeader`)
- Modify: `src/app/dashboard/page.tsx` (desktop "Morning" button ~line 291-306)

- [ ] **Step 1: Find every Moon usage**

Run: `grep -rn "Moon" src/components/dashboard/v2 src/app/dashboard`
Expected: import + JSX usages in `MorningLogDrawer.tsx` and `MobileLayout.tsx`, plus the CmdK `☾` glyph (a string, leave it).

- [ ] **Step 2: Replace in MorningLogDrawer.tsx**

Change the import on line 5 from:
```tsx
import { Moon, Plus, X } from 'lucide-react';
```
to:
```tsx
import { NotebookPen, Plus, X } from 'lucide-react';
```
Then replace every `<Moon` occurrence with `<NotebookPen` in this file (keep the same size/props).

- [ ] **Step 3: Replace in MobileLayout.tsx**

Change the import on line 4 from:
```tsx
import { Sparkles, Brain, Check, BarChart3, Pencil, Moon } from 'lucide-react';
```
to:
```tsx
import { Sparkles, Brain, Check, BarChart3, Pencil, NotebookPen } from 'lucide-react';
```
Then in `MobileHeader` replace the `<Moon ... />` element with `<NotebookPen ... />` (same props).

- [ ] **Step 4: Add icon to the desktop Morning button**

In `src/app/dashboard/page.tsx`, add `NotebookPen` to the lucide import on line 5:
```tsx
import { NotebookPen, Plus, Search } from 'lucide-react';
```
Then in the Morning `<button>` (the one with `data-testid="morning-log-trigger"`, ~line 291-306) put an icon before the text. Change the button's children from `Morning` to:
```tsx
<NotebookPen size={12} aria-hidden style={{ marginRight: 4, display: 'inline', verticalAlign: '-2px' }} /> Morning
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors; no remaining `Moon` import.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/v2/MorningLogDrawer.tsx src/components/dashboard/v2/MobileLayout.tsx src/app/dashboard/page.tsx
git commit -m "feat(dashboard-v2): swap Morning Log icon Moon -> NotebookPen"
```

---

### Task 2: Remove `+ Call` and `+ Demo` everywhere (keep Train, keep + FU)

**Files:**
- Modify: `src/components/dashboard/v2/MobileLayout.tsx` (`QUICK_ACTIONS`, lines 501-508)
- Modify: `src/components/dashboard/v2/MetricCard.tsx` (`PRESETS.pipeline`, line 21)
- Modify: `src/components/dashboard/v2/CmdK.tsx` (actions, lines 35-36)
- Modify: `src/components/dashboard/v2/__tests__/MobileLayout.test.tsx` (the `+Call` test, ~line 122)
- Modify: `src/components/dashboard/v2/__tests__/useMissionStore.test.tsx` (the `+ Call` row, ~line 63)

- [ ] **Step 1: Update the failing tests first (TDD: tests describe new behavior)**

In `__tests__/MobileLayout.test.tsx`, the test at ~line 122 (`'mobile non-money quick log (+Call) still logs the hardcoded delta directly'`) references a button that will no longer exist. Replace its `+Call` usage with `+ Deep 0.5h` (a remaining hour-based quick action), so it still asserts "non-money quick log logs the hardcoded delta directly". Find the line that queries `mobile-quick-call` (via `slugifyLabel('+ Call')` → `call`) and change the target to the Deep action:
```tsx
// was: getByTestId('mobile-quick-call') and asserting onLog('pipeline', 0.5, '+ Call')
const btn = screen.getByTestId('mobile-quick-deep-0-5h');
await userEvent.click(btn);
expect(onLog).toHaveBeenCalledWith('deepWork', 0.5, '+ Deep 0.5h');
```
(Match the exact existing query/assertion style in that test; only the metric/label/testid change.)

Add a new assertion in the same describe block that Call/Demo are gone:
```tsx
it('mobile quick log no longer offers Call or Demo', () => {
  render(<MobileLayout {...baseProps} />);
  expect(screen.queryByTestId('mobile-quick-call')).toBeNull();
  expect(screen.queryByTestId('mobile-quick-demo')).toBeNull();
});
```

In `__tests__/useMissionStore.test.tsx`, remove the `['pipeline', '/api/focus-hours', 0.5, '+ Call']` row (~line 63) from the parametrized cases array.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- MobileLayout useMissionStore`
Expected: FAIL — `mobile-quick-call` still rendered / old `+ Call` case still present.

- [ ] **Step 3: Remove from MobileLayout QUICK_ACTIONS**

In `MobileLayout.tsx` delete the Call and Demo entries so the array is:
```tsx
const QUICK_ACTIONS: QuickAction[] = [
  { label: '+ Moved',     metricId: 'moneyMoved', delta: null, color: MC_COLORS.green },
  { label: '+ Generated', metricId: 'moneyMoved', delta: null, color: MC_COLORS.green },
  { label: '+ Deep 0.5h', metricId: 'deepWork',   delta: 0.5,  color: MC_COLORS.cyan },
  { label: '+ Train',     metricId: 'trained',    delta: 1,    color: MC_COLORS.pink },
];
```

- [ ] **Step 4: Remove from MetricCard pipeline presets (keep + FU)**

In `MetricCard.tsx` line 21 change:
```tsx
  pipeline:   [{ label: '+ Call', delta: 0.5 }, { label: '+ Demo', delta: 1 }, { label: '+ FU', delta: 0.5 }],
```
to:
```tsx
  pipeline:   [{ label: '+ FU', delta: 0.5 }],
```

- [ ] **Step 5: Remove from CmdK**

In `CmdK.tsx` delete the two action objects on lines 35-36 (`+call pipeline` and `+demo pipeline`).

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test -- MobileLayout useMissionStore CmdK MetricCard`
Expected: PASS.

- [ ] **Step 7: Typecheck + lint, then commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
git add src/components/dashboard/v2/MobileLayout.tsx src/components/dashboard/v2/MetricCard.tsx src/components/dashboard/v2/CmdK.tsx src/components/dashboard/v2/__tests__/MobileLayout.test.tsx src/components/dashboard/v2/__tests__/useMissionStore.test.tsx
git commit -m "feat(dashboard-v2): remove Call/Demo quick actions (keep Train, FU)"
```

---

### Task 3: Render real Insights & Review tabs on mobile

**Files:**
- Modify: `src/components/dashboard/v2/MobileLayout.tsx` (props + tab bodies, lines 16-30, 86-97)
- Modify: `src/app/dashboard/page.tsx` (pass new props into `MobileLayout`, ~line 141-150)

- [ ] **Step 1: Add a test for mobile tab rendering**

In `__tests__/MobileLayout.test.tsx`, add:
```tsx
it('renders the Insights tab content on mobile (not a placeholder)', () => {
  render(<MobileLayout {...baseProps} tab="insights" />);
  // InsightsTab renders cards; assert the placeholder copy is gone.
  expect(screen.queryByText(/open the Insights tab in the bottom nav/i)).toBeNull();
});
it('renders the Review tab content on mobile (not a placeholder)', () => {
  render(<MobileLayout {...baseProps} tab="review" />);
  expect(screen.queryByText(/Open the Review tab in the bottom nav/i)).toBeNull();
});
```
Ensure `baseProps` in this test file includes the new props added in Step 3 (default them to `undefined`/empty arrays).

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- MobileLayout`
Expected: FAIL — placeholder text still present.

- [ ] **Step 3: Extend MobileLayout props + imports**

At the top of `MobileLayout.tsx` add imports:
```tsx
import { InsightsTab } from './InsightsTab';
import { ReviewTab } from './ReviewTab';
```
Extend the `Props` type (after `onUpdateTemporalGoal`) with the data the two tabs need (mirror the desktop call sites in `page.tsx` lines 436-447):
```tsx
  // Tab data — passed straight through to InsightsTab / ReviewTab so the
  // mobile tabs render real content instead of a placeholder.
  insightsData?: {
    focusDailyTrend?: React.ComponentProps<typeof InsightsTab>['focusDailyTrend'];
    financialDailyTrend?: React.ComponentProps<typeof InsightsTab>['financialDailyTrend'];
  };
  reviewData?: {
    currentMonthReview: React.ComponentProps<typeof ReviewTab>['currentMonthReview'];
    recentReviews: React.ComponentProps<typeof ReviewTab>['recentReviews'];
    ratingsTrend: React.ComponentProps<typeof ReviewTab>['ratingsTrend'];
  };
```
Add `insightsData` and `reviewData` to the destructured params of `MobileLayout`.

- [ ] **Step 4: Replace the placeholder tab bodies**

Replace the `tab === 'insights'` block (lines 86-91) with:
```tsx
        {tab === 'insights' && (
          <div style={{ padding: '12px 16px' }}>
            <InsightsTab
              focusDailyTrend={insightsData?.focusDailyTrend}
              financialDailyTrend={insightsData?.financialDailyTrend}
            />
          </div>
        )}
```
Replace the `tab === 'review'` block (lines 93-97) with:
```tsx
        {tab === 'review' && (
          <div style={{ padding: '12px 16px' }}>
            <ReviewTab
              currentMonthReview={reviewData?.currentMonthReview ?? null}
              recentReviews={reviewData?.recentReviews ?? []}
              ratingsTrend={reviewData?.ratingsTrend ?? []}
            />
          </div>
        )}
```

- [ ] **Step 5: Pass the props from page.tsx**

In `page.tsx`, update the `<MobileLayout ... />` call (lines 141-150) to add:
```tsx
        insightsData={{
          focusDailyTrend: focusData?.dailyTrend,
          financialDailyTrend: financialData?.dailyFinancialTrend,
        }}
        reviewData={{
          currentMonthReview: monthlyReviewData?.currentMonthReview ?? null,
          recentReviews: monthlyReviewData?.recentReviews ?? [],
          ratingsTrend: monthlyReviewData?.ratingsTrend ?? [],
        }}
```

- [ ] **Step 6: Run tests, typecheck, lint**

Run: `npm test -- MobileLayout && npx tsc --noEmit && npm run lint`
Expected: PASS, no type errors. (If `InsightsTab`/`ReviewTab` prop types don't expose the helper types via `React.ComponentProps`, fall back to importing their exported prop types or inlining the literal shapes from `page.tsx` lines 437-447.)

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/v2/MobileLayout.tsx src/app/dashboard/page.tsx src/components/dashboard/v2/__tests__/MobileLayout.test.tsx
git commit -m "fix(dashboard-v2): render real Insights/Review tabs on mobile"
```

---

## PHASE 2 — Editable / removable categories

> Backend already has `editSupplement`, `removeSupplement`, `addHabit`, `removeHabit`, `addEnvironmentField`, `removeEnvironmentField`. Only habit/env-field **rename** is missing.

### Task 4: Add `editHabit` + `editEnvironmentField` to tracker and API

**Files:**
- Modify: `src/lib/health-notes-tracker.ts` (after `removeHabit` / `removeEnvironmentField`)
- Modify: `src/app/api/health-notes/route.ts` (`update-templates` switch)
- Create: `src/app/api/health-notes/route.editremove.test.ts`

- [ ] **Step 1: Write the integration test (real tracker, real storage)**

Create `src/app/api/health-notes/route.editremove.test.ts`. Model it on the existing `src/app/api/health-notes/route.test.ts` (same import/setup style — read that file first for the storage/owner setup helpers). Cover: rename a habit, rename an env field, and that renaming a missing item throws/400.
```ts
import { HealthNotesTracker } from '@/lib/health-notes-tracker';

// Use the same owner-scoped storage setup as route.test.ts (copy its
// beforeEach/afterEach that points storage at a temp dir or test owner).
const OWNER = 'test-editremove-owner';

describe('HealthNotesTracker habit/env rename', () => {
  it('renames a habit, preserving order', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await t.addHabit('Cold plunge');
    await t.editHabit('Cold plunge', 'Sauna');
    const tpl = t.getTemplates();
    expect(tpl.habitTemplate.map(h => h.name)).toContain('Sauna');
    expect(tpl.habitTemplate.map(h => h.name)).not.toContain('Cold plunge');
  });

  it('throws when renaming a missing habit', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await expect(t.editHabit('Nope', 'X')).rejects.toThrow(/not found/i);
  });

  it('renames an environment field', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await t.addEnvironmentField('Blackout curtains');
    await t.editEnvironmentField('Blackout curtains', 'Eye mask');
    expect(t.getTemplates().environmentTemplate.customFieldNames).toContain('Eye mask');
  });
});
```
> Per AGENTS.md rule 10: do NOT skip if storage env is unset — copy whatever explicit setup `route.test.ts` uses and fail loudly if a required var is missing.

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- route.editremove`
Expected: FAIL — `editHabit` / `editEnvironmentField` not a function.

- [ ] **Step 3: Add `editHabit` to the tracker**

In `health-notes-tracker.ts`, after `removeHabit` (line 170) add:
```ts
  async editHabit(originalName: string, newName: string): Promise<void> {
    const idx = this.data.habitTemplate.findIndex(h => h.name === originalName);
    if (idx === -1) {
      throw new Error(`Habit "${originalName}" not found`);
    }
    const newNameLower = newName.toLowerCase();
    const hasDuplicate = this.data.habitTemplate.some(
      (h, i) => i !== idx && h.name.toLowerCase() === newNameLower,
    );
    if (hasDuplicate) {
      throw new Error(`Habit "${newName}" already exists`);
    }
    this.data.habitTemplate[idx] = { name: newName };
    await this.saveData();
  }
```

- [ ] **Step 4: Add `editEnvironmentField` to the tracker**

After `removeEnvironmentField` (line 183) add:
```ts
  async editEnvironmentField(originalName: string, newName: string): Promise<void> {
    const fields = this.data.environmentTemplate.customFieldNames;
    const idx = fields.findIndex(f => f === originalName);
    if (idx === -1) {
      throw new Error(`Environment field "${originalName}" not found`);
    }
    const newNameLower = newName.toLowerCase();
    const hasDuplicate = fields.some((f, i) => i !== idx && f.toLowerCase() === newNameLower);
    if (hasDuplicate) {
      throw new Error(`Environment field "${newName}" already exists`);
    }
    fields[idx] = newName;
    await this.saveData();
  }
```

- [ ] **Step 5: Add API operations**

In `route.ts`, inside the `update-templates` switch (after the `editSupplement` case, ~line 175), add two cases:
```ts
          case 'editHabit': {
            const { newName } = data;
            if (typeof newName !== 'string' || newName.trim().length === 0) {
              return NextResponse.json(
                { success: false, error: 'newName must be a non-empty string' },
                { status: 400 }
              );
            }
            try {
              await tracker.editHabit(name, newName.trim());
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to edit habit';
              return NextResponse.json({ success: false, error: message }, { status: 400 });
            }
            console.log('Health note template updated:', { operation: 'editHabit', name });
            break;
          }
          case 'editEnvironmentField': {
            const { newName } = data;
            if (typeof newName !== 'string' || newName.trim().length === 0) {
              return NextResponse.json(
                { success: false, error: 'newName must be a non-empty string' },
                { status: 400 }
              );
            }
            try {
              await tracker.editEnvironmentField(name, newName.trim());
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to edit environment field';
              return NextResponse.json({ success: false, error: message }, { status: 400 });
            }
            console.log('Health note template updated:', { operation: 'editEnvironmentField', name });
            break;
          }
```

- [ ] **Step 6: Run the test to verify pass**

Run: `npm test -- route.editremove`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint, commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
git add src/lib/health-notes-tracker.ts src/app/api/health-notes/route.ts src/app/api/health-notes/route.editremove.test.ts
git commit -m "feat(health-notes): add editHabit + editEnvironmentField (rename)"
```

---

### Task 5: Edit/remove UI in the Morning Log drawer

**Files:**
- Create: `src/components/dashboard/v2/EditableItemList.tsx`
- Modify: `src/components/dashboard/v2/MorningLogDrawer.tsx` (Supplements/Habits/Environment sections)

The drawer already calls `updateTemplate(operation, name, defaultDosageMg?, extra?)` from `useHealthData`. Removal and rename just call it with the right operation; `extra` carries `{ newName, newDosageMg }`.

- [ ] **Step 1: Write a test for EditableItemList**

Create `src/components/dashboard/v2/__tests__/EditableItemList.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableItemControls } from '../EditableItemList';

it('calls onRemove with the item name', async () => {
  const onRemove = jest.fn();
  render(<EditableItemControls name="Adderall" onRemove={onRemove} onRename={jest.fn()} testIdBase="supp" idx={0} />);
  await userEvent.click(screen.getByTestId('supp-remove-0'));
  expect(onRemove).toHaveBeenCalledWith('Adderall');
});

it('enters edit mode and calls onRename with the new value', async () => {
  const onRename = jest.fn();
  render(<EditableItemControls name="Adderall" onRemove={jest.fn()} onRename={onRename} testIdBase="supp" idx={0} />);
  await userEvent.click(screen.getByTestId('supp-edit-0'));
  const input = screen.getByTestId('supp-edit-input-0');
  await userEvent.clear(input);
  await userEvent.type(input, 'Adderall XR');
  await userEvent.click(screen.getByTestId('supp-edit-save-0'));
  expect(onRename).toHaveBeenCalledWith('Adderall', 'Adderall XR');
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- EditableItemList`
Expected: FAIL — module not found.

- [ ] **Step 3: Create EditableItemList.tsx**

```tsx
'use client';

import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';

// Small inline edit/remove controls for a template item (supplement, habit,
// or environment field). View-only by default; clicking the pencil reveals
// an inline text input. Rename calls onRename(originalName, newName).
export function EditableItemControls({
  name,
  onRemove,
  onRename,
  testIdBase,
  idx,
}: {
  name: string;
  onRemove: (name: string) => void;
  onRename: (originalName: string, newName: string) => void;
  testIdBase: string;
  idx: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const iconBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-mc-fg-muted)',
    cursor: 'pointer',
    padding: 2,
    lineHeight: 0,
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          data-testid={`${testIdBase}-edit-input-${idx}`}
          style={{
            width: 110,
            padding: '2px 6px',
            fontSize: 12,
            fontFamily: 'inherit',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            background: 'var(--color-mc-bg-warm)',
            color: 'var(--color-mc-ink)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          style={iconBtn}
          aria-label={`Save ${name}`}
          data-testid={`${testIdBase}-edit-save-${idx}`}
          onClick={() => {
            const next = draft.trim();
            if (next && next !== name) onRename(name, next);
            setEditing(false);
          }}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          style={iconBtn}
          aria-label={`Cancel editing ${name}`}
          data-testid={`${testIdBase}-edit-cancel-${idx}`}
          onClick={() => {
            setDraft(name);
            setEditing(false);
          }}
        >
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        style={iconBtn}
        aria-label={`Edit ${name}`}
        data-testid={`${testIdBase}-edit-${idx}`}
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        style={iconBtn}
        aria-label={`Remove ${name}`}
        data-testid={`${testIdBase}-remove-${idx}`}
        onClick={() => onRemove(name)}
      >
        <Trash2 size={13} />
      </button>
    </span>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- EditableItemList`
Expected: PASS.

- [ ] **Step 5: Wire into the Supplements section**

In `MorningLogDrawer.tsx`, import the control near the top:
```tsx
import { EditableItemControls } from './EditableItemList';
```
Locate where `updateTemplate` is obtained from `useHealthData()` in this component (search `updateTemplate`). Add handlers near the existing `handleAddSupplement`/`handleAddHabit`:
```tsx
  const handleRemoveSupplement = useCallback((name: string) => {
    void updateTemplate('removeSupplement', name);
  }, [updateTemplate]);
  const handleRenameSupplement = useCallback((originalName: string, newName: string) => {
    // Keep the existing dosage: find it from current supplement state.
    const current = supplements.find((s) => s.name === originalName);
    void updateTemplate('editSupplement', originalName, undefined, {
      newName,
      newDosageMg: current?.dosageMg && current.dosageMg > 0 ? current.dosageMg : 1,
    });
  }, [updateTemplate, supplements]);
  const handleRemoveHabit = useCallback((name: string) => {
    void updateTemplate('removeHabit', name);
  }, [updateTemplate]);
  const handleRenameHabit = useCallback((originalName: string, newName: string) => {
    void updateTemplate('editHabit', originalName, undefined, { newName });
  }, [updateTemplate]);
  const handleRemoveEnvField = useCallback((name: string) => {
    void updateTemplate('removeEnvironmentField', name);
  }, [updateTemplate]);
  const handleRenameEnvField = useCallback((originalName: string, newName: string) => {
    void updateTemplate('editEnvironmentField', originalName, undefined, { newName });
  }, [updateTemplate]);
```
> Note: `editSupplement` requires a positive `newDosageMg` (route validation). The rename control only changes the name, so we re-send the item's current dosage (falling back to `1`). Renaming an env field that's currently toggled in the form is a template-only change; the form's `customFields` keyed by the old name remain until the form is rebuilt from templates on next open — acceptable since edit happens out of the active form per the spec.

In the Supplements section (line 622-664), add the controls to each row. After the `<span>{supp.name}</span>` block, before the dosage `<input>`, insert:
```tsx
              <EditableItemControls
                name={supp.name}
                idx={idx}
                testIdBase="supp"
                onRemove={handleRemoveSupplement}
                onRename={handleRenameSupplement}
              />
```

- [ ] **Step 6: Wire into Habits and Environment sections**

In the Habits section (line 689-707), after the `<span>{habit.name}</span>`, insert:
```tsx
              <EditableItemControls
                name={habit.name}
                idx={idx}
                testIdBase="habit"
                onRemove={handleRemoveHabit}
                onRename={handleRenameHabit}
              />
```
For the Sleep Environment custom fields: find where `customFieldNames` are rendered (search `customFieldNames` / `customFields` in this file, around lines 572-619). For each custom field row, add:
```tsx
              <EditableItemControls
                name={fieldName}
                idx={idx}
                testIdBase="env"
                onRemove={handleRemoveEnvField}
                onRename={handleRenameEnvField}
              />
```
(Use the field name and index from that section's existing map.)

- [ ] **Step 7: Typecheck, lint, run drawer-related tests**

Run: `npx tsc --noEmit && npm run lint && npm test -- EditableItemList`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/v2/EditableItemList.tsx src/components/dashboard/v2/__tests__/EditableItemList.test.tsx src/components/dashboard/v2/MorningLogDrawer.tsx
git commit -m "feat(dashboard-v2): edit/remove supplements, habits, env fields in Morning Log"
```

---

## PHASE 3 — Unified feed + tap-for-detail

### Task 6: Extend `ActivityEntry` and add morning/reflection derivers

**Files:**
- Modify: `src/components/dashboard/v2/types.ts` (`ActivityEntry`)
- Modify: `src/components/dashboard/v2/derive.ts` (mappers + `deriveActivity`)
- Modify: `src/components/dashboard/v2/__tests__/derive.test.ts`

- [ ] **Step 1: Extend the ActivityEntry type**

In `types.ts`, replace the `ActivityEntry` type (lines 28-40) with:
```ts
export type ActivitySource = 'money' | 'focus' | 'morning' | 'reflection';

export type ActivityEntry = {
  id: string;
  t: string;        // 'HH:mm' — for display only
  // Full epoch-ms timestamp used by deriveActivity to sort newest-first
  // across day boundaries. Optional for back-compat with hand-built test
  // fixtures; missing/0 sorts to the bottom deterministically (insertion
  // order preserved among ties).
  tsMs?: number;
  kind: MetricId | 'money' | 'cash' | 'deepwork';
  delta: string;    // '+1h', '+ Generated', 'sync', or '' for summary cards
  label: string;
  meta: string;
  // Discriminates the entry's origin so the detail sheet knows how to
  // resolve the full record. Optional for back-compat with existing
  // fixtures and optimistic rows.
  source?: ActivitySource;
  // Lookup key for the detail sheet: YYYY-MM-DD for morning/reflection,
  // the underlying entry id for money/focus.
  refKey?: string;
};
```

- [ ] **Step 2: Write failing unit tests for the new mappers**

In `__tests__/derive.test.ts` add (import `deriveActivity` is already there; add `morningToActivity, reflectionToActivity` to the import):
```ts
import { deriveActivity, morningToActivity, reflectionToActivity } from '../derive';

describe('morningToActivity', () => {
  it('summarizes a morning log into one entry', () => {
    const e = morningToActivity({
      date: '2026-06-05',
      sleepEnvironment: { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
      sleepMetrics: { sleepScore: 87, durationMinutes: 442, bodyBattery: 95, restingHeartRate: 50, hrv: 40 },
      supplements: [{ name: 'A', dosageMg: 1, taken: true }, { name: 'B', dosageMg: 2, taken: false }],
      habits: [{ name: 'H1', done: true }, { name: 'H2', done: true }],
      freeformNote: '',
      loggedAt: '2026-06-05T08:14:00.000Z',
    });
    expect(e.source).toBe('morning');
    expect(e.refKey).toBe('2026-06-05');
    expect(e.label).toBe('Morning Log');
    expect(e.meta).toContain('87');
    expect(e.meta).toContain('7h22m');
    expect(e.meta).toContain('1 supplement'); // only "taken" counted
    expect(e.meta).toContain('2 habits');
  });
});

describe('reflectionToActivity', () => {
  it('summarizes a reflection into one entry', () => {
    const e = reflectionToActivity({
      date: '2026-06-05',
      questions: ['q1', 'q2', 'q3'],
      answers: [
        { id: '1', date: '2026-06-05', question: 'q1', answer: 'a', answeredAt: '2026-06-05T21:30:00.000Z' },
        { id: '2', date: '2026-06-05', question: 'q2', answer: '', answeredAt: '2026-06-05T21:30:00.000Z' },
      ],
    });
    expect(e.source).toBe('reflection');
    expect(e.refKey).toBe('2026-06-05');
    expect(e.label).toBe('Reflection');
    expect(e.meta).toBe('1 of 3 answered');
  });
});

describe('deriveActivity with morning + reflection', () => {
  it('includes morning and reflection entries in the merged feed', () => {
    const out = deriveActivity({
      morning: [{
        date: '2026-06-05',
        sleepEnvironment: { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
        sleepMetrics: { sleepScore: 80, durationMinutes: 420, bodyBattery: null, restingHeartRate: null, hrv: null },
        supplements: [], habits: [], freeformNote: '', loggedAt: '2026-06-05T08:00:00.000Z',
      }],
      reflection: [{
        date: '2026-06-05', questions: ['q1'], answers: [{ id: '1', date: '2026-06-05', question: 'q1', answer: 'x', answeredAt: '2026-06-05T21:00:00.000Z' }],
      }],
    });
    expect(out.some(e => e.source === 'morning')).toBe(true);
    expect(out.some(e => e.source === 'reflection')).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npm test -- derive`
Expected: FAIL — `morningToActivity` / `reflectionToActivity` not exported.

- [ ] **Step 4: Add the mappers + source/refKey to existing mappers in derive.ts**

In `derive.ts`, add the type import at the top:
```ts
import type { ActivityEntry, MetricId } from './types';
import type { DailyHealthNote, ThreeToThriveEntry } from '@/lib/types';
```
Update `focusToActivity` and `financialToActivity` to set `source` and `refKey`. In `focusToActivity`'s returned object add:
```ts
    source: 'focus',
    refKey: s.id ?? `focus-${s.timestamp ?? ''}`,
```
In `financialToActivity`'s returned object add:
```ts
    source: 'money',
    refKey: e.id ?? `fin-${e.timestamp ?? ''}`,
```
Add a duration formatter and the two new mappers (place above `deriveActivity`):
```ts
function fmtDuration(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0h0m';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h${m}m`;
}

function pluralize(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

export function morningToActivity(note: DailyHealthNote): ActivityEntry {
  const sm = note.sleepMetrics;
  const score = sm?.sleepScore;
  const takenSupps = note.supplements.filter((s) => s.taken).length;
  const doneHabits = note.habits.filter((h) => h.done).length;
  const parts: string[] = [];
  if (score != null) parts.push(`Sleep ${score}`);
  parts.push(fmtDuration(sm?.durationMinutes));
  parts.push(pluralize(takenSupps, 'supplement'));
  parts.push(pluralize(doneHabits, 'habit'));
  const tsMs = parseTimestampMs(note.loggedAt) || parseTimestampMs(`${note.date}T08:00:00`);
  return {
    id: `morning-${note.date}`,
    t: hhmm(note.loggedAt) === '--:--' ? '08:00' : hhmm(note.loggedAt),
    tsMs,
    kind: 'deepwork',
    delta: '',
    label: 'Morning Log',
    meta: parts.join(' · '),
    source: 'morning',
    refKey: note.date,
  };
}

export function reflectionToActivity(entry: ThreeToThriveEntry): ActivityEntry {
  const total = entry.questions.length;
  const answered = entry.answers.filter((a) => a.answer.trim().length > 0).length;
  const lastAt = entry.answers
    .map((a) => parseTimestampMs(a.answeredAt))
    .reduce((max, t) => (t > max ? t : max), 0);
  const tsMs = lastAt || parseTimestampMs(`${entry.date}T21:00:00`);
  return {
    id: `reflection-${entry.date}`,
    t: hhmm(lastAt ? new Date(lastAt).toISOString() : `${entry.date}T21:00:00`),
    tsMs,
    kind: 'temporal',
    delta: '',
    label: 'Reflection',
    meta: `${answered} of ${total} answered`,
    source: 'reflection',
    refKey: entry.date,
  };
}
```

- [ ] **Step 5: Extend `deriveActivity` to accept and merge the new sources**

Change the `deriveActivity` signature and merge. Update the options type and body:
```ts
export function deriveActivity(opts: {
  focus?: FocusSessionLike[];
  financial?: FinancialEntryLike[];
  morning?: DailyHealthNote[];
  reflection?: ThreeToThriveEntry[];
  optimistic?: ActivityEntry[];
  limit?: number;
}): ActivityEntry[] {
  const { focus = [], financial = [], morning = [], reflection = [], optimistic = [], limit = 25 } = opts;
  const liveFocus = focus.filter((s) => !isE2EDescription(s.description));
  const liveFinancial = financial.filter((e) => !isE2EDescription(e.description));
  // Morning/reflection have no free-text "description" that e2e seeds use,
  // so they need no E2E filter; their freeform note is not used as a key.
  const merged: ActivityEntry[] = [
    ...optimistic,
    ...liveFocus.map(focusToActivity),
    ...liveFinancial.map(financialToActivity),
    ...morning.map(morningToActivity),
    ...reflection.map(reflectionToActivity),
  ];
  // ...unchanged dedup + sort + slice below...
```
Leave the dedup/sort/slice block (lines 108-130) exactly as-is.

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test -- derive`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint, commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
git add src/components/dashboard/v2/types.ts src/components/dashboard/v2/derive.ts src/components/dashboard/v2/__tests__/derive.test.ts
git commit -m "feat(dashboard-v2): derive morning-log + reflection entries into activity feed"
```

---

### Task 7: Feed morning + reflection into the page & mobile feeds

**Files:**
- Modify: `src/app/dashboard/page.tsx` (add `useHealthData`, extend `deriveActivity` call)

- [ ] **Step 1: Import the health-data hook**

In `page.tsx` add near the other imports:
```tsx
import { useHealthData } from '@/hooks/useHealthData';
```

- [ ] **Step 2: Read notes + reflections and pass them to deriveActivity**

After `const store = useMissionStore();` (line 35) add:
```tsx
  const health = useHealthData();
```
Replace the `activity` memo (lines 85-92) with:
```tsx
  const activity = useMemo(() => {
    return deriveActivity({
      focus: focusData?.recentSessions,
      financial: financialData?.recentEntries,
      morning: Object.values(health.notes ?? {}),
      reflection: Object.values(store.threeToThrive?.entries ?? {}),
      optimistic: store.activity,
      limit: 25,
    });
  }, [focusData, financialData, health.notes, store.threeToThrive, store.activity]);
```

- [ ] **Step 3: Typecheck, lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`store.threeToThrive` is `ThreeToThriveData | undefined`; `.entries` is `Record<string, ThreeToThriveEntry>`.)

- [ ] **Step 4: Manual smoke (dev server)**

Run: `npm run dev` then open `http://localhost:3000/dashboard`. Log a morning entry via the Morning drawer; confirm a "Morning Log" summary card appears in the Activity feed (desktop right column and mobile recent list). Save a reflection; confirm a "Reflection" card appears.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard-v2): show morning log + reflections in the unified activity feed"
```

---

### Task 8: Read-only detail sheet + tap-to-open

**Files:**
- Create: `src/components/dashboard/v2/ActivityDetailSheet.tsx`
- Create: `src/components/dashboard/v2/__tests__/ActivityDetailSheet.test.tsx`
- Modify: `src/components/dashboard/v2/ActivityFeed.tsx` (clickable rows)
- Modify: `src/components/dashboard/v2/MobileLayout.tsx` (clickable rows + render sheet)
- Modify: `src/app/dashboard/page.tsx` (detail state, resolve record, render sheet)

The sheet is "dumb": it receives a fully-resolved, typed `detail` object. The page resolves it by `source` + `refKey` from data it already holds (single source of truth = data hooks).

- [ ] **Step 1: Define the detail payload type + write a test**

Create `src/components/dashboard/v2/__tests__/ActivityDetailSheet.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { ActivityDetailSheet } from '../ActivityDetailSheet';

it('renders morning detail with full sleep info', () => {
  render(
    <ActivityDetailSheet
      open
      onOpenChange={() => {}}
      detail={{
        source: 'morning',
        title: 'Morning Log · Jun 5, 2026',
        note: {
          date: '2026-06-05',
          sleepEnvironment: { temperatureF: 67, fanRunning: true, dogInRoom: false, customFields: {} },
          sleepMetrics: { sleepScore: 87, durationMinutes: 442, bodyBattery: 95, restingHeartRate: 50, hrv: 40 },
          supplements: [{ name: 'Adderall', dosageMg: 20, taken: true }],
          habits: [{ name: 'Red light', done: true }],
          freeformNote: 'slept well',
          loggedAt: '2026-06-05T08:14:00.000Z',
        },
      }}
      onEdit={() => {}}
    />,
  );
  expect(screen.getByText('87')).toBeInTheDocument();
  expect(screen.getByText(/Adderall/)).toBeInTheDocument();
  expect(screen.getByText(/slept well/)).toBeInTheDocument();
});

it('renders an empty fallback when the record is missing', () => {
  render(
    <ActivityDetailSheet
      open
      onOpenChange={() => {}}
      detail={{ source: 'morning', title: 'Morning Log', note: null }}
      onEdit={() => {}}
    />,
  );
  expect(screen.getByText(/no data/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- ActivityDetailSheet`
Expected: FAIL — module not found.

- [ ] **Step 3: Create ActivityDetailSheet.tsx**

```tsx
'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { DailyHealthNote, ThreeToThriveEntry } from '@/lib/types';

// Detail payloads — discriminated by source. The page resolves these from
// its data hooks (lookup-by-reference) and hands a fully-formed object here.
export type ActivityDetail =
  | { source: 'morning'; title: string; note: DailyHealthNote | null }
  | { source: 'reflection'; title: string; entry: ThreeToThriveEntry | null }
  | { source: 'money'; title: string; amount: number; category: string; note: string; when: string }
  | { source: 'focus'; title: string; category: string; hours: number; description: string; when: string };

function fmtDuration(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return '—';
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between" style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-mc-ink)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Body({ detail }: { detail: ActivityDetail }) {
  if (detail.source === 'morning') {
    const n = detail.note;
    if (!n) return <p style={{ fontSize: 13, color: 'var(--color-mc-fg-muted)' }}>No data for this entry.</p>;
    const sm = n.sleepMetrics;
    return (
      <div>
        <Row label="Sleep score" value={sm?.sleepScore ?? '—'} />
        <Row label="Duration" value={fmtDuration(sm?.durationMinutes)} />
        <Row label="Body battery" value={sm?.bodyBattery ?? '—'} />
        <Row label="Resting HR" value={sm?.restingHeartRate ?? '—'} />
        <Row label="HRV" value={sm?.hrv ?? '—'} />
        <Row label="Temperature" value={n.sleepEnvironment.temperatureF != null ? `${n.sleepEnvironment.temperatureF}°F` : '—'} />
        <Row label="Fan" value={n.sleepEnvironment.fanRunning ? 'On' : 'Off'} />
        <Row label="Dog in room" value={n.sleepEnvironment.dogInRoom ? 'Yes' : 'No'} />
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>Supplements</div>
        {n.supplements.length === 0 && <div style={{ fontSize: 13 }}>—</div>}
        {n.supplements.map((s) => (
          <Row key={s.name} label={s.name} value={s.taken ? `${s.dosageMg}mg ✓` : 'skipped'} />
        ))}
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>Habits</div>
        {n.habits.length === 0 && <div style={{ fontSize: 13 }}>—</div>}
        {n.habits.map((h) => (
          <Row key={h.name} label={h.name} value={h.done ? '✓' : '✗'} />
        ))}
        {n.freeformNote.trim() && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-mc-ink)' }}>{n.freeformNote}</p>
        )}
      </div>
    );
  }
  if (detail.source === 'reflection') {
    const e = detail.entry;
    if (!e) return <p style={{ fontSize: 13, color: 'var(--color-mc-fg-muted)' }}>No data for this entry.</p>;
    return (
      <div>
        {e.questions.map((q) => {
          const ans = e.answers.find((a) => a.question === q);
          return (
            <div key={q} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>{q}</div>
              <div style={{ fontSize: 13, color: 'var(--color-mc-ink)', marginTop: 2 }}>{ans?.answer?.trim() || '—'}</div>
            </div>
          );
        })}
      </div>
    );
  }
  if (detail.source === 'money') {
    return (
      <div>
        <Row label="Amount" value={`$${detail.amount.toLocaleString()}`} />
        <Row label="Category" value={detail.category} />
        <Row label="When" value={detail.when} />
        {detail.note && <p style={{ marginTop: 12, fontSize: 13 }}>{detail.note}</p>}
      </div>
    );
  }
  // focus
  return (
    <div>
      <Row label="Category" value={detail.category} />
      <Row label="Hours" value={`${detail.hours}h`} />
      <Row label="When" value={detail.when} />
      {detail.description && <p style={{ marginTop: 12, fontSize: 13 }}>{detail.description}</p>}
    </div>
  );
}

export function ActivityDetailSheet({
  open,
  onOpenChange,
  detail,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ActivityDetail | null;
  onEdit?: (detail: ActivityDetail) => void;
}) {
  const canEdit = !!detail && (detail.source === 'morning' || detail.source === 'reflection');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />
        <Dialog.Content
          data-testid="activity-detail-sheet"
          style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)', zIndex: 41,
            background: 'var(--color-mc-bg)', borderLeft: '1px solid rgba(255,255,255,0.1)',
            padding: '18px 18px 24px', overflowY: 'auto', color: 'var(--color-mc-fg)',
            fontFamily: 'var(--font-mc-sans)',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-mc-ink)' }}>
              {detail?.title ?? 'Detail'}
            </Dialog.Title>
            <Dialog.Close aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--color-mc-fg-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Read-only details for the selected activity entry.
          </Dialog.Description>
          {detail && <Body detail={detail} />}
          {canEdit && onEdit && detail && (
            <button
              type="button"
              data-testid="activity-detail-edit"
              onClick={() => onEdit(detail)}
              style={{
                marginTop: 18, padding: '8px 14px', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                background: 'rgba(124,124,255,0.14)', color: 'var(--color-mc-uv-hi)',
                border: '1px solid rgba(124,124,255,0.33)', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- ActivityDetailSheet`
Expected: PASS.

- [ ] **Step 5: Make ActivityFeed rows clickable**

In `ActivityFeed.tsx`, thread an `onOpenDetail` prop. Change the component signature to:
```tsx
export function ActivityFeed({ entries, onOpenDetail }: { entries: ActivityEntry[]; onOpenDetail?: (entry: ActivityEntry) => void }) {
```
Pass it down in the map: `<ActivityRow key={entry.id} entry={entry} onOpenDetail={onOpenDetail} />`. Change `ActivityRow` to accept `onOpenDetail` and wrap the row in a button-like clickable container:
```tsx
function ActivityRow({ entry, onOpenDetail }: { entry: ActivityEntry; onOpenDetail?: (entry: ActivityEntry) => void }) {
  const isPositive = entry.delta.startsWith('+');
  const clickable = !!onOpenDetail;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpenDetail!(entry) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail!(entry); } } : undefined}
      data-testid={`activity-row-${entry.id}`}
      className="flex items-start gap-2.5"
      style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', cursor: clickable ? 'pointer' : 'default' }}
    >
      {/* ...unchanged inner markup (time / delta / label / meta)... */}
    </div>
  );
}
```
(Keep the existing inner spans exactly; only the wrapper attributes change.)

- [ ] **Step 6: Add detail state + resolver + sheet in page.tsx**

In `page.tsx` add imports:
```tsx
import { ActivityDetailSheet, type ActivityDetail } from '@/components/dashboard/v2/ActivityDetailSheet';
import type { ActivityEntry } from '@/components/dashboard/v2/types';
```
Add state near the other `useState`s (line 38-42):
```tsx
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
```
Add a resolver that maps a clicked entry → detail payload, using data the page already holds:
```tsx
  const fmtWhen = (ms?: number) => (ms ? new Date(ms).toLocaleString() : '');

  const openDetail = useCallback((entry: ActivityEntry) => {
    let resolved: ActivityDetail | null = null;
    if (entry.source === 'morning') {
      resolved = {
        source: 'morning',
        title: `Morning Log · ${entry.refKey ?? ''}`,
        note: health.notes?.[entry.refKey ?? ''] ?? null,
      };
    } else if (entry.source === 'reflection') {
      resolved = {
        source: 'reflection',
        title: `Reflection · ${entry.refKey ?? ''}`,
        entry: store.threeToThrive?.entries?.[entry.refKey ?? ''] ?? null,
      };
    } else if (entry.source === 'money') {
      const fin = financialData?.recentEntries?.find((e) => e.id === entry.refKey);
      resolved = {
        source: 'money',
        title: 'Money entry',
        amount: fin?.amount ?? 0,
        category: fin?.category ?? 'moved',
        note: fin?.description ?? '',
        when: fmtWhen(entry.tsMs),
      };
    } else if (entry.source === 'focus') {
      const f = focusData?.recentSessions?.find((s) => s.id === entry.refKey);
      resolved = {
        source: 'focus',
        title: 'Focus session',
        category: f?.category ?? 'Focus',
        hours: f?.hours ?? 0,
        description: f?.description ?? '',
        when: fmtWhen(entry.tsMs),
      };
    }
    setDetail(resolved);
    setDetailOpen(true);
  }, [health.notes, store.threeToThrive, financialData, focusData]);
```
Wire `onOpenDetail={openDetail}` into the desktop `<ActivityFeed entries={activity} />` (line 431).

Render the sheet alongside the other overlays (after `<MorningLogDrawer ... />`, line 487):
```tsx
    <ActivityDetailSheet
      open={detailOpen}
      onOpenChange={setDetailOpen}
      detail={detail}
      onEdit={(d) => {
        setDetailOpen(false);
        if (d.source === 'morning') setMorningOpen(true);
        else if (d.source === 'reflection') setReflectOpen(true);
      }}
    />
```

- [ ] **Step 7: Wire mobile RecentActivity rows + sheet**

In `MobileLayout.tsx`, add an `onOpenDetail?: (entry: ActivityEntry) => void` prop to `Props` and to `RecentActivity`. Make each rendered activity row in `RecentActivity` clickable (same `role="button"` / `onClick` / `data-testid={`activity-row-${entry.id}`}` pattern as Task 8 Step 5). Pass `onOpenDetail` from `page.tsx`'s `MobileLayout` call (reuse `openDetail`). Because the sheet is a Radix portal, render a single `ActivityDetailSheet` in `page.tsx` (already done in Step 6) — it covers both layouts; do not add a second one inside `MobileLayout`.

Add `onOpenDetail={openDetail}` to the `<MobileLayout ... />` props in `page.tsx`.

- [ ] **Step 8: Typecheck, lint, run unit tests**

Run: `npx tsc --noEmit && npm run lint && npm test -- ActivityDetailSheet ActivityFeed`
Expected: PASS, no type errors.

- [ ] **Step 9: Manual smoke**

Run: `npm run dev`, open `/dashboard`. Click a Morning Log card → detail sheet shows full sleep metrics + supplements + habits + note. Click "Edit" → Morning drawer opens. Click a money row → money detail. Repeat on a narrow viewport (mobile).

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/v2/ActivityDetailSheet.tsx src/components/dashboard/v2/__tests__/ActivityDetailSheet.test.tsx src/components/dashboard/v2/ActivityFeed.tsx src/components/dashboard/v2/MobileLayout.tsx src/app/dashboard/page.tsx
git commit -m "feat(dashboard-v2): tap any activity entry for a read-only detail sheet"
```

---

## PHASE 4 — End-to-end coverage

### Task 9: Playwright E2E for the new flows

**Files:**
- Modify: `tests/e2e/morning-log.spec.ts` (extend) and/or `tests/e2e/dashboard-v2.spec.ts`

> Read `tests/e2e/morning-log.spec.ts` and `tests/e2e/dashboard.README.md` first for the auth/setup fixtures, the test-data cleanup convention, and the `data-testid` selectors already in use. Reuse the existing login/storage-state setup — do NOT skip when env is unset; fail with a clear message naming the missing var (AGENTS.md rule 10).

- [ ] **Step 1: Add the five required E2E specs**

Add tests covering (use real interactions, assert real effects — never visibility-only):
1. **Morning log → feed → detail:** open Morning drawer, fill sleep score + duration, save; assert a row with text "Morning Log" appears in the activity feed; click it; assert the detail sheet (`activity-detail-sheet`) shows the entered sleep score.
2. **Reflection in feed:** open reflection, answer one question, save; assert a "Reflection" row appears in the feed.
3. **Mobile Insights & Review render:** set a mobile viewport (`page.setViewportSize({ width: 390, height: 844 })`); tap the Insights bottom-nav item; assert the placeholder copy `/open the Insights tab in the bottom nav/i` is NOT present and an InsightsTab element IS; repeat for Review.
4. **Edit + remove a supplement persists:** open Morning drawer, add supplement "TestMag" (cleanup-friendly name), rename it via `supp-edit-*`, save; reload; assert the renamed supplement is present. Then remove it via `supp-remove-*`; reload; assert it's gone.
5. **Call/Demo gone, Train works:** assert `mobile-quick-call` and `mobile-quick-demo` are absent; tap `mobile-quick-train`; assert the trained metric increments (poll the metric card / snapshot value, matching how `weekly-tracker-quick-add.spec.ts` asserts effects).

Skeleton (adapt selectors/fixtures to the existing spec):
```ts
import { test, expect } from '@playwright/test';

test.describe('Unified activity log', () => {
  test('morning log appears in feed and opens a detail sheet', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('morning-log-trigger').click();
    // fill sleep score + duration using the drawer's existing inputs, then save
    // ...
    await expect(page.getByText('Morning Log')).toBeVisible();
    await page.getByText('Morning Log').first().click();
    await expect(page.getByTestId('activity-detail-sheet')).toBeVisible();
  });

  test('mobile quick log has no Call/Demo and Train logs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await expect(page.getByTestId('mobile-quick-call')).toHaveCount(0);
    await expect(page.getByTestId('mobile-quick-demo')).toHaveCount(0);
    await page.getByTestId('mobile-quick-train').click();
    // assert trained metric increment as weekly-tracker-quick-add.spec.ts does
  });

  // ... reflection, mobile tabs, supplement edit/remove ...
});
```

- [ ] **Step 2: Run the E2E suite against a local server**

Run: `npm run test:e2e:playwright -- morning-log dashboard-v2`
Expected: PASS (Playwright config already starts a local Next.js server — confirm in `playwright.config.ts`). Re-run flaky failures once per the known dashboard-v2 flake note before investigating.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/morning-log.spec.ts tests/e2e/dashboard-v2.spec.ts
git commit -m "test(e2e): unified activity feed, detail sheet, mobile tabs, edit/remove, Train"
```

---

## Final verification (before PR)

- [ ] **Full unit suite + coverage:** `npm run test:coverage` — all green; note coverage delta for the PR.
- [ ] **Typecheck + lint:** `npx tsc --noEmit && npm run lint` — clean.
- [ ] **Full E2E:** `npm run test:e2e:playwright` — green (re-run known flakes once).
- [ ] **Build:** `npm run build` — succeeds.
- [ ] **PR:** push `feat/unified-activity-log`, open a PR, paste the mandatory v2 PR checklist block from AGENTS.md (all `[x]`), include behavior-first summary, user-flow coverage (happy + failure paths), evidence (screenshots/recording of the feed + detail sheet + mobile tabs), architecture review, edge cases, monitoring/logging notes. Then monitor CI + CodeRabbit/Copilot and resolve feedback until green.

---

## Self-Review notes (author)

- **Spec coverage:** §1 unified feed → Tasks 6-7. §2 tap detail → Task 8. §3 editable categories → Tasks 4-5 (backend add/remove already existed; only rename added). §4 icon → Task 1. §5 Call/Demo removal everywhere → Task 2. §6 mobile Insights/Review → Task 3. Reflection-in-feed → Tasks 6-7. Testing/monitoring/logging → Tasks 4 & 9 + Final verification. All spec sections map to a task.
- **Type consistency:** `morningToActivity`/`reflectionToActivity` names, `ActivityDetail` discriminated union, `source`/`refKey` fields, and `updateTemplate(operation, name, defaultDosageMg?, extra?)` signature are used identically across tasks.
- **Lookup-by-reference:** entries stay lean (`source`+`refKey`); the page resolves full records from `health.notes`, `store.threeToThrive.entries`, `financialData.recentEntries`, `focusData.recentSessions` — single source of truth, per the approved spec.
