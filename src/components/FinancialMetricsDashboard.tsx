'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, Scissors, Calculator, ArrowUp, ArrowDown, Plus } from 'lucide-react';

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
  onAddEntry?: (category: 'moved' | 'generated' | 'cut', amount: number, description: string) => Promise<void>;
}

export function FinancialMetricsDashboard({
  todaysMetrics,
  weeklyTotals,
  monthlyTotals,
  recentEntries,
  onAddEntry
}: FinancialMetricsDashboardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<'moved' | 'generated' | 'cut'>('moved');
  const [addAmount, setAddAmount] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAmount.trim() || !onAddEntry) return;
    setIsSubmitting(true);
    try {
      await onAddEntry(addCategory, parseFloat(addAmount), addDescription.trim() || `Manual ${addCategory} entry`);
      setAddAmount('');
      setAddDescription('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding financial entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="flex items-center justify-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-gray-900">Financial Impact Tracking</h2>
          {onAddEntry && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Log Entry
            </button>
          )}
        </div>
        <p className="text-gray-600">How much $ was moved today toward $1M/month goal</p>
      </div>

      {/* Daily Key Question - shows when no activity today */}
      {todayTotal === 0 && onAddEntry && !isAdding && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-5 mb-6">
          <h3 className="text-lg font-bold text-amber-900 text-center mb-3">
            How much money was moved today?
          </h3>
          <p className="text-sm text-amber-700 text-center mb-4">
            Log your financial moves to track progress toward your $1M/month goal.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { amount: 1000, cat: 'moved' as const, label: '+$1K Moved', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
              { amount: 5000, cat: 'moved' as const, label: '+$5K Moved', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
              { amount: 1000, cat: 'generated' as const, label: '+$1K Revenue', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
              { amount: 5000, cat: 'generated' as const, label: '+$5K Revenue', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
              { amount: 500, cat: 'cut' as const, label: '+$500 Cut', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
            ].map(({ amount, cat, label, color }) => (
              <button
                key={`${cat}-${amount}`}
                onClick={() => { setAddAmount(amount.toString()); setAddCategory(cat); setIsAdding(true); }}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${color}`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Custom amount...
            </button>
          </div>
        </div>
      )}

      {/* Add Entry Form */}
      {isAdding && onAddEntry && (
        <form onSubmit={handleAddEntry} className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Log Financial Entry</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value as 'moved' | 'generated' | 'cut')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="moved">Money Moved</option>
              <option value="generated">Revenue Generated</option>
              <option value="cut">Expense Cut</option>
            </select>
            <input
              type="number"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder="Amount ($)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
              step="any"
              required
            />
            <input
              type="text"
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              placeholder="Description (optional)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !addAmount.trim()}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setIsAdding(false); setAddAmount(''); setAddDescription(''); }}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

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

      {/* Quick Add Buttons - shown when there's already activity and form is closed */}
      {todayTotal > 0 && onAddEntry && !isAdding && (
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { amount: 1000, cat: 'moved' as const, label: '+$1K Moved', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
            { amount: 5000, cat: 'moved' as const, label: '+$5K Moved', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
            { amount: 1000, cat: 'generated' as const, label: '+$1K Revenue', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
            { amount: 500, cat: 'cut' as const, label: '+$500 Cut', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
          ].map(({ amount, cat, label, color }) => (
            <button
              key={`quick-${cat}-${amount}`}
              onClick={() => { setAddAmount(amount.toString()); setAddCategory(cat); setIsAdding(true); }}
              className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${color}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Usage Hint - shown only when there's no add capability */}
      {!onAddEntry && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-800">
            <strong>Usage:</strong> In main chat, say things like:
            <div className="mt-1 space-y-1 text-xs">
              <div>&bull; &quot;Moved $12K: Artis WHO contract signed&quot;</div>
              <div>&bull; &quot;Generated $2K: Tricentis webinar booked&quot;</div>
              <div>&bull; &quot;Cut $200: cancelled Adobe subscription&quot;</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}