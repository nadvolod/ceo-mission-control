const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return usdFormatter.format(amount);
}

export function computeCashGrowthMoM(
  currentMonthIncome: number,
  currentMonthExpenses: number,
  previousMonthIncome: number,
  previousMonthExpenses: number,
): number | null {
  const currentNet = currentMonthIncome - currentMonthExpenses;
  const previousNet = previousMonthIncome - previousMonthExpenses;
  if (previousNet === 0) {
    if (currentNet === 0) return 0;
    console.warn(
      `[dashboard-metrics] cash growth MoM is undefined: previousNet=0, currentNet=${currentNet}. Rendering as "—".`,
    );
    return null;
  }
  return ((currentNet - previousNet) / Math.abs(previousNet)) * 100;
}
