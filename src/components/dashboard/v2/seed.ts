import type { ActivityEntry, MetricId, MetricSnapshot } from './types';

export const MC_COLORS = {
  uv: '#7C7CFF',
  uvHi: '#9D9CFF',
  pink: '#FF7AD8',
  green: '#3DDC97',
  amber: '#FFB454',
  red: '#FF6469',
  cyan: '#5DD9FF',
} as const;

// Numbers come from the design handoff source brief — used as the read-only
// first-render baseline before any real data is wired in. Once the v2 page
// reads from useDashboardData, real values override these per metric.
export const SEED_METRICS: Record<MetricId, MetricSnapshot> = {
  cash:       { id: 'cash',       label: 'Cash',        today: 35300,  week: 35300,  unit: '$', fmt: 'money', note: 'No burn',           color: MC_COLORS.uv },
  cashMoM:    { id: 'cashMoM',    label: 'Cash MoM',    today: 228.0,  week: 228.0,  unit: '%', fmt: 'pct',   note: '+$2.4K vs last mo', color: MC_COLORS.green },
  netWorth:   { id: 'netWorth',   label: 'Net worth',   today: 982000, week: 982000, unit: '$', fmt: 'money', note: '$1.01M − $27.9K',   color: MC_COLORS.cyan },
  debt:       { id: 'debt',       label: 'Total debt',  today: 27900,                unit: '$', fmt: 'money', note: 'liabilities',       color: MC_COLORS.red },
  temporal:   { id: 'temporal',   label: 'Temporal',    today: 0,      week: 6.5,    goal: 5,   unit: 'h', fmt: 'hours', note: 'this week', color: MC_COLORS.pink },
  focus:      { id: 'focus',      label: 'Focus hours', today: 0,      week: 0,      goal: 15,  unit: 'h', fmt: 'hours', note: 'this week', color: MC_COLORS.cyan },
  moneyMoved: { id: 'moneyMoved', label: 'Money moved', today: 0,      week: 0,                 unit: '$', fmt: 'money', note: 'this week', color: MC_COLORS.green },
  pipeline:   { id: 'pipeline',   label: 'Pipeline',    today: 0,      week: 0,      goal: 3,   unit: 'h', fmt: 'hours', note: 'this week', color: MC_COLORS.amber },
  deepWork:   { id: 'deepWork',   label: 'Deep work',   today: 0,      week: 0,      goal: 10,  unit: 'h', fmt: 'hours', note: 'this week', color: MC_COLORS.cyan },
  trained:    { id: 'trained',    label: 'Trained',     today: 0,      week: 0,      goal: 4,   unit: '×', fmt: 'count', note: 'this week', color: MC_COLORS.amber },
};

// 14-day spark series, hand-picked from the prototype.
export const SEED_SPARKS = {
  cash:       [28100, 27600, 28400, 30100, 29800, 31200, 30700, 32400, 31500, 32800, 33400, 34100, 34800, 35300],
  netWorth:   [951000, 952500, 954100, 955800, 958200, 960100, 962700, 965300, 968400, 971200, 973900, 976200, 978900, 982000],
  temporal:   [0.5, 1, 0.5, 1.5, 2, 1, 0.5, 1.5, 2, 1, 0, 1, 1.5, 0],
  pipeline:   [1, 0.5, 1.5, 1, 2, 0.5, 1, 0.5, 1.5, 2, 1, 0, 0.5, 0],
  deepWork:   [2, 1.5, 2, 1, 1.5, 2.5, 2, 1.5, 1, 2, 1.5, 1, 0.5, 0],
  moneyMoved: [250, 500, 0, 750, 250, 1000, 500, 250, 0, 500, 1000, 750, 250, 0],
} as const;

export const SEED_ACTIVITY: ActivityEntry[] = [
  { id: 'a1', t: '09:12', kind: 'temporal',   delta: '+1h',         label: 'Temporal',  meta: 'Brief read · investor deck' },
  { id: 'a2', t: '09:15', kind: 'money',      delta: '+ Generated', label: '$2,000',    meta: 'Annual contract · Vega' },
  { id: 'a3', t: '09:20', kind: 'pipeline',   delta: '+ Lead',      label: 'Pipeline',  meta: 'Outbound · Northway' },
  { id: 'a4', t: '08:48', kind: 'cash',       delta: 'sync',        label: 'Cash',      meta: 'Monarch · $35.3K' },
  { id: 'a5', t: '08:30', kind: 'deepwork',   delta: '+0.5h',       label: 'Deep work', meta: 'Architecture doc' },
];

// What gets rendered into the chip strip above the metric grid.
export type Chip =
  | { id: string; kind: 'streak'; icon: 'flame'; body: string; meta: string }
  | { id: string; kind: 'positive'; icon: 'arrow-up'; body: string; emphasis: string }
  | { id: string; kind: 'warning'; icon: 'zap'; body: string }
  | { id: string; kind: 'sync'; body: string };

export const SEED_CHIPS: Chip[] = [
  { id: 'c1', kind: 'streak',   icon: 'flame',    body: '6-day Temporal streak', meta: 'longest in 30d' },
  { id: 'c2', kind: 'positive', icon: 'arrow-up', body: 'Cash MoM',              emphasis: '+228%' },
  { id: 'c3', kind: 'warning',  icon: 'zap',      body: 'Deep work pace ↓ vs 14-day avg' },
  { id: 'c4', kind: 'sync',                       body: 'SYNC · monarch · 4m ago' },
];
