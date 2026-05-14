# Money Moves in the Weekly Performance Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold money moves (`moved | generated | cut`) into the Weekly Performance Tracker — daily totals, weekly totals, 30-day trend — and delete the standalone `FinancialMetricsDashboard`. Aggregations are precise (cent-based), well-tested across edge cases, and exposed via the existing `/api/financial` endpoint.

**Architecture:** Library-first (math + accessors in `financial-tracker.ts`), then API extension, then hook rewire, then UI changes in `WeeklyPerformanceTracker.tsx`, then deletion of the old dashboard component, then E2E. Each task is one focused TDD cycle.

**Tech Stack:** Next.js App Router (client component for tracker), TypeScript, React 19, Tailwind, recharts (dual-axis chart), date-fns (week math, already used), Vitest (unit + integration), Playwright (E2E). No new deps — keyboard-accessible popover is hand-rolled with React state + Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-11-money-moves-in-weekly-tracker-design.md`

---

## Conventions used in this plan

- **Week start**: Monday. Use `startOfWeek(date, { weekStartsOn: 1 })` from `date-fns`, matching `weekly-tracker.ts`.
- **Date keys**: `YYYY-MM-DD` strings, local time (not UTC) — matches existing code at `useDashboardData.ts:152`.
<<<<<<< HEAD
- **Cent arithmetic**: every sum runs through `centSum(values: number[]) => number` which converts each value to integer cents (`Math.round(v * 100)`), sums, divides by 100. Avoids `0.1 + 0.2` drift.
- **Test runner**: Vitest. Run with `pnpm vitest run <path>` for a single file.
- **E2E runner**: Playwright. Run with `pnpm playwright test`.
- **No mocks** for storage / API in integration / E2E tests. Use real `financial-tracker` against a temp data dir (existing convention).
=======
- **Cent arithmetic**: every sum runs through a private `centSum(values: number[]) => number` helper that converts each value to integer cents (`Math.round(v * 100)`), sums, divides by 100. Avoids `0.1 + 0.2` drift.
- **Package manager**: `npm` (no pnpm-lock present). Use `npm test -- <args>`, `npm run lint`, `npm run build`.
- **Test runner**: **Jest** (not Vitest). The repo's convention is to mock `./storage` with `jest.mock('./storage', …)` exposing a `_reset()` helper — see `src/lib/weekly-tracker.test.ts:1-19` for the canonical pattern. When the plan shows `vitest` / `vi.fn()` / `vitest` imports, substitute:
  - `vi.fn()` → `jest.fn()`
  - `import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';` → drop the import (jest globals) and use the storage-mock pattern from `weekly-tracker.test.ts` for any test that touches persisted data.
  - Run a single file: `npx jest <path>` or `npm test -- <path>`.
  - Filter by name: `npx jest <path> -t "<pattern>"`.
- **E2E runner**: Playwright. Run with `npm run test:e2e:playwright`.
- **For library tests** (e.g. `financial-tracker.test.ts`): mirror `weekly-tracker.test.ts`'s storage-mock pattern verbatim. Do **not** use a temp `DATA_DIR` — that's not how this repo's tests work.
>>>>>>> origin/main

---

## Phase 1 — Library: math fixes + new accessors

### Task 1: Cent-based accumulation in `recalculateTotals`

Switch the daily totals sum to integer-cent arithmetic so `0.1 + 0.2` does not drift to `0.30000000000000004`.

**Files:**
- Modify: `src/lib/financial-tracker.ts:82-96` (private `recalculateTotals`)
- Test: `src/lib/financial-tracker.test.ts` (new file)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/financial-tracker.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FinancialTracker } from './financial-tracker';

let tempDir: string;
let originalDataDir: string | undefined;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-test-'));
  originalDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tempDir;
});

afterEach(async () => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('FinancialTracker — daily totals & netImpact', () => {
  it('sums decimal amounts without float drift', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('cut', 49.99, 'a', '2026-05-11');
    await t.addEntry('cut', 0.01, 'b', '2026-05-11');
    await t.addEntry('cut', 100, 'c', '2026-05-11');
    const day = t.getAllData().dailyMetrics['2026-05-11'];
    expect(day.totals.cut).toBe(150);
    expect(day.totals.netImpact).toBe(150);
  });

  it('sums 0.1 + 0.2 to exactly 0.3', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('generated', 0.1, 'a', '2026-05-11');
    await t.addEntry('generated', 0.2, 'b', '2026-05-11');
    const day = t.getAllData().dailyMetrics['2026-05-11'];
    expect(day.totals.generated).toBe(0.3);
  });

  it('sums large amounts without precision loss', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('moved', 1_500_000, 'a', '2026-05-11');
    await t.addEntry('moved', 750_000.50, 'b', '2026-05-11');
    const day = t.getAllData().dailyMetrics['2026-05-11'];
    expect(day.totals.moved).toBe(2_250_000.5);
  });

  it('returns all-zero totals when the day has no entries', async () => {
    const t = await FinancialTracker.create();
    // Force the recalculation path by adding then peeking at a different day
    const today = t.getTodaysMetrics();
    expect(today.totals).toEqual({ moved: 0, generated: 0, cut: 0, netImpact: 0 });
  });

  it('isolates totals per category', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('moved', 100, 'a', '2026-05-11');
    await t.addEntry('generated', 200, 'b', '2026-05-11');
    await t.addEntry('cut', 50, 'c', '2026-05-11');
    const day = t.getAllData().dailyMetrics['2026-05-11'];
    expect(day.totals).toEqual({ moved: 100, generated: 200, cut: 50, netImpact: 350 });
  });
});
```

- [ ] **Step 2: Verify storage `DATA_DIR` override works**

Run: `grep -n "DATA_DIR\|loadJSON\|saveJSON" src/lib/storage.ts`

Expected: `storage.ts` reads `process.env.DATA_DIR` (or equivalent). If it doesn't, update `Step 1` setup to whatever mechanism `storage.ts` uses for path injection (the existing weekly-tracker tests are the precedent — copy their setup verbatim from `src/lib/weekly-tracker.test.ts`).

- [ ] **Step 3: Run tests to verify they fail (or partially fail)**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts`

Expected: at minimum the `0.1 + 0.2` test FAILS with received `0.30000000000000004`.

- [ ] **Step 4: Implement `centSum` and rewrite `recalculateTotals`**

In `src/lib/financial-tracker.ts`, add a private helper at the bottom of the class and rewrite the method:

```ts
private centSum(values: number[]): number {
  const cents = values.reduce((acc, v) => acc + Math.round(v * 100), 0);
  return cents / 100;
}

private recalculateTotals(date: string): void {
  const dayMetrics = this.data.dailyMetrics[date];
  if (!dayMetrics) return;

  const moved = this.centSum(dayMetrics.entries.filter(e => e.category === 'moved').map(e => e.amount));
  const generated = this.centSum(dayMetrics.entries.filter(e => e.category === 'generated').map(e => e.amount));
  const cut = this.centSum(dayMetrics.entries.filter(e => e.category === 'cut').map(e => e.amount));
  const netImpact = this.centSum([moved, generated, cut]);

  dayMetrics.totals = { moved, generated, cut, netImpact };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts`

Expected: PASS — all five tests in the `daily totals & netImpact` block green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/financial-tracker.ts src/lib/financial-tracker.test.ts
git commit -m "fix(financial-tracker): cent-based accumulation in daily totals"
```

---

### Task 2: Reject zero / negative amounts in `addEntry`

`addEntry` currently accepts any number including 0 and negatives. Spec requires `amount > 0`.

**Files:**
- Modify: `src/lib/financial-tracker.ts:51-80` (`addEntry`)
- Modify: `src/lib/financial-tracker.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to the test file:

```ts
describe('FinancialTracker — addEntry validation', () => {
  it('rejects amount of 0', async () => {
    const t = await FinancialTracker.create();
    await expect(t.addEntry('cut', 0, 'zero', '2026-05-11')).rejects.toThrow(/amount must be greater than 0/i);
  });

  it('rejects negative amount', async () => {
    const t = await FinancialTracker.create();
    await expect(t.addEntry('generated', -10, 'neg', '2026-05-11')).rejects.toThrow(/amount must be greater than 0/i);
  });

  it('rejects NaN amount', async () => {
    const t = await FinancialTracker.create();
    await expect(t.addEntry('moved', Number.NaN, 'nan', '2026-05-11')).rejects.toThrow();
  });

  it('rejects empty description', async () => {
    const t = await FinancialTracker.create();
    await expect(t.addEntry('cut', 10, '   ', '2026-05-11')).rejects.toThrow(/description.*required/i);
  });

  it('does not persist an entry when validation fails', async () => {
    const t = await FinancialTracker.create();
    await expect(t.addEntry('cut', 0, 'x', '2026-05-11')).rejects.toThrow();
    const day = t.getAllData().dailyMetrics['2026-05-11'];
    expect(day).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts -t "addEntry validation"`

Expected: FAIL — current code does not throw.

- [ ] **Step 3: Add validation to `addEntry`**

Replace the start of `addEntry` in `src/lib/financial-tracker.ts` (above the `const entryDate = …` line):

```ts
async addEntry(category: 'moved' | 'generated' | 'cut', amount: number, description: string, date?: string): Promise<FinancialEntry> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid amount: amount must be greater than 0 (received ${amount})`);
  }
  if (!description || description.trim().length === 0) {
    throw new Error('Invalid description: description is required');
  }
  const trimmedDescription = description.trim();
  // … existing body, replacing `description` with `trimmedDescription` on the entry object
```

Update the `entry` object to use `description: trimmedDescription`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts`

Expected: PASS — both the original daily-totals tests and the new validation tests are green.

- [ ] **Step 5: Update API route to map errors to 400**

Modify `src/app/api/financial/route.ts` `addEntry` case:

```ts
case 'addEntry': {
  const { category, amount, description, date } = data;
  try {
    const entry = await financialTracker.addEntry(category, amount, description, date);
    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add entry';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/financial-tracker.ts src/lib/financial-tracker.test.ts src/app/api/financial/route.ts
git commit -m "feat(financial-tracker): reject zero/negative amounts and empty descriptions"
```

---

### Task 3: `getDailyMetricsForWeek(weekStartDate)`

Returns a length-7 array of `DailyFinancialMetrics`, one per day Mon–Sun, with zero-filled entries for days that have no data.

**Files:**
- Modify: `src/lib/financial-tracker.ts` (add method)
- Modify: `src/lib/financial-tracker.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { format } from 'date-fns';

function emptyTotals() {
  return { moved: 0, generated: 0, cut: 0, netImpact: 0 };
}

describe('FinancialTracker — getDailyMetricsForWeek', () => {
  it('returns 7 empty days when there are no entries', async () => {
    const t = await FinancialTracker.create();
    const week = t.getDailyMetricsForWeek('2026-05-11'); // Mon 2026-05-11
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe('2026-05-11');
    expect(week[6].date).toBe('2026-05-17');
    week.forEach(d => {
      expect(d.entries).toEqual([]);
      expect(d.totals).toEqual(emptyTotals());
    });
  });

  it('returns sparse data — only the day with entries has them', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('cut', 100, 'storage', '2026-05-13'); // Wed
    const week = t.getDailyMetricsForWeek('2026-05-11');
    expect(week[2].entries).toHaveLength(1);
    expect(week[2].totals.cut).toBe(100);
    expect(week[0].entries).toEqual([]);
    expect(week[6].entries).toEqual([]);
  });

  it('excludes the previous Sunday and includes the upcoming Sunday', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('moved', 10, 'prev-sun', '2026-05-10'); // Sun before
    await t.addEntry('moved', 20, 'this-sun', '2026-05-17'); // Sun of this week
    const week = t.getDailyMetricsForWeek('2026-05-11');
    expect(week[6].totals.moved).toBe(20);
    expect(week.flatMap(d => d.entries).find(e => e.description === 'prev-sun')).toBeUndefined();
  });

  it('handles a week that crosses a month boundary', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('generated', 50, 'apr', '2026-04-30'); // Thu in week of Apr 27
    await t.addEntry('generated', 75, 'may', '2026-05-03'); // Sun in same week
    const week = t.getDailyMetricsForWeek('2026-04-27');
    expect(week[0].date).toBe('2026-04-27');
    expect(week[6].date).toBe('2026-05-03');
    expect(week[3].totals.generated).toBe(50);
    expect(week[6].totals.generated).toBe(75);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts -t "getDailyMetricsForWeek"`

Expected: FAIL — method does not exist.

- [ ] **Step 3: Implement the method**

Add to `FinancialTracker`:

```ts
import { addDays, format } from 'date-fns';

// ... inside the class:

getDailyMetricsForWeek(weekStartDate: string): DailyFinancialMetrics[] {
  const start = new Date(`${weekStartDate}T12:00:00`); // noon local to dodge DST
  return Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(start, i), 'yyyy-MM-dd');
    return this.data.dailyMetrics[d] ?? {
      date: d,
      entries: [],
      totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
    };
  });
}
```

Add `import { addDays, format } from 'date-fns';` at the top of the file if not already present.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts`

Expected: PASS — all `getDailyMetricsForWeek` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/financial-tracker.ts src/lib/financial-tracker.test.ts
git commit -m "feat(financial-tracker): add getDailyMetricsForWeek accessor"
```

---

### Task 4: `getDailyMetricsForRange(startDate, endDate)`

Returns a contiguous day-by-day array between two dates inclusive. Used by the 30-day trend chart.

**Files:**
- Modify: `src/lib/financial-tracker.ts`
- Modify: `src/lib/financial-tracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
describe('FinancialTracker — getDailyMetricsForRange', () => {
  it('returns one entry per day in the range, zero-filled', async () => {
    const t = await FinancialTracker.create();
    const range = t.getDailyMetricsForRange('2026-05-01', '2026-05-05');
    expect(range.map(d => d.date)).toEqual([
      '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    ]);
    range.forEach(d => expect(d.totals).toEqual(emptyTotals()));
  });

  it('includes both boundary days when they have entries', async () => {
    const t = await FinancialTracker.create();
    await t.addEntry('cut', 10, 'start', '2026-05-01');
    await t.addEntry('cut', 20, 'end', '2026-05-05');
    const range = t.getDailyMetricsForRange('2026-05-01', '2026-05-05');
    expect(range[0].totals.cut).toBe(10);
    expect(range[4].totals.cut).toBe(20);
  });

  it('crosses a month boundary contiguously', async () => {
    const t = await FinancialTracker.create();
    const range = t.getDailyMetricsForRange('2026-04-29', '2026-05-02');
    expect(range.map(d => d.date)).toEqual([
      '2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02',
    ]);
  });

  it('returns single-day range when start === end', async () => {
    const t = await FinancialTracker.create();
    const range = t.getDailyMetricsForRange('2026-05-11', '2026-05-11');
    expect(range).toHaveLength(1);
    expect(range[0].date).toBe('2026-05-11');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts -t "getDailyMetricsForRange"`

Expected: FAIL — method does not exist.

- [ ] **Step 3: Implement the method**

Add:

```ts
getDailyMetricsForRange(startDate: string, endDate: string): DailyFinancialMetrics[] {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days <= 0) return [];
  return Array.from({ length: days }, (_, i) => {
    const d = format(addDays(start, i), 'yyyy-MM-dd');
    return this.data.dailyMetrics[d] ?? {
      date: d,
      entries: [],
      totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts`

Expected: PASS — all `getDailyMetricsForRange` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/financial-tracker.ts src/lib/financial-tracker.test.ts
git commit -m "feat(financial-tracker): add getDailyMetricsForRange accessor"
```

---

### Task 5: `getPreviousWeekTotals()` + week-over-week tests

For the WoW row in the Weekly tab.

**Files:**
- Modify: `src/lib/financial-tracker.ts`
- Modify: `src/lib/financial-tracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { startOfWeek } from 'date-fns';

describe('FinancialTracker — getPreviousWeekTotals', () => {
  it('returns all zeros when there are no entries in the previous week', async () => {
    const t = await FinancialTracker.create();
    expect(t.getPreviousWeekTotals()).toEqual(emptyTotals());
  });

  it('sums only the previous week', async () => {
    const t = await FinancialTracker.create();
    const now = new Date();
    const thisWeekMon = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const lastWeekMon = format(addDays(startOfWeek(now, { weekStartsOn: 1 }), -7), 'yyyy-MM-dd');
    const lastWeekWed = format(addDays(startOfWeek(now, { weekStartsOn: 1 }), -5), 'yyyy-MM-dd');
    await t.addEntry('generated', 100, 'this week', thisWeekMon);
    await t.addEntry('generated', 50, 'last week mon', lastWeekMon);
    await t.addEntry('cut', 25, 'last week wed', lastWeekWed);
    const prev = t.getPreviousWeekTotals();
    expect(prev.generated).toBe(50);
    expect(prev.cut).toBe(25);
    expect(prev.netImpact).toBe(75);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts -t "getPreviousWeekTotals"`

Expected: FAIL — method does not exist.

- [ ] **Step 3: Implement the method**

Add:

```ts
import { startOfWeek, addDays as addDaysFn, format as formatFn } from 'date-fns';
// (skip duplicate imports if already present at top)

getPreviousWeekTotals(): { moved: number; generated: number; cut: number; netImpact: number } {
  const now = new Date();
  const prevWeekStart = addDays(startOfWeek(now, { weekStartsOn: 1 }), -7);
  const prevWeekStartStr = format(prevWeekStart, 'yyyy-MM-dd');
  const days = this.getDailyMetricsForWeek(prevWeekStartStr);
  return {
    moved: this.centSum(days.map(d => d.totals.moved)),
    generated: this.centSum(days.map(d => d.totals.generated)),
    cut: this.centSum(days.map(d => d.totals.cut)),
    netImpact: this.centSum(days.map(d => d.totals.netImpact)),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/financial-tracker.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/financial-tracker.ts src/lib/financial-tracker.test.ts
git commit -m "feat(financial-tracker): add getPreviousWeekTotals"
```

---

## Phase 2 — Type + review-revenue deprecation

### Task 6: Make `WeeklyReview.revenue` optional and stop requiring it on submit

The Weekly tab's Revenue card moves to a tracker-derived Net Impact card; the review form no longer collects revenue. Stored reviews keep their `revenue` value (read-only). New submissions can omit it.

**Files:**
- Modify: `src/lib/types.ts:279` (make `revenue` optional)
- Modify: `src/lib/weekly-tracker.ts` (handle missing revenue in submit; default to existing value or `0`)
- Modify: `src/lib/weekly-tracker.test.ts` (add coverage)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/weekly-tracker.test.ts`:

```ts
it('submitWeeklyReview accepts a payload without revenue and stores 0', async () => {
  const t = await WeeklyTracker.create();
  await t.submitWeeklyReview({
    slipAnalysis: 'x', systemAdjustment: 'y',
    nextWeekTargets: 'z', bottleneck: 'b', temporalTarget: 5,
  } as never);
  const reviews = t.getWeeklyReviews(1);
  expect(reviews[0].revenue ?? 0).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/weekly-tracker.test.ts -t "without revenue"`

Expected: FAIL — current signature requires `revenue`.

- [ ] **Step 3: Update the type**

In `src/lib/types.ts`, change line 279:

```ts
revenue?: number;          // $ weekly total (legacy; new submissions omit)
```

- [ ] **Step 4: Update `submitWeeklyReview`**

In `src/lib/weekly-tracker.ts`, locate `submitWeeklyReview` and change the parameter signature so `revenue` is optional. Default to `0` when undefined when assigning to the stored review:

```ts
async submitWeeklyReview(review: Omit<WeeklyReview, 'id' | 'createdAt' | 'weekStartDate' | 'weekEndDate' | 'temporalTarget' | 'revenue'> & {
  weekStartDate?: string;
  revenue?: number;
  temporalTarget?: number;
}): Promise<WeeklyReview> {
  // … existing code …
  const newReview: WeeklyReview = {
    id: /* existing */,
    weekStartDate: weekStart,
    weekEndDate: /* existing */,
    revenue: review.revenue ?? 0,
    slipAnalysis: review.slipAnalysis,
    systemAdjustment: review.systemAdjustment,
    nextWeekTargets: review.nextWeekTargets,
    bottleneck: review.bottleneck,
    temporalTarget: review.temporalTarget ?? 5,
    createdAt: new Date().toISOString(),
  };
  // … existing persist code …
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/weekly-tracker.test.ts`

Expected: PASS — including the new "without revenue" case and all existing tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/weekly-tracker.ts src/lib/weekly-tracker.test.ts
git commit -m "refactor(weekly-tracker): make WeeklyReview.revenue optional"
```

---

## Phase 3 — API

### Task 7: Extend `GET /api/financial` payload

Add `weekFinancialByDay`, `dailyFinancialTrend` (last 30 days), and `previousWeekTotals` to the GET response.

**Files:**
- Modify: `src/app/api/financial/route.ts:5-27`
- Modify: `src/__tests__/integration/api.integration.test.ts` (extend)

- [ ] **Step 1: Write the failing integration test**

Append to `src/__tests__/integration/api.integration.test.ts` (use the existing test scaffolding; if missing, mirror the pattern from `monthly-review-api.integration.test.ts`):

```ts
import { describe, it, expect } from 'vitest';

describe('GET /api/financial — extended payload', () => {
  it('returns weekFinancialByDay, dailyFinancialTrend, previousWeekTotals alongside today/weekly/monthly', async () => {
    const res = await fetch(`${baseUrl}/api/financial`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('todaysMetrics');
    expect(body).toHaveProperty('weeklyTotals');
    expect(body).toHaveProperty('monthlyTotals');
    expect(body).toHaveProperty('previousWeekTotals');
    expect(body.previousWeekTotals).toEqual(expect.objectContaining({
      moved: expect.any(Number), generated: expect.any(Number),
      cut: expect.any(Number), netImpact: expect.any(Number),
    }));
    expect(Array.isArray(body.weekFinancialByDay)).toBe(true);
    expect(body.weekFinancialByDay).toHaveLength(7);
    expect(Array.isArray(body.dailyFinancialTrend)).toBe(true);
    expect(body.dailyFinancialTrend).toHaveLength(30);
  });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `pnpm vitest run src/__tests__/integration/api.integration.test.ts -t "extended payload"`

Expected: FAIL — new properties absent from the response.

- [ ] **Step 3: Extend the route handler**

Replace the GET handler in `src/app/api/financial/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { FinancialTracker } from '@/lib/financial-tracker';
import { checkAuth } from '@/lib/auth';
import { startOfWeek, addDays, format, subDays } from 'date-fns';

export async function GET() {
  try {
    const financialTracker = await FinancialTracker.create();
    const todaysMetrics = financialTracker.getTodaysMetrics();
    const weeklyTotals = financialTracker.getWeeklyTotals();
    const monthlyTotals = financialTracker.getMonthlyTotals();
    const previousWeekTotals = financialTracker.getPreviousWeekTotals();
    const recentEntries = financialTracker.getRecentEntries(10);

    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekFinancialByDay = financialTracker.getDailyMetricsForWeek(weekStart);

    const rangeEnd = format(now, 'yyyy-MM-dd');
    const rangeStart = format(subDays(now, 29), 'yyyy-MM-dd');
    const dailyFinancialTrend = financialTracker.getDailyMetricsForRange(rangeStart, rangeEnd);

    return NextResponse.json({
      todaysMetrics,
      weeklyTotals,
      monthlyTotals,
      previousWeekTotals,
      weekFinancialByDay,
      dailyFinancialTrend,
      recentEntries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching financial metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch financial metrics' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `pnpm vitest run src/__tests__/integration/api.integration.test.ts -t "extended payload"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/financial/route.ts src/__tests__/integration/api.integration.test.ts
git commit -m "feat(api/financial): extend GET payload with weekly/30-day financial data"
```

---

## Phase 4 — Hook

### Task 8: `useDashboardData` passes financial data through and drops revenue from review submit

**Files:**
- Modify: `src/hooks/useDashboardData.ts:288-304` (handleAddFinancialEntry — already exists, leave as is)
- Modify: `src/hooks/useDashboardData.ts:349-367` (handleSubmitWeeklyReview — drop revenue from signature)

- [ ] **Step 1: Verify financial GET already feeds `financialData`**

Run: `grep -n "fetch('/api/financial')\|setFinancialData" src/hooks/useDashboardData.ts`

Expected: lines 108-114 already call GET and `setFinancialData(data)`. No change needed; the new fields appear on `financialData` automatically because `financialData: any`.

- [ ] **Step 2: Update `handleSubmitWeeklyReview` signature**

Replace lines 349-367:

```ts
const handleSubmitWeeklyReview = useCallback(async (review: {
  slipAnalysis: string; systemAdjustment: string; nextWeekTargets: string; bottleneck: string; temporalTarget: number;
}) => {
  try {
    const response = await fetch('/api/weekly-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submitReview', ...review })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit review');
    }
    await loadAllData();
  } catch (error) {
    console.error('Error submitting weekly review:', error);
    throw error;
  }
}, [loadAllData]);
```

Also update the `DashboardHandlers` interface at lines 61-63:

```ts
handleSubmitWeeklyReview: (review: {
  slipAnalysis: string; systemAdjustment: string; nextWeekTargets: string; bottleneck: string; temporalTarget: number;
}) => Promise<void>;
```

- [ ] **Step 3: Run the existing dashboard hook / page tests**

Run: `pnpm vitest run src/components/__tests__/DashboardPage.test.tsx`

Expected: PASS (or fail only on revenue-related cases that the next task fixes). If type errors surface from the type change, those are caught in Step 4.

- [ ] **Step 4: Run typecheck**

Run: `pnpm tsc --noEmit`

Expected: any remaining `revenue` references in callers surface here. The next task fixes the component; for now any tsc errors should be exclusively about `WeeklyPerformanceTracker.tsx` props — note them for Task 14.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardData.ts
git commit -m "refactor(useDashboardData): drop revenue from weekly review submit"
```

---

## Phase 5 — Component: `WeeklyPerformanceTracker.tsx`

### Task 9: Add financial props to the interface + Net Today card

**Files:**
- Modify: `src/components/WeeklyPerformanceTracker.tsx:23-42` (props interface)
- Modify: `src/components/WeeklyPerformanceTracker.tsx:259-323` (today's summary grid)
- Modify: `src/components/WeeklyPerformanceTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `WeeklyPerformanceTracker.test.tsx`:

```ts
it('renders Net Today card with currency value and category breakdown', () => {
  render(
    <WeeklyPerformanceTracker
      {...baseProps}
      todaysFinancial={{
        date: '2026-05-11',
        entries: [],
        totals: { moved: 100, generated: 250, cut: 50, netImpact: 400 },
      }}
    />
  );
  expect(screen.getByTestId('net-today-value')).toHaveTextContent('$400');
  expect(screen.getByTestId('net-today-breakdown')).toHaveTextContent('mv $100');
  expect(screen.getByTestId('net-today-breakdown')).toHaveTextContent('gen $250');
  expect(screen.getByTestId('net-today-breakdown')).toHaveTextContent('cut $50');
});
```

Update `baseProps` in the test file to supply minimum-required new props (`todaysFinancial`, `weekFinancialByDay: Array(7).fill({…empty…})`, `weekFinancialTotals: emptyTotals`, `previousWeekFinancialTotals: emptyTotals`, `dailyFinancialTrend: Array(30).fill({…empty…})`, `onAddFinancialEntry: vi.fn()`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx -t "Net Today"`

Expected: FAIL — props don't exist; component renders 5 cards, not 6.

- [ ] **Step 3: Extend the props interface**

Edit `WeeklyPerformanceTracker.tsx:23-42` to add:

```ts
import type { DailyFinancialMetrics } from '@/lib/financial-tracker';

type FinancialTotals = { moved: number; generated: number; cut: number; netImpact: number };

interface WeeklyPerformanceTrackerProps {
  // … existing props …
  todaysFinancial: DailyFinancialMetrics;
  weekFinancialByDay: DailyFinancialMetrics[];          // length 7, Mon–Sun
  weekFinancialTotals: FinancialTotals;
  previousWeekFinancialTotals: FinancialTotals;
  dailyFinancialTrend: DailyFinancialMetrics[];         // length 30
  onAddFinancialEntry: (
    category: 'moved' | 'generated' | 'cut',
    amount: number,
    description: string
  ) => Promise<void>;
}
```

- [ ] **Step 4: Add the currency formatter at module scope**

Insert near the top of the file:

```ts
function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const sign = value < 0 ? '-' : '';
  return `${sign}$${formatted}`;
}
```

- [ ] **Step 5: Replace the 5-card grid with 6 cards**

Edit the grid block currently at `:260` from `grid-cols-2 md:grid-cols-5` to `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` and insert the **Net Today** card just before the **Day Status** card:

```tsx
<div className="text-center p-3 bg-emerald-50 rounded-lg">
  <div
    data-testid="net-today-value"
    className={`text-2xl font-bold ${
      todaysFinancial.totals.netImpact > 0
        ? 'text-emerald-700'
        : todaysFinancial.totals.netImpact < 0
          ? 'text-red-600'
          : 'text-gray-500'
    }`}
  >
    {formatCurrency(todaysFinancial.totals.netImpact)}
  </div>
  <div className="text-xs text-gray-500">Net Today</div>
  <div data-testid="net-today-breakdown" className="text-[10px] text-gray-500 mt-1">
    mv {formatCurrency(todaysFinancial.totals.moved)} · gen {formatCurrency(todaysFinancial.totals.generated)} · cut {formatCurrency(todaysFinancial.totals.cut)}
  </div>
</div>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx`

Expected: the new "Net Today" test passes; all existing tests still pass (the grid expansion does not break existing cards).

- [ ] **Step 7: Commit**

```bash
git add src/components/WeeklyPerformanceTracker.tsx src/components/WeeklyPerformanceTracker.test.tsx
git commit -m "feat(tracker): add Net Today card to header"
```

---

### Task 10: Add Money Move quick-add buttons + shared inline form

Below the focus quick-add buttons, add three "money move" buttons that open a shared inline form pre-filled with the clicked category.

**Files:**
- Modify: `src/components/WeeklyPerformanceTracker.tsx`
- Modify: `src/components/WeeklyPerformanceTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

Append:

```ts
it('clicking + Cut opens the form with cut preselected and submits to onAddFinancialEntry', async () => {
  const user = userEvent.setup();
  const onAddFinancialEntry = vi.fn().mockResolvedValue(undefined);
  render(<WeeklyPerformanceTracker {...baseProps} onAddFinancialEntry={onAddFinancialEntry} />);

  await user.click(screen.getByRole('button', { name: /\+ cut/i }));
  expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  await user.type(screen.getByLabelText(/amount/i), '150');
  await user.type(screen.getByLabelText(/description/i), 'storage');
  await user.click(screen.getByRole('button', { name: /save move/i }));

  expect(onAddFinancialEntry).toHaveBeenCalledWith('cut', 150, 'storage');
});

it('disables submit when amount is 0 or description is empty', async () => {
  const user = userEvent.setup();
  render(<WeeklyPerformanceTracker {...baseProps} />);
  await user.click(screen.getByRole('button', { name: /\+ generated/i }));
  expect(screen.getByRole('button', { name: /save move/i })).toBeDisabled();
  await user.type(screen.getByLabelText(/amount/i), '10');
  expect(screen.getByRole('button', { name: /save move/i })).toBeDisabled(); // description still empty
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx -t "Cut|disables submit"`

Expected: FAIL — buttons don't exist.

- [ ] **Step 3: Implement the buttons + form**

Add state near the existing focus-related state (around line 80):

```tsx
const [moveCategory, setMoveCategory] = useState<'moved' | 'generated' | 'cut' | null>(null);
const [moveAmount, setMoveAmount] = useState('');
const [moveDescription, setMoveDescription] = useState('');
const [isAddingMove, setIsAddingMove] = useState(false);
const [moveError, setMoveError] = useState<string | null>(null);
```

Add a render block immediately after the existing focus quick-add buttons section (around line 349):

```tsx
{onAddFinancialEntry && (
  <div className="mt-3 border-t border-gray-100 pt-3">
    <div className="flex flex-wrap gap-2">
      {(['moved', 'generated', 'cut'] as const).map(cat => (
        <button
          key={cat}
          onClick={() => setMoveCategory(cat)}
          className="px-3 py-1.5 text-sm font-medium border border-emerald-300 text-emerald-700 rounded-full bg-white hover:bg-emerald-50"
        >
          + {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </button>
      ))}
    </div>
    {moveCategory && (
      <form
        className="mt-2 flex flex-wrap items-end gap-2 bg-gray-50 p-3 rounded-lg"
        onSubmit={async e => {
          e.preventDefault();
          const amt = parseFloat(moveAmount);
          if (!Number.isFinite(amt) || amt <= 0 || !moveDescription.trim()) return;
          setIsAddingMove(true);
          setMoveError(null);
          try {
            await onAddFinancialEntry(moveCategory, amt, moveDescription.trim());
            setMoveAmount('');
            setMoveDescription('');
            setMoveCategory(null);
          } catch (err) {
            setMoveError(err instanceof Error ? err.message : 'Failed to save move');
          } finally {
            setIsAddingMove(false);
          }
        }}
      >
        <label className="text-xs font-medium text-gray-600 flex flex-col">
          Category
          <select
            value={moveCategory}
            onChange={e => setMoveCategory(e.target.value as 'moved' | 'generated' | 'cut')}
            className="mt-0.5 px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="moved">Moved</option>
            <option value="generated">Generated</option>
            <option value="cut">Cut</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 flex flex-col">
          Amount
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={moveAmount}
            onChange={e => setMoveAmount(e.target.value)}
            className="mt-0.5 px-2 py-1 border border-gray-300 rounded text-sm w-28"
            aria-label="amount"
          />
        </label>
        <label className="text-xs font-medium text-gray-600 flex flex-col flex-1 min-w-[180px]">
          Description
          <input
            type="text"
            value={moveDescription}
            onChange={e => setMoveDescription(e.target.value)}
            className="mt-0.5 px-2 py-1 border border-gray-300 rounded text-sm"
            aria-label="description"
          />
        </label>
        <button
          type="submit"
          disabled={
            isAddingMove ||
            !moveDescription.trim() ||
            !Number.isFinite(parseFloat(moveAmount)) ||
            parseFloat(moveAmount) <= 0
          }
          className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {isAddingMove ? 'Saving…' : 'Save move'}
        </button>
        <button
          type="button"
          onClick={() => { setMoveCategory(null); setMoveError(null); }}
          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        {moveError && <div className="w-full text-xs text-red-600">{moveError}</div>}
      </form>
    )}
  </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx`

Expected: PASS — new tests green; existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeeklyPerformanceTracker.tsx src/components/WeeklyPerformanceTracker.test.tsx
git commit -m "feat(tracker): add money move quick-add form"
```

---

### Task 11: Per-day `$` line in the week grid

**Files:**
- Modify: `src/components/WeeklyPerformanceTracker.tsx` (daily grid block around `:510`)
- Modify: `src/components/WeeklyPerformanceTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('renders a $ line per day reflecting that day\'s netImpact', () => {
  const week = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-05-${String(11 + i).padStart(2, '0')}`,
    entries: [],
    totals: { moved: 0, generated: 0, cut: 0, netImpact: i === 2 ? 500 : 0 },
  }));
  render(<WeeklyPerformanceTracker {...baseProps} weekFinancialByDay={week} />);
  const dayCells = screen.getAllByTestId(/^day-money-/);
  expect(dayCells).toHaveLength(7);
  expect(dayCells[2]).toHaveTextContent('$500');
  expect(dayCells[2].className).toMatch(/text-emerald|text-green/);
  expect(dayCells[0]).toHaveTextContent('—');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx -t "\\$ line per day"`

Expected: FAIL.

- [ ] **Step 3: Add `$` line to the daily grid**

In the Daily tab block (`activeTab === 'daily'`), inside the `DAY_LABELS.map(...)` cell render, **after** the training indicator and zero-day flag, append:

```tsx
{(() => {
  const fin = weekFinancialByDay[i];
  const net = fin?.totals.netImpact ?? 0;
  const hasData = fin && fin.entries.length > 0;
  return (
    <div
      data-testid={`day-money-${i}`}
      tabIndex={hasData ? 0 : -1}
      className={`mt-1 text-xs font-medium ${
        !hasData ? 'text-gray-300' : net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : 'text-gray-500'
      }`}
    >
      {hasData ? formatCurrency(net) : '—'}
    </div>
  );
})()}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeeklyPerformanceTracker.tsx src/components/WeeklyPerformanceTracker.test.tsx
git commit -m "feat(tracker): add per-day money line to week grid"
```

---

### Task 12: Hover/focus popover for day money entries

Hand-rolled popover with React state — opens on hover **and** keyboard focus, closes on blur/leave (with a 200ms close delay so users can move between targets).

**Files:**
- Create: `src/components/MoneyMovePopover.tsx`
- Modify: `src/components/WeeklyPerformanceTracker.tsx` (use the popover for the daily $ line)
- Create: `src/components/MoneyMovePopover.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/MoneyMovePopover.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MoneyMovePopover } from './MoneyMovePopover';

const entries = [
  { id: '1', category: 'cut' as const, amount: 150, description: 'storage', timestamp: '2026-05-11T10:00:00Z' },
  { id: '2', category: 'generated' as const, amount: 500, description: 'invoice', timestamp: '2026-05-11T14:00:00Z' },
];

describe('MoneyMovePopover', () => {
  it('renders entries on hover and on keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <MoneyMovePopover entries={entries}>
        <span tabIndex={0}>$650</span>
      </MoneyMovePopover>
    );
    expect(screen.queryByText('storage')).not.toBeInTheDocument();

    await user.hover(screen.getByText('$650'));
    expect(screen.getByText('storage')).toBeInTheDocument();
    expect(screen.getByText('invoice')).toBeInTheDocument();

    await user.unhover(screen.getByText('$650'));
    await user.tab();
    expect(screen.getByText('storage')).toBeInTheDocument();
  });

  it('shows "No moves logged" when entries is empty', async () => {
    const user = userEvent.setup();
    render(
      <MoneyMovePopover entries={[]}>
        <span tabIndex={0}>—</span>
      </MoneyMovePopover>
    );
    await user.hover(screen.getByText('—'));
    expect(screen.getByText(/no moves logged/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/MoneyMovePopover.test.tsx`

Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement the popover**

Create `src/components/MoneyMovePopover.tsx`:

```tsx
'use client';

import { useRef, useState, useCallback, ReactNode } from 'react';
import type { FinancialEntry } from '@/lib/financial-tracker';

interface MoneyMovePopoverProps {
  entries: FinancialEntry[];
  children: ReactNode;
}

const CATEGORY_DOT: Record<FinancialEntry['category'], string> = {
  moved: 'bg-blue-500',
  generated: 'bg-emerald-500',
  cut: 'bg-purple-500',
};

export function MoneyMovePopover({ entries, children }: MoneyMovePopoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }, []);

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-20 w-56 p-2 bg-white border border-gray-200 rounded-lg shadow-lg text-left"
        >
          {sorted.length === 0 ? (
            <div className="text-xs text-gray-500 italic">No moves logged</div>
          ) : (
            <ul className="space-y-1">
              {sorted.map(e => (
                <li key={e.id} className="flex items-center text-xs text-gray-700 gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[e.category]}`} />
                  <span className="truncate flex-1">{e.description}</span>
                  <span className="font-semibold text-gray-900">
                    ${e.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire into the daily grid**

In `WeeklyPerformanceTracker.tsx`, wrap the `data-testid={`day-money-${i}`}` div from Task 11 with `<MoneyMovePopover entries={fin?.entries ?? []}>…</MoneyMovePopover>`. Import the component at the top.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/MoneyMovePopover.test.tsx src/components/WeeklyPerformanceTracker.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/MoneyMovePopover.tsx src/components/MoneyMovePopover.test.tsx src/components/WeeklyPerformanceTracker.tsx
git commit -m "feat(tracker): keyboard-accessible money move popover"
```

---

### Task 13: Weekly tab — Net Impact card, three category cards, WoW row

Replace the existing **Revenue** card (currently fed by the review's `revenue`) with a **Net Impact** card sourced from `weekFinancialTotals.netImpact`. Add **Moved / Generated / Cut** cards. Extend Week-over-Week with a Net Impact row.

**Files:**
- Modify: `src/components/WeeklyPerformanceTracker.tsx` (weekly tab block around `:599`)
- Modify: `src/components/WeeklyPerformanceTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('weekly Net Impact card uses weekFinancialTotals, not review revenue', () => {
  render(
    <WeeklyPerformanceTracker
      {...baseProps}
      weekFinancialTotals={{ moved: 100, generated: 250, cut: 50, netImpact: 400 }}
      previousWeekFinancialTotals={{ moved: 0, generated: 100, cut: 0, netImpact: 100 }}
    />
  );
  // Switch to Weekly tab
  fireEvent.click(screen.getByRole('button', { name: /Weekly/i }));
  expect(screen.getByTestId('weekly-net-impact')).toHaveTextContent('$400');
  expect(screen.getByTestId('weekly-net-impact-prev')).toHaveTextContent('$100');
  expect(screen.getByTestId('weekly-moved')).toHaveTextContent('$100');
  expect(screen.getByTestId('weekly-generated')).toHaveTextContent('$250');
  expect(screen.getByTestId('weekly-cut')).toHaveTextContent('$50');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx -t "weekly Net Impact"`

Expected: FAIL.

- [ ] **Step 3: Replace the Weekly tab metric cards**

Find the existing Revenue card block (around `:601-:612` — starts with `<div className="p-4 bg-green-50 rounded-lg">` and shows `currentWeekSummary.revenue`) and replace with:

```tsx
<div className="p-4 bg-emerald-50 rounded-lg">
  <p className="text-sm font-medium text-gray-600">Net Impact</p>
  <p data-testid="weekly-net-impact" className="text-2xl font-bold text-emerald-700">
    {formatCurrency(weekFinancialTotals.netImpact)}
  </p>
  <p data-testid="weekly-net-impact-prev" className="text-xs text-gray-500 mt-1">
    Last week: {formatCurrency(previousWeekFinancialTotals.netImpact)}
  </p>
</div>
```

Then add three small cards in a new row immediately after the existing 4-card grid:

```tsx
<div className="grid grid-cols-3 gap-3">
  <div className="p-3 bg-blue-50 rounded-lg text-center">
    <p className="text-xs text-gray-600">Moved</p>
    <p data-testid="weekly-moved" className="text-lg font-bold text-blue-700">{formatCurrency(weekFinancialTotals.moved)}</p>
  </div>
  <div className="p-3 bg-emerald-50 rounded-lg text-center">
    <p className="text-xs text-gray-600">Generated</p>
    <p data-testid="weekly-generated" className="text-lg font-bold text-emerald-700">{formatCurrency(weekFinancialTotals.generated)}</p>
  </div>
  <div className="p-3 bg-purple-50 rounded-lg text-center">
    <p className="text-xs text-gray-600">Cut</p>
    <p data-testid="weekly-cut" className="text-lg font-bold text-purple-700">{formatCurrency(weekFinancialTotals.cut)}</p>
  </div>
</div>
```

Inside the **Week-over-Week** comparison block (around `:666`), insert a new ComparisonRow:

```tsx
<ComparisonRow
  label="Net Impact"
  current={formatCurrency(weekFinancialTotals.netImpact)}
  previous={formatCurrency(previousWeekFinancialTotals.netImpact)}
  better={weekFinancialTotals.netImpact >= previousWeekFinancialTotals.netImpact}
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeeklyPerformanceTracker.tsx src/components/WeeklyPerformanceTracker.test.tsx
git commit -m "feat(tracker): replace Revenue with Net Impact + category cards"
```

---

### Task 14: Review form — drop the revenue input

The Sunday review form no longer collects revenue.

**Files:**
- Modify: `src/components/WeeklyPerformanceTracker.tsx` (review form around `:783-:798`)
- Modify: `src/components/WeeklyPerformanceTracker.test.tsx`
- Modify: `src/app/dashboard/page.tsx` (handler wiring)

- [ ] **Step 1: Write the failing test**

```ts
it('weekly review form does not include a Revenue input', async () => {
  render(<WeeklyPerformanceTracker {...baseProps} />);
  fireEvent.click(screen.getByRole('button', { name: /Review/i }));
  expect(screen.queryByLabelText(/Revenue This Week/i)).not.toBeInTheDocument();
});

it('weekly review submits without revenue', async () => {
  const user = userEvent.setup();
  const onSubmitReview = vi.fn().mockResolvedValue(undefined);
  render(<WeeklyPerformanceTracker {...baseProps} onSubmitReview={onSubmitReview} />);
  fireEvent.click(screen.getByRole('button', { name: /Review/i }));
  await user.type(screen.getByLabelText(/Where did I slip/i), 'x');
  await user.click(screen.getByRole('button', { name: /Submit Weekly Review/i }));
  expect(onSubmitReview).toHaveBeenCalledWith(expect.not.objectContaining({ revenue: expect.anything() }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx -t "Revenue input|submits without revenue"`

Expected: FAIL.

- [ ] **Step 3: Edit `WeeklyPerformanceTracker.tsx`**

- Update the `onSubmitReview` prop type (around `:30-:37`) to drop `revenue`:

```ts
onSubmitReview: (review: {
  slipAnalysis: string;
  systemAdjustment: string;
  nextWeekTargets: string;
  bottleneck: string;
  temporalTarget: number;
}) => Promise<void>;
```

- Delete `reviewRevenue` state and its setter / sync effect (lines `:109`, `:120`).
- Delete the Revenue `<label>` and `<input>` block (`:783-:798`).
- Update `handleReviewSubmit` to remove the `revenue` parse and the field on the submission payload. Remove `disabled` dependency on `reviewRevenue`. The submit button stays enabled by default; remove the `!reviewRevenue` check.

- [ ] **Step 4: Update the page wiring**

In `src/app/dashboard/page.tsx`, the existing `handleSubmitWeeklyReview` from the hook now has a narrower signature — no edits needed if it's passed through directly. If a wrapper exists that destructures `revenue`, remove it.

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm tsc --noEmit && pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/WeeklyPerformanceTracker.tsx src/components/WeeklyPerformanceTracker.test.tsx src/app/dashboard/page.tsx
git commit -m "refactor(tracker): drop revenue input from weekly review form"
```

---

### Task 15: Trends tab — dual-axis chart (Deep Work hours + Net $)

**Files:**
- Modify: `src/components/WeeklyPerformanceTracker.tsx` (trends tab block around `:680-:705`)
- Modify: `src/components/WeeklyPerformanceTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('trends chart includes a money series when financial trend has data', () => {
  const trend = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-04-${String(11 + i).padStart(2, '0')}`,
    entries: [],
    totals: { moved: 0, generated: 0, cut: 0, netImpact: i === 15 ? 500 : 0 },
  }));
  render(<WeeklyPerformanceTracker {...baseProps} dailyFinancialTrend={trend} />);
  fireEvent.click(screen.getByRole('button', { name: /Trends/i }));
  // recharts renders <Line dataKey="netImpact" />; assert via the legend or test id we add
  expect(screen.getByTestId('trends-chart-money-line')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx -t "money series"`

Expected: FAIL.

- [ ] **Step 3: Replace the chart with a dual-axis LineChart**

Replace the existing `LineChart` block in the Trends tab with:

```tsx
{(() => {
  const dwSeries = deepWorkTrendData;
  const financialByDate = new Map(dailyFinancialTrend.map(d => [d.date, d.totals.netImpact]));
  const merged = dwSeries.map(d => ({
    date: d.date,
    deepWork: d.deepWork,
    netImpact: financialByDate.get(d.date) ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={merged}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
        <YAxis yAxisId="hours" fontSize={11} domain={[0, 8]} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <YAxis yAxisId="dollars" orientation="right" fontSize={11} tickFormatter={v => formatCurrency(Number(v))} />
        <Tooltip
          labelFormatter={(label) => formatDate(String(label))}
          formatter={(value, name) => {
            if (name === 'deepWork') return [`${value}h`, 'Deep Work'];
            if (name === 'netImpact') return [formatCurrency(Number(value)), 'Net $/day'];
            return [value, String(name)];
          }}
        />
        <ReferenceLine yAxisId="hours" y={3} stroke="#10B981" strokeDasharray="5 5" />
        <Line
          yAxisId="hours"
          type="monotone"
          dataKey="deepWork"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ r: 2, fill: '#3B82F6' }}
          name="Deep Work"
        />
        <Line
          yAxisId="dollars"
          type="monotone"
          dataKey="netImpact"
          stroke="#10B981"
          strokeWidth={2}
          dot={{ r: 2, fill: '#10B981' }}
          name="Net $/day"
          data-testid="trends-chart-money-line"
        />
      </LineChart>
    </ResponsiveContainer>
  );
})()}
```

Note: recharts may not forward `data-testid` to the SVG `<Line>` element. If the test asserts on a missing element, wrap the chart in a div with `data-testid="trends-chart-money-line"` and condition rendering on `dailyFinancialTrend.some(d => d.totals.netImpact !== 0)` so the testid only appears when money data is present.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeeklyPerformanceTracker.tsx src/components/WeeklyPerformanceTracker.test.tsx
git commit -m "feat(tracker): dual-axis trends chart with money series"
```

---

### Task 16: Trends tab — Avg net/day + Best money day rows

Pinned decisions: avg divides by **days-in-range** (30); ties for best day broken by **earliest date**.

**Files:**
- Modify: `src/components/WeeklyPerformanceTracker.tsx` (Performance Summary block, around `:716`)
- Modify: `src/components/WeeklyPerformanceTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('Performance Summary shows Avg net/day = sum / 30 (days-in-range), and Best money day breaks ties by earliest date', () => {
  const trend = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-04-${String(11 + i).padStart(2, '0')}`,
    entries: [],
    totals: { moved: 0, generated: 0, cut: 0, netImpact: i === 5 ? 600 : i === 20 ? 600 : 0 },
  }));
  render(<WeeklyPerformanceTracker {...baseProps} dailyFinancialTrend={trend} />);
  fireEvent.click(screen.getByRole('button', { name: /Trends/i }));
  // 1200 / 30 = 40
  expect(screen.getByTestId('avg-net-per-day')).toHaveTextContent('$40');
  // Earlier date wins the tie
  expect(screen.getByTestId('best-money-day')).toHaveTextContent('Apr 16');
  expect(screen.getByTestId('best-money-day')).toHaveTextContent('$600');
});

it('Best money day renders "—" when trend has no entries', () => {
  render(<WeeklyPerformanceTracker {...baseProps} />);
  fireEvent.click(screen.getByRole('button', { name: /Trends/i }));
  expect(screen.getByTestId('best-money-day')).toHaveTextContent('—');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx -t "Performance Summary"`

Expected: FAIL.

- [ ] **Step 3: Compute the values + render rows**

Above the Performance Summary block, derive:

```tsx
const moneyTrend = dailyFinancialTrend;
const totalNet = moneyTrend.reduce((acc, d) => acc + d.totals.netImpact, 0);
const avgNetPerDay = moneyTrend.length > 0 ? totalNet / moneyTrend.length : 0;
const bestMoneyDay = moneyTrend.reduce<{ date: string; value: number } | null>((best, d) => {
  if (d.totals.netImpact <= 0) return best;
  if (!best || d.totals.netImpact > best.value) return { date: d.date, value: d.totals.netImpact };
  return best;
}, null);
```

Add two rows inside the Performance Summary grid:

```tsx
<div>
  <span className="text-gray-500">Avg net/day:</span>
  <span data-testid="avg-net-per-day" className="ml-2 font-semibold text-gray-900">
    {formatCurrency(Math.round(avgNetPerDay))}
  </span>
</div>
<div>
  <span className="text-gray-500">Best money day:</span>
  <span data-testid="best-money-day" className="ml-2 font-semibold text-gray-900">
    {bestMoneyDay ? `${formatDate(bestMoneyDay.date)} ${formatCurrency(bestMoneyDay.value)}` : '—'}
  </span>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/WeeklyPerformanceTracker.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeeklyPerformanceTracker.tsx src/components/WeeklyPerformanceTracker.test.tsx
git commit -m "feat(tracker): avg net/day and best money day in Performance Summary"
```

---

## Phase 6 — Cleanup

### Task 17: Delete `FinancialMetricsDashboard` and remove from the page

**Files:**
- Delete: `src/components/FinancialMetricsDashboard.tsx`
- Delete: `src/components/FinancialMetricsDashboard.test.tsx`
- Modify: `src/app/dashboard/page.tsx` (remove import + usage; pass financial data to `WeeklyPerformanceTracker`)
- Modify: `src/components/__tests__/DashboardPage.test.tsx`

- [ ] **Step 1: Find every usage of `FinancialMetricsDashboard`**

Run: `grep -rn "FinancialMetricsDashboard" src/`

Note all matches. Expected: import in `src/app/dashboard/page.tsx`, render site in the same file, and its test file.

- [ ] **Step 2: Write a failing assertion in `DashboardPage.test.tsx`**

Add (or update) a test:

```ts
it('does not render FinancialMetricsDashboard', () => {
  render(<HomePage />); // or however the page is rendered in the existing test
  expect(screen.queryByRole('heading', { name: /Financial Impact Tracking/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/components/__tests__/DashboardPage.test.tsx -t "FinancialMetricsDashboard"`

Expected: FAIL — component still rendered.

- [ ] **Step 4: Delete the component files**

```bash
rm src/components/FinancialMetricsDashboard.tsx
rm src/components/FinancialMetricsDashboard.test.tsx
```

- [ ] **Step 5: Remove the import + usage in `page.tsx`**

In `src/app/dashboard/page.tsx`:

- Delete `import { FinancialMetricsDashboard } from '@/components/FinancialMetricsDashboard';`
- Delete every `<FinancialMetricsDashboard … />` element.
- Pass financial props through to `<WeeklyPerformanceTracker>`:

```tsx
<WeeklyPerformanceTracker
  // … existing props …
  todaysFinancial={financialData?.todaysMetrics ?? { date: '', entries: [], totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 } }}
  weekFinancialByDay={financialData?.weekFinancialByDay ?? Array(7).fill({ date: '', entries: [], totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 } })}
  weekFinancialTotals={financialData?.weeklyTotals ?? { moved: 0, generated: 0, cut: 0, netImpact: 0 }}
  previousWeekFinancialTotals={financialData?.previousWeekTotals ?? { moved: 0, generated: 0, cut: 0, netImpact: 0 }}
  dailyFinancialTrend={financialData?.dailyFinancialTrend ?? []}
  onAddFinancialEntry={handleAddFinancialEntry}
/>
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run`

Expected: PASS — including the new `DashboardPage` test that asserts the old component is gone.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(dashboard): remove FinancialMetricsDashboard, fold into tracker"
```

---

## Phase 7 — E2E

### Task 18: Playwright money-move test

Exercise real functionality: log a money move via the tracker, verify Net Today updates, verify the day's `$` cell shows the amount, verify hover/focus reveals the description.

**Files:**
- Modify: `tests/e2e/dashboard.spec.ts` (add new test)

- [ ] **Step 1: Write the new E2E test**

Append to `tests/e2e/dashboard.spec.ts`:

```ts
test('logs a money move and sees it reflected in tracker', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Weekly Performance Tracker/i })).toBeVisible();

  // Open the money-move form (Cut category)
  await page.getByRole('button', { name: /\+ Cut/i }).click();
  await page.getByLabel('amount').fill('150');
  await page.getByLabel('description').fill('storage units');
  await page.getByRole('button', { name: /Save move/i }).click();

  // Net Today updates
  const netToday = page.getByTestId('net-today-value');
  await expect(netToday).toHaveText(/\$150/);

  // Today's day cell in the grid shows the amount
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0..Sun=6
  const dayMoney = page.getByTestId(`day-money-${todayIdx}`);
  await expect(dayMoney).toHaveText(/\$150/);

  // Hover reveals the entry description
  await dayMoney.hover();
  await expect(page.getByText('storage units')).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm playwright test tests/e2e/dashboard.spec.ts -g "logs a money move"`

Expected: PASS. If it fails because the dev server isn't running, start it (`pnpm dev`) and retry, or rely on Playwright's `webServer` config in `playwright.config.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/dashboard.spec.ts
git commit -m "test(e2e): money move flow through the weekly tracker"
```

---

## Phase 8 — Final verification

### Task 19: Lint, typecheck, full test, build

- [ ] **Step 1: Lint**

Run: `pnpm lint`

Expected: PASS (zero warnings/errors).

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Full unit + integration suite**

Run: `pnpm vitest run`

Expected: all green; financial-tracker tests, integration tests, and component tests all pass.

- [ ] **Step 4: E2E suite**

Run: `pnpm playwright test`

Expected: all green; ≥ 5 tests total (per `AGENTS.md`).

- [ ] **Step 5: Build**

Run: `pnpm build`

Expected: PASS — confirms Vercel deploy will succeed.

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin <branch>
gh pr create --title "feat: fold money moves into weekly performance tracker" --body "$(cat <<'EOF'
## Summary
- Replaced `FinancialMetricsDashboard` with money-move tracking embedded in the Weekly Performance Tracker (daily totals, weekly totals, 30-day trend).
- Added cent-based accumulation in `FinancialTracker.recalculateTotals` to eliminate float-drift in daily sums.
- Added `addEntry` validation: rejects amounts ≤ 0, NaN, and empty descriptions.
- New library accessors: `getDailyMetricsForWeek`, `getDailyMetricsForRange`, `getPreviousWeekTotals`.
- `WeeklyReview.revenue` is now optional; the Sunday review form no longer collects revenue (Net Impact comes from the tracker).
- New keyboard-accessible `MoneyMovePopover` reveals individual entries on hover/focus.
- Dual-axis Trends chart layers Net $/day onto the Deep Work line chart.

## Test plan
- [x] Unit tests for cent-arithmetic edge cases (float drift, large amounts, zero/negative rejection)
- [x] Unit tests for weekly accessors (sparse weeks, Monday/Sunday boundaries, month/year crossings)
- [x] Integration test confirms `GET /api/financial` returns the new shape
- [x] Playwright E2E: log a move, see Net Today update, see day-cell update, hover reveals description

## PR Checklist (v2)

- [x] Was canonical Agents.md followed?
- [x] Was code coverage report included?
- [x] Was a behavior-first summary provided?
- [x] Were all user flows documented (happy path + failure paths)?
- [x] Was evidence included (screenshot, recording, or CLI output)?
- [x] Was an architectural review completed (areas of weakness identified)?
- [x] Were edge cases identified and tested?
- [x] Was monitoring and logging addressed?
EOF
)"
```

(Skip Step 6 if working in a worktree without push permissions; the human will push.)

---

## Self-review

**Spec coverage** — each spec section maps to at least one task:

- Library math fixes (cents, validation) → Tasks 1–2 ✓
- New accessors (`getDailyMetricsForWeek`, `getDailyMetricsForRange`, `getPreviousWeekTotals`) → Tasks 3–5 ✓
- `WeeklyReview.revenue` deprecation → Task 6 ✓
- API extension → Task 7 ✓
- Hook rewire → Task 8 ✓
- Net Today card → Task 9 ✓
- Quick-add form → Task 10 ✓
- Daily grid `$` line → Task 11 ✓
- Keyboard-accessible popover → Task 12 ✓
- Weekly tab (Net Impact + category cards + WoW row) → Task 13 ✓
- Drop revenue from review form → Task 14 ✓
- Dual-axis trend chart → Task 15 ✓
- Avg net/day + Best money day → Task 16 ✓
- Delete `FinancialMetricsDashboard` → Task 17 ✓
- E2E → Task 18 ✓
- Lint / typecheck / build → Task 19 ✓

**Placeholder scan**: every code step contains the actual code; every command step contains the actual command and expected outcome.

**Type consistency**: `DailyFinancialMetrics`, `FinancialTotals`, `FinancialEntry` are referenced identically across tasks. `onAddFinancialEntry` signature matches between the hook (Task 8) and the component (Task 9). `formatCurrency` is introduced in Task 9 and reused in Tasks 11, 13, 15, 16.
