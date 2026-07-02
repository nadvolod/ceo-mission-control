const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return usdFormatter.format(amount);
}

export function formatCurrencyCompact(amount: number | null | undefined): string {
  const n = amount ?? 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatRunway(months: number | null | undefined): string {
  const n = months ?? 0;
  if (n < 0) return 'No burn';
  if (n >= 12) return `${(n / 12).toFixed(1)}y runway`;
  return `${n.toFixed(1)}mo runway`;
}

// Cash MoM growth percentage from Monarch cashflow data. Monarch's cashflow
// summary reports savingsRate as a ratio in some client versions (0.752) and
// as a percent in others (75.2), so normalize to display percent.
export function computeCashGrowthMoM(
  monthlyIncome: number,
  monthlyExpenses: number,
  savingsRate?: number | null,
): number | null {
  if (typeof savingsRate === 'number' && Number.isFinite(savingsRate)) {
    return Math.abs(savingsRate) <= 1 ? savingsRate * 100 : savingsRate;
  }
  if (monthlyIncome === 0) {
    if (monthlyExpenses === 0) return 0;
    console.warn('[dashboard-metrics] cash growth MoM is undefined: monthlyIncome=0 with non-zero expenses.');
    return null;
  }
  return ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100;
}

// Dollar cash growth from Monarch cashflow data.
export function computeCashMoMDelta(
  monthlyIncome: number,
  monthlyExpenses: number,
  savings?: number | null,
): number {
  return typeof savings === 'number' && Number.isFinite(savings)
    ? savings
    : monthlyIncome - monthlyExpenses;
}

// Total focused work for the week = every focus-session category (Temporal,
// Finance, Revenue, …) added together, plus any deep-work hours the user
// logged through the Weekly Performance Tracker form. The two systems are
// disjoint inputs (session-level tracking vs. a daily aggregate the user
// enters by hand), so summing them captures all "hours I log."
export function computeTotalFocusHoursThisWeek(
  focusWeeklyTotals: Record<string, number> | null | undefined,
  weeklyTrackerDeepWorkTotal: number | null | undefined,
): number {
  const sessionSum = focusWeeklyTotals
    ? Object.values(focusWeeklyTotals).reduce(
        (acc, hours) => acc + (Number.isFinite(hours) ? hours : 0),
        0,
      )
    : 0;
  const deepWork = Number.isFinite(weeklyTrackerDeepWorkTotal)
    ? (weeklyTrackerDeepWorkTotal as number)
    : 0;
  return sessionSum + deepWork;
}
