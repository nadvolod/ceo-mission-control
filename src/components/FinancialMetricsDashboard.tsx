'use client';

import { DollarSign, TrendingUp, Scissors, Calculator, ArrowUp, ArrowDown } from 'lucide-react';

interface FinancialEntry {
  id: string;
  amount: number;
  description: string;
  timestamp: string;
  category: 'moved' | 'generated' | 'cut';
}

interface DailyFinancialMetrics {
  date: string;
  entries: FinancialEntry[];
  totals: {
    moved: number;
    generated: number;
    cut: number;
    netImpact: number;
  };
}

interface FinancialMetricsDashboardProps {
  todaysMetrics: DailyFinancialMetrics;
  weeklyTotals: { moved: number; generated: number; cut: number; netImpact: number };
  monthlyTotals: { moved: number; generated: number; cut: number; netImpact: number };
  recentEntries: FinancialEntry[];
}

export function FinancialMetricsDashboard({
  todaysMetrics,
  weeklyTotals,
  monthlyTotals,
  recentEntries
}: FinancialMetricsDashboardProps) {
  
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'moved': return <DollarSign className="h-5 w-5" />;
      case 'generated': return <TrendingUp className="h-5 w-5" />;
      case 'cut': return <Scissors className="h-5 w-5" />;
      default: return <Calculator className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'moved': return 'text-blue-600 bg-blue-50';
      case 'generated': return 'text-green-600 bg-green-50';
      case 'cut': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const todayTotal = todaysMetrics.totals.netImpact;
  const weeklyTotal = weeklyTotals.netImpact;
  const monthlyTotal = monthlyTotals.netImpact;

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Financial Impact Tracking</h2>
        <p className="text-gray-600">How much $ was moved today toward $1M/month goal</p>
      </div>

      {/* Today's Metrics - Main Display */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="h-6 w-6 text-blue-600 mr-2" />
            <span className="font-semibold text-blue-900">Money Moved</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(todaysMetrics.totals.moved)}
          </div>
          <div className="text-xs text-blue-700 mt-1">Cash flow, deals closed</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
            <span className="font-semibold text-green-900">New Revenue</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(todaysMetrics.totals.generated)}
          </div>
          <div className="text-xs text-green-700 mt-1">Revenue creation</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Scissors className="h-6 w-6 text-purple-600 mr-2" />
            <span className="font-semibold text-purple-900">Expenses Cut</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(todaysMetrics.totals.cut)}
          </div>
          <div className="text-xs text-purple-700 mt-1">Cost optimization</div>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 text-center border-2 border-gray-300">
          <div className="flex items-center justify-center mb-2">
            <Calculator className="h-6 w-6 text-gray-700 mr-2" />
            <span className="font-semibold text-gray-900">Net Impact</span>
          </div>
          <div className={`text-2xl font-bold ${todayTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {todayTotal >= 0 ? '+' : ''}{formatCurrency(todayTotal)}
          </div>
          <div className="text-xs text-gray-600 mt-1">Total financial progress</div>
        </div>
      </div>

      {/* Period Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-700">Today</span>
            <span className={`flex items-center ${todayTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {todayTotal >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
              {formatCurrency(Math.abs(todayTotal))}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {todaysMetrics.entries.length} transactions
          </div>
        </div>

        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-700">This Week</span>
            <span className={`flex items-center ${weeklyTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {weeklyTotal >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
              {formatCurrency(Math.abs(weeklyTotal))}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            7-day total
          </div>
        </div>

        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-700">This Month</span>
            <span className={`flex items-center ${monthlyTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthlyTotal >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
              {formatCurrency(Math.abs(monthlyTotal))}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Month-to-date progress
          </div>
        </div>
      </div>

      {/* Mission Progress Indicator */}
      <div className="bg-white rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
          Mission Progress Analysis
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Monthly target ($1M/month)</span>
            <span className="font-medium">$1,000,000</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Current month progress</span>
            <span className="font-medium text-green-600">
              {formatCurrency(monthlyTotal)} ({((monthlyTotal / 1000000) * 100).toFixed(2)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Daily average needed</span>
            <span className="font-medium">
              {formatCurrency(1000000 / 30)} per day
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Today's performance vs. target</span>
            <span className={`font-medium ${todayTotal >= 33333 ? 'text-green-600' : 'text-orange-600'}`}>
              {todayTotal >= 33333 ? '✅ On track' : '⚡ Needs acceleration'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {recentEntries.length > 0 && (
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Recent Financial Activity</h3>
          <div className="space-y-2">
            {recentEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getCategoryColor(entry.category)}`}>
                    {getCategoryIcon(entry.category)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{entry.description}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">
                    {formatCurrency(entry.amount)}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {entry.category}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Hint */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-sm text-blue-800">
          <strong>💬 Usage:</strong> In main chat, say things like:
          <div className="mt-1 space-y-1 text-xs">
            <div>• "Moved $12K: Artis WHO contract signed"</div>
            <div>• "Generated $2K: Tricentis webinar booked"</div>
            <div>• "Cut $200: cancelled Adobe subscription"</div>
          </div>
        </div>
      </div>
    </div>
  );
}