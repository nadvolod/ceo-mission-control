'use client';

import { useState, useEffect } from 'react';
import {
  Flame, Plus, TrendingUp, TrendingDown, CheckCircle2, XCircle,
  AlertTriangle, BarChart3, Activity, ClipboardList, Target
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine
} from 'recharts';
import type { PerformanceDayEntry, WeeklySummary, WeeklyReview } from '@/lib/types';

interface WeeklyPerformanceTrackerProps {
  todaysEntry: PerformanceDayEntry | null;
  currentWeekSummary: WeeklySummary;
  previousWeekSummary: WeeklySummary;
  dailyTrend: Array<PerformanceDayEntry & { isEmpty: boolean }>;
  recentReviews: WeeklyReview[];
  onLogDay: (deepWorkHours: number, pipelineActions: number, trained: boolean) => Promise<void>;
  onSubmitReview: (review: {
    revenue: number;
    slipAnalysis: string;
    systemAdjustment: string;
    nextWeekTargets: string;
    bottleneck: string;
  }) => Promise<void>;
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
}: WeeklyPerformanceTrackerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('daily');
  const [isLogging, setIsLogging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Review form state
  const [reviewRevenue, setReviewRevenue] = useState('');
  const [reviewSlip, setReviewSlip] = useState('');
  const [reviewSystem, setReviewSystem] = useState('');
  const [reviewTargets, setReviewTargets] = useState('');
  const [reviewBottleneck, setReviewBottleneck] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rev = parseFloat(reviewRevenue);
    if (isNaN(rev) || rev < 0) return;

    setIsSubmittingReview(true);
    try {
      await onSubmitReview({
        revenue: rev,
        slipAnalysis: reviewSlip,
        systemAdjustment: reviewSystem,
        nextWeekTargets: reviewTargets,
        bottleneck: reviewBottleneck,
      });
      setReviewRevenue('');
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-green-700">
                  ${currentWeekSummary.revenue.toLocaleString()}
                </p>
                {previousWeekSummary.revenue > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last week: ${previousWeekSummary.revenue.toLocaleString()}
                  </p>
                )}
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
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {deepWorkTrendData.some(d => d.deepWork > 0) ? (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Deep Work (30 Days)</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={deepWorkTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                    <YAxis fontSize={11} domain={[0, 8]} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value) => [`${value}h`, 'Deep Work']}
                    />
                    <ReferenceLine y={3} stroke="#10B981" strokeDasharray="5 5" label={{ value: '3h target', position: 'right', fontSize: 10, fill: '#10B981' }} />
                    <Line
                      type="monotone"
                      dataKey="deepWork"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 2, fill: '#3B82F6' }}
                      name="Deep Work"
                    />
                  </LineChart>
                </ResponsiveContainer>
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
                <div>
                  <label htmlFor="wt-revenue" className="block text-sm font-medium text-gray-700 mb-1">
                    Revenue This Week ($)
                  </label>
                  <input
                    id="wt-revenue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={reviewRevenue}
                    onChange={(e) => setReviewRevenue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                    placeholder="e.g., 5000"
                    required
                  />
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
                  disabled={isSubmittingReview || !reviewRevenue}
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
                        <span className="text-sm font-bold text-green-600">
                          ${review.revenue.toLocaleString()}
                        </span>
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
