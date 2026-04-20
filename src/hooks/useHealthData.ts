'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GarminDayMetrics, DailyHealthNote } from '@/lib/types';

interface HealthTemplates {
  supplementTemplate: Array<{ name: string; defaultDosageMg: number }>;
  habitTemplate: Array<{ name: string }>;
  environmentTemplate: { customFieldNames: string[] };
}

interface HealthData {
  metrics: Record<string, GarminDayMetrics>;
  notes: Record<string, DailyHealthNote>;
  latest: GarminDayMetrics | null;
  averages: Record<string, number | null>;
  syncStatus: { lastSyncedAt: string; syncStatus: string; syncError: string | null };
  templates: HealthTemplates;
  garminConfigured: boolean;
  garminConnected: boolean;
  isLoading: boolean;
}

export function useHealthData() {
  const [data, setData] = useState<HealthData>({
    metrics: {},
    notes: {},
    latest: null,
    averages: {},
    syncStatus: { lastSyncedAt: '', syncStatus: 'idle', syncError: null },
    templates: { supplementTemplate: [], habitTemplate: [], environmentTemplate: { customFieldNames: [] } },
    garminConfigured: false,
    garminConnected: false,
    isLoading: true,
  });

  const loadData = useCallback(async () => {
    try {
      const [garminRes, notesRes] = await Promise.allSettled([
        fetch('/api/garmin'),
        fetch('/api/health-notes'),
      ]);

      const garmin = garminRes.status === 'fulfilled' ? await garminRes.value.json() : null;
      const notes = notesRes.status === 'fulfilled' ? await notesRes.value.json() : null;

      setData((prev) => ({
        metrics: garmin?.metrics || {},
        notes: notes?.notes || prev.notes,
        latest: garmin?.latest || null,
        averages: garmin?.averages || {},
        syncStatus: garmin?.syncStatus || { lastSyncedAt: '', syncStatus: 'idle', syncError: null },
        templates: notes?.templates || prev.templates,
        garminConfigured: garmin?.garminConfigured ?? false,
        garminConnected: garmin?.garminConnected ?? false,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load health data:', error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void loadData();
  }, [loadData]);

  const logNote = useCallback(async (note: {
    date: string;
    sleepEnvironment: { temperatureF: number | null; fanRunning: boolean; dogInRoom: boolean; customFields: Record<string, boolean> };
    supplements: Array<{ name: string; dosageMg: number; taken: boolean }>;
    habits: Array<{ name: string; done: boolean }>;
    freeformNote: string;
  }) => {
    const response = await fetch('/api/health-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log', ...note }),
    });
    const result = await response.json();
    if (result.success) await loadData();
    return result;
  }, [loadData]);

  const updateTemplate = useCallback(async (operation: string, name: string, defaultDosageMg?: number, extra?: Record<string, unknown>) => {
    const response = await fetch('/api/health-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...extra, action: 'update-templates', operation, name, defaultDosageMg }),
    });
    const result = await response.json();
    if (result.success) await loadData();
    return result;
  }, [loadData]);

  const syncFromGarmin = useCallback(async (days: number = 7) => {
    setData(prev => ({
      ...prev,
      syncStatus: { ...prev.syncStatus, syncStatus: 'syncing', syncError: null },
    }));

    try {
      // Read training threshold from localStorage (set in Settings panel)
      const storedThreshold = typeof window !== 'undefined'
        ? localStorage.getItem('garmin-training-threshold')
        : null;
      const trainingThreshold = storedThreshold ? parseInt(storedThreshold, 10) : undefined;

      const response = await fetch('/api/garmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch-garmin',
          days,
          ...(trainingThreshold && trainingThreshold > 0 ? { trainingThreshold } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setData(prev => ({
          ...prev,
          syncStatus: {
            lastSyncedAt: prev.syncStatus.lastSyncedAt,
            syncStatus: 'error',
            syncError: result.error || 'Sync failed',
          },
        }));
        return result;
      }

      await loadData();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      setData(prev => ({
        ...prev,
        syncStatus: {
          lastSyncedAt: prev.syncStatus.lastSyncedAt,
          syncStatus: 'error',
          syncError: message,
        },
      }));
      return { success: false, error: message };
    }
  }, [loadData]);

  return { ...data, loadData, syncFromGarmin, logNote, updateTemplate };
}
