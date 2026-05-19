'use client';

import { useState } from 'react';
import { TaskDashboard } from '@/components/TaskDashboard';
import { FocusOptimization } from '@/components/FocusOptimization';
import { MissionTracker } from '@/components/MissionTracker';
import { FinancialCommandCenter } from '@/components/FinancialCommandCenter';
import { WeeklyPerformanceTracker } from '@/components/WeeklyPerformanceTracker';
import { ThreeToThrive } from '@/components/ThreeToThrive';
import { MonthlyReviewTracker } from '@/components/MonthlyReviewTracker';
import { HealthIntelligenceDashboard } from '@/components/HealthIntelligenceDashboard';
import { DashboardTabs } from '@/components/DashboardTabs';
import type { TabId } from '@/components/DashboardTabs';
import { enrichScorecard } from '@/lib/derive-focus';
import { useDashboardData } from '@/hooks/useDashboardData';
import { AdminHandoffButtons } from '@/components/AdminHandoffButtons';
import { formatCurrency, computeCashGrowthMoM } from '@/lib/dashboard-metrics';

export default function HomePage() {
  const {
    aiTasks, taskStats, initiatives, scorecard, financialData, focusData,
    monarchData, monarchError, monarchLoading, weeklyTrackerData, isLoading,
    loadAllData, handleCreateTask, handleUpdateTask, handleDeleteTask,
    handleMonarchRefresh,
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
  const cashGrowthMoM = monarchData
    ? computeCashGrowthMoM(
        monarchData.monthlyIncome ?? 0,
        monarchData.monthlyExpenses ?? 0,
        monarchData.previousMonthIncome ?? 0,
        monarchData.previousMonthExpenses ?? 0,
      )
    : null;

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">CEO Mission Control</h1>
              <p className="text-gray-600 mt-1">
                Conversational task command center for {scorecard.date}
              </p>
            </div>
              <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {monarchData ? formatCurrency(monarchData.cashPosition ?? 0) : '—'}
                    </div>
                    <div className="text-xs text-gray-500">Current Cash Position</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${(cashGrowthMoM ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {cashGrowthMoM === null ? '—' : `${cashGrowthMoM >= 0 ? '+' : ''}${cashGrowthMoM.toFixed(1)}%`}
                    </div>
                    <div className="text-xs text-gray-500">Cash Growth MoM</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {(focusData?.weeklyTotals?.Temporal ?? 0).toFixed(1).replace(/\.0$/, '')}h
                    </div>
                    <div className="text-xs text-gray-500">Temporal Focus (This Week)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(financialData?.weeklyTotals?.moved ?? 0)}
                    </div>
                    <div className="text-xs text-gray-500">Money Moved (This Week)</div>
                  </div>
                </div>
              <AdminHandoffButtons />
              <button
                onClick={loadAllData}
                className="flex-shrink-0 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title="Refresh all data"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

            {/* Financial Command Center - Real Monarch data */}
            <div className="mb-8">
              <FinancialCommandCenter
                snapshot={monarchData}
                isLoading={monarchLoading}
                onRefresh={handleMonarchRefresh}
                error={monarchError}
              />
            </div>

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
