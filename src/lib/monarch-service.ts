import { loadJSON, saveJSON } from './storage';
import { fetchAccounts, fetchCashflowSummary } from './monarch-client';
import type { MonarchAccount, MonarchFinancialSnapshot } from './types';

const CACHE_KEY = 'monarch-financial-data.json';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Build a financial snapshot from raw Monarch data.
 * Pure computation — no API calls or side effects.
 */
export function buildSnapshot(
  accounts: MonarchAccount[],
  cashflowSummary: { sumIncome: number; sumExpense: number; savings: number; savingsRate: number }
): Omit<MonarchFinancialSnapshot, 'lastSynced'> {
  // Filter to visible, active accounts
  const visibleAccounts = accounts.filter(
    (a) => !a.isHidden && !a.syncDisabled && !a.deactivatedAt
  );

  // Cash accounts: checking + savings (depository type)
  const cashAccounts = visibleAccounts.filter((a) => {
    const typeName = a.type?.name?.toLowerCase() ?? '';
    const subtypeName = a.subtype?.name?.toLowerCase() ?? '';
    return (
      typeName === 'depository' ||
      subtypeName === 'checking' ||
      subtypeName === 'savings' ||
      subtypeName === 'money_market'
    );
  });

  const cashPosition = cashAccounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const totalAssets = visibleAccounts
    .filter((a) => a.isAsset && a.includeInNetWorth !== false)
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const totalLiabilities = visibleAccounts
    .filter((a) => !a.isAsset && a.includeInNetWorth !== false)
    .reduce((sum, a) => sum + Math.abs(a.currentBalance ?? 0), 0);

  const netWorth = totalAssets - totalLiabilities;

  const monthlyIncome = cashflowSummary.sumIncome;
  const monthlyExpenses = Math.abs(cashflowSummary.sumExpense);
  // Net burn = expenses minus income (0 if profitable)
  const burnRate = Math.max(monthlyExpenses - monthlyIncome, 0);
  // Use -1 sentinel for "infinite/no burn" since JSON.stringify(Infinity) → null
  const rawRunway = burnRate > 0 ? Math.max(cashPosition / burnRate, 0) : -1;
  const runwayMonths = Number.isFinite(rawRunway) ? rawRunway : -1;

  return {
    accounts: visibleAccounts,
    cashPosition,
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyIncome,
    monthlyExpenses,
    burnRate,
    runwayMonths,
    savingsRate: cashflowSummary.savingsRate,
  };
}

function isCacheFresh(lastSynced: string): boolean {
  const age = Date.now() - new Date(lastSynced).getTime();
  return age < CACHE_TTL_MS;
}

/**
 * Get the current financial snapshot.
 * Returns cached data if fresh (< 15 min), otherwise fetches from Monarch API.
 */
export async function getFinancialSnapshot(
  forceRefresh = false
): Promise<MonarchFinancialSnapshot> {
  // Check cache first
  if (!forceRefresh) {
    const cached = await loadJSON<MonarchFinancialSnapshot | null>(CACHE_KEY, null);
    if (cached && cached.lastSynced && isCacheFresh(cached.lastSynced)) {
      return cached;
    }
  }

  // Fetch fresh data from Monarch
  const [accounts, cashflowSummary] = await Promise.all([
    fetchAccounts(),
    fetchCashflowSummary(),
  ]);

  const snapshot: MonarchFinancialSnapshot = {
    ...buildSnapshot(accounts, cashflowSummary),
    lastSynced: new Date().toISOString(),
  };

  // Persist to cache
  await saveJSON(CACHE_KEY, snapshot);

  return snapshot;
}

/**
 * Get cached snapshot without refreshing.
 * Returns null if no cached data exists.
 */
export async function getCachedSnapshot(): Promise<MonarchFinancialSnapshot | null> {
  return loadJSON<MonarchFinancialSnapshot | null>(CACHE_KEY, null);
}
