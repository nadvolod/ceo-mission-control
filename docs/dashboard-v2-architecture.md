# Mission Control v2 — Architecture Reference

The v2 dashboard at `/dashboard/v2` is a redesign of `/dashboard` that lives
alongside the legacy page. Both routes share the same data layer; v2 only
changes the UI shell, the optimistic logging path, and the dark-skin
primitives. This doc is the map.

---

## 1 · Layout

```
src/
├── app/dashboard/
│   ├── page.tsx                       # legacy /dashboard (untouched)
│   └── v2/page.tsx                    # new /dashboard/v2 shell
├── components/dashboard/v2/
│   ├── primitives/
│   │   ├── Aurora.tsx                 # page backdrop (radial gradient)
│   │   ├── OrbitStar.tsx              # brand mark
│   │   └── Sparkline.tsx              # inline SVG, no deps
│   ├── palette.ts                     # MC_COLORS, METRIC_ACCENTS, Chip type
│   ├── types.ts                       # MetricId, MetricSnapshot, ActivityEntry
│   ├── format.ts                      # fmtMetric(), clamp()
│   ├── derive.ts                      # deriveActivity, deriveChips, consecutiveStreak
│   ├── ActivityFeed.tsx               # right-rail live feed
│   ├── ChipStrip.tsx                  # streak / cash-MoM / sync chips
│   ├── CmdK.tsx                       # ⌘K command palette (Radix Dialog)
│   ├── CollapsiblePanel.tsx           # disclosure wrapper
│   ├── InsightsTab.tsx                # Insights body (period selector + cards)
│   ├── MetricCard.tsx                 # the hero primitive
│   ├── ReflectionDrawer.tsx           # T3T side sheet
│   ├── ReviewTab.tsx                  # Review body (monthly review surface)
│   ├── TrendsPanel.tsx                # Overview's 3-column trend strip
│   ├── useMissionStore.ts             # the v2 hook (wraps useDashboardData)
│   └── __tests__/                     # jest + __fixtures__/ (test-only data)
├── hooks/
│   └── useDashboardData.ts            # canonical data hook (shared with legacy)
└── lib/
    ├── dates.ts                       # localDate / localDateInTz / isLocalDateKey
    ├── focus-tracker.ts               # per-category daily focus hours
    ├── financial-tracker.ts           # moved / generated / cut entries
    └── weekly-tracker.ts              # deepWorkHours / pipelineActions / trained
```

---

## 2 · Data flow

```
                      Postgres (Neon)                       
                            ▲                               
                            │ via @neondatabase/serverless  
                            │                               
   ┌─────────────────── server-side lib/*-tracker ───────┐  
   │  FocusTracker  FinancialTracker  WeeklyTracker      │  
   │  ThreeToThriveTracker  MonarchService               │  
   │  ↑ all take an optional `todayKey` arg              │  
   └──────────────────────────────────────────────────────┘  
                            ▲                               
                            │ /api/{financial,focus-hours,  
                            │  weekly-tracker,three-to-     
                            │  thrive,temporal,monarch,...} 
                            │   (POST adds, GET reads;      
                            │    every "today" GET/POST     
                            │    accepts ?date=YYYY-MM-DD   
                            │    or body.date)              
                            ▲                               
                            │                               
  ┌────────── useDashboardData (client hook) ──────────┐    
  │  fetches everything in parallel on mount + on demand │  
  │  computes `today = localDate()` once and pins every  │  
  │  "today" GET to it (?date=…)                         │  
  │  exposes: monarchData, focusData, financialData,     │  
  │           weeklyTrackerData, monthlyReviewData,      │  
  │           threeToThriveData, plus handle* mutations  │  
  └──────────────────────────────────────────────────────┘  
                            ▲                               
                            │ used directly by /dashboard   
                            │ wrapped by useMissionStore    
                            │ for /dashboard/v2             
                            ▲                               
  ┌──────────── useMissionStore (v2-only) ─────────────┐    
  │  - flattens metric data into MetricSnapshot map      │  
  │  - exposes log(metricId, delta, label) which:        │  
  │      1. optimistically updates overlay + activity    │  
  │      2. POSTs to the matching /api endpoint          │  
  │      3. on success, refreshes via useDashboardData   │  
  │         and commits the optimistic mutation          │  
  │      4. on error, rolls back and surfaces a toast    │  
  │  - exposes activity, toast, threeToThrive, etc.      │  
  └──────────────────────────────────────────────────────┘  
                            ▲                               
                            │                               
              src/app/dashboard/v2/page.tsx                 
              ── ChipStrip, MetricCard grid, CmdK,          
                 ReflectionDrawer, Tab body                 
                 (Overview | Insights | Review)             
```

### Metric ID → API endpoint

| metricId    | endpoint                                | category / action                |
| ----------- | --------------------------------------- | -------------------------------- |
| `temporal`  | `POST /api/focus-hours` (addSession)    | category=`Temporal`              |
| `pipeline`  | `POST /api/focus-hours` (addSession)    | category=`Revenue`               |
| `deepWork`  | `POST /api/focus-hours` (addSession)    | category=`Other` (convention)    |
| `moneyMoved`| `POST /api/financial` (addEntry)        | category=moved/generated/cut by label |
| `trained`   | `POST /api/weekly-tracker` (addToDay)   | sets `setTrained: true`          |
| `cash` / `netWorth` / `debt` / `cashMoM` | (read-only)        | sourced from Monarch sync         |

### Tab → body component

| tab        | body component             | data source                                              |
| ---------- | -------------------------- | -------------------------------------------------------- |
| `overview` | CollapsiblePanels in page  | live activity + T3T + Trends                             |
| `insights` | `<InsightsTab>`            | `focusData.dailyTrend`, `financialData.dailyFinancialTrend`, `weeklyTrackerData.dailyTrend` |
| `review`   | `<ReviewTab>`              | `monthlyReviewData` (currentMonthReview, recentReviews, ratingsTrend) |

---

## 3 · Hard rules

These rules are enforced by tests and runtime checks, not by convention.

### R1 · No fixtures in production code

- Fake/seed values for design parity live **only** in `src/components/dashboard/v2/__tests__/__fixtures__.ts`.
- Every export is prefixed `__FIXTURE_` so accidental production imports are glaring in review.
- The module throws at load time if `process.env.NODE_ENV === 'production'`.
- `src/components/dashboard/v2/__tests__/no-fixture-leak.test.ts` walks every production source file and fails if any of them import `__FIXTURE_*` or the `__fixtures__` module.

If a UI surface has no data, it must render an **empty state**, not a fallback to fixture rows. The original SEED_ACTIVITY fallback (`"+ Generated $2,000 · Annual contract · Vega"`) leaked into real users' screens — that bug class is now structurally prevented.

### R2 · Local-day, not UTC-day

- Every "today" computation goes through `src/lib/dates.ts::localDate()` (client local zone) or `localDateInTz(d, tz)` (explicit IANA zone).
- The pattern `new Date().toISOString().split('T')[0]` is BANNED on the hot path. It returns the UTC date — at 9 pm EST that's already tomorrow, so anything logged in the evening landed on the wrong day.
- Server endpoints accept the client's local date as a `?date=` query (GETs) or `date` body field (POSTs). The trackers' `getTodaysMetrics(todayKey?)` methods accept an optional key and fall back to server-local.
- `isLocalDateKey()` validates the string semantically (rejects `"2026-13-40"`, `"__proto__"`, etc.) before any code uses it as an object key.

### R3 · Optimistic mutations are recoverable

- `useMissionStore.log()` always dispatches the optimistic update **first**.
- On server success → refresh `useDashboardData`, then commit (drop the local overlay).
- On server error → roll back the overlay, remove the optimistic activity row, surface a toast.
- Concurrent in-flight logs each commit independently; one slow log doesn't strand another's optimistic state.

### R4 · `mc-root` scope for dark text styles

- The legacy landing page has a global `input, select, textarea { color: #171717 }` rule. The v2 dashboard sets a darker background, so we scope the dark-on-light override to `.mc-root` — every v2 surface (page, drawer, palette dialog) carries that class.

---

## 4 · Verification

| Check                                | How                                                                  |
| ------------------------------------ | -------------------------------------------------------------------- |
| Unit tests pass                      | `npx jest --testPathIgnorePatterns=…` (see jest.config.js)           |
| Type check                           | `npx tsc --noEmit`                                                   |
| Lint                                 | `npx eslint src tests`                                               |
| E2E (needs DATABASE_URL + secrets)   | `npx playwright test`                                                |
| Visual parity vs. legacy `/dashboard`| Manual: open both routes side-by-side, log on one, refresh the other |
| Production build                     | `npx next build` — `/dashboard/v2` registers as `○ static`            |

---

## 5 · Out of scope / known follow-ups

The following are tracked as separate work, **not** addressed by the v2 PR chain:

- `src/app/api/auth/{login,logout}/route.ts` still uses UTC date keys for audit logs. Not on the v2 hot path; affecting which calendar day a session login is filed under in `audit_log`.
- `src/lib/monthly-review-tracker.ts:115` — monthly fallback uses UTC.
- `src/lib/task-api.ts:67` — task "today" filter uses UTC. (Tasks panel has been removed from v2, so this only impacts the legacy dashboard.)
- `src/components/HealthIntelligenceDashboard.tsx:34` — health-data cutoff uses UTC.
- `src/lib/workspace-reader.ts:82` — scorecard markdown date fallback uses UTC.
- The "trained" preset uses `addToDay` which is additive but reads/writes a single day's `PerformanceDayEntry`. If a future preset needs to write `deepWorkHours` / `pipelineActions` from v2 without overwriting the others, it should also use `addToDay` (which the lib supports) — not `logDay` (set-not-add).
- Insights & Review are read-only. Edit/submit flows still live in `/dashboard`. When we flip the default route, those flows need to land in v2 too.

---

## 6 · Switching `/dashboard` over to v2

When the team is ready:

1. Move `src/app/dashboard/page.tsx` → `src/app/dashboard/legacy/page.tsx` (or delete).
2. Move `src/app/dashboard/v2/page.tsx` → `src/app/dashboard/page.tsx`.
3. Remove the `Link href="/dashboard"` "← Old dashboard" pill in the header.
4. Update any tests that still navigate to `/dashboard/v2`.
5. Update `tests/e2e/dashboard-v2.spec.ts` paths.

The Playwright `parity` test in the spec is the canary — it asserts that `/dashboard/v2` shows the same Temporal hours as `/api/focus-hours` returns. As long as that test passes, the two routes are observing the same data.
