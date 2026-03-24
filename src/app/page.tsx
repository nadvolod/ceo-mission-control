'use client';

import { TaskCommandCenter } from '@/components/TaskCommandCenter';
import { ConversationTaskInput } from '@/components/ConversationTaskInput';
import { FocusOptimization } from '@/components/FocusOptimization';
import { MissionTracker } from '@/components/MissionTracker';
import { FinancialMetricsDashboard } from '@/components/FinancialMetricsDashboard';
import { FocusHoursTracker } from '@/components/FocusHoursTracker';
import { Task, ConversationExtraction, FocusCategory } from '@/lib/types';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [scorecard, setScorecard] = useState<any>(null);
  const [financialData, setFinancialData] = useState<any>(null);
  const [focusData, setFocusData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      // Load tasks
      const tasksResponse = await fetch('/api/tasks');
      const tasksData = await tasksResponse.json();
      setTasks(tasksData.tasks || []);

      // Load workspace data
      const workspaceResponse = await fetch('/api/workspace');
      const workspaceData = await workspaceResponse.json();
      setInitiatives(workspaceData.initiatives || []);
      setScorecard(workspaceData.scorecard);

      // Load financial data
      const financialResponse = await fetch('/api/financial');
      const financialData = await financialResponse.json();
      setFinancialData(financialData);

      // Load focus hours data
      const focusResponse = await fetch('/api/focus-hours');
      if (focusResponse.ok) {
        const focusDataResult = await focusResponse.json();
        setFocusData(focusDataResult);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          taskId,
          updates
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleConversationMessage = async (message: string): Promise<{ tasks: Task[]; extraction: ConversationExtraction; }> => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'processConversation',
          message
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Process focus hours from the same message
        const focusResponse = await fetch('/api/focus-hours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'processMessage',
            message
          })
        });
        const focusResult = focusResponse.ok ? await focusResponse.json() : null;

        // Refresh all data to include new tasks and financial updates
        await loadAllData();

        return {
          tasks: data.created || [],
          extraction: {
            ...data.extraction || { tasks: [], deadlines: [], statusUpdates: [], blockers: [] },
            financial: data.financial || null,
            focusHours: focusResult || null
          }
        };
      }

      throw new Error('Failed to process message');
    } catch (error) {
      console.error('Error processing conversation:', error);
      throw error;
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

  const seedTasksFromInitiatives = async () => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seedFromInitiatives' })
      });
      loadAllData();
    } catch (error) {
      console.error('Error seeding tasks:', error);
    }
  };

  // Data is loaded via useEffect and stored in state

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

  const completedToday = tasks.filter(t => 
    t.status === 'Done' && 
    new Date(t.updatedAt).toDateString() === new Date().toDateString()
  ).length;

  const urgentTasks = tasks.filter(t => {
    if (!t.deadline) return false;
    const daysUntil = Math.ceil((new Date(t.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 3 && t.status !== 'Done';
  }).length;

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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{tasks.length}</div>
                <div className="text-xs text-gray-500">Total Tasks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{completedToday}</div>
                <div className="text-xs text-gray-500">Done Today</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{urgentTasks}</div>
                <div className="text-xs text-gray-500">Urgent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {focusData?.todaysMetrics?.totalHours || 0}h
                </div>
                <div className="text-xs text-gray-500">Focus Hours</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Mission Tracker - Top Priority */}
        <div className="mb-8">
          <MissionTracker />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Task Management */}
          <div className="lg:col-span-2 space-y-8">
            {/* Conversational Input */}
            <ConversationTaskInput 
              onProcessMessage={handleConversationMessage}
            />

            {/* Task Command Center */}
            <TaskCommandCenter
              initiatives={initiatives}
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
            />

            {/* Seed Tasks Button */}
            {tasks.length === 0 && (
              <div className="text-center py-8">
                <button
                  onClick={seedTasksFromInitiatives}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Import Tasks from Current Initiatives
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  This will create initial tasks based on your INITIATIVES.md file
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Context & Financial */}
          <div className="space-y-8">
            {/* Focus Hours Dashboard */}
            {focusData && (
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
            )}

            {/* Financial Metrics Dashboard */}
            {financialData && (
              <FinancialMetricsDashboard
                todaysMetrics={financialData.todaysMetrics}
                weeklyTotals={financialData.weeklyTotals}
                monthlyTotals={financialData.monthlyTotals}
                recentEntries={financialData.recentEntries}
              />
            )}

            {/* Focus Optimization */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Focus</h2>
              <FocusOptimization scorecard={scorecard} />
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">System Status</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Refresh</span>
                  <span className="text-gray-900">{lastRefresh.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Projects</span>
                  <span className="text-gray-900">{initiatives.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tasks Created Today</span>
                  <span className="text-gray-900">
                    {tasks.filter(t => 
                      new Date(t.createdAt).toDateString() === new Date().toDateString()
                    ).length}
                  </span>
                </div>
                <button
                  onClick={loadAllData}
                  className="w-full mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}