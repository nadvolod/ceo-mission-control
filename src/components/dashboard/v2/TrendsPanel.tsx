'use client';

import { Sparkline } from './primitives/Sparkline';
import { MC_COLORS } from './palette';

// Compact 3-column trends. Rendered inside the Overview's "Trends" collapsible
// panel. Sparklines pull from focusData.dailyTrend (focus-hours by category)
// so the series matches the same source the v2 MetricCards read and write.
//
// Empty / missing data renders as a flat zero line and a "—" delta — never a
// fake series. The component takes already-derived numeric arrays so it stays
// trivially testable.

export type TrendSeries = {
  label: string;          // 'TEMPORAL'
  data: number[];         // 14 entries oldest → newest
  color: string;          // hex from palette
  subText: string;        // 'X.Xh · goal Yh'  or '— this week'
  deltaPct?: number;      // current vs previous-week mean (signed)
};

export function TrendsPanel({ series }: { series: TrendSeries[] }) {
  if (series.length === 0) {
    return (
      <div style={{ padding: '14px 18px', fontSize: 12.5, color: 'var(--color-mc-fg-dim)' }}>
        No trend data yet.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 14,
      }}
      data-testid="trends-panel"
    >
      {series.map((s) => (
        <TrendCell key={s.label} series={s} />
      ))}
    </div>
  );
}

function TrendCell({ series }: { series: TrendSeries }) {
  const max = Math.max(...series.data, 0);
  const empty = max === 0;
  const deltaLabel =
    series.deltaPct === undefined || !Number.isFinite(series.deltaPct)
      ? '—'
      : `${series.deltaPct > 0 ? '+' : ''}${series.deltaPct.toFixed(0)}%`;
  const deltaColor =
    series.deltaPct === undefined || series.deltaPct === 0 ? 'var(--color-mc-fg-muted)' :
    series.deltaPct > 0 ? 'var(--color-mc-green)' : 'var(--color-mc-red)';

  return (
    <div className="flex flex-col gap-1.5" data-testid={`trend-${series.label.toLowerCase()}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-numerics uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--color-mc-fg-dim)',
          }}
        >
          {series.label}
        </span>
        <span className="font-numerics" style={{ fontSize: 11, color: deltaColor }}>
          {deltaLabel}
        </span>
      </div>
      {empty ? (
        // Flat baseline — explicitly NOT a fake series. Just a line at 0.
        <div
          style={{
            height: 36,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 1,
              background: 'rgba(255,255,255,0.07)',
            }}
          />
        </div>
      ) : (
        <Sparkline data={series.data} color={series.color} fill={series.color} height={36} width={260} strokeWidth={1.5} dots />
      )}
      <span style={{ fontSize: 11, color: 'var(--color-mc-fg-dim)' }}>{series.subText}</span>
    </div>
  );
}

// ----- Derivation helpers ------------------------------------------------

type DailyFocusEntry = { date: string; totalHours?: number; byCategory?: Record<string, number> };

function lastNDays<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  return arr.slice(-n);
}

function meanOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function weekOverWeekDelta(series: number[]): number | undefined {
  // Compare the last 7 days' mean to the previous 7 days' mean.
  if (series.length < 14) return undefined;
  const recent = meanOf(series.slice(-7));
  const prior = meanOf(series.slice(-14, -7));
  if (prior === 0) {
    if (recent === 0) return 0;
    return undefined; // can't compute % when prior is 0 and recent isn't
  }
  return ((recent - prior) / prior) * 100;
}

export function buildOverviewTrendSeries(
  focusDailyTrend: DailyFocusEntry[] | undefined,
  goals: { temporalWeekly: number; deepWorkWeekly: number; pipelineWeekly: number },
): TrendSeries[] {
  const focus14 = lastNDays(focusDailyTrend ?? [], 14);
  const temporal = focus14.map((d) => d.byCategory?.Temporal ?? 0);
  const pipelineHours = focus14.map((d) => d.byCategory?.Revenue ?? 0);
  // Deep work = "Other" + Temporal. Temporal IS deep work, just additionally
  // tagged as the strategic project. Without this, +1h Temporal wouldn't
  // contribute to the Deep Work goal — see useMissionStore for the snapshot
  // and architecture doc for the rule.
  const deepWork = focus14.map((d) =>
    (d.byCategory?.Other ?? 0) + (d.byCategory?.Temporal ?? 0),
  );

  const fmtHours = (mean: number) => `${(mean * 7).toFixed(1)}h this week`;

  return [
    {
      label: 'TEMPORAL',
      data: temporal,
      color: MC_COLORS.pink,
      subText: `${fmtHours(meanOf(temporal.slice(-7)))} · goal ${goals.temporalWeekly}h`,
      deltaPct: weekOverWeekDelta(temporal),
    },
    {
      label: 'DEEP WORK',
      data: deepWork,
      color: MC_COLORS.cyan,
      subText: `${fmtHours(meanOf(deepWork.slice(-7)))} · goal ${goals.deepWorkWeekly}h`,
      deltaPct: weekOverWeekDelta(deepWork),
    },
    {
      label: 'PIPELINE',
      data: pipelineHours,
      color: MC_COLORS.amber,
      subText: `${fmtHours(meanOf(pipelineHours.slice(-7)))} · goal ${goals.pipelineWeekly}h`,
      deltaPct: weekOverWeekDelta(pipelineHours),
    },
  ];
}
