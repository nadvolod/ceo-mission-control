export type MetricId =
  | 'cash'
  | 'netWorth'
  | 'debt'
  | 'cashMoM'
  | 'temporal'
  | 'focus'
  | 'deepWork'
  | 'pipeline'
  | 'moneyMoved'
  | 'trained';

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
  color: string;
};

export type ActivitySource = 'money' | 'focus' | 'morning' | 'reflection';

export type ActivityEntry = {
  id: string;
  t: string;        // 'HH:mm' — for display only
  // Full epoch-ms timestamp used by deriveActivity to sort newest-first
  // across day boundaries. Optional for back-compat with hand-built test
  // fixtures; missing/0 sorts to the bottom deterministically (insertion
  // order preserved among ties).
  tsMs?: number;
  kind: MetricId | 'money' | 'cash' | 'deepwork';
  delta: string;    // '+1h', '+ Generated', 'sync', or '' for summary cards
  label: string;
  meta: string;
  // Discriminates the entry's origin so the detail sheet knows how to
  // resolve the full record. Optional for back-compat with existing
  // fixtures and optimistic rows.
  source?: ActivitySource;
  // Lookup key for the detail sheet: YYYY-MM-DD for morning/reflection,
  // the underlying entry id for money/focus.
  refKey?: string;
};
