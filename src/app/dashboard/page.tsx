'use client';

import { TaskDashboard } from '@/components/TaskDashboard';
import { FocusOptimization } from '@/components/FocusOptimization';
import { MissionTracker } from '@/components/MissionTracker';
import { FinancialMetricsDashboard } from '@/components/FinancialMetricsDashboard';
import { FinancialCommandCenter } from '@/components/FinancialCommandCenter';
import { FocusHoursTracker } from '@/components/FocusHoursTracker';
import { RevenueProjectionWidget } from '@/components/RevenueProjectionWidget';
import { AiTask, TaskStats, FocusCategory, MonarchFinancialSnapshot, AdjustmentType, RevenueProjectionData, MonthProjection } from '@/lib/types';

interface RevenueProjectionApiResponse {
  data: RevenueProjectionData;
  projections: MonthProjection[];
  monarchBase: { income: number; expenses: number; cashPosition: number };
  timestamp: string;
}
import { enrichScorecard } from '@/lib/derive-focus';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const [aiTasks, setAiTasks] = useState<AiTask[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({ total: 0, todo: 0, doing: 0, doneToday: 0, overdue: 0 });
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [scorecard, setScorecard] = useState<any>(null);
  const [financialData, setFinancialData] = useState<any>(null);
  const [focusData, setFocusData] = useState<any>(null);
  const [monarchData, setMonarchData] = useState<MonarchFinancialSnapshot | null>(null);
  const [monarchError, setMonarchError] = useState<string | null>(null);
  const [monarchLoading, setMonarchLoading] = useState(false);
  const [projectionData, setProjectionData] = useState<RevenueProjectionApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    // Fetch each data source independently so one failure doesn't block others
    const fetchers = [
      async () => {
        try {
          const res = await fetch('/api/tasks');
          if (res.ok) {
            const data = await res.json();
            setAiTasks(data.tasks || []);
            setTaskStats(data.stats || { total: 0, todo: 0, doing: 0, doneToday: 0, overdue: 0 });
          }
        } catch (e) { console.error('Error loading tasks:', e); }
      },
      async () => {
        try {
          const res = await fetch('/api/workspace');
          if (res.ok) {
            const data = await res.json();
            setInitiatives(data.initiatives || []);
            setScorecard(data.scorecard);
          }
        } catch (e) { console.error('Error loading workspace:', e); }
      },
      async () => {
        try {
          const res = await fetch('/api/financial');
          if (res.ok) {
            const data = await res.json();
            setFinancialData(data);
          }
        } catch (e) { console.error('Error loading financial:', e); }
      },
      async () => {
        try {
          const res = await fetch('/api/focus-hours');
          if (res.ok) {
            const data = await res.json();
            setFocusData(data);
          }
        } catch (e) { console.error('Error loading focus hours:', e); }
      },
      async () => {
        try {
          const res = await fetch('/api/monarch');
          const data = await res.json().catch(() => null);
          if (data?.error) {
            setMonarchError(data.error);
          } else if (data) {
            setMonarchData(data);
            setMonarchError(null);
          }
        } catch (e) { console.error('Error loading Monarch:', e); }
      },
      async () => {
        try {
          const res = await fetch('/api/revenue-projection');
          if (res.ok) {
            const data = await res.json();
            setProjectionData(data);
          }
        } catch (e) { console.error('Error loading projections:', e); }
      },
    ];

    await Promise.allSettled(fetchers.map(f => f()));
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  const handleCreateTask = async (data: { title: string; category?: string }) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) await loadAllData();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleUpdateTask = async (id: number, data: { status?: string; title?: string }) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) await loadAllData();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (id: number) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (response.ok) await loadAllData();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleMonarchRefresh = async () => {
    setMonarchLoading(true);
    try {
      const response = await fetch('/api/monarch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
      const result = await response.json().catch(() => null);
      if (result?.error) {
        setMonarchError(result.error);
      } else if (result) {
        setMonarchData(result);
        setMonarchError(null);
      }
    } catch (error) {
      console.error('Error refreshing Monarch data:', error);
    } finally {
      setMonarchLoading(false);
    }
  };

  const handleAddProjectionAdjustment = async (adj: {
    effectiveMonth: string; amount: number; description: string; type: AdjustmentType; recurring: boolean;
  }) => {
    try {
      const response = await fetch('/api/revenue-projection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addAdjustment', ...adj })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to add projection adjustment:', err.error || response.statusText);
        return;
      }
      await loadAllData();
    } catch (error) {
      console.error('Error adding projection adjustment:', error);
    }
  };

  const handleRemoveProjectionAdjustment = async (id: string) => {
    try {
      const response = await fetch('/api/revenue-projection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeAdjustment', id })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to remove projection adjustment:', err.error || response.statusText);
        return;
      }
      await loadAllData();
    } catch (error) {
      console.error('Error removing projection adjustment:', error);
    }
  };

  const handleAddFinancialEntry = async (category: 'moved' | 'generated' | 'cut', amount: number, description: string) => {
    try {
      const response = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addEntry', category, amount, description })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to add financial entry:', err.error || response.statusText);
        return;
      }
      await loadAllData();
    } catch (error) {
      console.error('Error adding financial entry:', error);
    }
  };

  const handleAddFocusSession = async (category: FocusCategory, hours: number, description: string) => {
    try {
      const response = await fetch('/api/focus-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          category,
          hours,
          description: description || `${hours}h ${category} focus block`
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to add focus session');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error adding focus session:', error);
    }
  };

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

  const enrichedScorecard = scorecard
    ? enrichScorecard(scorecard, aiTasks, initiatives)
    : scorecard;

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
              baseIncome={projectionData.data?.baseMonthlyIncome ?? monarchData?.monthlyIncome ?? 0}
              baseExpenses={projectionData.data?.baseMonthlyExpenses ?? monarchData?.monthlyExpenses ?? 0}
              isUsingMonarchBase={{
                income: projectionData.data?.baseMonthlyIncome == null,
                expenses: projectionData.data?.baseMonthlyExpenses == null,
              }}
              onAddAdjustment={handleAddProjectionAdjustment}
              onRemoveAdjustment={handleRemoveProjectionAdjustment}
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
