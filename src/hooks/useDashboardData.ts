'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AiTask, TaskStats, FocusCategory, MonarchFinancialSnapshot, AdjustmentType, RevenueProjectionData, MonthProjection, Initiative, DailyScorecard, PerformanceDayEntry, WeeklySummary, WeeklyReview } from '@/lib/types';

export interface RevenueProjectionApiResponse {
  data: RevenueProjectionData;
  projections: MonthProjection[];
  monarchBase: { income: number; expenses: number; cashPosition: number; label?: string };
  timestamp: string;
}

export interface WeeklyTrackerApiResponse {
  success: boolean;
  todaysEntry: PerformanceDayEntry | null;
  currentWeekSummary: WeeklySummary;
  previousWeekSummary: WeeklySummary;
  dailyTrend: Array<PerformanceDayEntry & { isEmpty: boolean }>;
  recentReviews: WeeklyReview[];
  timestamp: string;
}

export interface DashboardData {
  aiTasks: AiTask[];
  taskStats: TaskStats;
  initiatives: Initiative[];
  scorecard: DailyScorecard | null;
  financialData: any;
  focusData: any;
  monarchData: MonarchFinancialSnapshot | null;
  monarchError: string | null;
  monarchLoading: boolean;
  projectionData: RevenueProjectionApiResponse | null;
  weeklyTrackerData: WeeklyTrackerApiResponse | null;
  isLoading: boolean;
}

export interface DashboardHandlers {
  loadAllData: () => Promise<void>;
  handleCreateTask: (data: { title: string; category?: string }) => Promise<void>;
  handleUpdateTask: (id: number, data: { status?: string; title?: string }) => Promise<void>;
  handleDeleteTask: (id: number) => Promise<void>;
  handleMonarchRefresh: () => Promise<void>;
  handleAddProjectionAdjustment: (adj: {
    effectiveMonth: string; amount: number; description: string; type: AdjustmentType; recurring: boolean;
  }) => Promise<void>;
  handleRemoveProjectionAdjustment: (id: string) => Promise<void>;
  handleAddFinancialEntry: (category: 'moved' | 'generated' | 'cut', amount: number, description: string) => Promise<void>;
  handleAddFocusSession: (category: FocusCategory, hours: number, description: string) => Promise<void>;
  handleLogDay: (deepWorkHours: number, pipelineActions: number, trained: boolean) => Promise<void>;
  handleSubmitWeeklyReview: (review: {
    revenue: number; slipAnalysis: string; systemAdjustment: string; nextWeekTargets: string; bottleneck: string;
  }) => Promise<void>;
}

export function useDashboardData(): DashboardData & DashboardHandlers {
  const [aiTasks, setAiTasks] = useState<AiTask[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({ total: 0, todo: 0, doing: 0, doneToday: 0, overdue: 0 });
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [scorecard, setScorecard] = useState<DailyScorecard | null>(null);
  const [financialData, setFinancialData] = useState<any>(null);
  const [focusData, setFocusData] = useState<any>(null);
  const [monarchData, setMonarchData] = useState<MonarchFinancialSnapshot | null>(null);
  const [monarchError, setMonarchError] = useState<string | null>(null);
  const [monarchLoading, setMonarchLoading] = useState(false);
  const [projectionData, setProjectionData] = useState<RevenueProjectionApiResponse | null>(null);
  const [weeklyTrackerData, setWeeklyTrackerData] = useState<WeeklyTrackerApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAllData = useCallback(async () => {
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
      async () => {
        try {
          const res = await fetch('/api/weekly-tracker');
          if (res.ok) {
            const data = await res.json();
            setWeeklyTrackerData(data);
          }
        } catch (e) { console.error('Error loading weekly tracker:', e); }
      },
    ];

    await Promise.allSettled(fetchers.map(f => f()));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleCreateTask = useCallback(async (data: { title: string; category?: string }) => {
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
  }, [loadAllData]);

  const handleUpdateTask = useCallback(async (id: number, data: { status?: string; title?: string }) => {
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
  }, [loadAllData]);

  const handleDeleteTask = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (response.ok) await loadAllData();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }, [loadAllData]);

  const handleMonarchRefresh = useCallback(async () => {
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
  }, []);

  const handleAddProjectionAdjustment = useCallback(async (adj: {
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
        throw new Error(err.error || response.statusText || 'Failed to add projection adjustment');
      }
      await loadAllData();
    } catch (error) {
      console.error('Error adding projection adjustment:', error);
      throw error;
    }
  }, [loadAllData]);

  const handleRemoveProjectionAdjustment = useCallback(async (id: string) => {
    try {
      const response = await fetch('/api/revenue-projection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeAdjustment', id })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || response.statusText || 'Failed to remove projection adjustment');
      }
      await loadAllData();
    } catch (error) {
      console.error('Error removing projection adjustment:', error);
      throw error;
    }
  }, [loadAllData]);

  const handleAddFinancialEntry = useCallback(async (category: 'moved' | 'generated' | 'cut', amount: number, description: string) => {
    try {
      const response = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addEntry', category, amount, description })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || response.statusText || 'Failed to add financial entry');
      }
      await loadAllData();
    } catch (error) {
      console.error('Error adding financial entry:', error);
      throw error;
    }
  }, [loadAllData]);

  const handleAddFocusSession = useCallback(async (category: FocusCategory, hours: number, description: string) => {
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
  }, [loadAllData]);

  const handleLogDay = useCallback(async (deepWorkHours: number, pipelineActions: number, trained: boolean) => {
    try {
      const response = await fetch('/api/weekly-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logDay', deepWorkHours, pipelineActions, trained })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to log day');
      }
      await loadAllData();
    } catch (error) {
      console.error('Error logging day:', error);
      throw error;
    }
  }, [loadAllData]);

  const handleSubmitWeeklyReview = useCallback(async (review: {
    revenue: number; slipAnalysis: string; systemAdjustment: string; nextWeekTargets: string; bottleneck: string;
  }) => {
    try {
      const response = await fetch('/api/weekly-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submitReview', ...review })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit review');
      }
      await loadAllData();
    } catch (error) {
      console.error('Error submitting weekly review:', error);
      throw error;
    }
  }, [loadAllData]);

  return {
    aiTasks, taskStats, initiatives, scorecard, financialData, focusData,
    monarchData, monarchError, monarchLoading, projectionData, weeklyTrackerData, isLoading,
    loadAllData, handleCreateTask, handleUpdateTask, handleDeleteTask,
    handleMonarchRefresh, handleAddProjectionAdjustment, handleRemoveProjectionAdjustment,
    handleAddFinancialEntry, handleAddFocusSession, handleLogDay, handleSubmitWeeklyReview,
  };
}
