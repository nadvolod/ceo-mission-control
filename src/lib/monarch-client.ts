import { setToken, getAccounts, getCashflowSummary } from 'monarch-money-api';
import type { MonarchAccount, MonarchCashflowSummary } from './types';

let initialized = false;

/**
 * Initialize the Monarch Money API client.
 * Must be called before any API calls.
 * Uses MONARCH_TOKEN env var for authentication.
 */
export async function initializeMonarch(): Promise<void> {
  if (initialized) return;

  const token = process.env.MONARCH_TOKEN;
  if (!token) {
    throw new Error(
      'MONARCH_TOKEN environment variable is required. ' +
      'Run `npx tsx scripts/monarch-login.ts` to obtain a session token.'
    );
  }

  setToken(token);
  initialized = true;
}

/**
 * Fetch all accounts from Monarch Money.
 */
export async function fetchAccounts(): Promise<MonarchAccount[]> {
  await initializeMonarch();
  const result = await getAccounts();
  return (result.accounts ?? []) as MonarchAccount[];
}

/**
 * Fetch cashflow summary for a date range from Monarch Money.
 * Defaults to current month if no dates provided.
 */
export async function fetchCashflowSummary(
  startDate?: string,
  endDate?: string
): Promise<MonarchCashflowSummary> {
  await initializeMonarch();

  const opts: { startDate?: string; endDate?: string } = {};
  if (startDate && endDate) {
    opts.startDate = startDate;
    opts.endDate = endDate;
  }

  const result = await getCashflowSummary(opts);
  // Response shape: { summary: [{ summary: { sumIncome, sumExpense, ... } }] }
  const summaryArray = result.summary;
  const summary = Array.isArray(summaryArray)
    ? summaryArray[0]?.summary
    : (summaryArray as unknown as { summary: MonarchCashflowSummary })?.summary;

  return {
    sumIncome: summary?.sumIncome ?? 0,
    sumExpense: summary?.sumExpense ?? 0,
    savings: summary?.savings ?? 0,
    savingsRate: summary?.savingsRate ?? 0,
  };
}
