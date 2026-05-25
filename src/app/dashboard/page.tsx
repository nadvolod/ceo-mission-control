'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { TaskDashboard } from '@/components/TaskDashboard';
import { FocusOptimization } from '@/components/FocusOptimization';
import { MissionTracker } from '@/components/MissionTracker';
import { WeeklyPerformanceTracker } from '@/components/WeeklyPerformanceTracker';
import { ThreeToThrive } from '@/components/ThreeToThrive';
import { MonthlyReviewTracker } from '@/components/MonthlyReviewTracker';
import { HealthIntelligenceDashboard } from '@/components/HealthIntelligenceDashboard';
import { DashboardTabs } from '@/components/DashboardTabs';
import type { TabId } from '@/components/DashboardTabs';
import { enrichScorecard } from '@/lib/derive-focus';
import { useDashboardData } from '@/hooks/useDashboardData';
import { AdminHandoffButtons } from '@/components/AdminHandoffButtons';
import { KeyMetricsStrip } from '@/components/KeyMetricsStrip';

export default function HomePage() {
  const {
    aiTasks, taskStats, initiatives, scorecard, financialData, focusData,
    monarchData, weeklyTrackerData, isLoading,
    loadAllData, handleCreateTask, handleUpdateTask, handleDeleteTask,
    handleAddFinancialEntry, handleAddFocusSession, handleLogDay, handleSubmitWeeklyReview,
    monthlyReviewData, handleSubmitMonthlyReview, handleDeleteMonthlyReview,
    handleDeleteDay, handleDeleteWeeklyReview,
    threeToThriveData, handleSaveThreeToThriveAnswer,
  } = useDashboardData();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Mission Control...</p>
        </div>
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Cannot Load Workspace Data</h2>
            <p className="text-red-700">
              Unable to read DAILY_SCORECARD.md from workspace.
              Make sure the file exists and the app has access to your OpenClaw workspace.
            </p>
            <div className="mt-4 text-sm text-red-600">
              <p>Check that workspace data files are available.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // scorecard is guaranteed non-null after the early return above
  const enrichedScorecard = enrichScorecard(scorecard, aiTasks, initiatives);

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Compact header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              Mission Control
            </h1>
            <span className="text-[11px] sm:text-xs text-gray-500 truncate hidden sm:inline">
              {scorecard.date}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <AdminHandoffButtons />
            <button
              onClick={loadAllData}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Refresh all data"
              aria-label="Refresh all data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Key Metrics Strip */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
        <KeyMetricsStrip
          monarchData={monarchData}
          temporalHoursThisWeek={focusData?.weeklyTotals?.Temporal ?? 0}
          moneyMovedThisWeek={financialData?.weeklyTotals?.moved ?? 0}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Dashboard Tab - Daily items */}
        {activeTab === 'dashboard' && (
          <>
            {/* Three to Thrive - Daily Focus Questions */}
            {threeToThriveData && (
              <div className="mb-8">
                <ThreeToThrive
                  todaysEntry={threeToThriveData.todaysEntry}
                  history={threeToThriveData.history}
                  onSaveAnswer={handleSaveThreeToThriveAnswer}
                />
              </div>
            )}

            {/* Weekly Performance Tracker */}
            {weeklyTrackerData && (
              <div className="mb-8">
                <WeeklyPerformanceTracker
                  todaysEntry={weeklyTrackerData.todaysEntry}
                  currentWeekSummary={weeklyTrackerData.currentWeekSummary}
                  previousWeekSummary={weeklyTrackerData.previousWeekSummary}
                  dailyTrend={weeklyTrackerData.dailyTrend}
                  recentReviews={weeklyTrackerData.recentReviews}
                  onLogDay={handleLogDay}
                  onSubmitReview={(review) =>
                    handleSubmitWeeklyReview({
                      slipAnalysis: review.slipAnalysis,
                      systemAdjustment: review.systemAdjustment,
                      nextWeekTargets: review.nextWeekTargets,
                      bottleneck: review.bottleneck,
                      temporalTarget: review.temporalTarget,
                    })
                  }
                  onAddFocusSession={handleAddFocusSession}
                  temporalActual={focusData?.weeklyTotals?.Temporal ?? scorecard.temporalActual ?? 0}
                  todaysFocusSessions={focusData?.recentSessions?.filter((s: { date: string }) => s.date === scorecard.date)}
                  todaysFocusTotal={focusData?.todaysMetrics?.totalHours ?? 0}
                  todaysFinancial={
                    financialData?.todaysMetrics ?? {
                      date: '',
                      entries: [],
                      totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
                    }
                  }
                  weekFinancialByDay={
                    financialData?.weekFinancialByDay ??
                    Array.from({ length: 7 }, () => ({
                      date: '',
                      entries: [],
                      totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
                    }))
                  }
                  weekFinancialTotals={
                    financialData?.weeklyTotals ?? { moved: 0, generated: 0, cut: 0, netImpact: 0 }
                  }
                  previousWeekFinancialTotals={
                    financialData?.previousWeekTotals ?? { moved: 0, generated: 0, cut: 0, netImpact: 0 }
                  }
                  dailyFinancialTrend={financialData?.dailyFinancialTrend ?? []}
                  onAddFinancialEntry={handleAddFinancialEntry}
                  onDeleteDay={handleDeleteDay}
                  onDeleteReview={handleDeleteWeeklyReview}
                />
              </div>
            )}

            {/* Health Intelligence */}
            <div className="mb-8">
              <HealthIntelligenceDashboard />
            </div>

            {/* Today's Plan - Priorities, Critical Moves, Focus Blocks */}
            <div className="mb-8">
              <FocusOptimization scorecard={enrichedScorecard} />
            </div>
          </>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="mb-8">
            <TaskDashboard
              tasks={aiTasks.filter(t => t.status !== 'done')}
              stats={taskStats}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onRefresh={loadAllData}
              taskListUrl={process.env.NEXT_PUBLIC_AI_TASK_LIST_URL || 'https://tasklistai.vercel.app'}
            />
          </div>
        )}

        {/* Monthly Review Tab */}
        {activeTab === 'monthly-review' && (
          <>
            {/* Mission Tracker - Connected to real MRR from Monarch */}
            <div className="mb-8">
              <MissionTracker currentMRR={monarchData?.monthlyIncome} />
            </div>

            {/* Monthly Review */}
            {monthlyReviewData && (
              <div className="mb-8">
                <MonthlyReviewTracker
                  currentMonthReview={monthlyReviewData.currentMonthReview}
                  recentReviews={monthlyReviewData.recentReviews}
                  ratingsTrend={monthlyReviewData.ratingsTrend}
                  onSubmitReview={handleSubmitMonthlyReview}
                  onDeleteReview={handleDeleteMonthlyReview}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
