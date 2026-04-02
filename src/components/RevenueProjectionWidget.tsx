'use client';

import { useState } from 'react';
import { TrendingDown, Plus, Trash2, CalendarDays } from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Line, ComposedChart,
} from 'recharts';
import type { RevenueAdjustment, MonthProjection, AdjustmentType } from '@/lib/types';

interface RevenueProjectionWidgetProps {
  projections: MonthProjection[];
  adjustments: RevenueAdjustment[];
  baseIncome: number;
  baseExpenses: number;
  isUsingMonarchBase: { income: boolean; expenses: boolean };
  onAddAdjustment: (adj: {
    effectiveMonth: string;
    amount: number;
    description: string;
    type: AdjustmentType;
    recurring: boolean;
  }) => Promise<void>;
  onRemoveAdjustment: (id: string) => Promise<void>;
}

const TYPE_LABELS: Record<AdjustmentType, string> = {
  revenue_gain: 'Revenue Gain',
  revenue_loss: 'Revenue Loss',
  expense_increase: 'Expense Increase',
  expense_decrease: 'Expense Decrease',
};

const TYPE_COLORS: Record<AdjustmentType, string> = {
  revenue_gain: 'bg-green-100 text-green-700',
  revenue_loss: 'bg-red-100 text-red-700',
  expense_increase: 'bg-orange-100 text-orange-700',
  expense_decrease: 'bg-blue-100 text-blue-700',
};

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Only generate months through Dec of current year to match projection horizon
  for (let y = now.getFullYear(); y <= now.getFullYear(); y++) {
    const startMonth = now.getMonth();
    const endMonth = 11;
    for (let m = startMonth; m <= endMonth; m++) {
      const value = `${y}-${String(m + 1).padStart(2, '0')}`;
      options.push({ value, label: `${monthNames[m]} ${y}` });
    }
  }
  return options;
}

export function RevenueProjectionWidget({
  projections,
  adjustments,
  baseIncome,
  baseExpenses,
  isUsingMonarchBase,
  onAddAdjustment,
  onRemoveAdjustment,
}: RevenueProjectionWidgetProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [formMonth, setFormMonth] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<AdjustmentType>('revenue_loss');
  const [formRecurring, setFormRecurring] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'projection' | 'adjustments'>('projection');

  const monthOptions = generateMonthOptions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMonth || !formAmount || !formDescription) return;
    const parsed = parseFloat(formAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setIsSubmitting(true);
    try {
      await onAddAdjustment({
        effectiveMonth: formMonth,
        amount: parsed,
        description: formDescription,
        type: formType,
        recurring: formRecurring,
      });
      setFormMonth('');
      setFormAmount('');
      setFormDescription('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding adjustment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAdjustment = async (id: string) => {
    setDeletingId(id);
    try {
      await onRemoveAdjustment(id);
    } catch (error) {
      console.error('Error removing adjustment:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const chartData = projections.map((p) => ({
    month: p.monthLabel.split(' ')[0], // "Apr"
    income: p.projectedIncome,
    expenses: p.projectedExpenses,
    net: p.netCashFlow,
    cumulative: p.cumulativeCashImpact,
  }));

  // Find months where net cash flow is negative
  const hasNegativeMonths = projections.some((p) => p.netCashFlow < 0);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-green-50 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Revenue Projections</h2>
          <p className="text-sm text-gray-600 mt-1">
            Month-by-month forecast through end of year
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Adjustment
        </button>
      </div>

      {/* Base Values */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg p-3">
          <div className="text-xs text-gray-500">Base Monthly Income</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(baseIncome)}</div>
          <div className="text-xs text-gray-400">
            {isUsingMonarchBase.income ? 'From Monarch' : 'Manual override'}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="text-xs text-gray-500">Base Monthly Expenses</div>
          <div className="text-lg font-bold text-red-500">{formatCurrency(baseExpenses)}</div>
          <div className="text-xs text-gray-400">
            {isUsingMonarchBase.expenses ? 'From Monarch' : 'Manual override'}
          </div>
        </div>
      </div>

      {/* Add Adjustment Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 mb-6 border border-indigo-200">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            New Revenue/Expense Adjustment
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <select
              value={formMonth}
              onChange={(e) => setFormMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Effective month"
              required
            >
              <option value="">Select month...</option>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as AdjustmentType)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Adjustment type"
            >
              <option value="revenue_loss">Revenue Loss (e.g., contract ends)</option>
              <option value="revenue_gain">Revenue Gain (e.g., new client)</option>
              <option value="expense_decrease">Expense Decrease (e.g., no more rent)</option>
              <option value="expense_increase">Expense Increase (e.g., new lease)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              type="number"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="Amount per month ($)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Amount per month (USD)"
              aria-required="true"
              min="0"
              step="any"
              required
            />
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Description (e.g., WHO contract ends)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2"
              aria-label="Description"
              aria-required="true"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formRecurring}
                onChange={(e) => setFormRecurring(e.target.checked)}
                className="rounded border-gray-300"
              />
              Recurring (applies every month from this point forward)
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-lg p-1">
        <button
          onClick={() => setActiveTab('projection')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'projection'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Projection
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'adjustments'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Adjustments ({adjustments.length})
        </button>
      </div>

      {/* Projection Tab */}
      {activeTab === 'projection' && (
        <div className="space-y-6">
          {/* Chart */}
          {projections.length > 0 && (
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Monthly Cash Flow Forecast</h4>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      name === 'income' ? 'Income' : name === 'expenses' ? 'Expenses' : 'Net',
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  <Line dataKey="net" name="Net Cash Flow" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Projection Table */}
          <div className="bg-white rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Month</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Income</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Inc. Adj</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Proj. Income</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Expenses</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Exp. Adj</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Proj. Expenses</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Net</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((p) => {
                    const hasAdj = p.incomeAdjustments !== 0 || p.expenseAdjustments !== 0;
                    return (
                      <tr
                        key={p.month}
                        className={`border-b ${hasAdj ? 'bg-indigo-50/50' : ''} hover:bg-gray-50`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">{p.monthLabel}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(p.baseIncome)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${
                          p.incomeAdjustments > 0 ? 'text-green-600' : p.incomeAdjustments < 0 ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {p.incomeAdjustments !== 0 ? `${p.incomeAdjustments > 0 ? '+' : ''}${formatCurrency(p.incomeAdjustments)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">{formatCurrency(p.projectedIncome)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(p.baseExpenses)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${
                          p.expenseAdjustments < 0 ? 'text-green-600' : p.expenseAdjustments > 0 ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {p.expenseAdjustments !== 0 ? `${p.expenseAdjustments > 0 ? '+' : ''}${formatCurrency(p.expenseAdjustments)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-red-600">{formatCurrency(p.projectedExpenses)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${p.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {p.netCashFlow >= 0 ? '+' : ''}{formatCurrency(p.netCashFlow)}
                        </td>
                        <td className={`px-3 py-2 text-right ${p.cumulativeCashImpact >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                          {formatCurrency(p.cumulativeCashImpact)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warning if negative months */}
          {hasNegativeMonths && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <TrendingDown className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <strong>Warning:</strong> Some months show negative cash flow. Review your projections and consider adjustments.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjustments Tab */}
      {activeTab === 'adjustments' && (
        <div className="space-y-3">
          {adjustments.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center text-gray-500">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No adjustments yet</p>
              <p className="text-sm mt-1">Add revenue changes or expense adjustments to see projections.</p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Add First Adjustment
              </button>
            </div>
          ) : (
            adjustments
              .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
              .map((adj) => {
                const monthLabel = (() => {
                  const [y, m] = adj.effectiveMonth.split('-');
                  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return `${names[parseInt(m, 10) - 1]} ${y}`;
                })();

                return (
                  <div key={adj.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${TYPE_COLORS[adj.type]}`}>
                        {TYPE_LABELS[adj.type]}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{adj.description}</div>
                        <div className="text-xs text-gray-500">
                          {monthLabel}{adj.recurring ? ' onward' : ' only'} &middot; {formatCurrency(adj.amount)}/mo
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAdjustment(adj.id)}
                      disabled={deletingId === adj.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove adjustment"
                      aria-busy={deletingId === adj.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
