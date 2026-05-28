import type { ActivityEntry, MetricId } from './types';
import type { Chip } from './palette';

// ----- ActivityFeed derivation -------------------------------------------

type FocusSessionLike = {
  id?: string;
  category?: string;
  hours?: number;
  description?: string;
  date?: string;
  timestamp?: string;
};

type FinancialEntryLike = {
  id?: string;
  amount?: number;
  description?: string;
  timestamp?: string;
  category?: 'moved' | 'generated' | 'cut';
};

function hhmm(iso?: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function metricForCategory(category?: string): MetricId {
  if (category === 'Temporal') return 'temporal';
  if (category === 'Revenue') return 'pipeline';
  return 'deepWork';
}

// Descriptions matching these patterns are written by e2e tests. They
// must never reach a real user's activity feed even if the test row
// somehow survived in the DB. The right cleanup happens in the test
// teardown / global-setup, but this is the last-line filter so a stale
// row from a long-ago test run can't pollute the UI.
const E2E_DESCRIPTION_RE = /^(e2e-|\[test\]|playwright[-_])/i;

function isE2EDescription(description?: string | null): boolean {
  if (!description) return false;
  return E2E_DESCRIPTION_RE.test(description.trim());
}

function focusToActivity(s: FocusSessionLike): ActivityEntry {
  const m = metricForCategory(s.category);
  const hours = s.hours ?? 0;
  return {
    id: s.id ?? `focus-${s.timestamp ?? Math.random()}`,
    t: hhmm(s.timestamp),
    kind: m,
    delta: `+${hours}h`,
    label: s.category ?? 'Focus',
    meta: s.description?.slice(0, 70) || '—',
  };
}

function financialToActivity(e: FinancialEntryLike): ActivityEntry {
  const amount = e.amount ?? 0;
  const cat = e.category ?? 'moved';
  const verb =
    cat === 'generated' ? '+ Generated' :
    cat === 'cut'       ? '+ Cut'       : '+ Moved';
  return {
    id: e.id ?? `fin-${e.timestamp ?? Math.random()}`,
    t: hhmm(e.timestamp),
    kind: 'moneyMoved',
    delta: verb,
    label: `$${amount.toLocaleString()}`,
    meta: e.description?.slice(0, 70) || '—',
  };
}

// Merge server-side recent entries with optimistic local entries, dedup,
// and sort newest-first. Optimistic rows win when an id collides.
export function deriveActivity(opts: {
  focus?: FocusSessionLike[];
  financial?: FinancialEntryLike[];
  optimistic?: ActivityEntry[];
  limit?: number;
}): ActivityEntry[] {
  const { focus = [], financial = [], optimistic = [], limit = 25 } = opts;
  // Drop e2e-test-authored rows before mapping. Belt-and-suspenders for
  // when stale rows survive in the DB despite global-setup wiping the
  // test user; the rule is documented in docs/dashboard-v2-architecture.md
  // under R5 ("derive.ts filters e2e-authored rows from the activity feed").
  const liveFocus = focus.filter((s) => !isE2EDescription(s.description));
  const liveFinancial = financial.filter((e) => !isE2EDescription(e.description));
  const merged: ActivityEntry[] = [
    ...optimistic,
    ...liveFocus.map(focusToActivity),
    ...liveFinancial.map(financialToActivity),
  ];
  // Stable de-dup by id (optimistic entries land first and win).
  const seen = new Set<string>();
  const deduped: ActivityEntry[] = [];
  for (const entry of merged) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    deduped.push(entry);
  }
  return deduped
    .map((entry, index) => ({ entry, index, time: parseActivityTime(entry.t) }))
    .sort((a, b) => {
      if (a.time != null && b.time != null && a.time !== b.time) return b.time - a.time;
      if (a.time != null && b.time == null) return -1;
      if (a.time == null && b.time != null) return 1;
      return a.index - b.index;
    })
    .map(({ entry }) => entry)
    .slice(0, limit);
}

function parseActivityTime(t: string): number | null {
  const match = t.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// ----- ChipStrip derivation ----------------------------------------------

type DailyEntryLike = { date?: string; deepWorkHours?: number; pipelineActions?: number; trained?: boolean };
type WeeklyTrackerLike = {
  currentWeekSummary?: { dailyEntries?: Array<DailyEntryLike | null> };
};

// Counts consecutive days back from today that had any work signal logged.
export function consecutiveStreak(weekly: WeeklyTrackerLike | null | undefined): number {
  const entries = weekly?.currentWeekSummary?.dailyEntries ?? [];
  let count = 0;
  // dailyEntries is sorted oldest → newest by the tracker, so walk in reverse.
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (!e) break;
    if ((e.deepWorkHours ?? 0) > 0 || (e.pipelineActions ?? 0) > 0 || e.trained) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function deriveChips(opts: {
  streakDays: number;
  monarchSyncedAt?: string | null;
  cashMoMPct?: number | null;
  deepWorkPace?: 'up' | 'down' | 'flat';
}): Chip[] {
  const { streakDays, monarchSyncedAt, cashMoMPct, deepWorkPace } = opts;
  const chips: Chip[] = [];

  if (streakDays >= 3) {
    chips.push({
      id: 'streak',
      kind: 'streak',
      icon: 'flame',
      body: `${streakDays}-day work streak`,
      meta: 'consecutive days',
    });
  }

  if (typeof cashMoMPct === 'number' && cashMoMPct > 5) {
    chips.push({
      id: 'cashmom',
      kind: 'positive',
      icon: 'arrow-up',
      body: 'Cash MoM',
      emphasis: `${cashMoMPct > 0 ? '+' : ''}${cashMoMPct.toFixed(0)}%`,
    });
  } else if (typeof cashMoMPct === 'number' && cashMoMPct < -5) {
    chips.push({
      id: 'cashmom-down',
      kind: 'warning',
      icon: 'zap',
      body: `Cash MoM ${cashMoMPct.toFixed(0)}%`,
    });
  }

  if (deepWorkPace === 'down') {
    chips.push({
      id: 'pace',
      kind: 'warning',
      icon: 'zap',
      body: 'Deep work pace ↓ vs 14-day avg',
    });
  }

  if (monarchSyncedAt) {
    const synced = new Date(monarchSyncedAt);
    if (Number.isNaN(synced.getTime())) return chips;
    const minsAgo = Math.max(0, Math.round((Date.now() - synced.getTime()) / 60_000));
    const human =
      minsAgo < 1 ? 'just now' :
      minsAgo < 60 ? `${minsAgo}m ago` :
      `${Math.floor(minsAgo / 60)}h ago`;
    chips.push({
      id: 'sync',
      kind: 'sync',
      body: `SYNC · monarch · ${human}`,
    });
  }

  return chips;
}
