export type MetricId =
  | 'cash'
  | 'netWorth'
  | 'debt'
  | 'cashMoM'
  | 'temporal'
  | 'focus'
  | 'deepWork'
  | 'battles'
  | 'moneyMoved'
  | 'trained';

export type MetricFmt = 'money' | 'pct' | 'hours' | 'count' | 'int';

// Presentational icon names rendered as a small badge on the metric card and
// on matching activity rows. Kept as a small string union (not a component)
// so MetricSnapshot/ActivityEntry stay plain serializable data.
export type MetricIcon = 'swords';

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
  trend?: {
    label: string;
    value: string;
    tone: 'positive' | 'negative' | 'neutral';
  };
  color: string;
  // Optional badge icon shown in the card eyebrow (e.g. ⚔️ for battles).
  icon?: MetricIcon;
  // Which value the card headlines as its big number. Defaults to 'today'.
  // Battles headline the weekly count instead.
  headline?: 'today' | 'week';
};

export type ActivitySource = 'money' | 'focus' | 'morning' | 'reflection' | 'battle';

export type ActivityEntry = {
  id: string;
  t: string;        // 'HH:mm' — for display only
  // Full epoch-ms timestamp used by deriveActivity to sort newest-first
  // across day boundaries. Optional for back-compat with hand-built test
  // fixtures; missing/0 sorts to the bottom deterministically (insertion
  // order preserved among ties).
  tsMs?: number;
  kind: MetricId | 'money' | 'cash' | 'deepwork' | 'morning' | 'reflection';
  delta: string;    // '+1h', '+ Generated', 'sync', or '' for summary cards
  label: string;
  meta: string;
  // Optional badge icon rendered before the row content (e.g. ⚔️ for battles).
  icon?: MetricIcon;
  // Discriminates the entry's origin so the detail sheet knows how to
  // resolve the full record. Optional for back-compat with existing
  // fixtures and optimistic rows.
  source?: ActivitySource;
  // Lookup key for the detail sheet: YYYY-MM-DD for morning/reflection,
  // the underlying entry id for money/focus.
  refKey?: string;
};
