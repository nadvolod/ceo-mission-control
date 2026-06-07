# Unified Home-Screen Activity Log + Fixes (dashboard-v2)

**Date:** 2026-06-06
**Branch:** `feat/morning-log-v2` (or a fresh feature branch off `main`)
**Status:** Approved design — ready for implementation plan

## Problem

Activity in dashboard-v2 is dispersed across multiple surfaces, which makes the
home screen feel fragmented:

- The desktop `ActivityFeed` (right column) and mobile `RecentActivity` show only
  **focus** and **financial** events.
- The **Morning Log** lives in its own `MorningLogDrawer`, opened by a `Moon`
  icon that reads like a dark-mode toggle.
- **Reflections** (Three-to-Thrive) show only inline in their own panel.
- Category options (supplements, habits, sleep-environment fields) can be **added
  but not edited or removed**.
- **Mobile Insights & Review** tabs render placeholder text instead of content.
- The mobile Quick Log grid has `+ Call` and `+ Demo` buttons the user wants gone.

## Goal

Make the home page the single place to see **all** activity — financial, focus,
morning log, and reflections — in one chronological feed, with tap-to-expand
detail. Plus a set of targeted fixes (editable categories, icon swap, removed
quick actions, working mobile tabs).

## Decisions (locked with user)

1. **Morning log in feed** → one **summary card per day** (score · time slept ·
   # supplements · # habits). Tap to see full detail.
2. **Tap behavior** → opens a **read-only detail view**; editing stays in the
   Morning Log / Reflection drawers (separate view vs. edit).
3. **Open icon** → `NotebookPen` (replacing `Moon`).
4. **Reflections in feed** → summary card in the feed **and** keep the inline
   Three-to-Thrive panel on the overview.
5. **Call/Demo removal** → remove **everywhere** (mobile Quick Log, desktop
   `MetricCard` pipeline presets, `CmdK` palette). Keep `+ Train` and `+ FU`.
6. **Detail payload** → **lookup-by-reference** (entry carries a lightweight
   `source` + key; detail sheet reads the full record from existing data hooks).

---

## Architecture

### Data flow today

`deriveActivity()` (`src/components/dashboard/v2/derive.ts`) merges `focus` +
`financial` entries (plus optimistic local rows) into `ActivityEntry[]`, dedups
by id, sorts newest-first by `tsMs`, and filters E2E-authored rows. The result is
rendered by `ActivityFeed` (desktop) and `RecentActivity` (mobile).

### Data flow after

`deriveActivity()` additionally folds in **morning logs** and **reflections**:

```text
deriveActivity({ focus, financial, morning, reflection, optimistic, limit })
  → [...optimistic, focus→, financial→, morning→, reflection→]
  → dedup by id → sort by tsMs desc → filter E2E rows → slice(limit)
```

---

## Components & changes

### 1. Unified activity feed

**`src/components/dashboard/v2/types.ts`** — extend `ActivityEntry`:

- Add `source: 'money' | 'focus' | 'morning' | 'reflection'` (discriminator).
- Add `refKey: string` — the lookup key for the detail sheet (date for
  morning/reflection; entry id for money/focus). The detail sheet resolves the
  full record from data hooks, not from the entry itself (lookup-by-reference).

**`src/components/dashboard/v2/derive.ts`** — new mappers + inputs:

- `morningToActivity(note: DailyHealthNote): ActivityEntry`
  - `source: 'morning'`, label `"Morning Log"`, `delta: ''`,
    `meta: "Sleep {score} · {h}h{m}m · {n} supplements · {k} habits"`,
    `tsMs` from `loggedAt`, `refKey = note.date`.
- `reflectionToActivity(entry): ActivityEntry`
  - `source: 'reflection'`, label `"Reflection"`, `delta: ''`,
    `meta: "{answered} of {total} answered"`, `tsMs` from the entry,
    `refKey = entry.date`.
- `focusToActivity` / `financialToActivity` set `source` + `refKey` (`entry.id`).
- `deriveActivity(opts)` gains `morning?: DailyHealthNote[]` and
  `reflection?: ReflectionEntryLike[]`; same dedup/sort/E2E-filter pipeline.

**`src/app/dashboard/page.tsx`** and **`MobileLayout.tsx`** — pass `morning` and
`reflection` data into `deriveActivity()` from the existing hooks/store.

### 2. Tap → read-only detail sheet

- **`ActivityFeed.tsx` / `RecentActivity`** — `ActivityRow` becomes a `<button>`;
  on click it calls `onOpenDetail(entry)`.
- **New `ActivityDetailSheet.tsx`** — a read-only sheet (reuse existing
  drawer/sheet styling). Given `{ source, refKey }` it resolves and renders:
  - **morning** → `useHealthData` note for `refKey`: full sleep metrics,
    environment, supplements (name + dosage + taken), habits, freeform note.
  - **reflection** → store reflection for `refKey`: each question + answer.
  - **money** → financial entry by id: amount, category, note, timestamp.
  - **focus** → focus session by id: category, hours, description, timestamp.
  - Each variant shows an **"Edit"** button that opens the relevant editor
    drawer (Morning Log / Reflection); money & focus edit is out of scope here.
- State for the open detail entry lives in `page.tsx` and `MobileLayout` (or a
  shared hook), mirroring how `morningOpen` / `reflectOpen` are handled today.

### 3. Editable / removable categories

- **`src/lib/health-notes-tracker.ts`** — add alongside existing `add*`:
  - `editSupplement(name, patch)` / `removeSupplement(name)`
  - `editHabit(name, newName)` / `removeHabit(name)`
  - `editEnvField(name, newName)` / `removeEnvField(name)`
  - **Semantics:** mutations affect the **template** (future logs) only. Past
    `DailyHealthNote` records are left intact — history is never rewritten.
- **`src/app/api/health-notes/route.ts`** — extend to persist template
  edit/remove (e.g. `PATCH`/`DELETE` template actions). Structured logging on
  each mutation path.
- **`MorningLogDrawer.tsx`** — render inline edit (rename / dosage) + remove
  controls for each supplement, habit, and environment custom field.

### 4. Icon swap

- Replace `Moon` with `NotebookPen` (lucide-react) in:
  - `MorningLogDrawer.tsx` header icon.
  - `MobileLayout.tsx` `MobileHeader` morning-log button.
  - Add a small `NotebookPen` to the desktop "Morning" text button in
    `page.tsx`.
- Remove now-unused `Moon` imports.

### 5. Remove Call/Demo (keep Train, keep + FU)

- **`MobileLayout.tsx` `QUICK_ACTIONS`** — drop `+ Call`, `+ Demo`. Keep
  `+ Moved`, `+ Generated`, `+ Deep 0.5h`, `+ Train`.
- **`MetricCard.tsx`** pipeline presets — drop Call/Demo, keep `+ FU`.
- **`CmdK.tsx`** — remove the `+call` / `+demo` commands.
- Update referencing tests: `__tests__/MobileLayout.test.tsx` (the `+Call` test),
  `__tests__/useMissionStore.test.tsx`.

### 6. Mobile Insights & Review render

- **`MobileLayout.tsx`** — replace the placeholder text blocks for
  `tab === 'insights'` and `tab === 'review'` with the real `<InsightsTab>` and
  `<ReviewTab>` components.
- Thread the props those components need (`focusData?.dailyTrend`,
  `financialData?.dailyFinancialTrend`, review history) from `page.tsx` into
  `MobileLayout` via new props.

---

## Error handling & edge cases

- **No data**: feed shows existing "No activity yet today." empty state; morning
  log with no entry produces no card; detail sheet for a missing record shows a
  graceful "No data" message instead of crashing.
- **Partial morning log**: meta summary tolerates missing metrics (NaN-safe, in
  line with the recent NaN-safe metric work).
- **Remove an in-use template item**: only future logs are affected; the detail
  sheet for a past note still shows the removed item from that note's record.
- **Timezone / cross-day**: reuse existing `tsMs` epoch sort so morning logs and
  reflections order correctly across day boundaries (the prior EST day-bug fix).
- **E2E rows**: morning/reflection mappers respect the same E2E-description
  filter so test data never leaks into a real feed.
- **Optimistic vs server**: morning/reflection entries dedup by id like focus/
  financial; optimistic rows win on id collision.

## Testing strategy (per AGENTS.md)

Majority integration tests (real DB/API, no mocking), minority unit, plus E2E.

- **Integration**: `/api/health-notes` template edit + remove round-trips
  (add → edit → remove → verify persisted template and that past notes are
  unchanged).
- **Unit**: `derive.ts` `morningToActivity` / `reflectionToActivity` mapping and
  `deriveActivity` ordering with all four sources; `ActivityDetailSheet`
  rendering per source incl. missing-record fallback.
- **E2E (≥5 Playwright, localhost, real browser)**:
  1. Morning log appears as a summary card in the home feed → tap → detail sheet
     shows full sleep metrics.
  2. Reflection appears as a summary card in the feed.
  3. Mobile Insights tab opens and renders cards; Review tab opens and renders.
  4. Edit + remove a supplement in the Morning Log drawer; reload → change
     persisted.
  5. Call/Demo absent from Quick Log; `+ Train` still logs to the trained metric.

## Monitoring & logging

- Structured server logs on the new health-notes template mutation paths
  (action, item, outcome).
- Client: detail-sheet lookups guard against missing records and log a warning
  rather than throwing.

## Architectural review (weaknesses)

1. **Feed entry coupling** — mitigated by lookup-by-reference: the entry stays
   lean (`source` + `refKey`); the detail sheet owns resolution from data hooks,
   keeping a single source of truth.
2. **`MorningLogDrawer` size** — already large (~940 lines). Adding edit/remove
   controls risks bloat; extract the per-category editable list into a small
   reusable subcomponent (e.g. `EditableItemList`) to keep the drawer readable.
3. **Prop threading into `MobileLayout`** — rendering Insights/Review on mobile
   adds several new props. Keep them grouped (e.g. a single `tabData` prop) to
   avoid a long parameter list.

## Out of scope

- Editing money/focus entries from the detail sheet (view-only there).
- Backend schema changes beyond template edit/remove.
- Any change to the Three-to-Thrive panel itself (it stays as-is).
