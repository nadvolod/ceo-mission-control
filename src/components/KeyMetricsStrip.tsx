'use client';

import { MetricCard } from './MetricCard';
import type { MonarchFinancialSnapshot } from '@/lib/types';
import {
  formatCurrencyCompact,
  formatRunway,
  computeCashGrowthMoM,
  computeCashMoMDelta,
} from '@/lib/dashboard-metrics';

interface KeyMetricsStripProps {
  monarchData: MonarchFinancialSnapshot | null;
  temporalHoursThisWeek: number;
  moneyMovedThisWeek: number;
  focusHoursThisWeek: number;
}

const DASH = '—';

export function KeyMetricsStrip({
  monarchData,
  temporalHoursThisWeek,
  moneyMovedThisWeek,
  focusHoursThisWeek,
}: KeyMetricsStripProps) {
  const cashGrowthPct = monarchData
    ? computeCashGrowthMoM(
        monarchData.monthlyIncome ?? 0,
        monarchData.monthlyExpenses ?? 0,
        monarchData.previousMonthIncome ?? 0,
        monarchData.previousMonthExpenses ?? 0,
      )
    : null;

  const cashGrowthDelta = monarchData
    ? computeCashMoMDelta(
        monarchData.monthlyIncome ?? 0,
        monarchData.monthlyExpenses ?? 0,
        monarchData.previousMonthIncome ?? 0,
        monarchData.previousMonthExpenses ?? 0,
      )
    : null;

  const momColor =
    cashGrowthPct === null
      ? 'text-gray-400'
      : cashGrowthPct >= 0
      ? 'text-green-600'
      : 'text-red-600';

  const netWorthColor =
    monarchData && (monarchData.netWorth ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600';

  const temporalHours = Number.isFinite(temporalHoursThisWeek) ? temporalHoursThisWeek : 0;
  const temporalDisplay = `${temporalHours.toFixed(1).replace(/\.0$/, '')}h`;

  const focusHours = Number.isFinite(focusHoursThisWeek) ? focusHoursThisWeek : 0;
  const focusHoursDisplay = `${focusHours.toFixed(1).replace(/\.0$/, '')}h`;

  return (
    <section
      aria-label="Key metrics"
      data-testid="key-metrics-strip"
      className="grid grid-cols-3 md:grid-cols-7 gap-2 sm:gap-3"
    >
      <MetricCard
        testId="metric-cash"
        title="Cash"
        valueColor="text-blue-600"
        value={monarchData ? formatCurrencyCompact(monarchData.cashPosition) : DASH}
        subLabel={monarchData ? formatRunway(monarchData.runwayMonths) : 'no data'}
      />
      <MetricCard
        testId="metric-cash-mom"
        title="Cash MoM"
        valueColor={momColor}
        value={
          cashGrowthPct === null
            ? DASH
            : `${cashGrowthPct >= 0 ? '+' : ''}${cashGrowthPct.toFixed(1)}%`
        }
        subLabel={
          cashGrowthDelta === null
            ? 'no prior data'
            : `${cashGrowthDelta >= 0 ? '+' : ''}${formatCurrencyCompact(cashGrowthDelta)} vs last mo`
        }
      />
      <MetricCard
        testId="metric-net-worth"
        title="Net Worth"
        valueColor={netWorthColor}
        value={monarchData ? formatCurrencyCompact(monarchData.netWorth) : DASH}
        subLabel={
          monarchData
            ? `${formatCurrencyCompact(monarchData.totalAssets)} − ${formatCurrencyCompact(monarchData.totalLiabilities)}`
            : 'no data'
        }
      />
      <MetricCard
        testId="metric-total-debt"
        title="Total Debt"
        valueColor="text-red-600"
        value={monarchData ? formatCurrencyCompact(monarchData.totalLiabilities) : DASH}
        subLabel="liabilities"
      />
      <MetricCard
        testId="metric-temporal"
        title="Temporal"
        valueColor="text-purple-600"
        value={temporalDisplay}
        subLabel="this week"
      />
      <MetricCard
        testId="metric-focus-hours"
        title="Focus Hours"
        valueColor="text-blue-600"
        value={focusHoursDisplay}
        subLabel="this week"
      />
      <MetricCard
        testId="metric-money-moved"
        title="Money Moved"
        valueColor="text-amber-600"
        value={formatCurrencyCompact(moneyMovedThisWeek)}
        subLabel="this week"
      />
    </section>
  );
}
