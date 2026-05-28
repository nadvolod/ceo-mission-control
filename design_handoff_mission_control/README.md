# Mission Control — Redesign Handoff

> **Chosen direction:** ★ **Conservative · Dark** (V1·D)
> The prototype canvas explored three directions; the user committed to the dark UV palette skin on the conservative layout. Build this one. The others (V1 light, V2 trading terminal, V3 experimental/Raycast) are kept in the prototype only for visual reference.

---

## Overview

This is a redesign of the **Mission Control** dashboard at `ceo-mission-control/` — Nikolay's executive ops console for portfolio, financial, and focus tracking. The redesign converts the current page from a stacked "productivity workspace" into a compressed, glanceable **operations console** in the spirit of Linear / Raycast / modern trading terminals.

The job changes:
- **Primary**: glance current state · log/update metrics in one action
- **Secondary**: review trends and reflect (relegated to drawers and collapsible panels, not primary scroll real estate)

The visual character is dark, UV-violet-accented, with techy monospace numerals and aurora gradients. The single most distinctive design move is the **⌘K command palette** as the primary input surface — every quick-log action is one keystroke + Enter away.

See `source_brief.md` for the user's original strategy document — it lays out the structural diagnosis, jobs-to-be-done, and the phase plan. **Read it first.**

---

## About the design files

The files in `prototype/` are **design references created in HTML/React** — runnable prototypes showing intended look and behavior. They are **not production code to copy directly.** They use:
- Inline styles (intentional, for fast iteration on the canvas)
- A shared `MissionProvider` mock store with in-memory state
- A `design_canvas` wrapper that presents 3 variations side by side

Your task is to **recreate this design in the existing `ceo-mission-control/` Next.js codebase** using its established patterns (App Router, TypeScript, Tailwind, shadcn/ui, the existing `useDashboardData` hook, `/api/*` routes, and the existing trackers in `src/lib/*-tracker.ts`).

**Run the prototype:** open `prototype/Mission Control.html` in a browser. The **★ Conservative · Dark** section at the top is the spec. Try ⌘K, click a `+0.5h` button, click a metric value to edit it inline.

---

## Fidelity

**High-fidelity.** Every color, font, size, radius, animation timing, and interaction is intentional. Match it closely. The only intentional deviations from the prototype when porting:
- Inline styles → Tailwind utility classes + CSS variables
- Inline SVG icons → `lucide-react` (the project already uses Lucide via shadcn)
- Mock `useMission` store → existing `useDashboardData` + new `useLog` mutation
- HTML page → Next.js route at `src/app/dashboard/page.tsx`

---

## Mapping to the existing codebase

The target repo is `ceo-mission-control/`. Here's what changes:

### Files to **delete**
The redesign deletes a large amount of UI surface. Remove these (they're called out as low-value in the source brief):

- `src/components/MissionTracker.tsx` — the "Mission Command" $1M/5-person panel — out
- `src/components/PriorityDashboard.tsx` — initiative-ranking dashboard — out
- `src/components/FocusOptimization.tsx` — duplicate of WeeklyPerformanceTracker — out
- `src/components/MonthlyReviewTracker.tsx` — moves into the Reflection drawer instead
- `src/components/DashboardTabs.tsx` — replaced by the new 3-tab top-nav inside the new dashboard
- `src/components/FocusHoursTracker.tsx` — folded into MetricCard
- `src/components/RevenueProjectionWidget.tsx` — out (covered by metric cards)

Keep their **business logic** (under `src/lib/*-tracker.ts`) — only the UI components are removed.

### Files to **rewrite**

- `src/app/dashboard/page.tsx` — becomes the new console layout (see "Desktop layout" below)
- `src/components/ThreeToThrive.tsx` — becomes a compact 3-row inline component (collapsible panel on desktop, full drawer on mobile/tablet)
- `src/components/FinancialCommandCenter.tsx` — its data flows into `MetricCard`s; the component itself goes away
- `src/components/WeeklyPerformanceTracker.tsx` — its chart becomes part of the new `Insights` tab; the daily/weekly logging UI is replaced by `MetricCard`s and ⌘K
- `src/components/TaskDashboard.tsx` — becomes a compact collapsible panel in the new dashboard
- `src/components/TemporalTracker.tsx` — its quick-log buttons live inside the Temporal `MetricCard` now

### New components to **add**

Under `src/components/dashboard/`:

```
dashboard/
  MetricCard.tsx          ← the hero primitive
  CmdK.tsx                ← ⌘K command palette (uses shadcn's Command + Dialog)
  ActivityFeed.tsx        ← live tape on the right rail
  ChipStrip.tsx           ← anomaly/streak chips above the metric grid
  ReflectionDrawer.tsx    ← shadcn Sheet variant for Three to Thrive
  CollapsiblePanel.tsx    ← thin wrapper around shadcn Collapsible
  primitives/
    Sparkline.tsx
    Ring.tsx              ← progress ring (used in mobile)
    OrbitStar.tsx         ← the 4-point orbital, rotating
    Aurora.tsx            ← page-level radial gradient backdrop
    InlineNumber.tsx      ← click-to-edit numeric input
    Ticker.tsx            ← animated count-to-value (optional, used on mobile hero)
  hooks/
    useMissionStore.ts    ← wraps useDashboardData with optimistic log()
    useCmdK.ts            ← ⌘K keyboard handler, returns { open, setOpen }
```

### Existing things to **keep + integrate**

- `src/hooks/useDashboardData.ts` — current source of truth. Extend it with an optimistic `log(metricId, delta, label)` action that POSTs and updates local cache immediately.
- `src/lib/three-to-thrive.ts`, `src/lib/weekly-tracker.ts`, `src/lib/financial-tracker.ts`, `src/lib/focus-tracker.ts` — keep all of these. They already model the data correctly. The redesign only changes the UI consuming them.
- `src/lib/types.ts` — extend with `ActivityEntry`, `MetricSnapshot`, `Streak`, `AnomalyChip` types (shapes below).
- shadcn primitives already in the repo (Dialog, Sheet, Command, Collapsible, Tooltip) — reuse, don't reinvent.

---

## Screens / Views

### 1. Desktop · Overview (the default)

**Reference:** the **★ Conservative · Dark** desktop artboard in the prototype (1280×880).

**Layout (top → bottom):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER (sticky, 56px)                                                │
│  [orbit-star]  Mission Control   WED · 2026-05-27 · 09:12            │
│  [Overview] [Insights] [Review]      [⌘K search] [+ Log]            │
├─────────────────────────────────────────────────────────────────────┤
│ CHIP STRIP (28px)                                                    │
│  🔥 6-day Temporal · longest in 30d   ▲ Cash MoM +228%               │
│  ⚡ Deep work pace ↓ vs 14-day avg     SYNC · monarch · 4m ago        │
├─────────────────────────────────────────────────────────────────────┤
│ METRIC GRID (6 columns, equal width, 134px tall each)                │
│  [Cash] [NetWorth] [Temporal] [Pipeline] [DeepWork] [MoneyMoved]    │
├─────────────────────────────────────────────────────────────────────┤
│ MAIN GRID (2 columns: 1fr / 320px)                                   │
│  ┌──────────────────────────────────┐  ┌──────────────────────────┐ │
│  │ Three to Thrive (collapsible)    │  │ Activity (live)          │ │
│  │ Trends · last 14d (collapsible)  │  │   09:12 +1h Temporal     │ │
│  │ Tasks (collapsible)              │  │   09:15 + Gen $2,000     │ │
│  │                                  │  │   ...                    │ │
│  └──────────────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Container:**
- `position: relative`, full viewport
- Background: `#0E0C14`
- An `<Aurora />` element absolutely positioned behind everything (z=0, `pointer-events: none`)
- Content sits at z=1 in a flex column

**Header:**
- Height 56px (`py-3 px-5`)
- `border-bottom: 1px solid rgba(255,255,255,0.08)`
- Background: `rgba(14,12,20,0.6)` with `backdrop-filter: blur(24px)`
- Left cluster: 28×28 UV-filled rounded square (`rounded-lg`, `bg-uv-500`, `box-shadow: 0 0 18px rgba(124,124,255,0.55)`) containing the white `<OrbitStar size={16} />`; then the wordmark "Mission Control" at 14px / 600 weight / `-0.01em` tracking; then the date in JetBrains Mono 11px / `letter-spacing: 0.06em` / muted color
- Center: nav tabs `[Overview, Insights, Review]` — see "Tab pill" component below
- Right cluster: `[Cmd-K search trigger]` then `[+ Log button]`

**Tab pill (active):**
- `padding: 5px 12px`, `rounded-md`
- Background `rgba(124,124,255,0.14)`
- Color `#9D9CFF`
- Border `1px solid rgba(124,124,255,0.33)`
- Inactive: transparent bg, `border: 1px transparent`, color `#9890B5`, hover lightens

**⌘K search trigger:**
- Min-width 260px, height 28px, `rounded-lg`
- `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.08)`
- Left: `<Search size={14} />` (Lucide), color `#9890B5`
- Center: placeholder text "Log, jump, find…" 12px muted
- Right: kbd `⌘K` chip — 10px JetBrains Mono, `bg-rgba(255,255,255,0.07)`, border, `rounded-sm`, `px-1.5 py-0.5`
- `cursor: pointer`, `onClick` → opens CmdK

**+ Log button:**
- `padding: 6px 14px`, `rounded-lg`, `bg-uv-500` (#7C7CFF), white text 12px / 500
- Box shadow `0 4px 14px rgba(124,124,255,0.33)`
- Icon: lucide `Plus size={12}` + label "Log"
- `onClick` → opens CmdK

### 2. Mobile · Overview

**Reference:** ★ Conservative · Dark mobile artboard (390×844).

Same data, vertical stack. Order:
1. Status bar (system)
2. Header: 30×30 UV orbit square + "Mission Control" 20px / 600 + date row
3. **Hero card** — Temporal as the focus metric, gradient `linear-gradient(135deg, rgba(124,124,255,0.15), rgba(255,122,216,0.10))` with UV border, big `46px` JetBrains Mono numeral, week/goal text top-right, 5px progress bar, and 3 fat `+0.5h / +1h / +2h` buttons
4. **Snapshot strip** — horizontal-scroll mini cards (Cash, NetWorth, Pipeline, MoneyMoved, DeepWork), each ~130px wide, mono numeral 20px
5. **Quick log grid** — 3×2 grid of accent-tinted buttons (+ Moved, + Generated, + Call, + Demo, + Deep 0.5h, + Train)
6. Activity feed (5 entries)
7. **Bottom nav** — Overview / Insights / Reflect / Tasks, sticky, backdrop-blur. Active item gets UV-tinted pill background.

### 3. Reflection Drawer

**Reference:** ★ Conservative · Dark drawer artboard (460×844).

Implemented as a **shadcn `<Sheet side="right">`** on desktop (width 460px) and a `<Drawer>` (bottom sheet) on mobile.

**Layout:**
1. **Header** (16px padding-y, 22px padding-x):
   - 36×36 gradient-square (`linear-gradient(135deg, #7C7CFF, #FF7AD8)`) with OrbitStar inside
   - Title "Reflection" 15px / 600
   - Subtitle: JetBrains Mono 11px — `WED · 2026-05-27 · {answered}/3 answered`
   - Close button (top right) — 30×30, `bg-rgba(255,255,255,0.04)`, lucide `X size={14}`
2. **Progress strip** (14px padding-top): 3-segment progress bar, gap 6px. Filled segments use `linear-gradient(90deg, #7C7CFF, #FF7AD8)` with a `0 0 10px #7C7CFF` glow.
3. **Three prompts** — each row:
   - 22×22 numbered circle (`0` if not done — fills with `linear-gradient(135deg, #7C7CFF, #FF7AD8)` + Check icon + glow when done). Accent rotates: `#7C7CFF` / `#FF7AD8` / `#FFB454`.
   - Question text in Instrument Serif 13.5px / 500 / tight tracking (the prompts are the only place the serif appears — they read as introspective vs. operator)
   - "Daily" tag pill if the prompt has one (random daily prompt #3 in the seed data)
   - Textarea below: 10px×12px padding, 13px Geist sans, 1.5 line-height, glass background, border `rgba(255,255,255,0.08)`. Focus state: border becomes the prompt's accent color + 3px tinted ring.
   - Below textarea, when text is present: tiny green mono confirmation "● SAVED · N CHARS"
4. **Yesterday card** at the bottom — glass tile with a 3px left-border in pink, eyebrow "YESTERDAY · 3/3", body in Instrument Serif italic with the previous day's first answer.
5. **Footer** — sticky, blurred. Left: mono hint "⌘↩ TO SAVE & CLOSE". Right: gradient "Save & close" button.

---

## Components

### MetricCard

The hero primitive. Six per row on desktop, lazy-loaded into the snapshot strip on mobile.

```ts
type MetricCardProps = {
  id: string;                          // 'cash' | 'temporal' | ... (see Metric IDs below)
  label: string;                       // 'Cash', 'Temporal', 'Net Worth'
  value: number;                       // today's value
  fmt: 'money' | 'pct' | 'hours' | 'count';
  weekValue?: number;                  // optional — shown as "Xh/Yh" goal pair if goal present
  goal?: number;
  note?: string;                       // "No burn", "+$2.4K vs last mo", "liabilities"
  spark?: number[];                    // 14-30 datapoints, default flat
  presets?: Array<{ label: string; delta: number; }>;  // quick-log buttons revealed on hover
  accent: string;                      // hex from palette: uv / cyan / pink / amber / green
  onLog: (delta: number, label: string) => void;
  onEdit: (newValue: number) => void;
};
```

**Anatomy** (top → bottom inside the card, `padding: 14px`):

| Element | Detail |
|---|---|
| **Eyebrow row** | `flex justify-between items-baseline`. Left: label uppercase in JetBrains Mono 10px / 0.1em letter-spacing / `#9890B5`. Right: goal indicator `"{weekValue}/{goal}"` 10px mono. If `weekValue >= goal`, color → `#3DDC97` + small check icon. |
| **Value row** | Big number. Click-to-edit (see `InlineNumber`). **Font: JetBrains Mono, weight 500, size 26px (or 30px for hero variant), color `#F5F1FF`, line-height 1.** **Feature settings: `'tnum' 1, 'zero' 1, 'ss01' 1, 'cv11' 1`** (tabular figures + slashed zero — non-negotiable, this is the "techy" feel). To the right of the value: tiny mono "TODAY" tag 10px muted. |
| **Sub row** | Single line: either week summary ("6.5h this week") or freeform note ("No burn", "+$2.4K vs last mo"). 11px / `#9890B5`. |
| **Footer (32px)** | Default state: a 232×32 inline sparkline OR (no spark) a 4px goal progress bar with the accent color + 8px-radius glow OR (no goal either) a small mono `note` label. **Hover state**: the footer crossfades (200ms opacity) into a row of preset quick-log buttons (`flex gap-1`). |

**Card chrome:**
- `position: relative`
- `background: rgba(255,255,255,0.04)` (hover: `0.07`)
- `border: 1px solid rgba(255,255,255,0.08)` (hover: `0.16`; flash: accent color)
- `border-radius: 12px`
- `backdrop-filter: blur(20px)`
- A 90×90 radial-gradient glow positioned at `top: -30px; right: -30px`, color = `radial-gradient(circle, {accent} 0%, transparent 70%)`, opacity 0.18 (hover: 0.32, 200ms)
- **Flash effect**: when `value` changes, briefly (900ms) apply `box-shadow: 0 0 24px {accent}55, inset 0 0 0 1px {accent}` and set border to accent. This is what makes logging *feel* like something happened.

**Quick-log preset buttons** (the hover-revealed row):
- `flex: 1`, equal width, `padding: 6px 4px`, 11px Geist sans / 500
- `background: {accent}22` (12% alpha hex)
- `color: {accent}`
- `border: 1px solid {accent}40` (25% alpha)
- `border-radius: 6px`
- onClick: calls `onLog(delta, label.trim())`. Triggers the flash above and adds an activity entry.

**Preset content per metric ID:**

```ts
const PRESETS = {
  temporal:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  focus:      [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  pipeline:   [{ label: '+ Call', delta: 0.5 }, { label: '+ Demo', delta: 1 }, { label: '+ FU', delta: 0.5 }],
  deepWork:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }],
  trained:    [{ label: '+ Session', delta: 1 }],
  moneyMoved: [{ label: '+ Moved', delta: 250 }, { label: '+ Generated', delta: 500 }, { label: '+ Cut', delta: 100 }],
  // cash, netWorth, debt — read-only, no presets
};
```

### CmdK (command palette)

Built on shadcn's `<Command>` inside a `<Dialog>`.

**Trigger:** ⌘K anywhere on the page (or Ctrl+K on Windows), click search bar, click + Log.

**Layout** (max-width 560px, centered, top-offset 80px from viewport top):
- Backdrop: `rgba(0,0,0,0.55)` + `backdrop-filter: blur(6px)`. Click-outside closes.
- Body: `background: #13111A`, border `1px solid rgba(255,255,255,0.16)`, `border-radius: 14px`, shadow `0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,124,255,0.13), 0 0 80px rgba(124,124,255,0.10)`
- **Input row** (14px padding): `<Search size=15 />` in UV color · text input 14px Geist · `[ESC]` chip on right
- **Result list** (max-height 340px, scrollable, 6px vertical padding):
  - Each row: 28×28 accent-tinted icon square + label text + faint hint code in mono on the right
  - The first (top) result has a faint surface background AND a small `[↩]` UV chip showing it's the default-on-Enter target
- **Footer** (8px padding, `bg-rgba(0,0,0,0.2)`): mono hint row "↩ RUN · ESC CLOSE · {filtered} / {total} ACTIONS"

**Action list (seed):**

```ts
const CMDK_ACTIONS = [
  { kw: '+0.5h temporal', label: 'Log +0.5h Temporal',   hint: 'temp 0.5', icon: '⏱', accent: 'pink',  run: (m) => m.log('temporal', 0.5, '+0.5h') },
  { kw: '+1h temporal',   label: 'Log +1h Temporal',     hint: 'temp 1',   icon: '⏱', accent: 'pink',  run: (m) => m.log('temporal', 1, '+1h') },
  { kw: '+2h temporal',   label: 'Log +2h Temporal',     hint: 'temp 2',   icon: '⏱', accent: 'pink',  run: (m) => m.log('temporal', 2, '+2h') },
  { kw: '+gen generated', label: '+ Generated $2,000',   hint: '$ gen',    icon: '$', accent: 'green', run: (m) => m.log('moneyMoved', 2000, '+ Generated') },
  { kw: '+moved',         label: '+ Moved $500',         hint: '$ moved',  icon: '$', accent: 'green', run: (m) => m.log('moneyMoved', 500, '+ Moved') },
  { kw: '+cut',           label: '+ Cut $250',           hint: '$ cut',    icon: '$', accent: 'green', run: (m) => m.log('moneyMoved', 250, '+ Cut') },
  { kw: '+call pipeline', label: '+ Pipeline call',      hint: 'pipe',     icon: '☎', accent: 'amber', run: (m) => m.log('pipeline', 0.5, '+ Call') },
  { kw: '+demo pipeline', label: '+ Pipeline demo',      hint: 'pipe',     icon: '☎', accent: 'amber', run: (m) => m.log('pipeline', 1, '+ Demo') },
  { kw: '+0.5h deep',     label: '+0.5h Deep work',      hint: 'deep',     icon: '◆', accent: 'cyan',  run: (m) => m.log('deepWork', 0.5, '+0.5h') },
  { kw: '+1h deep',       label: '+1h Deep work',        hint: 'deep 1',   icon: '◆', accent: 'cyan',  run: (m) => m.log('deepWork', 1, '+1h') },
  { kw: '+train session', label: '+ Training session',   hint: 'train',    icon: '△', accent: 'amber', run: (m) => m.log('trained', 1, '+ Session') },
  { kw: 'reflect t3t',    label: 'Open reflection',      hint: '⌘R',       icon: '❋', accent: 'pink',  run: (m) => m.openDrawer() },
  { kw: 'insights trends',label: 'Open insights',        hint: 'tab 2',    icon: '∿', accent: 'uv',    run: (m) => m.setTab('insights') },
  { kw: 'review',         label: 'Open review',          hint: 'tab 3',    icon: '▸', accent: 'uv',    run: (m) => m.setTab('review') },
];
```

Use shadcn's built-in filtering (it does substring + fuzzy on `kw + label`). On `Enter`, run the top filtered action and close the dialog.

### ActivityFeed

Right rail on desktop, condensed on mobile.

**Structure:**
- Header (12px padding): `<span>Activity</span>` 13px / 600 + a 6×6 green dot with `mc-pulse 2s ease-in-out infinite` animation; right: mono "LIVE" 10px
- Body: scrollable list of entries (max 40)
- Each entry:
  - `flex gap-2.5 items-start py-2.5 px-3.5`, `border-top: 1px solid border-color`
  - Time stamp left: 10px JetBrains Mono `#5E5774`, min-width 34px
  - Right column: top line is `{delta} {label}` — delta colored green if starts with `+`, label 12px / 500 ink; bottom line is `meta` 11px muted
- **Flash:** when an entry is newly added, briefly (1s) set `background: rgba(124,124,255,0.10)` on its row, then transition back to transparent

### ChipStrip

Above the metric grid. Horizontal flex with `gap-2`, `flex-wrap`.

Four chip styles:
- **Streak** (orange/amber): icon `Flame size={12}` color `#FFB454`, body "6-day Temporal streak" + faint "longest in 30d"
- **Positive momentum** (green): icon `ArrowUp size={12}`, body "Cash MoM" + bold "+228%"
- **Anomaly/warning** (amber): icon `Zap size={12}`, body "Deep work pace ↓ vs 14-day avg"
- **Sync** (neutral): no icon, mono "SYNC · monarch · 4m ago"

All chips: `padding: 5px 11px`, `border-radius: 999px`, `border: 1px solid {tinted}`, `background: {tinted at 8%}`. Use Tailwind's `rounded-full`.

### CollapsiblePanel

Wraps shadcn `<Collapsible>`. Spec:
- Surface: `bg-rgba(255,255,255,0.04)`, border, `rounded-xl`, backdrop-blur
- Trigger row (12×14px padding): caret (`ChevronRight size=12`, rotates 90° on open) + title (13px / 600 ink) + count (11px mono muted) + optional accent badge + spacer + optional right-side action
- Body: opens with a 200ms ease, `border-top: 1px solid` separating from header

**Three default panels on desktop (order matters):**
1. **Three to Thrive** — `open` by default, `count = "0 / 3"`, badge "DAILY" (amber). Body contains 3 prompt rows with compact textareas (1 row each, expands on focus).
2. **Trends · last 14 days** — `open` by default, badge "+18% MoM" (UV). Body: 3-column grid of sparkline cards (Temporal · Deep Work · Pipeline).
3. **Tasks** — collapsed by default, count "3 open". Body: task list rows with checkbox + label + accent tag + due hint.

### ReflectionDrawer

Already specced above under "Screens". Implementation: shadcn `<Sheet side="right">` desktop, `<Drawer>` (vaul) on mobile breakpoints.

### Sparkline (primitive)

Inline SVG, no deps. Props: `{ data: number[], color: string, fill?: string, height: number, width: number, strokeWidth?: number, dots?: boolean }`. The fill is rendered as a `<path>` from the line down to the bottom, with 0.5 opacity; the stroke uses `stroke-linecap: round, stroke-linejoin: round`. When `dots` is true, the last point is rendered at 2px radius and earlier points at 1px.

### Ring (primitive)

Used only on mobile for progress around a value. SVG. Props: `{ pct: 0..1, size: number, stroke: number, color: string, track?: string, children?: ReactNode }`. Two concentric circles; the foreground uses `stroke-dasharray` + `stroke-dashoffset` for the progress, rotated -90° so 0% is at the top. Transition the offset over 320ms. Children render centered inside.

### OrbitStar (primitive)

The brand mark. Two crossed ellipses + center dot, slowly rotating.

```tsx
<svg width={size} height={size} viewBox="0 0 24 24"
     className={spin ? 'animate-orbit-spin' : ''}>
  <ellipse cx="12" cy="12" rx="10" ry="3" fill="none" stroke={color} strokeWidth={1.5} />
  <ellipse cx="12" cy="12" rx="3" ry="10" fill="none" stroke={color} strokeWidth={1.5} />
  <circle cx="12" cy="12" r="1.5" fill={color} />
</svg>
```

Tailwind: `@keyframes orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }` then `.animate-orbit-spin { animation: orbit-spin 14s linear infinite; }`.

### Aurora (primitive)

Backdrop. Absolutely positioned `inset-0`, `pointer-events: none`, `opacity: 0.55`. Background:

```css
background:
  radial-gradient(60% 50% at 15% 0%,  rgba(124,124,255,0.20) 0%, transparent 50%),
  radial-gradient(40% 30% at 90% 10%, rgba(255,122,216,0.10) 0%, transparent 60%),
  radial-gradient(50% 40% at 80% 95%, rgba(93,217,255,0.08)  0%, transparent 60%);
```

Optional `intensity` prop scales the opacity (drawer uses 0.7, mobile uses 0.9).

### InlineNumber

Click-to-edit numeric. Used everywhere a metric value is displayed in a card.

```ts
type InlineNumberProps = {
  value: number;
  onCommit: (v: number) => void;
  fmt: 'money' | 'pct' | 'hours' | 'count';
  style?: CSSProperties;          // for font-family + size customization
  prefix?: string;
  suffix?: string;
};
```

States:
- **Idle:** renders the formatted value as a `<span>` with `cursor: text`. Hover: faint background pill.
- **Editing:** swaps to a borderless `<input>` with a 1.5px outline in `currentColor`. On `Enter` or `blur`, parse the raw string (strip `$`, `K`, `h`, `%`, commas), `parseFloat`, and call `onCommit` if numeric. `Escape` cancels.

### Ticker

Optional, used only for the mobile hero number where animating count-up adds polish.

Same idea as inline number but read-only and animates from previous value to current value over 480ms with cubic ease-out. Implementation uses `requestAnimationFrame` and a ref for the starting value.

---

## Interactions & Behavior

### Logging

Every quick-log button (MetricCard preset, ⌘K action, mobile quick-action grid) calls a single shared `log(metricId, delta, label)` function. Sequence:

1. **Optimistic update**: increment the in-memory metric value immediately
2. **Activity feed**: prepend a new entry — `{ id, t: HH:mm, kind: metricId, delta: label, label: metricLabel, meta: 'Quick log', flash: true }`
3. **MetricCard flash**: the card's `value` change triggers the 900ms border + glow + box-shadow flash (already wired via useEffect on value change)
4. **Activity row flash**: the new row gets a 1s UV-tinted background that fades out
5. **Server PATCH**: fire-and-forget POST to the appropriate endpoint (e.g., `/api/temporal/log`, `/api/money-moved/log`). On 4xx/5xx, roll back the optimistic update and surface a toast.

### Inline editing

Click a metric value → text input. Enter/blur commits via `setMetric(id, { today: newValue })`. Same optimistic + server-sync pattern. Useful for typing in a daily start value (e.g., "I already did 1.5h before opening this").

### ⌘K palette

- ⌘K (or Ctrl+K) toggles open/close
- ESC closes
- Typing filters; Enter runs the top result and closes
- ↑↓ arrows navigate the list (let shadcn `<Command>` handle this for free)
- Click outside closes

### Three to Thrive autosave

The 3 textareas debounce-PATCH to `/api/three-to-thrive/today` on change (debounce 600ms, or commit on blur). Use the existing `src/lib/three-to-thrive.ts` tracker server-side. The "● SAVED · N CHARS" hint below each textarea appears when there's content and the last PATCH succeeded.

### Tab nav

Top-bar tabs (Overview / Insights / Review) swap the body content. **Don't make them routes** — they're query-param or local-state driven so the dashboard URL stays clean. Default tab: Overview.

### Reflection drawer

Opens via:
- Top-right "Reflect" button (mobile only)
- ⌘K action `Open reflection`
- ⌘R keyboard shortcut

Closes via:
- ESC
- Click backdrop
- "Save & close" button (saves any in-progress textarea content)

### Animations

| Element | Property | Duration | Easing |
|---|---|---|---|
| MetricCard hover | border-color, background | 150ms | ease-out |
| MetricCard flash | border-color, box-shadow | 350ms in / 350ms out (auto-clear at 900ms) | ease-out |
| MetricCard preset row crossfade | opacity | 120ms | linear |
| Hue glow on hover | opacity | 200ms | ease-out |
| CollapsiblePanel open/close | height, opacity | 200ms | ease-out |
| ChevronRight rotate | transform | 150ms | ease-out |
| CmdK open | opacity + scale(0.96 → 1) | 180ms | cubic-bezier(.2,.7,.3,1) |
| Activity row flash bg | background-color | 1000ms | ease-out |
| Orbit star spin | transform | 14000ms | linear (infinite) |
| Live dot pulse | opacity, scale | 2000ms | ease-in-out (infinite) |
| Ticker count-up | numeric value (rAF) | 480ms | cubic ease-out |

---

## State Management

Extend `src/hooks/useDashboardData.ts` to expose:

```ts
type MissionStore = {
  metrics: Record<MetricId, MetricSnapshot>;
  activity: ActivityEntry[];
  answers: Record<'courage' | 'serve' | 'redo', string>;
  streaks: Record<MetricId, Streak | null>;
  chips: AnomalyChip[];

  log: (metricId: MetricId, delta: number, label: string) => Promise<void>;
  setMetric: (metricId: MetricId, patch: Partial<MetricSnapshot>) => Promise<void>;
  setAnswer: (id: 'courage' | 'serve' | 'redo', text: string) => void;  // debounced inside
};
```

Implementation guidance:
- Use TanStack Query if the repo already uses it; otherwise extend the existing simple SWR-ish hook
- `log` is the main mutation — optimistic update + server POST + rollback on error
- `activity` is derived from the log endpoint (`GET /api/activity?limit=40`) plus prepended local-optimistic entries
- `streaks` and `chips` are computed server-side from the existing trackers; just expose them

### Types to add to `src/lib/types.ts`

```ts
export type MetricId =
  | 'cash' | 'netWorth' | 'debt' | 'cashMoM'
  | 'temporal' | 'focus' | 'deepWork' | 'pipeline'
  | 'moneyMoved' | 'trained';

export type MetricFmt = 'money' | 'pct' | 'hours' | 'count';

export type MetricSnapshot = {
  id: MetricId;
  label: string;
  today: number;
  week?: number;
  goal?: number;
  unit: '$' | '%' | 'h' | '×';
  fmt: MetricFmt;
  spark?: number[];
  note?: string;
  color: string;            // hex from palette
};

export type ActivityEntry = {
  id: string;
  t: string;                // 'HH:mm'
  kind: MetricId;
  delta: string;            // '+1h', '+ Generated', '+ Moved'
  label: string;            // 'Temporal', 'Money moved'
  meta: string;             // 'Brief read · investor deck'
};

export type Streak = {
  metricId: MetricId;
  days: number;
  longest30d: number;
  label: string;
};

export type AnomalyChip = {
  id: string;
  kind: 'streak' | 'positive' | 'warning' | 'sync';
  body: string;
  emphasis?: string;        // e.g. '+228%'
  icon?: 'flame' | 'arrow-up' | 'arrow-down' | 'zap' | null;
};
```

---

## Design Tokens

### Color palette

Add these to `tailwind.config.ts` under `theme.extend.colors`:

```ts
{
  // Surfaces
  bg:        '#0E0C14',      // page background
  bgWarm:    '#13111A',      // CmdK body, footers
  surface:   'rgba(255,255,255,0.04)',  // default card/panel
  surfaceHi: 'rgba(255,255,255,0.07)',  // hover
  border:    'rgba(255,255,255,0.08)',
  borderHi:  'rgba(255,255,255,0.16)',

  // Foreground
  ink:    '#F5F1FF',
  fg:     '#D7D2E8',
  fgDim:  '#9890B5',
  fgMuted:'#5E5774',

  // Primary accent — UV violet
  uv:       '#7C7CFF',
  'uv-hi':  '#9D9CFF',
  'uv-soft': 'rgba(124,124,255,0.14)',

  // Secondary accents (use one at a time per metric/chip)
  pink:  '#FF7AD8',
  green: '#3DDC97',
  amber: '#FFB454',
  red:   '#FF6469',
  cyan:  '#5DD9FF',
}
```

**Metric → accent mapping** (this is the source of truth — keep it consistent across MetricCard, ChipStrip, and CmdK actions):

| Metric | Accent |
|---|---|
| Cash | UV (#7C7CFF) |
| Net Worth | Cyan (#5DD9FF) |
| Temporal | Pink (#FF7AD8) |
| Pipeline | Amber (#FFB454) |
| Deep Work | Cyan (#5DD9FF) |
| Money Moved | Green (#3DDC97) |
| Trained | Pink (#FF7AD8) or Amber for "behind" state |
| Debt | Red (#FF6469) |

### Typography

Three families:
- **Sans (body, UI):** Geist, fallback Inter, fallback system
- **Mono (numerals, code, eyebrows):** JetBrains Mono, fallback Geist Mono, fallback `ui-monospace`
- **Serif (prose only, Reflection drawer):** Instrument Serif, fallback Georgia

Load via `next/font` (preferred) or Google Fonts link in `_layout`.

**The JetBrains Mono "techy numerals" treatment** is critical:

```css
.font-numerics {
  font-family: 'JetBrains Mono', 'Geist Mono', ui-monospace, monospace;
  font-feature-settings: 'tnum' 1, 'zero' 1, 'ss01' 1, 'cv11' 1;
  font-variant-numeric: tabular-nums slashed-zero;
  letter-spacing: -0.02em;
  font-weight: 500;
}
```

Apply `.font-numerics` to every MetricCard value, mobile hero value, snapshot strip values, and any other display numerals. The tabular feature is what keeps digits from shifting when values update. The slashed zero is the operator giveaway.

### Type scale

| Token | Size | Used for |
|---|---|---|
| `text-eyebrow` | 10px / 0.1em letter-spacing / uppercase | MetricCard labels, section labels |
| `text-meta` | 10–11px JetBrains Mono | Timestamps, sync hints, kbd chips |
| `text-body` | 12.5–13px Geist | Body text, panel content |
| `text-card-value` | 26px JetBrains Mono / 500 | MetricCard primary value |
| `text-card-value-hero` | 30px | MetricCard `big` variant |
| `text-mobile-hero` | 46px | Mobile hero Temporal value |
| `text-header` | 14px / 600 / -0.01em | App title |
| `text-drawer-title` | 15px / 600 | Drawer headers |
| `text-prompt` | 13.5px Instrument Serif / 500 | Reflection drawer prompt questions only |

### Spacing

Use Tailwind's default scale. Common values: `gap-1`, `gap-2`, `gap-2.5`, `gap-3.5`, `gap-4`, `gap-5`, `gap-6`. Card grid `gap-2.5`, panel internal `gap-3.5`, header cluster `gap-3.5`.

### Radii

| Token | Value | Used for |
|---|---|---|
| `rounded-sm` | 3px | kbd chip |
| `rounded-md` | 6px | Quick-log preset buttons, tab pills |
| `rounded-lg` | 8px | Search trigger, + Log button, drawer close button |
| `rounded-xl` | 10–12px | Cards, panels, MetricCard, ChipStrip wrappers |
| `rounded-2xl` | 14–16px | CmdK dialog, mobile hero card |
| `rounded-full` | 999px | Chips, dots, gradient strip segments |

### Shadows / glows

- **UV button glow:** `box-shadow: 0 4px 14px rgba(124,124,255,0.33)`
- **Card flash:** `box-shadow: 0 0 24px {accent}55, inset 0 0 0 1px {accent}` (transient, 900ms)
- **Orbit-star glow on header logo:** `box-shadow: 0 0 18px rgba(124,124,255,0.55)`
- **Drawer & CmdK ambient:** `box-shadow: -24px 0 60px rgba(0,0,0,0.5)` (drawer); `0 30px 80px rgba(0,0,0,0.6), 0 0 80px rgba(124,124,255,0.10)` (CmdK)
- **Live dot:** soft green glow on the activity-feed pulse dot — `box-shadow: 0 0 8px #3DDC97`

---

## Assets

- **OrbitStar** — drawn inline (no asset). 2 ellipses + a dot.
- **Icons** — Lucide React (`lucide-react`, already in repo via shadcn). Used: `Search`, `Plus`, `Minus`, `Flame`, `Zap`, `ArrowUp`, `ArrowDown`, `ArrowRight`, `Check`, `X`, `ChevronRight`, `Brain`, `DollarSign`, `Sparkles`.
- **Fonts** — Geist (Vercel), JetBrains Mono (JetBrains), Instrument Serif (Google Fonts). All free, all available via `next/font/google`.
- **No images.** No stock photography. No illustrations.

---

## Sample data (for first-render parity with the prototype)

These numbers come from the user's screenshots. Use them as fixtures in dev / Storybook / e2e tests:

```ts
const SEED_METRICS: Record<MetricId, MetricSnapshot> = {
  cash:       { id: 'cash',       label: 'Cash',       today: 35300,   week: 35300,  goal: undefined, unit: '$', fmt: 'money', note: 'No burn',           color: '#7C7CFF' },
  cashMoM:    { id: 'cashMoM',    label: 'Cash MoM',   today: 228.0,   week: 228.0,  goal: undefined, unit: '%', fmt: 'pct',   note: '+$2.4K vs last mo', color: '#3DDC97' },
  netWorth:   { id: 'netWorth',   label: 'Net worth',  today: 982000,  week: 982000, goal: undefined, unit: '$', fmt: 'money', note: '$1.01M − $27.9K',   color: '#5DD9FF' },
  debt:       { id: 'debt',       label: 'Total debt', today: 27900,                                  unit: '$', fmt: 'money', note: 'liabilities',       color: '#FF6469' },
  temporal:   { id: 'temporal',   label: 'Temporal',   today: 0,       week: 6.5,    goal: 5,         unit: 'h', fmt: 'hours', note: 'this week',         color: '#FF7AD8' },
  focus:      { id: 'focus',      label: 'Focus hours',today: 0,       week: 0,      goal: 15,        unit: 'h', fmt: 'hours', note: 'this week',         color: '#5DD9FF' },
  moneyMoved: { id: 'moneyMoved', label: 'Money moved',today: 0,       week: 0,      goal: undefined, unit: '$', fmt: 'money', note: 'this week',         color: '#3DDC97' },
  pipeline:   { id: 'pipeline',   label: 'Pipeline',   today: 0,       week: 0,      goal: 3,         unit: 'h', fmt: 'hours', note: 'this week',         color: '#FFB454' },
  deepWork:   { id: 'deepWork',   label: 'Deep work',  today: 0,       week: 0,      goal: 10,        unit: 'h', fmt: 'hours', note: 'this week',         color: '#5DD9FF' },
  trained:    { id: 'trained',    label: 'Trained',    today: 0,       week: 0,      goal: 4,         unit: '×', fmt: 'count', note: 'this week',         color: '#FFB454' },
};

const SEED_T3T_PROMPTS = [
  { id: 'courage', q: 'How can I live with even more courage and determination?', tag: null },
  { id: 'serve',   q: 'How can I serve even more?', tag: null },
  { id: 'redo',    q: 'What would I do differently if I could live my day over?', tag: 'Daily random' },
];

const SEED_ACTIVITY = [
  { t: '09:12', kind: 'temporal',  delta: '+1h',         label: 'Temporal',  meta: 'Brief read · investor deck' },
  { t: '09:15', kind: 'money',     delta: '+ Generated', label: '$2,000',    meta: 'Annual contract · Vega' },
  { t: '09:20', kind: 'pipeline',  delta: '+ Lead',      label: 'Pipeline',  meta: 'Outbound · Northway' },
  { t: '08:48', kind: 'cash',      delta: 'sync',        label: 'Cash',      meta: 'Monarch · $35.3K' },
  { t: '08:30', kind: 'deepwork',  delta: '+0.5h',       label: 'Deep work', meta: 'Architecture doc' },
];
```

---

## Phase plan (from the user's brief, in build order)

**Phase 1 — Highest ROI:**
1. Build `MetricCard` + `Sparkline` + `InlineNumber` + the dashboard shell. Replace the top of `src/app/dashboard/page.tsx`. Wire to existing `useDashboardData`.
2. Build `CmdK` + `useCmdK` hook. Wire to existing log endpoints.
3. Compress `ThreeToThrive` into `ReflectionDrawer`. Add the "compact" panel variant for inline display.
4. Build `ActivityFeed` + the new `/api/activity` endpoint (read from existing log tables).
5. Surface streaks + anomalies as `ChipStrip`. Compute server-side from existing trackers.
6. **Delete:** `MissionTracker`, `PriorityDashboard`, `FocusOptimization`, `MonthlyReviewTracker`, `RevenueProjectionWidget`, `FocusHoursTracker`.

**Phase 2:**
1. Rebuild Trends panel — use Sparkline + the existing `weekly-tracker.ts` data
2. Add keyboard shortcuts beyond ⌘K (⌘R for reflect, etc.)
3. Mobile compressed view + bottom nav
4. Undo toast after every log (3s window — see brief)

**Phase 3:**
1. Predictive insights (out of scope for this handoff, but the ChipStrip is ready to receive them)
2. Auto-generated reviews
3. Smart reminders / anomaly detection

---

## Files in this handoff

```
design_handoff_mission_control/
├── README.md                                 ← you are here
├── source_brief.md                           ← the user's original strategy doc (READ FIRST)
├── screenshots/
│   ├── 01-desktop-overview.png               ← the chosen direction, desktop
│   ├── 02-mobile.png                         ← mobile (compressed)
│   └── 03-reflection-drawer.png              ← Three to Thrive in the drawer
└── prototype/
    ├── Mission Control.html                  ← runnable canvas with all 4 directions
    ├── design-canvas.jsx                     ← canvas wrapper (not part of the design)
    ├── shared.jsx                            ← data, hooks, primitives (this is what to translate)
    ├── v1-dark.jsx                           ← THE chosen direction — port this
    ├── v1-conservative.jsx                   ← light-mode reference (not building this)
    ├── v2-bold.jsx                           ← trading-terminal reference (not building this)
    └── v3-experimental.jsx                   ← Raycast-style reference (not building this)
```

**Start by opening `Mission Control.html` in a browser** and using the ★ Conservative · Dark artboard as the visual source of truth. Then read `prototype/v1-dark.jsx` end-to-end — it's ~900 lines of fully-working React showing every interaction, including the ⌘K palette, inline editing, optimistic logging, flash effects, and the reflection drawer.

The translation is mostly mechanical: inline styles → Tailwind utility classes, the mock `useMission` → real `useDashboardData`, `Object.assign(window, …)` → ES exports. The design decisions are all baked in.

---

## Questions for the implementing developer

If anything is ambiguous when you start, ask the user:
- Should ⌘K work globally across the whole app or only on /dashboard? (prototype: dashboard only)
- Activity feed — local-only ring buffer, or persisted to DB? (prototype: in-memory; recommend persisted for the "auditability" benefit the brief mentions)
- Reflection drawer on desktop — Sheet (overlay) or split-pane (push content)? (prototype: Sheet overlay)
- Undo toast — implement now in Phase 1, or defer to Phase 2? (brief mentions it as a key UX win, but Phase 2 in the prioritization)
