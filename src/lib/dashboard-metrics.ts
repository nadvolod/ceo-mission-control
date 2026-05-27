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

// % change in account balance over the current month — matches Monarch's
// "1 month" view. previousCashPosition is derived as `cashPosition - currentNet`
// (the balance at the start of the current month, assuming the only delta is
// this month's income/expenses). Returns null when the prior balance is 0 and
// the current month has movement, since percentage change from zero is
// undefined.
export function computeCashGrowthMoM(
  cashPosition: number,
  monthlyIncome: number,
  monthlyExpenses: number,
): number | null {
  const currentNet = monthlyIncome - monthlyExpenses;
  const previousCashPosition = cashPosition - currentNet;
  if (previousCashPosition === 0) {
    if (currentNet === 0) return 0;
    console.warn(
      `[dashboard-metrics] cash growth MoM is undefined: previousCashPosition=0, currentNet=${currentNet}. Rendering as "—".`,
    );
    return null;
  }
  return (currentNet / Math.abs(previousCashPosition)) * 100;
}

// Dollar change in cash position over the current month. Equal to
// monthlyIncome − monthlyExpenses by construction (see computeCashGrowthMoM).
export function computeCashMoMDelta(monthlyIncome: number, monthlyExpenses: number): number {
  return monthlyIncome - monthlyExpenses;
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
