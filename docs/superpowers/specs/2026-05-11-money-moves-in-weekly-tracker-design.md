# Money Moves in the Weekly Performance Tracker

**Status:** Approved (brainstorming)
**Date:** 2026-05-11
**Owner:** Nikolay

## Problem

The dashboard currently has two separate places for daily activity:

- `WeeklyPerformanceTracker` — tracks deep work hours, pipeline actions, training, Temporal target, and focus sessions on a daily and weekly cadence with trends.
- `FinancialMetricsDashboard` — tracks money "moves" (`moved`, `generated`, `cut`) and shows an ever-growing **Recent Financial Activity** list.

The recent-activity list is satisfying in the short term but becomes noise over weeks and months. The list grows; the value per row decays. Meanwhile, money moves are conceptually the same shape as the other daily metrics (a number per day, summed weekly, trended over time), so they belong inside the same tracker.

## Goal

Fold money moves into the Weekly Performance Tracker so hours and dollars are tracked side-by-side: daily totals, weekly totals, and trends. Replace the growing activity list with daily aggregates plus hover-on-demand detail.

## Non-goals

- Annualizing recurring transactions (explicitly out of scope; may revisit later).
- The conversational "Moved $12K: …" parser path (`processConversationalUpdate`) — left as-is in the library, not wired into the tracker UI.
- Changing categories or storage model — `moved | generated | cut` stay; `financial-metrics.json` stays.

## High-level architecture

- **Delete** `src/components/FinancialMetricsDashboard.tsx` and its `<FinancialMetricsDashboard … />` usage on the dashboard page.
- **Keep** `src/lib/financial-tracker.ts` as the storage/aggregation library. Add accessors needed by the tracker (see below). The `/api/financial` route, the underlying JSON store, and existing aggregation methods stay.
- **Extend** `WeeklyPerformanceTracker` with financial props and an `onAddFinancialEntry` callback. The tracker becomes the single surface for daily/weekly money tracking.
- **Rewire** `src/hooks/useDashboardData.ts` to pass financial data through to `WeeklyPerformanceTracker` instead of `FinancialMetricsDashboard`. The hook already loads financial data; only the consumer changes.

### New library accessors

Add to `FinancialTracker`:

- `getDailyMetricsForWeek(weekStartDate: string): DailyFinancialMetrics[]` — returns Mon–Sun array (length 7), with empty-day placeholders where no entries exist.
- `getDailyMetricsForRange(startDate: string, endDate: string): DailyFinancialMetrics[]` — for the 30-day trend chart.
- `getPreviousWeekTotals(): { moved; generated; cut; netImpact }` — for week-over-week deltas.

Existing methods (`getTodaysMetrics`, `getWeeklyTotals`) stay.

### New tracker props

```ts
interface WeeklyPerformanceTrackerProps {
  // … existing props …
  todaysFinancial: DailyFinancialMetrics;
  weekFinancialByDay: DailyFinancialMetrics[];          // length 7, Mon–Sun
  weekFinancialTotals: { moved; generated; cut; netImpact };
  previousWeekFinancialTotals: { moved; generated; cut; netImpact };
  dailyFinancialTrend: DailyFinancialMetrics[];         // last 30 days
  onAddFinancialEntry: (
    category: 'moved' | 'generated' | 'cut',
    amount: number,
    description: string
  ) => Promise<void>;
}
```

## UX changes

### Header (today's summary)

- The current 5-card row (Deep Work · Pipeline · Trained · Temporal · Day Status) becomes **6 cards**: Deep Work · Pipeline · Trained · Temporal · **Net Today** · Day Status.
  - Grid shifts to `md:grid-cols-6`. Mobile keeps `grid-cols-2`.
  - **Net Today** shows `todaysFinancial.totals.netImpact` formatted as currency (e.g. `$1,250`), with a small breakdown line beneath in muted text showing the three category totals: `mv $X · gen $Y · cut $Z`. The card's main number is green when positive, red when negative, neutral gray when zero.
- **Add Money Move** entry UI mirrors the existing focus quick-add pattern, placed below the cards:
  - Three buttons: `+ Moved`, `+ Generated`, `+ Cut`.
  - Clicking any button reveals a single shared inline mini-form below the button row, with the clicked category pre-selected (and changeable via a small category pill). Fields: amount (number, required, > 0) + description (text, required, non-empty); Submit / Cancel.
  - On success, the form collapses and a brief success line shows `Added! +$X generated` for ~2s (same pattern as `lastAdded` for focus sessions).
- Today's logged entries render below the form area, matching the existing "today's focus sessions" list style — small category dot, description, amount on the right.

### Daily tab (this-week grid)

- Each of the 7 day columns gains a small `$` line at the bottom showing **net for that day**, colored green / red / gray. `—` when no entries exist.
- **Hover (and keyboard focus) on the `$` value** opens a small popover listing that day's entries: category icon, amount, description, ordered by timestamp. Empty when no entries.
  - Implementation: Radix UI Tooltip if it's already in deps; otherwise a small custom popover component using Tailwind, with `tabIndex={0}` and `onFocus`/`onBlur` for keyboard accessibility.
- The 14-day deep-work / pipeline bar chart at the bottom stays unchanged. The money trend lives in the Trends tab.

### Weekly tab

- The existing **Revenue** card (currently fed by the Sunday review form's `revenue` field) becomes a **Net Impact** card sourced from `weekFinancialTotals.netImpact`. Single source of truth.
- The Sunday review form **drops its `revenue` input field**. The `WeeklyReview.revenue` type field stays as optional for backward compatibility with existing stored reviews; new submissions omit it. The review-submit handler ignores the missing field gracefully.
- Add three small cards alongside Net Impact: **Moved**, **Generated**, **Cut** (week totals, with last-week numbers underneath like other cards).
- The **Week-over-Week** comparison block gains one row: **Net Impact** (`$prev → $current`, green if higher).
- Pipeline / Deep Work / Consistency cards stay as-is.

### Trends tab

- The existing 30-day Deep Work line chart becomes a **dual-axis line chart**:
  - Left Y-axis: deep work hours (0–8), blue line — unchanged.
  - Right Y-axis: net money impact ($/day), green line.
  - 3h target reference line stays.
  - Tooltip shows both values for the hovered day.
  - Empty state stays the same; chart renders when either dataset has values.
- **Performance Summary block** gains two rows:
  - **Avg net/day**: average of `dailyFinancialTrend[*].totals.netImpact` over the tracked window.
  - **Best money day**: max single-day netImpact (date + value).

### Empty states

- New tracker user with no financial entries: Net Today card shows `--`, Weekly cards show `$0`, Trends chart renders only the deep-work line.
- The "log a money move" UI is always available regardless of data presence.

## Data flow

```
/api/financial (existing)
   └─> useDashboardData (existing, rewired)
         └─> WeeklyPerformanceTracker (new financial props)
                ├─ header: Net Today card + entry form
                ├─ daily grid: per-day $ with hover popover
                ├─ weekly cards: Net Impact / Moved / Gen / Cut
                └─ trends chart: dual-axis (hours + net $)
```

`onAddFinancialEntry` posts to `/api/financial` (existing endpoint), which calls `FinancialTracker.addEntry`. On success, the hook revalidates and the tracker re-renders with the new totals.

## Error handling

- Add-entry form: client-side validation (positive amount, non-empty description). Server errors surface inline ("Couldn't save — try again") without dismissing the form.
- Library load failure (corrupt `financial-metrics.json`) is already handled by `loadJSON` defaults. Tracker renders empty financial state in that case.
- Hover popover with no entries (zero-day): popover shows "No moves logged".

## Testing

Per repo rules: integration tests should outnumber unit tests; E2E must exercise real functionality (no visibility-only); the majority of tests hit real storage / API with no mocking; test data is cleaned up rather than mocked away.

### Calculation tests (the highest-value layer)

The aggregation math is the part most likely to regress silently and the cheapest to test thoroughly. These run as pure-library tests in `src/lib/financial-tracker.test.ts` (new) — no React, no API, just `FinancialTracker` and a temp data dir.

**Daily total / `netImpact`**

- Empty day → `{ moved: 0, generated: 0, cut: 0, netImpact: 0 }`.
- Single entry per category → totals reflect that single value; the other two categories stay `0`.
- Multiple entries in the same category on the same day sum correctly (e.g., three `cut` entries of `100`, `50`, `25` → `cut: 175`).
- All three categories on the same day → `netImpact` equals the sum of the three category totals exactly.
- Decimal amounts (cents): `49.99 + 0.01 + 100.00 → 150.00` exactly. Use `Math.round((a + b) * 100) / 100` semantics or a cent-based integer accumulator inside `recalculateTotals` to avoid `0.1 + 0.2 === 0.30000000000000004` drift. **This is a behavior change**: add an explicit test that proves the result is `150` and not `149.99…` or `150.00000…1`.
- Large amounts (e.g., `1_500_000`) sum without precision loss.
- Zero-amount entry is rejected by `addEntry` (today the function would store it; the new contract requires `amount > 0` and throws / returns an error). New test asserts the rejection.
- Removing an entry (if/when supported) recomputes totals correctly — out of scope here; left as a TODO if delete support is added later.

**Weekly totals (`getWeeklyTotals` / `getDailyMetricsForWeek`)**

- No entries anywhere in the week → all four totals `0`; `getDailyMetricsForWeek` returns a length-7 array of empty `DailyFinancialMetrics`, one per Mon–Sun.
- Sparse week (only Wednesday has entries) → array length still 7; only index 2 (Wed) has non-empty entries; weekly totals equal the Wednesday totals.
- Full week of entries → weekly totals equal the sum across all 7 daily totals.
- Week starts on Monday (`weekStartDate` matches `currentWeekSummary.weekStartDate`). An entry timestamped on the prior Sunday is **not** in the current week; an entry timestamped on the upcoming Sunday **is**.
- Week spanning a month boundary (e.g., Mon Apr 28 → Sun May 4): all seven days included; totals correct.
- Week spanning a year boundary (Dec 29 → Jan 4): same — verify no off-by-one.
- DST transition week (US spring-forward and fall-back): seven entries on seven calendar days still produce length-7 array with correct day indexing.

**Previous-week totals & week-over-week**

- No previous week data → `previousWeekFinancialTotals` returns all `0`s; the WoW row in the UI shows `$0 → $X`.
- Previous week `0`, current `> 0` → delta positive, "better" flag true.
- Previous week `> 0`, current `0` → delta negative, "better" flag false.
- Both zero → delta `0`, neutral (not flagged red).
- Identical totals → delta `0`, "better" defaults to true (matches existing `>=` convention in `ComparisonRow`).

**30-day trend (`getDailyMetricsForRange`)**

- Range with no entries → returns 30 entries (one per day), each empty.
- Range with sparse entries (only 3 of 30 days have data) → all 30 days present; gap days are zero-filled.
- Range whose end date is "today" includes today's partial entries.
- Range that crosses a month boundary still produces contiguous, in-order daily metrics.

**Trends-tab derived stats**

- **Avg net/day** over 30 days: when only 5 days have entries, the average is `sum / 30` (not `sum / 5`) — anchor the denominator decision in a test so it can't drift silently. (Decision: divide by **days in range**, not days with entries, because empty days are real zero-impact days.)
- **Best money day**: returns the date and value of the single max `netImpact`. Ties broken by **earliest date** (deterministic, easy to reason about). Test both a no-tie case and a tie case.
- Empty trend window → Avg net/day is `0`, Best money day is `null` (UI renders `—`).

**Format / display**

- Currency formatter rendering: `0 → $0`, `1234 → $1,234`, `1500 → $1,500` (no K-collapse below 10k for tracker context — different from the dashboard's `formatCurrency` which uses K at 1k). Pin this in a test; the new formatter lives next to the component.
- Sign color logic: `> 0 → green`, `< 0 → red`, `=== 0 → gray` — tested at the component layer once the formatter is verified at the lib layer.

### Component tests (`src/components/WeeklyPerformanceTracker.test.tsx`)

- Renders Net Today card with correct value and the three-category breakdown line.
- Renders day-grid `$` value per day; color class reflects sign per the rules above.
- Hovering a day's `$` reveals that day's entries; keyboard focus on the same target reveals the same popover. Empty-day popover shows "No moves logged".
- "Add Money Move" form: clicking each of the three category buttons preselects that category; submitting calls `onAddFinancialEntry(category, amount, description)` with the exact args; form collapses on success; success line renders for ~2s.
- Invalid input (empty description, `0`, negative) keeps the Submit button disabled or surfaces inline errors; `onAddFinancialEntry` is not called.
- Weekly Net Impact card pulls from `weekFinancialTotals`, not from any review-form value (regression guard against the old Revenue field path).
- Trends dual-axis chart renders both series when both have data; renders only deep work when financial trend is all zeros; renders empty state when both are empty.

### Integration tests (`src/__tests__/integration/api.integration.test.ts`)

Real DB / real API — no mocks. The point is that the math survives the round-trip.

- `POST /api/financial` for three categories on the same day, then `GET` the dashboard data: today's totals match the sums; daily metrics for the week reflect the new entry; weekly Net Impact equals the sum of all three.
- Two `POST`s for different days within the same week: weekly totals equal the sum across days; per-day metrics are isolated to their dates.
- `POST` an entry timestamped at 23:59 on Sunday vs. 00:01 on Monday: the entries land in the correct week. (Use explicit date strings, not "now".)
- Reload after server restart: stored entries survive; aggregations are identical (proves recalculation is deterministic, not stateful).

### E2E (Playwright)

Must exercise real functionality. Maintain the existing ≥ 5 count; this change adds at least one new test:

- User logs a money move via the tracker → page reloads → Net Today card updates with the new sum → that day's `$` value appears in the grid → hovering / focusing the `$` reveals the entry's description.

### Test data cleanup

Tests write to a temp data dir per existing convention (`workspace-reader` pattern). After each test, the dir is removed. No mocking of `financial-tracker` — real storage, real reads, real reads-after-writes.

## Migration / backward compatibility

- Existing `financial-metrics.json` works unchanged.
- Existing weekly reviews keep their `revenue` field in storage. The form no longer surfaces it, so it stops being updated. No data migration script needed.
- `FinancialMetricsDashboard` deletion removes the component file and its imports; no other consumers exist.

## Areas of weakness (architect review)

- **Header density**: 6 cards on `md:` may feel cramped on narrow tablets. Mitigation: keep `grid-cols-2` on small screens; if the 6-col layout looks tight at 768–900px, drop to `md:grid-cols-3` and `lg:grid-cols-6`.
- **Popover accessibility**: hover-only popovers are an accessibility trap. The keyboard-focus path is mandatory, not optional.
- **Dual-axis charts** can mislead at a glance (two scales). Tooltip values + clear axis labels are required; consider a small legend.
- **Revenue field deprecation**: dropping the input but keeping the type field is a soft migration. If `revenue` is later removed from the type, run a migration that strips it from stored reviews.
- **Conversational parser drift**: leaving `processConversationalUpdate` in the library but not wiring it to the UI means it can rot. Acceptable for now; flag for removal if unused after this change ships.

## Edge cases

- Same-day duplicate entries → both stored; daily total = sum; popover lists both.
- Negative `cut` entry (savings recorded as positive but conceptually a reduction) — current model treats all categories as positive numbers contributing to `netImpact`. Preserve this; do not introduce signed amounts.
- Day with only `moved` entries (reallocation, not net new money) — netImpact still shows the moved total. Acceptable per current model.
- Week boundary at Sunday midnight: ensure `getDailyMetricsForWeek` uses the same `weekStartDate` convention as `currentWeekSummary` (Monday-based).
- Hovering between adjacent day popovers — debounce close so quick mouse movement doesn't flicker.

## Monitoring & logging

- `addEntry` already runs through the storage layer; existing logs cover writes. Add an info-level log on successful add (`category`, `amount`) in the API route handler if not already present.
- Surface `/api/financial` 4xx/5xx counts on the existing observability dashboard (no new instrumentation required if the route is already instrumented; verify during implementation).
