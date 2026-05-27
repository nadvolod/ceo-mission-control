'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { SEED_METRICS, SEED_SPARKS } from './seed';
import type { ActivityEntry, MetricId, MetricSnapshot } from './types';

// ----- Action mapping -----------------------------------------------------
//
// Every MetricCard preset → exactly one of these labels. The mapping below
// converts that label + delta into a server call against the existing v1
// endpoints (so the new dashboard logs into the same data the old one reads).

type LogResult = { ok: true } | { ok: false; error: string };

async function postLog(metricId: MetricId, delta: number, label: string): Promise<LogResult> {
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
          date: localDateKey(),
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

function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ----- Public hook -------------------------------------------------------

export function useMissionStore() {
  const dashboard = useDashboardData();
  const { monarchData, focusData, financialData, threeToThriveData } = dashboard;

  const [local, dispatch] = useReducer(localReducer, initialLocal);
  const refreshRef = useRef(dashboard.loadAllData);
  useEffect(() => {
    refreshRef.current = dashboard.loadAllData;
  }, [dashboard.loadAllData]);

  const baseMetrics: Record<MetricId, MetricSnapshot> = useMemo(() => {
    const base: Record<MetricId, MetricSnapshot> = {
      cash:       { ...SEED_METRICS.cash,       spark: [...SEED_SPARKS.cash] },
      cashMoM:    { ...SEED_METRICS.cashMoM },
      netWorth:   { ...SEED_METRICS.netWorth,   spark: [...SEED_SPARKS.netWorth] },
      debt:       { ...SEED_METRICS.debt },
      temporal:   { ...SEED_METRICS.temporal,   spark: [...SEED_SPARKS.temporal] },
      focus:      { ...SEED_METRICS.focus },
      moneyMoved: { ...SEED_METRICS.moneyMoved, spark: [...SEED_SPARKS.moneyMoved] },
      pipeline:   { ...SEED_METRICS.pipeline,   spark: [...SEED_SPARKS.pipeline] },
      deepWork:   { ...SEED_METRICS.deepWork,   spark: [...SEED_SPARKS.deepWork] },
      trained:    { ...SEED_METRICS.trained },
    };

    if (monarchData) {
      base.cash.today = monarchData.cashPosition;
      base.cash.week = monarchData.cashPosition;
      base.netWorth.today = monarchData.netWorth;
      base.netWorth.week = monarchData.netWorth;
      base.netWorth.note = `Assets $${(monarchData.totalAssets / 1000).toFixed(0)}K · liab $${(monarchData.totalLiabilities / 1000).toFixed(0)}K`;
      base.debt.today = monarchData.totalLiabilities;
    }

    const todayFocus = focusData?.todaysMetrics;
    const todayByCat = todayFocus?.byCategory ?? {};
    const weeklyByCat = focusData?.weeklyTotals ?? {};
    base.temporal.today = todayByCat.Temporal ?? base.temporal.today;
    base.temporal.week = weeklyByCat.Temporal ?? base.temporal.week;
    base.pipeline.today = todayByCat.Revenue ?? base.pipeline.today;
    base.pipeline.week = weeklyByCat.Revenue ?? base.pipeline.week;
    // Deep work uses focus-hours "Other" by convention (no dedicated category).
    base.deepWork.today = todayByCat.Other ?? base.deepWork.today;
    base.deepWork.week = weeklyByCat.Other ?? base.deepWork.week;

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
        label: SEED_METRICS[metricId]?.label || metricId,
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
    saveThreeToThriveAnswer: dashboard.handleSaveThreeToThriveAnswer,
    isLoading: dashboard.isLoading,
    log,
    clearToast,
  };
}
