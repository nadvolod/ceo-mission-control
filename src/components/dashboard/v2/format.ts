import type { MetricFmt } from './types';

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// One-shot metric formatter shared by MetricCard, hero card, and snapshot strip.
// Compact for money (e.g., 35300 → "$35.3K"), 1-decimal for hours/pct.
export function fmtMetric(value: number, fmt: MetricFmt): string {
  if (!Number.isFinite(value)) return '—';
  switch (fmt) {
    case 'money': {
      const sign = value < 0 ? '-' : '';
      const abs = Math.abs(value);
      if (abs >= 1000) return `${sign}$${COMPACT.format(abs)}`;
      return `${sign}$${abs.toFixed(0)}`;
    }
    case 'pct':
      return `${value.toFixed(value >= 100 ? 0 : 1)}%`;
    case 'hours':
      return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}h`;
    case 'count':
      return `${value.toFixed(0)}×`;
  }
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
