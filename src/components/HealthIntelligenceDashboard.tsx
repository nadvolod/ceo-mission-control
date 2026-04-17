'use client';

import { useState, useMemo } from 'react';
import { Heart, BarChart3, Edit3, Settings, RefreshCw } from 'lucide-react';
import { useHealthData } from '@/hooks/useHealthData';
import { TodaySummaryCard } from './health/TodaySummaryCard';
import { DailyHealthChart } from './health/DailyHealthChart';
import { MorningLogForm } from './health/MorningLogForm';
import { HealthSettingsPanel } from './health/HealthSettingsPanel';
import type { GarminDayMetrics } from '@/lib/types';

type TabId = 'charts' | 'log' | 'settings';

const TIME_RANGES = [7, 14, 30, 60, 90] as const;

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'charts', label: 'Charts', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'log', label: 'Morning Log', icon: <Edit3 className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export function HealthIntelligenceDashboard() {
  const { metrics, notes, latest, averages, syncStatus, templates, garminConfigured, garminConnected, isLoading, syncFromGarmin, logNote, updateTemplate } =
    useHealthData();

  const isSyncing = syncStatus.syncStatus === 'syncing';

  const [activeTab, setActiveTab] = useState<TabId>('charts');
  const [timeRange, setTimeRange] = useState<number>(30);

  const filteredMetrics = useMemo<GarminDayMetrics[]>(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (timeRange - 1));
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    return Object.values(metrics)
      .filter((m) => m.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics, timeRange]);

  const lastSyncDisplay = syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900">Health Intelligence</h2>
          {lastSyncDisplay && (
            <span className="text-xs text-gray-400 ml-2">Last sync: {lastSyncDisplay}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            {TIME_RANGES.map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Sync button */}
          <button
            onClick={() => syncFromGarmin(7)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            title="Sync health data from Garmin Connect"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Sync error banner */}
      {syncStatus.syncError && (
        <div className="mb-4 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          Sync error: {syncStatus.syncError}
        </div>
      )}

      {/* Today Summary — always visible */}
      <TodaySummaryCard latest={latest} averages={averages} />

      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
          <span className="text-sm text-gray-500">Loading health data...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Tab navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'charts' && (
            <DailyHealthChart metrics={filteredMetrics} notes={notes} days={timeRange} />
          )}

          {activeTab === 'log' && (
            <MorningLogForm
              templates={templates}
              notes={notes}
              onSave={logNote}
              onUpdateTemplate={updateTemplate}
            />
          )}

          {activeTab === 'settings' && (
            <HealthSettingsPanel
              templates={templates}
              syncStatus={syncStatus}
              garminConfigured={garminConfigured}
              garminConnected={garminConnected}
              onUpdateTemplate={updateTemplate}
              onSync={() => syncFromGarmin(7)}
            />
          )}
        </>
      )}
    </div>
  );
}
