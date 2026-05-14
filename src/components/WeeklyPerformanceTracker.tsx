'use client';

import { useState, useEffect } from 'react';
import {
  Flame, Plus, TrendingUp, TrendingDown, CheckCircle2, XCircle,
  AlertTriangle, BarChart3, Activity, ClipboardList, Target, Trash2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine
} from 'recharts';
import type { PerformanceDayEntry, WeeklySummary, WeeklyReview, FocusCategory } from '@/lib/types';
import type { DailyFinancialMetrics } from '@/lib/financial-tracker';
import { MoneyMovePopover } from './MoneyMovePopover';

type FinancialTotals = { moved: number; generated: number; cut: number; netImpact: number };

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const sign = value < 0 ? '-' : '';
  return `${sign}$${formatted}`;
}

const QUICK_ADD_BUTTONS: Array<{ hours: number; category: FocusCategory; color: string; borderColor: string }> = [
  { hours: 0.5, category: 'Temporal', color: 'text-blue-600', borderColor: 'border-blue-300 hover:bg-blue-50' },
  { hours: 1, category: 'Temporal', color: 'text-blue-600', borderColor: 'border-blue-300 hover:bg-blue-50' },
  { hours: 2, category: 'Temporal', color: 'text-blue-600', borderColor: 'border-blue-300 hover:bg-blue-50' },
  { hours: 1, category: 'Finance', color: 'text-emerald-600', borderColor: 'border-emerald-300 hover:bg-emerald-50' },
  { hours: 1, category: 'Revenue', color: 'text-violet-600', borderColor: 'border-violet-300 hover:bg-violet-50' },
  { hours: 1, category: 'Tax', color: 'text-red-600', borderColor: 'border-red-300 hover:bg-red-50' },
];

interface WeeklyPerformanceTrackerProps {
  todaysEntry: PerformanceDayEntry | null;
  currentWeekSummary: WeeklySummary;
  previousWeekSummary: WeeklySummary;
  dailyTrend: Array<PerformanceDayEntry & { isEmpty: boolean }>;
  recentReviews: WeeklyReview[];
  onLogDay: (deepWorkHours: number, pipelineActions: number, trained: boolean) => Promise<void>;
  onSubmitReview: (review: {
    slipAnalysis: string;
    systemAdjustment: string;
    nextWeekTargets: string;
    bottleneck: string;
    temporalTarget: number;
  }) => Promise<void>;
  onAddFocusSession?: (category: FocusCategory, hours: number, description: string) => Promise<void>;
  temporalActual?: number;
  todaysFocusSessions?: Array<{ category: string; hours: number; description: string; timestamp: string }>;
  todaysFocusTotal?: number;
  todaysFinancial: DailyFinancialMetrics;
  weekFinancialByDay: DailyFinancialMetrics[];
  weekFinancialTotals: FinancialTotals;
  previousWeekFinancialTotals: FinancialTotals;
  dailyFinancialTrend: DailyFinancialMetrics[];
  onAddFinancialEntry: (
    category: 'moved' | 'generated' | 'cut',
    amount: number,
    description: string
  ) => Promise<void>;
  /** Admin curation: remove a daily entry for the given date. Optional. */
  onDeleteDay?: (date: string) => Promise<void>;
  /** Admin curation: remove a weekly review by id. Optional. */
  onDeleteReview?: (id: string) => Promise<void>;
}

type TabId = 'daily' | 'weekly' | 'trends' | 'review';

function getDayFlags(entry: PerformanceDayEntry | null): { isZeroDay: boolean; isGoodDay: boolean } {
  if (!entry) return { isZeroDay: false, isGoodDay: false };
  const isZeroDay = entry.deepWorkHours === 0 || entry.pipelineActions === 0;
  const isGoodDay = entry.deepWorkHours >= 3 && entry.pipelineActions >= 2 && entry.trained;
  return { isZeroDay, isGoodDay };
}

function getDayStatusLabel(entry: PerformanceDayEntry | null): { label: string; color: string; bgColor: string } {
  if (!entry) return { label: 'Not Logged', color: 'text-gray-400', bgColor: 'bg-gray-50' };
  const flags = getDayFlags(entry);
  if (flags.isGoodDay) return { label: 'Good Day', color: 'text-green-700', bgColor: 'bg-green-50' };
  if (flags.isZeroDay) return { label: 'Zero Day', color: 'text-red-700', bgColor: 'bg-red-50' };
  return { label: 'Partial', color: 'text-amber-700', bgColor: 'bg-amber-50' };
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyPerformanceTracker({
  todaysEntry,
  currentWeekSummary,
  previousWeekSummary,
  dailyTrend,
  recentReviews,
  onLogDay,
  onSubmitReview,
  onAddFocusSession,
  temporalActual = 0,
  todaysFocusSessions = [],
  todaysFocusTotal = 0,
  todaysFinancial,
  weekFinancialByDay,
  weekFinancialTotals,
  previousWeekFinancialTotals,
  dailyFinancialTrend,
  onAddFinancialEntry,
  onDeleteDay,
  onDeleteReview,
}: WeeklyPerformanceTrackerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('daily');
  const [isLogging, setIsLogging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddingFocus, setIsAddingFocus] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ category: string; hours: number } | null>(null);

  // Money Move quick-add state
  const [moveCategory, setMoveCategory] = useState<'moved' | 'generated' | 'cut' | null>(null);
  const [moveAmount, setMoveAmount] = useState('');
  const [moveDescription, setMoveDescription] = useState('');
  const [isAddingMove, setIsAddingMove] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Auto-clear success confirmation after 2 seconds
  useEffect(() => {
    if (!lastAdded) return;
    const timer = setTimeout(() => setLastAdded(null), 2000);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  // Daily entry form state
  const [deepWork, setDeepWork] = useState(todaysEntry?.deepWorkHours?.toString() ?? '');
  const [pipeline, setPipeline] = useState(todaysEntry?.pipelineActions?.toString() ?? '');
  const [trained, setTrained] = useState(todaysEntry?.trained ?? false);

  // Sync form state when todaysEntry prop changes (e.g. after logging),
  // but only when the user is NOT actively editing the form
  useEffect(() => {
    if (!isLogging) {
      setDeepWork(todaysEntry?.deepWorkHours?.toString() ?? '');
      setPipeline(todaysEntry?.pipelineActions?.toString() ?? '');
      setTrained(todaysEntry?.trained ?? false);
    }
  }, [todaysEntry, isLogging]);

  // Review form state — pre-populate from existing review if available
  const existingReview = recentReviews.find(
    r => r.weekStartDate === currentWeekSummary.weekStartDate
  );
  const [reviewSlip, setReviewSlip] = useState(existingReview?.slipAnalysis ?? '');
  const [reviewSystem, setReviewSystem] = useState(existingReview?.systemAdjustment ?? '');
  const [reviewTargets, setReviewTargets] = useState(existingReview?.nextWeekTargets ?? '');
  const [reviewBottleneck, setReviewBottleneck] = useState(existingReview?.bottleneck ?? '');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Inline Temporal Target edit state
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState<string>('');
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);

  // Sync review form when existing review data changes (e.g. after submit)
  useEffect(() => {
    if (existingReview) {
      setReviewSlip(existingReview.slipAnalysis ?? '');
      setReviewSystem(existingReview.systemAdjustment ?? '');
      setReviewTargets(existingReview.nextWeekTargets ?? '');
      setReviewBottleneck(existingReview.bottleneck ?? '');
    }
  }, [existingReview?.id]);

  const dayStatus = getDayStatusLabel(todaysEntry);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dw = parseFloat(deepWork);
    const pl = parseInt(pipeline, 10);
    if (isNaN(dw) || isNaN(pl)) return;

    setIsSubmitting(true);
    try {
      await onLogDay(dw, pl, trained);
      setIsLogging(false);
    } catch (error) {
      console.error('Error logging day:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickGoodDay = async () => {
    setIsSubmitting(true);
    try {
      await onLogDay(3, 2, true);
      setIsLogging(false);
    } catch (error) {
      console.error('Error logging good day:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginEditTarget = () => {
    setTargetDraft(currentWeekSummary.temporalTarget.toString());
    setTargetError(null);
    setIsEditingTarget(true);
  };

  const cancelEditTarget = () => {
    setIsEditingTarget(false);
    setTargetError(null);
    setTargetDraft('');
  };

  const saveTarget = async () => {
    if (isSavingTarget) return;
    const next = parseFloat(targetDraft);
    if (isNaN(next) || next < 0) {
      setTargetError('Enter a non-negative number');
      return;
    }
    if (next === currentWeekSummary.temporalTarget) {
      cancelEditTarget();
      return;
    }
    setIsSavingTarget(true);
    setTargetError(null);
    try {
      await onSubmitReview({
        slipAnalysis: existingReview?.slipAnalysis ?? '',
        systemAdjustment: existingReview?.systemAdjustment ?? '',
        nextWeekTargets: existingReview?.nextWeekTargets ?? '',
        bottleneck: existingReview?.bottleneck ?? '',
        temporalTarget: next,
      });
      setIsEditingTarget(false);
      setTargetDraft('');
    } catch (error) {
      console.error('Error saving Temporal Target:', error);
      setTargetError('Save failed — try again');
    } finally {
      setIsSavingTarget(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmittingReview(true);
    try {
      await onSubmitReview({
        slipAnalysis: reviewSlip,
        systemAdjustment: reviewSystem,
        nextWeekTargets: reviewTargets,
        bottleneck: reviewBottleneck,
        temporalTarget: existingReview?.temporalTarget ?? currentWeekSummary.temporalTarget ?? 5,
      });
      setReviewSlip('');
      setReviewSystem('');
      setReviewTargets('');
      setReviewBottleneck('');
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  };

  // Prepare chart data for 14-day trend
  const trendChartData = dailyTrend.slice(-14).map(d => ({
    date: d.date,
    deepWork: d.deepWorkHours,
    pipeline: d.pipelineActions,
    trained: d.trained ? 1 : 0,
  }));

  // 30-day deep work line chart data
  const deepWorkTrendData = dailyTrend.map(d => ({
    date: d.date,
    deepWork: d.deepWorkHours,
  }));

  // Performance Summary stats for money trend
  const moneyTrend = dailyFinancialTrend;
  const totalNet = moneyTrend.reduce((acc, d) => acc + d.totals.netImpact, 0);
  const avgNetPerDay = moneyTrend.length > 0 ? totalNet / moneyTrend.length : 0;
  const bestMoneyDay = moneyTrend.reduce<{ date: string; value: number } | null>((best, d) => {
    if (d.totals.netImpact <= 0) return best;
    if (!best || d.totals.netImpact > best.value) {
      return { date: d.date, value: d.totals.netImpact };
    }
    return best;
  }, null);

  // Merge financial Net $/day into the 30-day trend chart
  const moneyHasData = dailyFinancialTrend.some(d => d.totals.netImpact !== 0);
  const financialByDate = new Map(dailyFinancialTrend.map(d => [d.date, d.totals.netImpact]));
  const trendChartMerged = deepWorkTrendData.map(d => ({
    date: d.date,
    deepWork: d.deepWork,
    netImpact: financialByDate.get(d.date) ?? 0,
  }));
  const hasDeepWorkData = deepWorkTrendData.some(d => d.deepWork > 0);
  const showTrendChart = hasDeepWorkData || moneyHasData;

  // Weekly entries for the daily grid
  const weekEntries = currentWeekSummary.dailyEntries;

  // Check if today is Sunday for review CTA
  const isSunday = new Date().getDay() === 0;
  const hasCurrentWeekReview = recentReviews.some(
    r => r.weekStartDate === currentWeekSummary.weekStartDate
  );

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'daily', label: 'Daily', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'weekly', label: 'Weekly', icon: <Target className="h-4 w-4" /> },
    { id: 'trends', label: 'Trends', icon: <Activity className="h-4 w-4" /> },
    { id: 'review', label: 'Review', icon: <ClipboardList className="h-4 w-4" /> },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Flame className="h-6 w-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Weekly Performance Tracker</h3>
          </div>
          <div className="flex items-center space-x-2">
            {!isLogging && (
              <button
                onClick={handleQuickGoodDay}
                disabled={isSubmitting}
                className="flex items-center space-x-1 px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                title="Log 3h deep work + 2 pipeline + trained"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Good Day</span>
              </button>
            )}
            <button
              onClick={() => setIsLogging(!isLogging)}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Log Today</span>
            </button>
          </div>
        </div>

        {/* Today's Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {todaysEntry?.deepWorkHours ?? '--'}
              {todaysEntry && <span className="text-sm font-normal">h</span>}
            </div>
            <div className="text-xs text-gray-500">Deep Work</div>
            {todaysEntry && (
              <div className={`text-xs mt-1 ${todaysEntry.deepWorkHours >= 3 ? 'text-green-600' : 'text-amber-600'}`}>
                {todaysEntry.deepWorkHours >= 3 ? 'Target met' : `${(3 - todaysEntry.deepWorkHours).toFixed(1)}h to target`}
              </div>
            )}
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {todaysEntry?.pipelineActions ?? '--'}
            </div>
            <div className="text-xs text-gray-500">Pipeline</div>
            {todaysEntry && (
              <div className={`text-xs mt-1 ${todaysEntry.pipelineActions >= 2 ? 'text-green-600' : 'text-amber-600'}`}>
                {todaysEntry.pipelineActions >= 2 ? 'Target met' : `${2 - todaysEntry.pipelineActions} more needed`}
              </div>
            )}
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold">
              {todaysEntry == null ? (
                <span className="text-gray-400">--</span>
              ) : todaysEntry.trained ? (
                <CheckCircle2 className="h-7 w-7 text-green-600 mx-auto" />
              ) : (
                <XCircle className="h-7 w-7 text-red-500 mx-auto" />
              )}
            </div>
            <div className="text-xs text-gray-500">Trained</div>
          </div>
          <div className="text-center p-3 bg-indigo-50 rounded-lg">
            {isEditingTarget ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-indigo-600">
                  <span>{temporalActual}/</span>
                  <input
                    autoFocus
                    type="number"
                    step="0.5"
                    min="0"
                    aria-label="Temporal Target (hours/week)"
                    value={targetDraft}
                    disabled={isSavingTarget}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void saveTarget();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEditTarget();
                      }
                    }}
                    onBlur={() => {
                      if (isEditingTarget) void saveTarget();
                    }}
                    className="w-16 text-center text-2xl font-bold text-indigo-600 bg-white border border-indigo-300 rounded px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-normal">h</span>
                </div>
                <div className="text-xs text-gray-500">Temporal Target</div>
                {targetError && (
                  <div className="text-xs text-red-600" role="alert">{targetError}</div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={beginEditTarget}
                aria-label="Edit Temporal Target"
                className="w-full text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                title="Click to edit Temporal Target"
              >
                <div className="text-2xl font-bold text-indigo-600">
                  {temporalActual}/{currentWeekSummary.temporalTarget}
                  <span className="text-sm font-normal">h</span>
                </div>
                <div className="text-xs text-gray-500">Temporal Target</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      currentWeekSummary.temporalTarget > 0 && temporalActual >= currentWeekSummary.temporalTarget
                        ? 'bg-green-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, currentWeekSummary.temporalTarget > 0 ? (temporalActual / currentWeekSummary.temporalTarget) * 100 : 0)}%` }}
                  />
                </div>
              </button>
            )}
          </div>
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div
              data-testid="net-today-value"
              className={`text-2xl font-bold ${
                todaysFinancial.totals.netImpact > 0
                  ? 'text-emerald-700'
                  : todaysFinancial.totals.netImpact < 0
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            >
              {formatCurrency(todaysFinancial.totals.netImpact)}
            </div>
            <div className="text-xs text-gray-500">Net Today</div>
            <div data-testid="net-today-breakdown" className="text-[10px] text-gray-500 mt-1">
              mv {formatCurrency(todaysFinancial.totals.moved)} · gen {formatCurrency(todaysFinancial.totals.generated)} · cut {formatCurrency(todaysFinancial.totals.cut)}
            </div>
          </div>
          <div className={`text-center p-3 rounded-lg ${dayStatus.bgColor}`}>
            <div className={`text-sm font-bold ${dayStatus.color}`}>{dayStatus.label}</div>
            <div className="text-xs text-gray-500 mt-1">Day Status</div>
            {todaysEntry && getDayFlags(todaysEntry).isZeroDay && (
              <div className="flex items-center justify-center mt-1">
                <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />
                <span className="text-xs text-red-600">Unacceptable</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick-Add Focus Buttons */}
        {onAddFocusSession && (
          <div className="flex flex-wrap gap-2 mt-4">
            {QUICK_ADD_BUTTONS.map(({ hours, category, color, borderColor }) => (
              <button
                key={`${hours}-${category}`}
                disabled={isAddingFocus}
                onClick={async () => {
                  setIsAddingFocus(true);
                  try {
                    await onAddFocusSession(category, hours, `${hours}h ${category} focus block`);
                    setLastAdded({ category, hours });
                  } catch (error) {
                    console.error('Error adding focus session:', error);
                  } finally {
                    setIsAddingFocus(false);
                  }
                }}
                className={`px-3 py-1.5 text-sm font-medium border rounded-full ${color} ${borderColor} bg-white transition-colors disabled:opacity-50`}
              >
                +{hours}h {category}
              </button>
            ))}
          </div>
        )}

        {/* Money Move quick-add */}
        {onAddFinancialEntry && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap gap-2">
              {(['moved', 'generated', 'cut'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMoveCategory(cat)}
                  className="px-3 py-1.5 text-sm font-medium border border-emerald-300 text-emerald-700 rounded-full bg-white hover:bg-emerald-50"
                >
                  + {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            {moveCategory && (
              <form
                className="mt-2 flex flex-wrap items-end gap-2 bg-gray-50 p-3 rounded-lg"
                onSubmit={async e => {
                  e.preventDefault();
                  const amt = parseFloat(moveAmount);
                  if (!Number.isFinite(amt) || amt <= 0 || !moveDescription.trim()) return;
                  setIsAddingMove(true);
                  setMoveError(null);
                  try {
                    await onAddFinancialEntry(moveCategory, amt, moveDescription.trim());
                    setMoveAmount('');
                    setMoveDescription('');
                    setMoveCategory(null);
                  } catch (err) {
                    setMoveError(err instanceof Error ? err.message : 'Failed to save move');
                  } finally {
                    setIsAddingMove(false);
                  }
                }}
              >
                <label className="text-xs font-medium text-gray-600 flex flex-col">
                  Category
                  <select
                    value={moveCategory}
                    onChange={e => setMoveCategory(e.target.value as 'moved' | 'generated' | 'cut')}
                    className="mt-0.5 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="moved">Moved</option>
                    <option value="generated">Generated</option>
                    <option value="cut">Cut</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-gray-600 flex flex-col">
                  Amount
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={moveAmount}
                    onChange={e => setMoveAmount(e.target.value)}
                    className="mt-0.5 px-2 py-1 border border-gray-300 rounded text-sm w-28"
                    aria-label="amount"
                  />
                </label>
                <label className="text-xs font-medium text-gray-600 flex flex-col flex-1 min-w-[180px]">
                  Description
                  <input
                    type="text"
                    value={moveDescription}
                    onChange={e => setMoveDescription(e.target.value)}
                    className="mt-0.5 px-2 py-1 border border-gray-300 rounded text-sm"
                    aria-label="description"
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    isAddingMove ||
                    !moveDescription.trim() ||
                    !Number.isFinite(parseFloat(moveAmount)) ||
                    parseFloat(moveAmount) <= 0
                  }
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isAddingMove ? 'Saving…' : 'Save move'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMoveCategory(null); setMoveError(null); }}
                  className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                {moveError && <div className="w-full text-xs text-red-600">{moveError}</div>}
              </form>
            )}
          </div>
        )}

        {/* Today's Focus Sessions */}
        {onAddFocusSession && (
          <div className="mt-3">
            {lastAdded && (
              <div className="text-sm text-green-600 font-medium mb-1">
                Added! +{lastAdded.hours}h {lastAdded.category}
              </div>
            )}
            {todaysFocusTotal > 0 && (
              <div className="text-xs text-gray-500 mb-2">
                Today: {todaysFocusTotal}h focus logged
              </div>
            )}
            {todaysFocusSessions.length > 0 && (
              <div className="space-y-1">
                {todaysFocusSessions.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center text-xs text-gray-600 gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <span>{s.description}</span>
                    <span className="text-gray-400 ml-auto">{s.hours}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Form */}
      {isLogging && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h4 className="text-md font-medium text-gray-900 mb-3">Log Today&apos;s Performance</h4>
          <form onSubmit={handleLogSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wt-deep-work" className="block text-sm font-medium text-gray-700 mb-1">
                  Deep Work Hours (0-8)
                </label>
                <input
                  id="wt-deep-work"
                  type="number"
                  step="0.5"
                  min="0"
                  max="8"
                  value={deepWork}
                  onChange={(e) => setDeepWork(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                  placeholder="e.g., 3.5"
                  required
                />
              </div>
              <div>
                <label htmlFor="wt-pipeline" className="block text-sm font-medium text-gray-700 mb-1">
                  Pipeline Actions
                </label>
                <input
                  id="wt-pipeline"
                  type="number"
                  step="1"
                  min="0"
                  value={pipeline}
                  onChange={(e) => setPipeline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                  placeholder="e.g., 3"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Training</label>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setTrained(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    trained
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-1" /> Trained
                </button>
                <button
                  type="button"
                  onClick={() => setTrained(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !trained
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <XCircle className="h-4 w-4 inline mr-1" /> Skipped
                </button>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isSubmitting || !deepWork || !pipeline}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : todaysEntry ? 'Update Today' : 'Log Today'}
              </button>
              <button
                type="button"
                onClick={() => setIsLogging(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sunday Review CTA */}
      {isSunday && !hasCurrentWeekReview && activeTab !== 'review' && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Sunday evening review is due</span>
            </div>
            <button
              onClick={() => setActiveTab('review')}
              className="text-sm px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Start Review
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Daily Tab */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Current Week Grid */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">This Week</h4>
              <div className="grid grid-cols-7 gap-2">
                {DAY_LABELS.map((dayLabel, i) => {
                  const entry = weekEntries[i] || null;
                  const flags = getDayFlags(entry);
                  const dwColor = entry
                    ? entry.deepWorkHours >= 3
                      ? 'bg-green-500'
                      : entry.deepWorkHours > 0
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    : 'bg-gray-200';
                  const dwPct = entry ? Math.min(100, (entry.deepWorkHours / 8) * 100) : 0;

                  return (
                    <div key={dayLabel} className="text-center">
                      <div className="text-xs font-medium text-gray-500 mb-1">{dayLabel}</div>
                      {/* Deep work bar */}
                      <div className="h-16 w-full bg-gray-100 rounded relative flex items-end justify-center overflow-hidden">
                        <div
                          className={`w-full rounded-t ${dwColor} transition-all duration-300`}
                          style={{ height: `${dwPct}%` }}
                        />
                        {entry && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
                            {entry.deepWorkHours}h
                          </div>
                        )}
                      </div>
                      {/* Pipeline count */}
                      <div className={`text-xs mt-1 ${entry ? 'text-purple-600 font-semibold' : 'text-gray-300'}`}>
                        {entry ? `${entry.pipelineActions} pl` : '--'}
                      </div>
                      {/* Training indicator */}
                      <div className="mt-0.5">
                        {entry == null ? (
                          <span className="text-gray-300 text-xs">--</span>
                        ) : entry.trained ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />
                        )}
                      </div>
                      {/* Zero day flag */}
                      {flags.isZeroDay && (
                        <div className="mt-0.5">
                          <AlertTriangle className="h-3 w-3 text-red-500 mx-auto" />
                        </div>
                      )}
                      {/* Curation: delete this day's entry. Only shows
                          when an entry exists AND the parent supplied an
                          onDeleteDay handler (admin contexts). */}
                      {entry && onDeleteDay && (
                        <button
                          type="button"
                          aria-label={`Delete entry for ${entry.date}`}
                          title={`Delete entry for ${entry.date}`}
                          onClick={async () => {
                            if (!window.confirm(`Delete the weekly tracker entry for ${entry.date}? This cannot be undone.`)) return;
                            try {
                              await onDeleteDay(entry.date);
                            } catch (err) {
                              alert((err as Error).message || 'Failed to delete entry');
                            }
                          }}
                          className="mt-1 text-gray-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3 mx-auto" />
                        </button>
                      )}
                      {(() => {
                        const fin = weekFinancialByDay[i];
                        const net = fin?.totals.netImpact ?? 0;
                        const hasData = fin && fin.entries.length > 0;
                        return (
                          <MoneyMovePopover entries={fin?.entries ?? []}>
                            <div
                              data-testid={`day-money-${i}`}
                              tabIndex={hasData ? 0 : -1}
                              className={`mt-1 text-xs font-medium ${
                                !hasData ? 'text-gray-300' : net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : 'text-gray-500'
                              }`}
                            >
                              {hasData ? formatCurrency(net) : '—'}
                            </div>
                          </MoneyMovePopover>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 14-day Bar Chart */}
            {trendChartData.some(d => d.deepWork > 0 || d.pipeline > 0) ? (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Last 14 Days</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDayOfWeek} fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value, name) => {
                        if (name === 'deepWork') return [`${value}h`, 'Deep Work'];
                        if (name === 'pipeline') return [value, 'Pipeline'];
                        return [value, String(name)];
                      }}
                    />
                    <Bar dataKey="deepWork" fill="#3B82F6" name="Deep Work" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="pipeline" fill="#8B5CF6" name="Pipeline" radius={[2, 2, 0, 0]} />
                    <ReferenceLine y={3} stroke="#10B981" strokeDasharray="3 3" label={{ value: '3h target', position: 'right', fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No data yet</p>
                <p className="text-xs mt-1">Log your first day to see charts</p>
              </div>
            )}
          </div>
        )}

        {/* Weekly Tab */}
        {activeTab === 'weekly' && (
          <div className="space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Net Impact</p>
                <p data-testid="weekly-net-impact" className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(weekFinancialTotals.netImpact)}
                </p>
                <p data-testid="weekly-net-impact-prev" className="text-xs text-gray-500 mt-1">
                  Last week: {formatCurrency(previousWeekFinancialTotals.netImpact)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Pipeline Total</p>
                <p className="text-2xl font-bold text-purple-700">{currentWeekSummary.pipelineTotal}</p>
                {previousWeekSummary.pipelineTotal > 0 && (
                  <DeltaBadge current={currentWeekSummary.pipelineTotal} previous={previousWeekSummary.pipelineTotal} />
                )}
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Deep Work Total</p>
                <p className="text-2xl font-bold text-blue-700">{currentWeekSummary.deepWorkTotal}h</p>
                {previousWeekSummary.deepWorkTotal > 0 && (
                  <DeltaBadge current={currentWeekSummary.deepWorkTotal} previous={previousWeekSummary.deepWorkTotal} suffix="h" />
                )}
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Consistency</p>
                <p className="text-2xl font-bold text-amber-700">{currentWeekSummary.consistencyScore}%</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      currentWeekSummary.consistencyScore >= 80
                        ? 'bg-green-500'
                        : currentWeekSummary.consistencyScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${currentWeekSummary.consistencyScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Money Category Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Moved</p>
                <p data-testid="weekly-moved" className="text-lg font-bold text-blue-700">{formatCurrency(weekFinancialTotals.moved)}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Generated</p>
                <p data-testid="weekly-generated" className="text-lg font-bold text-emerald-700">{formatCurrency(weekFinancialTotals.generated)}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Cut</p>
                <p data-testid="weekly-cut" className="text-lg font-bold text-purple-700">{formatCurrency(weekFinancialTotals.cut)}</p>
              </div>
            </div>

            {/* Days Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-gray-50">
                <div className="text-xl font-bold text-gray-700">{currentWeekSummary.daysTracked}</div>
                <div className="text-xs text-gray-500">Days Tracked</div>
              </div>
              <div className={`text-center p-3 rounded-lg ${currentWeekSummary.goodDays > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className={`text-xl font-bold ${currentWeekSummary.goodDays > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {currentWeekSummary.goodDays}
                </div>
                <div className="text-xs text-gray-500">Good Days</div>
              </div>
              <div className={`text-center p-3 rounded-lg ${currentWeekSummary.zeroDays > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`text-xl font-bold ${currentWeekSummary.zeroDays > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {currentWeekSummary.zeroDays}
                </div>
                <div className="text-xs text-gray-500">Zero Days</div>
              </div>
            </div>

            {/* Week-over-Week Comparison */}
            {previousWeekSummary.daysTracked > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Week-over-Week</h4>
                <div className="space-y-2">
                  <ComparisonRow label="Deep Work" current={`${currentWeekSummary.deepWorkTotal}h`} previous={`${previousWeekSummary.deepWorkTotal}h`} better={currentWeekSummary.deepWorkTotal >= previousWeekSummary.deepWorkTotal} />
                  <ComparisonRow label="Pipeline" current={`${currentWeekSummary.pipelineTotal}`} previous={`${previousWeekSummary.pipelineTotal}`} better={currentWeekSummary.pipelineTotal >= previousWeekSummary.pipelineTotal} />
                  <ComparisonRow label="Consistency" current={`${currentWeekSummary.consistencyScore}%`} previous={`${previousWeekSummary.consistencyScore}%`} better={currentWeekSummary.consistencyScore >= previousWeekSummary.consistencyScore} />
                  <ComparisonRow label="Good Days" current={`${currentWeekSummary.goodDays}`} previous={`${previousWeekSummary.goodDays}`} better={currentWeekSummary.goodDays >= previousWeekSummary.goodDays} />
                  <ComparisonRow
                    label="Net Impact"
                    current={formatCurrency(weekFinancialTotals.netImpact)}
                    previous={formatCurrency(previousWeekFinancialTotals.netImpact)}
                    better={weekFinancialTotals.netImpact >= previousWeekFinancialTotals.netImpact}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {showTrendChart ? (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Deep Work (30 Days){moneyHasData ? ' + Net $/day' : ''}</h4>
                <div data-testid={moneyHasData ? 'trends-chart-money' : 'trends-chart'}>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendChartMerged}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                      <YAxis
                        yAxisId="hours"
                        fontSize={11}
                        domain={[0, 8]}
                        label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 11 }}
                      />
                      {moneyHasData && (
                        <YAxis
                          yAxisId="dollars"
                          orientation="right"
                          fontSize={11}
                          tickFormatter={(v) => formatCurrency(Number(v))}
                        />
                      )}
                      <Tooltip
                        labelFormatter={(label) => formatDate(String(label))}
                        formatter={(value, name) => {
                          if (name === 'Deep Work') return [`${value}h`, 'Deep Work'];
                          if (name === 'Net $/day') return [formatCurrency(Number(value)), 'Net $/day'];
                          return [value, String(name)];
                        }}
                      />
                      <ReferenceLine yAxisId="hours" y={3} stroke="#10B981" strokeDasharray="5 5" label={{ value: '3h target', position: 'right', fontSize: 10, fill: '#10B981' }} />
                      <Line
                        yAxisId="hours"
                        type="monotone"
                        dataKey="deepWork"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 2, fill: '#3B82F6' }}
                        name="Deep Work"
                      />
                      {moneyHasData && (
                        <Line
                          yAxisId="dollars"
                          type="monotone"
                          dataKey="netImpact"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={{ r: 2, fill: '#10B981' }}
                          name="Net $/day"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Not enough data for trends yet</p>
              </div>
            )}

            {/* Rolling consistency (computed inline) */}
            {currentWeekSummary.daysTracked > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Performance Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Avg Deep Work/day:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {currentWeekSummary.daysTracked > 0
                        ? (currentWeekSummary.deepWorkTotal / currentWeekSummary.daysTracked).toFixed(1)
                        : '0'}h
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Pipeline/day:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {currentWeekSummary.daysTracked > 0
                        ? (currentWeekSummary.pipelineTotal / currentWeekSummary.daysTracked).toFixed(1)
                        : '0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Training rate:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {currentWeekSummary.daysTracked > 0
                        ? Math.round(
                            (weekEntries.filter((e): e is PerformanceDayEntry => e !== null && e.trained).length / currentWeekSummary.daysTracked) * 100
                          )
                        : 0}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Zero day rate:</span>
                    <span className={`ml-2 font-semibold ${currentWeekSummary.zeroDays > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {currentWeekSummary.daysTracked > 0
                        ? Math.round((currentWeekSummary.zeroDays / currentWeekSummary.daysTracked) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg net/day:</span>
                    <span data-testid="avg-net-per-day" className="ml-2 font-semibold text-gray-900">
                      {formatCurrency(Math.round(avgNetPerDay))}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Best money day:</span>
                    <span data-testid="best-money-day" className="ml-2 font-semibold text-gray-900">
                      {bestMoneyDay ? `${formatDate(bestMoneyDay.date)} ${formatCurrency(bestMoneyDay.value)}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
          <div className="space-y-6">
            {/* Review Form */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                {hasCurrentWeekReview ? 'Update Weekly Review' : 'Weekly Review'}
              </h4>
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <div className="text-xs text-gray-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                  Tip: click the Temporal Target card above to change your weekly target.
                </div>
                <div>
                  <label htmlFor="wt-slip" className="block text-sm font-medium text-gray-700 mb-1">
                    Where did I slip? Why? <span className="text-gray-400">(be precise, not emotional)</span>
                  </label>
                  <textarea
                    id="wt-slip"
                    value={reviewSlip}
                    onChange={(e) => setReviewSlip(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                    rows={2}
                    placeholder="e.g., Missed deep work Wednesday — client emergency pulled me out"
                  />
                </div>
                <div>
                  <label htmlFor="wt-system" className="block text-sm font-medium text-gray-700 mb-1">
                    What system do I adjust?
                  </label>
                  <textarea
                    id="wt-system"
                    value={reviewSystem}
                    onChange={(e) => setReviewSystem(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                    rows={2}
                    placeholder="e.g., Block morning 8-11 for deep work, no meetings before noon"
                  />
                </div>
                <div>
                  <label htmlFor="wt-targets" className="block text-sm font-medium text-gray-700 mb-1">
                    Next week targets
                  </label>
                  <textarea
                    id="wt-targets"
                    value={reviewTargets}
                    onChange={(e) => setReviewTargets(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                    rows={2}
                    placeholder="e.g., 4h deep work daily, 3+ pipeline, train every day"
                  />
                </div>
                <div>
                  <label htmlFor="wt-bottleneck" className="block text-sm font-medium text-gray-700 mb-1">
                    1 Bottleneck
                  </label>
                  <input
                    id="wt-bottleneck"
                    type="text"
                    value={reviewBottleneck}
                    onChange={(e) => setReviewBottleneck(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                    placeholder="e.g., Context switching between too many projects"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingReview ? 'Submitting...' : 'Submit Weekly Review'}
                </button>
              </form>
            </div>

            {/* Recent Reviews */}
            {recentReviews.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Reviews</h4>
                <div className="space-y-3">
                  {recentReviews.map(review => (
                    <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          Week of {formatDate(review.weekStartDate)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-green-600">
                            ${(review.revenue ?? 0).toLocaleString()}
                          </span>
                          {onDeleteReview && (
                            <button
                              type="button"
                              aria-label={`Delete review for week of ${review.weekStartDate}`}
                              title={`Delete review for week of ${review.weekStartDate}`}
                              onClick={async () => {
                                if (!window.confirm(`Delete the weekly review for week of ${review.weekStartDate}? This cannot be undone.`)) return;
                                try {
                                  await onDeleteReview(review.id);
                                } catch (err) {
                                  alert((err as Error).message || 'Failed to delete review');
                                }
                              }}
                              className="text-gray-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {review.slipAnalysis && (
                        <div className="text-xs text-gray-600 mb-1">
                          <span className="font-medium">Slip:</span> {review.slipAnalysis}
                        </div>
                      )}
                      {review.systemAdjustment && (
                        <div className="text-xs text-gray-600 mb-1">
                          <span className="font-medium">Adjust:</span> {review.systemAdjustment}
                        </div>
                      )}
                      {review.bottleneck && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Bottleneck:</span> {review.bottleneck}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaBadge({ current, previous, suffix = '' }: { current: number; previous: number; suffix?: string }) {
  const delta = current - previous;
  const isUp = delta >= 0;
  return (
    <div className={`flex items-center text-xs mt-1 ${isUp ? 'text-green-600' : 'text-red-600'}`}>
      {isUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
      {isUp ? '+' : ''}{delta}{suffix} vs last week
    </div>
  );
}

function ComparisonRow({ label, current, previous, better }: { label: string; current: string; previous: string; better: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center space-x-3">
        <span className="text-sm text-gray-400">{previous}</span>
        <span className="text-gray-300">&rarr;</span>
        <span className={`text-sm font-semibold ${better ? 'text-green-600' : 'text-red-600'}`}>{current}</span>
      </div>
    </div>
  );
}
