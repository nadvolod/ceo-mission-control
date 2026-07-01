'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { localDate } from '@/lib/dates';
import { METRIC_ACCENTS } from './palette';
import { fmtMetric } from './format';
import type { ActivityEntry, MetricId, MetricSnapshot } from './types';

// Display labels for the activity feed. These are presentational and
// don't carry any user data, so they're safe to hard-code.
const METRIC_LABELS: Record<MetricId, string> = {
  cash:       'Cash',
  cashMoM:    'Cash MoM',
  netWorth:   'Net worth',
  debt:       'Total debt',
  temporal:   'Temporal Focus',
  focus:      'Focus hours',
  moneyMoved: 'Money moved',
  battles:    'Battles Won',
  deepWork:   'Deep work',
  trained:    'Trained',
};

// ----- Action mapping -----------------------------------------------------
//
// Every MetricCard preset → exactly one of these labels. The mapping below
// converts that label + delta into a server call against the existing v1
// endpoints (so the new dashboard logs into the same data the old one reads).

type LogResult = { ok: true } | { ok: false; error: string };

type LogOptions = {
  // Optional user-supplied description (e.g. "Benepass" for a money entry,
  // or the battle name for a battles entry).
  // When omitted we fall back to the auto-generated string per metric.
  description?: string;
  // Battles only: the dollar value won in this battle. The `delta` arg for
  // battles is the count increment (1); the money value travels here so the
  // overlay can increment the weekly count by 1 regardless of the $ amount.
  value?: number;
};

async function postLog(
  metricId: MetricId,
  delta: number,
  label: string,
  options: LogOptions = {},
): Promise<LogResult> {
  // Pin the row to the user's local day. Every POST body carries this
  // so an evening log in EST doesn't land on tomorrow per UTC clocks.
  const today = localDate();
  const userDescription = options.description?.trim();
  try {
    if (metricId === 'temporal') {
      const res = await fetch('/api/focus-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          category: 'Temporal',
          hours: delta,
          description: `${label.trim()} Temporal · Mission Control`,
          date: today,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Temporal log failed (${res.status})` };
      }
      return { ok: true };
    }

    if (metricId === 'moneyMoved') {
      const category =
        label.toLowerCase().includes('generated') ? 'generated' :
        label.toLowerCase().includes('cut') ? 'cut' : 'moved';
      const res = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addEntry',
          category,
          amount: delta,
          // Prefer the user-typed note ("Benepass"); fall back to the
          // auto-generated string if they didn't supply one. The server
          // requires a non-empty description, so an empty `userDescription`
          // would 400.
          description: userDescription || `${label.trim()} via Mission Control`,
          date: today,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Financial log failed (${res.status})` };
      }
      return { ok: true };
    }

    if (metricId === 'deepWork') {
      const res = await fetch('/api/focus-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          category: 'Other',
          hours: delta,
          description: `${label.trim()} Deep work · Mission Control`,
          date: today,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Focus log failed (${res.status})` };
      }
      return { ok: true };
    }

    if (metricId === 'battles') {
      // For battles the $ value travels in options.value and the name in
      // options.description. The `delta` arg is the count increment (1).
      const res = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addBattle',
          name: userDescription || label.trim(),
          value: options.value ?? 0,
          date: today,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Battle log failed (${res.status})` };
      }
      return { ok: true };
    }

    if (metricId === 'trained') {
      const res = await fetch('/api/weekly-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addToDay',
          deepWorkDelta: 0,
          pipelineDelta: 0,
          setTrained: true,
          date: today,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Training log failed (${res.status})` };
      }
      return { ok: true };
    }

    return { ok: false, error: `Metric "${metricId}" is read-only` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

// ----- Local optimistic state --------------------------------------------

type LocalState = {
  overlay: Partial<Record<MetricId, { today?: number; week?: number }>>;
  activity: ActivityEntry[];
  toast: { kind: 'error' | 'success'; text: string } | null;
};

type LocalAction =
  | { type: 'optimistic'; metricId: MetricId; delta: number; entry: ActivityEntry }
  | { type: 'commit'; metricId: MetricId; delta: number; entryId: string }
  | { type: 'rollback'; metricId: MetricId; delta: number; entryId: string; error: string }
  | { type: 'clearToast' }
  | { type: 'saveError'; error: string };

const initialLocal: LocalState = { overlay: {}, activity: [], toast: null };

function applyOverlayDelta(
  overlay: LocalState['overlay'],
  metricId: MetricId,
  todayDelta: number,
  weekDelta: number,
): LocalState['overlay'] {
  const prev = overlay[metricId] || {};
  const today = (prev.today ?? 0) + todayDelta;
  const week = (prev.week ?? 0) + weekDelta;
  const next = { ...overlay };
  if (Math.abs(today) < 0.0001 && Math.abs(week) < 0.0001) {
    delete next[metricId];
  } else {
    next[metricId] = { today, week };
  }
  return next;
}

function localReducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case 'optimistic': {
      return {
        ...state,
        overlay: applyOverlayDelta(state.overlay, action.metricId, action.delta, action.delta),
        activity: [action.entry, ...state.activity].slice(0, 40),
      };
    }
    case 'commit':
      return {
        ...state,
        overlay: applyOverlayDelta(state.overlay, action.metricId, -action.delta, -action.delta),
        activity: state.activity.filter((e) => e.id !== action.entryId),
      };
    case 'rollback': {
      return {
        ...state,
        overlay: applyOverlayDelta(state.overlay, action.metricId, -action.delta, -action.delta),
        activity: state.activity.filter((e) => e.id !== action.entryId),
        toast: { kind: 'error', text: action.error },
      };
    }
    case 'clearToast':
      return { ...state, toast: null };
    case 'saveError':
      return { ...state, toast: { kind: 'error', text: action.error } };
  }
}

function hhmm(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ----- Public hook -------------------------------------------------------

export function useMissionStore() {
  const dashboard = useDashboardData();
  const { monarchData, focusData, financialData, battlesData, threeToThriveData, monthlyReviewData, weeklyTrackerData } = dashboard;

  const [local, dispatch] = useReducer(localReducer, initialLocal);
  const refreshRef = useRef(dashboard.loadAllData);
  const refreshWeeklyTrackerRef = useRef(dashboard.loadWeeklyTracker);
  useEffect(() => {
    refreshRef.current = dashboard.loadAllData;
    refreshWeeklyTrackerRef.current = dashboard.loadWeeklyTracker;
  }, [dashboard.loadAllData, dashboard.loadWeeklyTracker]);

  const baseMetrics: Record<MetricId, MetricSnapshot> = useMemo(() => {
    // Empty defaults. No fake user values, no fake spark series. The UI
    // renders an empty/loading state until real data arrives. (Previously
    // this seeded with the design-handoff sample numbers — $35.3K cash,
    // 6.5h temporal — which leaked into real users' screens.)
    const make = (
      id: MetricId,
      unit: MetricSnapshot['unit'],
      fmt: MetricSnapshot['fmt'],
      extras: Partial<MetricSnapshot> = {},
    ): MetricSnapshot => ({
      id,
      label: METRIC_LABELS[id],
      unit,
      fmt,
      today: 0,
      color: METRIC_ACCENTS[id],
      ...extras,
    });

    const base: Record<MetricId, MetricSnapshot> = {
      cash:       make('cash',       '$', 'money'),
      cashMoM:    make('cashMoM',    '%', 'pct'),
      netWorth:   make('netWorth',   '$', 'money'),
      debt:       make('debt',       '$', 'money'),
      // Goal is sourced from the current week's review (user-editable via
      // the Temporal Focus card pencil button). Falls back to 5h until
      // a review exists for the current week.
      temporal:   make('temporal',   'h', 'hours', {
        goal: weeklyTrackerData?.currentWeekSummary?.temporalTarget ?? 5,
        note: 'this week',
      }),
      focus:      make('focus',      'h', 'hours', { goal: 15, note: 'this week' }),
      moneyMoved: make('moneyMoved', '$', 'money', { note: 'this week' }),
      // Battles Won: the big number is the weekly count (integer); the
      // sub-line shows all-time count + total $ won. No goal/progress bar.
      battles:    make('battles',    '×', 'int',   { headline: 'week', icon: 'swords', note: '0 total' }),
      deepWork:   make('deepWork',   'h', 'hours', { goal: 10, note: 'this week' }),
      trained:    make('trained',    '×', 'count', { goal: 4,  note: 'this week' }),
    };

    if (monarchData) {
      base.cash.today = monarchData.cashPosition;
      base.cash.week = monarchData.cashPosition;
      if (
        typeof monarchData.cashMoMDelta === 'number' &&
        typeof monarchData.cashMoMPct === 'number' &&
        Number.isFinite(monarchData.cashMoMDelta) &&
        Number.isFinite(monarchData.cashMoMPct)
      ) {
        const sign = monarchData.cashMoMDelta >= 0 ? '+' : '';
        const pctSign = monarchData.cashMoMPct >= 0 ? '+' : '';
        base.cash.trend = {
          value: `${sign}${fmtMetric(monarchData.cashMoMDelta, 'money')} · ${pctSign}${fmtMetric(monarchData.cashMoMPct, 'pct')}`,
          label: monarchData.cashMoMLabel ? `${monarchData.cashMoMLabel}` : 'last month',
          tone:
            monarchData.cashMoMDelta > 0
              ? 'positive'
              : monarchData.cashMoMDelta < 0
              ? 'negative'
              : 'neutral',
        };
        base.cash.note = 'Cash MoM';
      }
      base.netWorth.today = monarchData.netWorth;
      base.netWorth.week = monarchData.netWorth;
      base.netWorth.note = `Assets $${(monarchData.totalAssets / 1000).toFixed(0)}K · liab $${(monarchData.totalLiabilities / 1000).toFixed(0)}K`;
      base.debt.today = monarchData.totalLiabilities;
    }

    const todayByCat = focusData?.todaysMetrics?.byCategory ?? {};
    const weeklyByCat = focusData?.weeklyTotals ?? {};
    base.temporal.today = todayByCat.Temporal ?? 0;
    base.temporal.week = weeklyByCat.Temporal;
    // Deep work = focus-hours category "Other" + Temporal. The user's working
    // model: Temporal hours ARE deep work (just additionally tagged as the
    // strategic project). Without this, logging +1h Temporal would not
    // contribute to the Deep Work goal — but it should.
    //
    // When neither category has data we leave `week` undefined so the empty-
    // state guarantee in the snapshot still holds (the page renders 0 today
    // and shows the goal-progress bar, not a fake "0 this week" subtitle).
    base.deepWork.today = (todayByCat.Other ?? 0) + (todayByCat.Temporal ?? 0);
    const otherWeek = weeklyByCat.Other;
    const temporalWeek = weeklyByCat.Temporal;
    base.deepWork.week =
      otherWeek === undefined && temporalWeek === undefined
        ? undefined
        : (otherWeek ?? 0) + (temporalWeek ?? 0);

    const finToday = financialData?.todaysMetrics?.totals;
    if (finToday) {
      base.moneyMoved.today = (finToday.moved ?? 0) + (finToday.generated ?? 0) + (finToday.cut ?? 0);
    }
    const finWeek = financialData?.weeklyTotals;
    if (finWeek) {
      base.moneyMoved.week = (finWeek.moved ?? 0) + (finWeek.generated ?? 0) + (finWeek.cut ?? 0);
    }

    // Battles: today = today's count, week = weekly count (the headline),
    // note = all-time count + total $ won (the card sub-line). Leave today/week
    // at their empty defaults (0 / undefined) until real data arrives so the
    // empty-state contract holds (see baseMetrics comment).
    if (battlesData) {
      base.battles.today = battlesData.todaysMetrics?.totals?.count ?? 0;
      base.battles.week = battlesData.weeklyTotals?.count ?? 0;
      const allTime = battlesData.allTimeTotals;
      if (allTime) {
        const wonStr = allTime.value > 0 ? ` · ${fmtMetric(allTime.value, 'money')} won` : '';
        base.battles.note = `${allTime.count} total${wonStr}`;
      }
    }

    return base;
  }, [monarchData, focusData, financialData, battlesData, weeklyTrackerData]);

  const metrics: Record<MetricId, MetricSnapshot> = useMemo(() => {
    const out = { ...baseMetrics };
    for (const id of Object.keys(local.overlay) as MetricId[]) {
      const o = local.overlay[id];
      if (!o) continue;
      out[id] = {
        ...out[id],
        today: (out[id].today ?? 0) + (o.today ?? 0),
        week: (out[id].week ?? 0) + (o.week ?? 0),
      };
    }
    return out;
  }, [baseMetrics, local.overlay]);

  const log = useCallback(
    async (
      metricId: MetricId,
      delta: number,
      label: string,
      options: LogOptions = {},
    ) => {
      // For money entries, the optimistic row should show the $amount and
      // the user's note — otherwise it reads "+ Moved Money moved | Quick
      // log" and the user can't tell anything happened. (The server-side
      // entry shows "+ Moved $500 | Benepass" once the refresh resolves;
      // we mirror that shape on the optimistic row so there's no flash.)
      const isMoney = metricId === 'moneyMoved';
      const isBattle = metricId === 'battles';
      const userDescription = options.description?.trim();
      // Battles: show the $ value won and the battle name on the optimistic
      // row so it matches the server-side shape (no flash on refresh).
      const optimisticLabel = isBattle
        ? `$${(options.value ?? 0).toLocaleString()}`
        : isMoney
        ? `$${delta.toLocaleString()}`
        : METRIC_LABELS[metricId];
      const optimisticMeta = isBattle
        ? userDescription || label.trim()
        : userDescription || (isMoney ? `${label.trim()} via Mission Control` : 'Quick log');

      // Use Date.now() for tsMs so deriveActivity's sort places this row
      // above any older server-side entry, even if that server entry's
      // HH:MM string is later in the day (cross-day clutter from yesterday
      // evening, etc.). The HH:MM `t` is for display only.
      const nowMs = Date.now();
      const entry: ActivityEntry = {
        id: `local-${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
        t: hhmm(new Date(nowMs)),
        tsMs: nowMs,
        kind: metricId,
        // Battles render a "+ Won" verb (matches the server-derived row) and
        // a ⚔️ badge, regardless of the preset label used to open the editor.
        delta: isBattle ? '+ Won' : label,
        label: optimisticLabel,
        meta: optimisticMeta,
        ...(isBattle ? { icon: 'swords' as const } : {}),
      };
      dispatch({ type: 'optimistic', metricId, delta, entry });

      const result = await postLog(metricId, delta, label, options);
      if (!result.ok) {
        dispatch({
          type: 'rollback',
          metricId,
          delta,
          entryId: entry.id,
          error: result.error,
        });
        return;
      }
      // Server accepted. Refresh authoritative state, then clear only the
      // optimistic mutation owned by this request so concurrent logs stay intact.
      try {
        await refreshRef.current();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Refresh failed';
        dispatch({ type: 'saveError', error: message });
      } finally {
        dispatch({ type: 'commit', metricId, delta, entryId: entry.id });
      }
    },
    [],
  );

  const clearToast = useCallback(() => dispatch({ type: 'clearToast' }), []);

  // Public refresh — calls the underlying dashboard hook's loadAllData
  // so the page can pull authoritative state after a mutation that the
  // store doesn't own.
  const refresh = useCallback(async () => {
    await refreshRef.current();
  }, []);

  // Targeted refresh for mutations that only touch the weekly-tracker
  // slice (e.g. inline Temporal goal edit). Avoids re-fetching focus,
  // financial, monarch, etc. — that full reload kept the editor in its
  // "Saving..." state for the duration of the slowest endpoint.
  const refreshWeeklyTracker = useCallback(async () => {
    await refreshWeeklyTrackerRef.current();
  }, []);

  return {
    metrics,
    activity: local.activity,
    toast: local.toast,
    focusData,
    financialData,
    battlesData,
    weeklyTrackerData: dashboard.weeklyTrackerData,
    monarchData,
    threeToThrive: threeToThriveData,
    monthlyReviewData,
    saveThreeToThriveAnswer: dashboard.handleSaveThreeToThriveAnswer,
    isLoading: dashboard.isLoading,
    log,
    refresh,
    refreshWeeklyTracker,
    clearToast,
  };
}
