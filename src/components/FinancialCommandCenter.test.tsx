import { render, screen } from '@testing-library/react';
import { FinancialCommandCenter } from './FinancialCommandCenter';
import type { MonarchFinancialSnapshot } from '@/lib/types';

describe('FinancialCommandCenter', () => {
  const baseSnapshot: MonarchFinancialSnapshot = {
    accounts: [
      {
        id: '1',
        displayName: 'Checking',
        currentBalance: 5000,
        displayBalance: 5000,
        isAsset: true,
        isHidden: false,
        syncDisabled: false,
        includeInNetWorth: true,
        deactivatedAt: null,
        updatedAt: '2026-03-26T00:00:00Z',
        displayLastUpdatedAt: '2026-03-26',
        logoUrl: null,
        type: { name: 'depository', display: 'Cash' },
        subtype: { name: 'checking', display: 'Checking' },
        institution: { id: 'inst1', name: 'Test Bank' },
        credential: null,
      },
    ],
    cashPosition: 5000,
    totalAssets: 10000,
    totalLiabilities: 2000,
    netWorth: 8000,
    monthlyIncome: 5000,
    monthlyExpenses: 3000,
    previousMonthIncome: 5000,
    previousMonthExpenses: 3000,
    previousMonthLabel: 'Mar 2026',
    burnRate: 0,
    runwayMonths: -1,
    savingsRate: 0.4,
    lastSynced: new Date().toISOString(),
  };

  it('renders without crashing with valid data', () => {
    render(
      <FinancialCommandCenter
        snapshot={baseSnapshot}
        isLoading={false}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Financial Command Center')).toBeInTheDocument();
    expect(screen.getByText('Cash Position')).toBeInTheDocument();
    expect(screen.getByText('Net Worth')).toBeInTheDocument();
  });

  it('renders loading state when no snapshot', () => {
    render(
      <FinancialCommandCenter
        snapshot={null}
        isLoading={true}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Loading Monarch data...')).toBeInTheDocument();
  });

  it('renders not-connected state when no snapshot and not loading', () => {
    render(
      <FinancialCommandCenter
        snapshot={null}
        isLoading={false}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Monarch Money Not Connected')).toBeInTheDocument();
  });

  it('renders error state with error message', () => {
    render(
      <FinancialCommandCenter
        snapshot={null}
        isLoading={false}
        onRefresh={() => {}}
        error="Token expired"
      />
    );
    expect(screen.getByText('Monarch Money Error')).toBeInTheDocument();
    expect(screen.getByText('Token expired')).toBeInTheDocument();
  });

  it('renders without crashing when accounts have null currentBalance', () => {
    const snapshotWithNulls: MonarchFinancialSnapshot = {
      ...baseSnapshot,
      accounts: [
        {
          ...baseSnapshot.accounts[0],
          currentBalance: null,
          displayBalance: null,
        },
        {
          ...baseSnapshot.accounts[0],
          id: '2',
          displayName: 'Credit Card',
          currentBalance: -1500,
          displayBalance: -1500,
          isAsset: false,
        },
        {
          ...baseSnapshot.accounts[0],
          id: '3',
          displayName: 'Investment',
          currentBalance: null,
          displayBalance: null,
        },
      ],
    };

    render(
      <FinancialCommandCenter
        snapshot={snapshotWithNulls}
        isLoading={false}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Financial Command Center')).toBeInTheDocument();
    // Component should render without crashing despite null account balances
    expect(screen.getByText('Cash Position')).toBeInTheDocument();
  });

  it('renders without crashing when snapshot fields are null', () => {
    // Simulate what happens when the API returns partial/null data
    const nullishSnapshot = {
      accounts: [],
      cashPosition: null,
      totalAssets: null,
      totalLiabilities: null,
      netWorth: null,
      monthlyIncome: null,
      monthlyExpenses: null,
      burnRate: null,
      runwayMonths: null,
      savingsRate: null,
      lastSynced: new Date().toISOString(),
    } as unknown as MonarchFinancialSnapshot;

    render(
      <FinancialCommandCenter
        snapshot={nullishSnapshot}
        isLoading={false}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Financial Command Center')).toBeInTheDocument();
    expect(screen.getByText('Cash Position')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders stale data indicator', () => {
    const staleSnapshot = { ...baseSnapshot, stale: true } as any;
    render(
      <FinancialCommandCenter
        snapshot={staleSnapshot}
        isLoading={false}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Stale data')).toBeInTheDocument();
  });

  it('renders with large financial values (millions)', () => {
    const bigSnapshot: MonarchFinancialSnapshot = {
      ...baseSnapshot,
      cashPosition: 2500000,
      netWorth: 5000000,
      totalAssets: 6000000,
      totalLiabilities: 1000000,
    };

    render(
      <FinancialCommandCenter
        snapshot={bigSnapshot}
        isLoading={false}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('$2.50M')).toBeInTheDocument();
  });

  it('renders with negative net worth', () => {
    const negativeSnapshot: MonarchFinancialSnapshot = {
      ...baseSnapshot,
      netWorth: -50000,
      totalAssets: 10000,
      totalLiabilities: 60000,
    };

    render(
      <FinancialCommandCenter
        snapshot={negativeSnapshot}
        isLoading={false}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Net Worth')).toBeInTheDocument();
  });
});
