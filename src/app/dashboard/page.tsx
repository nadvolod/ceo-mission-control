'use client';

import { TaskDashboard } from '@/components/TaskDashboard';
import { FocusOptimization } from '@/components/FocusOptimization';
import { MissionTracker } from '@/components/MissionTracker';
import { FinancialMetricsDashboard } from '@/components/FinancialMetricsDashboard';
import { FinancialCommandCenter } from '@/components/FinancialCommandCenter';
import { FocusHoursTracker } from '@/components/FocusHoursTracker';
import { RevenueProjectionWidget } from '@/components/RevenueProjectionWidget';
import { WeeklyPerformanceTracker } from '@/components/WeeklyPerformanceTracker';
import { enrichScorecard } from '@/lib/derive-focus';
import { useDashboardData } from '@/hooks/useDashboardData';

export default function HomePage() {
  const {
    aiTasks, taskStats, initiatives, scorecard, financialData, focusData,
    monarchData, monarchError, monarchLoading, projectionData, weeklyTrackerData, isLoading,
    loadAllData, handleCreateTask, handleUpdateTask, handleDeleteTask,
    handleMonarchRefresh, handleAddProjectionAdjustment, handleRemoveProjectionAdjustment,
    handleAddFinancialEntry, handleAddFocusSession, handleLogDay, handleSubmitWeeklyReview,
  } = useDashboardData();

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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">CEO Mission Control</h1>
              <p className="text-gray-600 mt-1">
                Conversational task command center for {scorecard.date}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{taskStats.total}</div>
                  <div className="text-xs text-gray-500">Total Tasks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{taskStats.doneToday}</div>
                  <div className="text-xs text-gray-500">Done Today</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{taskStats.overdue}</div>
                  <div className="text-xs text-gray-500">Overdue</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {focusData?.todaysMetrics?.totalHours || 0}h
                  </div>
                  <div className="text-xs text-gray-500">Focus Hours</div>
                </div>
              </div>
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
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Financial Command Center - Real Monarch data */}
        <div className="mb-8">
          <FinancialCommandCenter
            snapshot={monarchData}
            isLoading={monarchLoading}
            onRefresh={handleMonarchRefresh}
            error={monarchError}
          />
        </div>

        {/* Revenue Projections */}
        {projectionData && (
          <div className="mb-8">
            <RevenueProjectionWidget
              projections={projectionData.projections ?? []}
              adjustments={projectionData.data?.adjustments ?? []}
              baseIncome={projectionData.data?.baseMonthlyIncome ?? projectionData.monarchBase?.income ?? 0}
              baseExpenses={projectionData.data?.baseMonthlyExpenses ?? projectionData.monarchBase?.expenses ?? 0}
              isUsingMonarchBase={{
                income: projectionData.data?.baseMonthlyIncome == null,
                expenses: projectionData.data?.baseMonthlyExpenses == null,
              }}
              monarchBaseLabel={projectionData.monarchBase?.label}
              onAddAdjustment={handleAddProjectionAdjustment}
              onRemoveAdjustment={handleRemoveProjectionAdjustment}
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
              onSubmitReview={handleSubmitWeeklyReview}
            />
          </div>
        )}

        {/* Mission Tracker - Connected to real MRR from Monarch */}
        <div className="mb-8">
          <MissionTracker currentMRR={monarchData?.monthlyIncome} />
        </div>

        {/* Today's Plan - Priorities, Critical Moves, Focus Blocks */}
        <div className="mb-8">
          <FocusOptimization scorecard={enrichedScorecard} />
        </div>

        {/* Focus Hours Dashboard - Full Width */}
        {focusData && (
          <div className="mb-8">
            <FocusHoursTracker
              todaysMetrics={focusData.todaysMetrics}
              weeklyTotals={focusData.weeklyTotals}
              weekOverWeek={focusData.weekOverWeek}
              dailyTrend={focusData.dailyTrend}
              rollingAverage={focusData.rollingAverage}
              categoryDistribution={focusData.categoryDistribution}
              recentSessions={focusData.recentSessions}
              temporalTarget={scorecard.temporalTarget || 0}
              temporalActual={scorecard.temporalActual || 0}
              onAddSession={handleAddFocusSession}
            />
          </div>
        )}

        {/* Financial Impact Tracking - Full Width */}
        {financialData && (
          <div className="mb-8">
            <FinancialMetricsDashboard
              todaysMetrics={financialData.todaysMetrics}
              weeklyTotals={financialData.weeklyTotals}
              monthlyTotals={financialData.monthlyTotals}
              recentEntries={financialData.recentEntries}
              onAddEntry={handleAddFinancialEntry}
            />
          </div>
        )}

        {/* Task Dashboard - Always Last */}
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
      </main>
    </div>
  );
}
