'use client';

import { TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, AlertTriangle } from 'lucide-react';
import type { MonarchFinancialSnapshot } from '@/lib/types';

interface FinancialCommandCenterProps {
  snapshot: MonarchFinancialSnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
  error?: string | null;
}

function formatCurrency(amount: number | null | undefined): string {
  const n = amount ?? 0;
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(1)}K`;
  }
  return `$${n.toFixed(0)}`;
}

function formatRunway(months: number | null | undefined): string {
  const n = months ?? 0;
  if (n < 0) return 'No burn'; // -1 sentinel = profitable/no net burn
  if (n >= 12) return `${(n / 12).toFixed(1)} years`;
  return `${n.toFixed(1)} months`;
}

function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function FinancialCommandCenter({ snapshot, isLoading, onRefresh, error }: FinancialCommandCenterProps) {
  if (isLoading && !snapshot) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Command Center</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-500">Loading Monarch data...</span>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Command Center</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">
              {error ? 'Monarch Money Error' : 'Monarch Money Not Connected'}
            </span>
          </div>
          <p className="text-sm text-yellow-700">
            {error || 'Set the MONARCH_TOKEN environment variable to connect your financial accounts.'}
          </p>
        </div>
      </div>
    );
  }

  const isStale = (snapshot as any).stale === true;
  const runway = snapshot.runwayMonths ?? 0;
  const runwayPositive = runway >= 0;
  const runwayColor = !runwayPositive ? 'text-green-600' : runway < 3 ? 'text-red-600' : runway < 6 ? 'text-yellow-600' : 'text-green-600';
  const runwayBgColor = !runwayPositive ? 'bg-green-50' : runway < 3 ? 'bg-red-50' : runway < 6 ? 'bg-yellow-50' : 'bg-green-50';
  const cards = [
    {
      title: 'Cash Position',
      value: formatCurrency(snapshot.cashPosition),
      subValue: `${formatRunway(runway)} runway`,
      icon: Wallet,
      color: runwayColor,
      bgColor: runwayBgColor,
      urgent: runway >= 0 && runway < 3,
    },
    {
      title: 'Net Worth',
      value: formatCurrency(snapshot.netWorth),
      subValue: `${formatCurrency(snapshot.totalAssets)} assets - ${formatCurrency(snapshot.totalLiabilities)} debt`,
      icon: TrendingUp,
      color: (snapshot.netWorth ?? 0) >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: (snapshot.netWorth ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50',
      urgent: false,
    },
    {
      title: 'Monthly Burn',
      value: formatCurrency(snapshot.burnRate),
      subValue: `vs ${formatCurrency(snapshot.monthlyIncome)} income`,
      icon: TrendingDown,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      urgent: false,
    },
    {
      title: 'Savings Rate',
      value: `${((snapshot.savingsRate ?? 0) * 100).toFixed(0)}%`,
      subValue: `${formatCurrency((snapshot.monthlyIncome ?? 0) - (snapshot.monthlyExpenses ?? 0))}/mo saved`,
      icon: PiggyBank,
      color: (snapshot.savingsRate ?? 0) > 0 ? 'text-emerald-600' : 'text-red-600',
      bgColor: (snapshot.savingsRate ?? 0) > 0 ? 'bg-emerald-50' : 'bg-red-50',
      urgent: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with sync info */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Financial Command Center</h3>
        <div className="flex items-center gap-3">
          {isStale && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Stale data
            </span>
          )}
          <span className="text-xs text-gray-400">
            Synced {timeSince(snapshot.lastSynced)}
          </span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh from Monarch Money"
            title="Refresh from Monarch Money"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`${card.bgColor} rounded-lg p-4 relative overflow-hidden`}>
              {card.urgent && (
                <div className="absolute top-0 right-0 w-0 h-0 border-l-[30px] border-l-transparent border-t-[30px] border-t-red-500"></div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.subValue}</p>
                </div>
                <Icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Runway Visualization */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Runway</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Current Position</span>
            <span className={`text-sm font-bold ${runwayColor}`}>
              {formatRunway(runway)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                runway < 3 ? 'bg-red-500' :
                runway < 6 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(runway >= 0 ? (runway / 24) * 100 : 100, 100)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>0</span>
            <span>6 mo</span>
            <span>12 mo</span>
            <span>24 mo</span>
          </div>

          {/* Income vs Expenses bar */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">This Month</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">Income</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{
                      width: `${Math.min(
                        ((snapshot.monthlyIncome ?? 0) / Math.max(snapshot.monthlyIncome ?? 0, snapshot.monthlyExpenses ?? 0, 1)) * 100,
                        100
                      )}%`
                    }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-green-600 w-20 text-right">
                  {formatCurrency(snapshot.monthlyIncome)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">Expenses</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-red-400"
                    style={{
                      width: `${Math.min(
                        ((snapshot.monthlyExpenses ?? 0) / Math.max(snapshot.monthlyIncome ?? 0, snapshot.monthlyExpenses ?? 0, 1)) * 100,
                        100
                      )}%`
                    }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-red-500 w-20 text-right">
                  {formatCurrency(snapshot.monthlyExpenses)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
