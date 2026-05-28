// Production-safe colors and chip-shape type for the v2 dashboard.
// This file is NOT a fixtures module — it has no fake user data and is
// safe to import from production components. The actual sample metrics,
// activity rows, and chip seeds live in __tests__/__fixtures__.ts and
// MUST NOT be imported outside __tests__ paths.

import type { MetricId } from './types';

export const MC_COLORS = {
  uv: '#7C7CFF',
  uvHi: '#9D9CFF',
  pink: '#FF7AD8',
  green: '#3DDC97',
  amber: '#FFB454',
  red: '#FF6469',
  cyan: '#5DD9FF',
} as const;

// Metric → accent color. Used by MetricCard / ChipStrip when we don't
// yet have a real `metric.color` (i.e. before the first data response
// has built the snapshot).
export const METRIC_ACCENTS: Record<MetricId, string> = {
  cash:       MC_COLORS.uv,
  cashMoM:    MC_COLORS.green,
  netWorth:   MC_COLORS.cyan,
  debt:       MC_COLORS.red,
  temporal:   MC_COLORS.pink,
  focus:      MC_COLORS.cyan,
  moneyMoved: MC_COLORS.green,
  pipeline:   MC_COLORS.amber,
  deepWork:   MC_COLORS.cyan,
  trained:    MC_COLORS.amber,
};

// Static, user-agnostic chip-strip type. The actual chip rows are
// computed at runtime by `derive.ts` from real data — there's no seed.
export type Chip =
  | { id: string; kind: 'streak'; icon: 'flame'; body: string; meta: string }
  | { id: string; kind: 'positive'; icon: 'arrow-up'; body: string; emphasis: string }
  | { id: string; kind: 'warning'; icon: 'zap'; body: string }
  | { id: string; kind: 'sync'; body: string };
