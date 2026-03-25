import type { MonarchAccount, MonarchCashflowSummary } from './types';

// Mock storage and client to avoid pulling in DB/API dependencies
jest.mock('./storage', () => ({
  loadJSON: jest.fn(),
  saveJSON: jest.fn(),
}));

jest.mock('./monarch-client', () => ({
  fetchAccounts: jest.fn(),
  fetchCashflowSummary: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildSnapshot } = require('./monarch-service');

function makeAccount(overrides: Partial<MonarchAccount> = {}): MonarchAccount {
  return {
    id: 'acc-1',
    displayName: 'Test Account',
    currentBalance: 10000,
    displayBalance: 10000,
    isAsset: true,
    isHidden: false,
    syncDisabled: false,
    includeInNetWorth: true,
    deactivatedAt: null,
    updatedAt: '2026-03-25T00:00:00Z',
    displayLastUpdatedAt: '2026-03-25',
    logoUrl: null,
    type: { name: 'depository', display: 'Depository' },
    subtype: { name: 'checking', display: 'Checking' },
    institution: { id: 'inst-1', name: 'Test Bank' },
    credential: null,
    ...overrides,
  };
}

function makeCashflow(overrides: Partial<MonarchCashflowSummary> = {}): MonarchCashflowSummary {
  return {
    sumIncome: 8000,
    sumExpense: -5000,
    savings: 3000,
    savingsRate: 0.375,
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('computes cash position from checking and savings accounts', () => {
    const accounts = [
      makeAccount({ id: 'a1', currentBalance: 5000, subtype: { name: 'checking', display: 'Checking' } }),
      makeAccount({ id: 'a2', currentBalance: 3000, subtype: { name: 'savings', display: 'Savings' } }),
      makeAccount({ id: 'a3', currentBalance: 50000, isAsset: true, type: { name: 'investment', display: 'Investment' }, subtype: { name: 'brokerage', display: 'Brokerage' } }),
    ];

    const result = buildSnapshot(accounts, makeCashflow());

    expect(result.cashPosition).toBe(8000);
    expect(result.totalAssets).toBe(58000);
  });

  it('computes net worth as assets minus liabilities', () => {
    const accounts = [
      makeAccount({ id: 'a1', currentBalance: 10000, isAsset: true }),
      makeAccount({ id: 'a2', currentBalance: -3000, isAsset: false, type: { name: 'credit', display: 'Credit Card' }, subtype: { name: 'credit_card', display: 'Credit Card' } }),
    ];

    const result = buildSnapshot(accounts, makeCashflow());

    expect(result.totalAssets).toBe(10000);
    expect(result.totalLiabilities).toBe(3000);
    expect(result.netWorth).toBe(7000);
  });

  it('computes runway as cashPosition / burnRate', () => {
    const accounts = [makeAccount({ currentBalance: 10000 })];
    const cashflow = makeCashflow({ sumExpense: -5000 });

    const result = buildSnapshot(accounts, cashflow);

    expect(result.burnRate).toBe(5000);
    expect(result.runwayMonths).toBe(2);
  });

  it('returns -1 runway sentinel when expenses are zero', () => {
    const accounts = [makeAccount({ currentBalance: 10000 })];
    const cashflow = makeCashflow({ sumExpense: 0 });

    const result = buildSnapshot(accounts, cashflow);

    expect(result.runwayMonths).toBe(-1);
  });

  it('excludes hidden accounts', () => {
    const accounts = [
      makeAccount({ id: 'visible', currentBalance: 5000, isHidden: false }),
      makeAccount({ id: 'hidden', currentBalance: 99999, isHidden: true }),
    ];

    const result = buildSnapshot(accounts, makeCashflow());

    expect(result.accounts).toHaveLength(1);
    expect(result.cashPosition).toBe(5000);
  });

  it('excludes sync-disabled accounts', () => {
    const accounts = [
      makeAccount({ id: 'active', currentBalance: 5000, syncDisabled: false }),
      makeAccount({ id: 'disabled', currentBalance: 99999, syncDisabled: true }),
    ];

    const result = buildSnapshot(accounts, makeCashflow());

    expect(result.accounts).toHaveLength(1);
    expect(result.cashPosition).toBe(5000);
  });

  it('excludes deactivated accounts', () => {
    const accounts = [
      makeAccount({ id: 'active', currentBalance: 5000, deactivatedAt: null }),
      makeAccount({ id: 'deactivated', currentBalance: 99999, deactivatedAt: '2026-01-01T00:00:00Z' }),
    ];

    const result = buildSnapshot(accounts, makeCashflow());

    expect(result.accounts).toHaveLength(1);
    expect(result.cashPosition).toBe(5000);
  });

  it('includes money market accounts in cash position', () => {
    const accounts = [
      makeAccount({ id: 'mm', currentBalance: 15000, subtype: { name: 'money_market', display: 'Money Market' } }),
    ];

    const result = buildSnapshot(accounts, makeCashflow());

    expect(result.cashPosition).toBe(15000);
  });

  it('handles empty accounts array', () => {
    const result = buildSnapshot([], makeCashflow());

    expect(result.cashPosition).toBe(0);
    expect(result.totalAssets).toBe(0);
    expect(result.totalLiabilities).toBe(0);
    expect(result.netWorth).toBe(0);
    expect(result.runwayMonths).toBe(0);
  });

  it('passes through income and savings rate from cashflow', () => {
    const cashflow = makeCashflow({ sumIncome: 12000, savingsRate: 0.5 });
    const result = buildSnapshot([makeAccount()], cashflow);

    expect(result.monthlyIncome).toBe(12000);
    expect(result.savingsRate).toBe(0.5);
  });
});
