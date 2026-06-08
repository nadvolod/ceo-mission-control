'use client';

import { useMemo, useState } from 'react';
import { Sparkline } from './primitives/Sparkline';
import { MC_COLORS } from './palette';
import { fmtMetric } from './format';

type Period = 7 | 14 | 30;

type DailyFocusEntry = {
  date: string;
  totalHours?: number;
  byCategory?: Record<string, number>;
};

type DailyFinancialEntry = {
  date: string;
  totals?: { moved?: number; generated?: number; cut?: number; netImpact?: number };
};

type Props = {
  focusDailyTrend?: DailyFocusEntry[];
  financialDailyTrend?: DailyFinancialEntry[];
};

// Insights body. Period selector controls all the cards. Each card shows
// label / period total / sparkline / week-over-week delta.
export function InsightsTab({ focusDailyTrend, financialDailyTrend }: Props) {
  const [period, setPeriod] = useState<Period>(14);

  const cards = useMemo(
    () => buildInsightCards(period, focusDailyTrend, financialDailyTrend),
    [period, focusDailyTrend, financialDailyTrend],
  );

  return (
    <div className="flex flex-col gap-4" data-testid="insights-tab">
      <PeriodSelector value={period} onChange={setPeriod} />
      <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2">
        {cards.map((c) => (
          <InsightCard key={c.label} {...c} />
        ))}
      </div>
    </div>
  );
}

// ----- Period selector ---------------------------------------------------

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const options: Period[] = [7, 14, 30];
  return (
    <div className="flex items-center gap-1" data-testid="insights-period-selector">
      {options.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className="rounded-md font-numerics cursor-pointer"
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.06em',
              background: active ? 'rgba(124,124,255,0.14)' : 'transparent',
              color: active ? 'var(--color-mc-uv-hi)' : 'var(--color-mc-fg-dim)',
              border: active ? '1px solid rgba(124,124,255,0.33)' : '1px solid rgba(255,255,255,0.08)',
              font: 'inherit',
            }}
            data-testid={`insights-period-${p}`}
            aria-pressed={active}
          >
            {p}D
          </button>
        );
      })}
    </div>
  );
}

// ----- Insight card ------------------------------------------------------

type InsightCard = {
  label: string;
  data: number[];
  color: string;
  total: number;
  fmt: 'hours' | 'count' | 'money';
  deltaPct?: number;
};

function InsightCard({ label, data, color, total, fmt, deltaPct }: InsightCard) {
  const hasData = data.some((v) => v > 0);
  const totalText =
    fmt === 'hours' ? `${total.toFixed(1)}h` :
    fmt === 'count' ? `${total.toFixed(0)}×` :
    fmtMetric(total, 'money');

  const deltaLabel =
    deltaPct === undefined || !Number.isFinite(deltaPct)
      ? '—'
      : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%`;
  const deltaColor =
    deltaPct === undefined || deltaPct === 0 ? 'var(--color-mc-fg-muted)' :
    deltaPct > 0 ? 'var(--color-mc-green)' : 'var(--color-mc-red)';

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        padding: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
      data-testid={`insight-card-${label.toLowerCase()}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          opacity: 0.16,
        }}
      />
      <div className="relative flex items-baseline justify-between gap-2">
        <span
          className="font-numerics uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--color-mc-fg-dim)',
          }}
        >
          {label}
        </span>
        <span className="font-numerics" style={{ fontSize: 11, color: deltaColor }}>
          {deltaLabel} WoW
        </span>
      </div>
      <div
        className="relative font-numerics"
        style={{
          fontSize: 30,
          color: 'var(--color-mc-ink)',
          lineHeight: 1,
          marginTop: 8,
        }}
      >
        {totalText}
      </div>
      <div
        className="relative"
        style={{ fontSize: 11, color: 'var(--color-mc-fg-dim)', marginTop: 6 }}
      >
        period total
      </div>
      <div className="relative" style={{ marginTop: 14 }}>
        {hasData ? (
          <Sparkline
            data={data}
            color={color}
            fill={color}
            height={48}
            width={360}
            strokeWidth={1.5}
            dots
          />
        ) : (
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--color-mc-fg-muted)',
            }}
            className="font-numerics"
          >
            NO DATA YET
          </div>
        )}
      </div>
    </div>
  );
}

// ----- Derivation --------------------------------------------------------

function meanOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sumOf(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// Always-week-over-week: compare the last 7 days against the 7 days before
// that, regardless of the selected display period. The card labels the
// number "WoW" — that promise has to hold for every period (Copilot caught
// the half-vs-half implementation didn't actually compute WoW for 7d/30d).
//
// Caller passes the FULL recent series (we slice the last 14 here); if the
// series is shorter than 14, we return undefined so the UI shows "—".
function weekOverWeekDelta(seriesUpTo14d: number[]): number | undefined {
  const tail = seriesUpTo14d.slice(-14);
  if (tail.length < 14) return undefined;
  const recent = meanOf(tail.slice(-7));
  const prior = meanOf(tail.slice(0, 7));
  if (prior === 0) {
    if (recent === 0) return 0;
    return undefined;
  }
  return ((recent - prior) / prior) * 100;
}

function buildInsightCards(
  period: Period,
  focusDailyTrend: DailyFocusEntry[] | undefined,
  financialDailyTrend: DailyFinancialEntry[] | undefined,
): InsightCard[] {
  // Period-scoped series — used for the sparkline + total.
  const focus = (focusDailyTrend ?? []).slice(-period);
  const fin = (financialDailyTrend ?? []).slice(-period);

  const temporal = focus.map((d) => d.byCategory?.Temporal ?? 0);
  // Deep Work = "Other" + Temporal. Temporal hours ARE deep work, just
  // additionally tagged as the strategic project — without this addition,
  // +1h Temporal wouldn't contribute to the Deep Work card. The same
  // accumulation runs in useMissionStore.baseMetrics and TrendsPanel.
  const deepWork = focus.map((d) =>
    (d.byCategory?.Other ?? 0) + (d.byCategory?.Temporal ?? 0),
  );
  const moneyMoved = fin.map((d) =>
    (d.totals?.moved ?? 0) + (d.totals?.generated ?? 0) + (d.totals?.cut ?? 0),
  );

  // Fixed 14-day series — used only for the WoW delta so the label is
  // accurate regardless of the selected display period.
  const focus14 = (focusDailyTrend ?? []).slice(-14);
  const fin14 = (financialDailyTrend ?? []).slice(-14);
  const temporal14 = focus14.map((d) => d.byCategory?.Temporal ?? 0);
  const deepWork14 = focus14.map((d) =>
    (d.byCategory?.Other ?? 0) + (d.byCategory?.Temporal ?? 0),
  );
  const moneyMoved14 = fin14.map((d) =>
    (d.totals?.moved ?? 0) + (d.totals?.generated ?? 0) + (d.totals?.cut ?? 0),
  );

  return [
    {
      label: 'Temporal',
      data: temporal,
      color: MC_COLORS.pink,
      total: sumOf(temporal),
      fmt: 'hours',
      deltaPct: weekOverWeekDelta(temporal14),
    },
    {
      label: 'Deep work',
      data: deepWork,
      color: MC_COLORS.cyan,
      total: sumOf(deepWork),
      fmt: 'hours',
      deltaPct: weekOverWeekDelta(deepWork14),
    },
    {
      label: 'Money moved',
      data: moneyMoved,
      color: MC_COLORS.green,
      total: sumOf(moneyMoved),
      fmt: 'money',
      deltaPct: weekOverWeekDelta(moneyMoved14),
    },
  ];
}

// Exported for tests.
export const __insightsInternals = { buildInsightCards, weekOverWeekDelta, meanOf, sumOf };
