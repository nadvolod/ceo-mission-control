'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { localDate } from '@/lib/dates';
import { METRIC_ACCENTS } from './palette';
import type { ActivityEntry, MetricId, MetricSnapshot } from './types';

// Display labels for the activity feed. These are presentational and
// don't carry any user data, so they're safe to hard-code.
const METRIC_LABELS: Record<MetricId, string> = {
  cash:       'Cash',
  cashMoM:    'Cash MoM',
  netWorth:   'Net worth',
  debt:       'Total debt',
  temporal:   'Temporal',
  focus:      'Focus hours',
  moneyMoved: 'Money moved',
  pipeline:   'Pipeline',
  deepWork:   'Deep work',
  trained:    'Trained',
};

// ----- Action mapping -----------------------------------------------------
//
// Every MetricCard preset → exactly one of these labels. The mapping below
// converts that label + delta into a server call against the existing v1
// endpoints (so the new dashboard logs into the same data the old one reads).

type LogResult = { ok: true } | { ok: false; error: string };

async function postLog(metricId: MetricId, delta: number, label: string): Promise<LogResult> {
  // Pin the row to the user's local day. Every POST body carries this
  // so an evening log in EST doesn't land on tomorrow per UTC clocks.
  const today = localDate();
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
          description: `${label.trim()} via Mission Control`,
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

    if (metricId === 'pipeline') {
      const res = await fetch('/api/focus-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          category: 'Revenue',
          hours: delta,
          description: `${label.trim()} Pipeline · Mission Control`,
          date: today,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Pipeline log failed (${res.status})` };
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
  const { monarchData, focusData, financialData, threeToThriveData, monthlyReviewData } = dashboard;

  const [local, dispatch] = useReducer(localReducer, initialLocal);
  const refreshRef = useRef(dashboard.loadAllData);
  useEffect(() => {
    refreshRef.current = dashboard.loadAllData;
  }, [dashboard.loadAllData]);

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
      temporal:   make('temporal',   'h', 'hours', { goal: 5,  note: 'this week' }),
      focus:      make('focus',      'h', 'hours', { goal: 15, note: 'this week' }),
      moneyMoved: make('moneyMoved', '$', 'money', { note: 'this week' }),
      pipeline:   make('pipeline',   'h', 'hours', { goal: 3,  note: 'this week' }),
      deepWork:   make('deepWork',   'h', 'hours', { goal: 10, note: 'this week' }),
      trained:    make('trained',    '×', 'count', { goal: 4,  note: 'this week' }),
    };

    if (monarchData) {
      base.cash.today = monarchData.cashPosition;
      base.cash.week = monarchData.cashPosition;
      base.netWorth.today = monarchData.netWorth;
      base.netWorth.week = monarchData.netWorth;
      base.netWorth.note = `Assets $${(monarchData.totalAssets / 1000).toFixed(0)}K · liab $${(monarchData.totalLiabilities / 1000).toFixed(0)}K`;
      base.debt.today = monarchData.totalLiabilities;
    }

    const todayByCat = focusData?.todaysMetrics?.byCategory ?? {};
    const weeklyByCat = focusData?.weeklyTotals ?? {};
    base.temporal.today = todayByCat.Temporal ?? 0;
    base.temporal.week = weeklyByCat.Temporal;
    base.pipeline.today = todayByCat.Revenue ?? 0;
    base.pipeline.week = weeklyByCat.Revenue;
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

    return base;
  }, [monarchData, focusData, financialData]);

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
    async (metricId: MetricId, delta: number, label: string) => {
      const entry: ActivityEntry = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        t: hhmm(),
        kind: metricId,
        delta: label,
        label: METRIC_LABELS[metricId],
        meta: 'Quick log',
      };
      dispatch({ type: 'optimistic', metricId, delta, entry });

      const result = await postLog(metricId, delta, label);
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

  return {
    metrics,
    activity: local.activity,
    toast: local.toast,
    focusData,
    financialData,
    weeklyTrackerData: dashboard.weeklyTrackerData,
    monarchData,
    threeToThrive: threeToThriveData,
    monthlyReviewData,
    saveThreeToThriveAnswer: dashboard.handleSaveThreeToThriveAnswer,
    isLoading: dashboard.isLoading,
    log,
    clearToast,
  };
}
