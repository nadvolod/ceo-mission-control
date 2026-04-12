'use client';

import { useState, useEffect } from 'react';
import { Brain, ChevronDown, ChevronUp, Pencil, Trash2, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import type { MonthlyReview, MonthlyReviewRatings } from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATING_KEYS: Array<{ key: keyof MonthlyReviewRatings; label: string; color: string }> = [
  { key: 'discipline', label: 'Discipline', color: '#2563eb' },
  { key: 'focus', label: 'Focus', color: '#7c3aed' },
  { key: 'executive', label: 'Executive', color: '#0891b2' },
  { key: 'math', label: 'Math', color: '#059669' },
  { key: 'nutrition', label: 'Nutrition', color: '#d97706' },
  { key: 'fitness', label: 'Fitness', color: '#dc2626' },
  { key: 'sleep', label: 'Sleep', color: '#6366f1' },
];

const DECISION_OPTIONS: Array<{ value: MonthlyReview['decisionSource']; label: string; colors: string }> = [
  { value: 'discipline', label: 'Discipline', colors: 'bg-green-100 text-green-800 border-green-300 ring-green-500' },
  { value: 'emotion', label: 'Emotion', colors: 'bg-red-100 text-red-800 border-red-300 ring-red-500' },
  { value: 'mixed', label: 'Mixed', colors: 'bg-amber-100 text-amber-800 border-amber-300 ring-amber-500' },
];

type TabId = 'new' | 'history' | 'trends';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'new', label: 'New Review' },
  { id: 'history', label: 'History' },
  { id: 'trends', label: 'Trends' },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function emptyRatings(): MonthlyReviewRatings {
  return { discipline: 5, focus: 5, executive: 5, math: 5, nutrition: 5, fitness: 5, sleep: 5 };
}

function avgRating(r: MonthlyReviewRatings): string {
  const vals = Object.values(r) as number[];
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(m: string): string {
  // m = "2026-04"
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function decisionBadge(src: MonthlyReview['decisionSource']): { label: string; className: string } {
  switch (src) {
    case 'discipline': return { label: 'Discipline', className: 'bg-green-100 text-green-800' };
    case 'emotion': return { label: 'Emotion', className: 'bg-red-100 text-red-800' };
    case 'mixed': return { label: 'Mixed', className: 'bg-amber-100 text-amber-800' };
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonthlyReviewTrackerProps {
  currentMonthReview: MonthlyReview | null;
  recentReviews: MonthlyReview[];
  ratingsTrend: Array<MonthlyReviewRatings & { month: string }>;
  onSubmitReview: (review: Omit<MonthlyReview, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteReview: (month: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonthlyReviewTracker({
  currentMonthReview,
  recentReviews,
  ratingsTrend,
  onSubmitReview,
  onDeleteReview,
}: MonthlyReviewTrackerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('new');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<MonthlyReview | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────
  const [month, setMonth] = useState(currentMonthReview?.month ?? currentMonth());
  const [date, setDate] = useState(currentMonthReview?.date ?? todayDate());
  const [timeAllocation, setTimeAllocation] = useState(currentMonthReview?.timeAllocation ?? '');
  const [hoursWorked, setHoursWorked] = useState(currentMonthReview?.hoursWorked?.toString() ?? '');
  const [temporalHours, setTemporalHours] = useState(currentMonthReview?.temporalHours?.toString() ?? '');
  const [energyGivers, setEnergyGivers] = useState(currentMonthReview?.energyGivers ?? '');
  const [energyDrainers, setEnergyDrainers] = useState(currentMonthReview?.energyDrainers ?? '');
  const [ignoredSignals, setIgnoredSignals] = useState(currentMonthReview?.ignoredSignals ?? '');
  const [moneySpent, setMoneySpent] = useState(currentMonthReview?.moneySpent ?? '');
  const [expenseJoyVsStress, setExpenseJoyVsStress] = useState(currentMonthReview?.expenseJoyVsStress ?? '');
  const [alignmentCheck, setAlignmentCheck] = useState(currentMonthReview?.alignmentCheck ?? '');
  const [monthLesson, setMonthLesson] = useState(currentMonthReview?.monthLesson ?? '');
  const [decisionSource, setDecisionSource] = useState<MonthlyReview['decisionSource']>(currentMonthReview?.decisionSource ?? 'discipline');
  const [badHabits, setBadHabits] = useState(currentMonthReview?.badHabits ?? '');
  const [goodPatterns, setGoodPatterns] = useState(currentMonthReview?.goodPatterns ?? '');
  const [ratings, setRatings] = useState<MonthlyReviewRatings>(currentMonthReview?.ratings ?? emptyRatings());
  const [oneThingToFix, setOneThingToFix] = useState(currentMonthReview?.oneThingToFix ?? '');
  const [disciplinedVersionAction, setDisciplinedVersionAction] = useState(currentMonthReview?.disciplinedVersionAction ?? '');

  // Sync form when currentMonthReview prop changes (e.g. after save)
  useEffect(() => {
    if (!isSubmitting) {
      populateForm(currentMonthReview);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthReview?.id]);

  function populateForm(review: MonthlyReview | null) {
    setMonth(review?.month ?? currentMonth());
    setDate(review?.date ?? todayDate());
    setTimeAllocation(review?.timeAllocation ?? '');
    setHoursWorked(review?.hoursWorked?.toString() ?? '');
    setTemporalHours(review?.temporalHours?.toString() ?? '');
    setEnergyGivers(review?.energyGivers ?? '');
    setEnergyDrainers(review?.energyDrainers ?? '');
    setIgnoredSignals(review?.ignoredSignals ?? '');
    setMoneySpent(review?.moneySpent ?? '');
    setExpenseJoyVsStress(review?.expenseJoyVsStress ?? '');
    setAlignmentCheck(review?.alignmentCheck ?? '');
    setMonthLesson(review?.monthLesson ?? '');
    setDecisionSource(review?.decisionSource ?? 'discipline');
    setBadHabits(review?.badHabits ?? '');
    setGoodPatterns(review?.goodPatterns ?? '');
    setRatings(review?.ratings ?? emptyRatings());
    setOneThingToFix(review?.oneThingToFix ?? '');
    setDisciplinedVersionAction(review?.disciplinedVersionAction ?? '');
  }

  function handleEditFromHistory(review: MonthlyReview) {
    setEditingReview(review);
    populateForm(review);
    setActiveTab('new');
  }

  function handleCancelEdit() {
    setEditingReview(null);
    populateForm(currentMonthReview);
  }

  async function handleDelete(reviewMonth: string) {
    if (!confirm(`Delete the review for ${formatMonthLabel(reviewMonth)}?`)) return;
    try {
      await onDeleteReview(reviewMonth);
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hw = parseFloat(hoursWorked);
    const th = parseFloat(temporalHours);
    if (!month || isNaN(hw) || isNaN(th)) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitReview({
        month,
        date,
        timeAllocation,
        hoursWorked: hw,
        temporalHours: th,
        energyGivers,
        energyDrainers,
        ignoredSignals,
        moneySpent,
        expenseJoyVsStress,
        alignmentCheck,
        monthLesson,
        decisionSource,
        badHabits,
        goodPatterns,
        ratings,
        oneThingToFix,
        disciplinedVersionAction,
      });
      if (editingReview) {
        setEditingReview(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save review';
      setSubmitError(message);
      console.error('Error submitting review:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateRating(key: keyof MonthlyReviewRatings, value: number) {
    setRatings(prev => ({ ...prev, [key]: value }));
  }

  // ── Trend chart data ──────────────────────────────────────────────────
  const hoursChartData = recentReviews
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(r => ({
      month: r.month,
      label: formatMonthLabel(r.month),
      hoursWorked: r.hoursWorked,
      temporalHours: r.temporalHours,
    }));

  const radarData = ratingsTrend.length > 0
    ? RATING_KEYS.map(rk => ({
        subject: rk.label,
        value: ratingsTrend[ratingsTrend.length - 1][rk.key],
        fullMark: 10,
      }))
    : [];

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Monthly Review</h2>
              <p className="text-sm text-gray-500">Reflect, rate, commit forward</p>
            </div>
          </div>
          {currentMonthReview && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
              {formatMonthLabel(currentMonthReview.month)} logged
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {/* ── NEW REVIEW TAB ── */}
        {activeTab === 'new' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {editingReview && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
                Editing review for <strong>{formatMonthLabel(editingReview.month)}</strong>
              </div>
            )}

            {/* Month selector */}
            <div>
              <label htmlFor="mr-month" className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <input
                id="mr-month"
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            {/* Time section */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-semibold text-gray-700 px-2">Time</legend>
              <div className="space-y-3">
                <div>
                  <label htmlFor="mr-time-alloc" className="block text-xs text-gray-500 mb-1">
                    Where did my time actually go?
                  </label>
                  <textarea
                    id="mr-time-alloc"
                    rows={2}
                    value={timeAllocation}
                    onChange={e => setTimeAllocation(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="mr-hours" className="block text-xs text-gray-500 mb-1">
                      Hours worked
                    </label>
                    <input
                      id="mr-hours"
                      type="number"
                      min={0}
                      step={0.5}
                      value={hoursWorked}
                      onChange={e => setHoursWorked(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="mr-temporal" className="block text-xs text-gray-500 mb-1">
                      Temporal hours
                    </label>
                    <input
                      id="mr-temporal"
                      type="number"
                      min={0}
                      step={0.5}
                      value={temporalHours}
                      onChange={e => setTemporalHours(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Energy section */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-semibold text-gray-700 px-2">Energy</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mr-givers" className="block text-xs text-gray-500 mb-1">
                    What gave me energy?
                  </label>
                  <textarea
                    id="mr-givers"
                    rows={2}
                    value={energyGivers}
                    onChange={e => setEnergyGivers(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="mr-drainers" className="block text-xs text-gray-500 mb-1">
                    What drained me?
                  </label>
                  <textarea
                    id="mr-drainers"
                    rows={2}
                    value={energyDrainers}
                    onChange={e => setEnergyDrainers(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </fieldset>

            {/* Health signals */}
            <div>
              <label htmlFor="mr-signals" className="block text-sm font-medium text-gray-700 mb-1">
                Health Signals Ignored
              </label>
              <textarea
                id="mr-signals"
                rows={2}
                value={ignoredSignals}
                onChange={e => setIgnoredSignals(e.target.value)}
                placeholder="Where did I ignore chronic signals?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Money section */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-semibold text-gray-700 px-2">Money</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mr-money" className="block text-xs text-gray-500 mb-1">
                    Where did my money go?
                  </label>
                  <textarea
                    id="mr-money"
                    rows={2}
                    value={moneySpent}
                    onChange={e => setMoneySpent(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="mr-joy" className="block text-xs text-gray-500 mb-1">
                    Joy vs stress expenses?
                  </label>
                  <textarea
                    id="mr-joy"
                    rows={2}
                    value={expenseJoyVsStress}
                    onChange={e => setExpenseJoyVsStress(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </fieldset>

            {/* Discipline & Alignment section */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-semibold text-gray-700 px-2">Discipline &amp; Alignment</legend>
              <div className="space-y-3">
                <div>
                  <label htmlFor="mr-alignment" className="block text-xs text-gray-500 mb-1">
                    Did I align with long-term discipline or impulse?
                  </label>
                  <textarea
                    id="mr-alignment"
                    rows={2}
                    value={alignmentCheck}
                    onChange={e => setAlignmentCheck(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="mr-lesson" className="block text-xs text-gray-500 mb-1">
                    What lesson does this month teach?
                  </label>
                  <textarea
                    id="mr-lesson"
                    rows={2}
                    value={monthLesson}
                    onChange={e => setMonthLesson(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Decision source toggle */}
                <div>
                  <span className="block text-xs text-gray-500 mb-2">Primary decision driver this month</span>
                  <div className="flex gap-2">
                    {DECISION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDecisionSource(opt.value)}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                          decisionSource === opt.value
                            ? `${opt.colors} ring-2`
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="mr-bad" className="block text-xs text-gray-500 mb-1">
                      Bad habits that tried to return
                    </label>
                    <textarea
                      id="mr-bad"
                      rows={2}
                      value={badHabits}
                      onChange={e => setBadHabits(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="mr-good" className="block text-xs text-gray-500 mb-1">
                      Good patterns that held
                    </label>
                    <textarea
                      id="mr-good"
                      rows={2}
                      value={goodPatterns}
                      onChange={e => setGoodPatterns(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Self-Ratings section */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-semibold text-gray-700 px-2">Self-Ratings (1-10)</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {RATING_KEYS.map(rk => (
                  <div key={rk.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor={`mr-rating-${rk.key}`} className="text-xs text-gray-600">
                        {rk.label}
                      </label>
                      <span className="text-xs font-bold" style={{ color: rk.color }}>
                        {ratings[rk.key]}
                      </span>
                    </div>
                    <input
                      id={`mr-rating-${rk.key}`}
                      type="range"
                      min={1}
                      max={10}
                      value={ratings[rk.key]}
                      onChange={e => updateRating(rk.key, Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Forward Commitments */}
            <fieldset className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/30">
              <legend className="text-sm font-semibold text-indigo-700 px-2">Forward Commitments</legend>
              <div className="space-y-3">
                <div>
                  <label htmlFor="mr-fix" className="block text-xs text-gray-500 mb-1">
                    If I fix only ONE thing next month...
                  </label>
                  <textarea
                    id="mr-fix"
                    rows={2}
                    value={oneThingToFix}
                    onChange={e => setOneThingToFix(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="mr-disciplined" className="block text-xs text-gray-500 mb-1">
                    What would a disciplined version of me do?
                  </label>
                  <textarea
                    id="mr-disciplined"
                    rows={2}
                    value={disciplinedVersionAction}
                    onChange={e => setDisciplinedVersionAction(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </fieldset>

            {/* Submit row */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingReview
                    ? 'Update Review'
                    : currentMonthReview
                      ? 'Update Review'
                      : 'Save Review'}
              </button>
              {editingReview && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {recentReviews.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No monthly reviews yet. Start with your first monthly review!</p>
            ) : (
              recentReviews.map(review => {
                const isExpanded = expandedId === review.id;
                const badge = decisionBadge(review.decisionSource);
                return (
                  <div
                    key={review.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Summary row */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : review.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatMonthLabel(review.month)}
                        </span>
                        <span className="text-xs text-gray-500">{review.hoursWorked}h worked</span>
                        <span className="text-xs text-gray-500">{review.temporalHours}h temporal</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-indigo-600 font-medium">
                          avg {avgRating(review.ratings)}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <DetailField label="Time Allocation" value={review.timeAllocation} />
                          <DetailField label="Energy Givers" value={review.energyGivers} />
                          <DetailField label="Energy Drainers" value={review.energyDrainers} />
                          <DetailField label="Ignored Signals" value={review.ignoredSignals} />
                          <DetailField label="Money Spent" value={review.moneySpent} />
                          <DetailField label="Joy vs Stress" value={review.expenseJoyVsStress} />
                          <DetailField label="Alignment Check" value={review.alignmentCheck} />
                          <DetailField label="Month Lesson" value={review.monthLesson} />
                          <DetailField label="Bad Habits" value={review.badHabits} />
                          <DetailField label="Good Patterns" value={review.goodPatterns} />
                          <DetailField label="One Thing to Fix" value={review.oneThingToFix} />
                          <DetailField label="Disciplined Action" value={review.disciplinedVersionAction} />
                        </div>

                        {/* Ratings */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2">Ratings</h4>
                          <div className="flex flex-wrap gap-2">
                            {RATING_KEYS.map(rk => (
                              <span
                                key={rk.key}
                                className="text-xs font-medium px-2 py-1 rounded-full bg-white border border-gray-200"
                                style={{ color: rk.color }}
                              >
                                {rk.label}: {review.ratings[rk.key]}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleEditFromHistory(review)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(review.month)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TRENDS TAB ── */}
        {activeTab === 'trends' && (
          <div className="space-y-8">
            {ratingsTrend.length < 2 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  Need at least 2 monthly reviews to show trends.
                </p>
              </div>
            ) : (
              <>
                {/* Line chart: all 7 ratings over time */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Ratings Over Time</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ratingsTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11 }}
                          tickFormatter={m => {
                            const [, mo] = m.split('-');
                            const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            return names[Number(mo) - 1] ?? m;
                          }}
                        />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {RATING_KEYS.map(rk => (
                          <Line
                            key={rk.key}
                            type="monotone"
                            dataKey={rk.key}
                            name={rk.label}
                            stroke={rk.color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Radar chart: latest month */}
                {radarData.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Latest Month Radar ({formatMonthLabel(ratingsTrend[ratingsTrend.length - 1].month)})
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
                          <Radar
                            name="Rating"
                            dataKey="value"
                            stroke="#4f46e5"
                            fill="#4f46e5"
                            fillOpacity={0.25}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Line chart: hours worked + temporal hours over time */}
                {hoursChartData.length >= 2 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Hours Over Time</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={hoursChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11 }}
                            tickFormatter={m => {
                              const [, mo] = m.split('-');
                              const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                              return names[Number(mo) - 1] ?? m;
                            }}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line
                            type="monotone"
                            dataKey="hoursWorked"
                            name="Hours Worked"
                            stroke="#4f46e5"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="temporalHours"
                            name="Temporal Hours"
                            stroke="#0891b2"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper component for history detail fields
// ---------------------------------------------------------------------------

function DetailField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
