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

export type ActivityEntry = {
  id: string;
  t: string;        // 'HH:mm'
  kind: MetricId | 'money' | 'cash' | 'deepwork';
  delta: string;    // '+1h', '+ Generated', 'sync'
  label: string;
  meta: string;
};
