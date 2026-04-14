import { format, subDays } from 'date-fns';
import type { GarminDayMetrics, GarminHealthData } from './types';
import { loadJSON, saveJSON, appendAuditLog } from './storage';

const STORAGE_KEY = 'garmin-health.json';

function defaultData(): GarminHealthData {
  return {
    metrics: {},
    lastSyncedAt: '',
    syncStatus: 'idle',
    syncError: null,
  };
}

export class GarminTracker {
  private data: GarminHealthData = defaultData();

  private constructor() {}

  static async create(): Promise<GarminTracker> {
    const tracker = new GarminTracker();
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    const stored = await loadJSON(STORAGE_KEY, defaultData());
    this.data = { ...defaultData(), ...stored };
  }

  private async saveData(): Promise<void> {
    await saveJSON(STORAGE_KEY, this.data);
  }

  async syncMetrics(metrics: GarminDayMetrics[]): Promise<{ synced: number }> {
    let synced = 0;
    for (const m of metrics) {
      if (!m.date || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) {
        console.warn('Skipping metric with invalid date:', m.date);
        continue;
      }
      this.data.metrics[m.date] = { ...this.data.metrics[m.date], ...m };
      synced++;
    }

    this.data.lastSyncedAt = new Date().toISOString();
    this.data.syncStatus = 'idle';
    this.data.syncError = null;
    await this.saveData();

    await appendAuditLog(
      format(new Date(), 'yyyy-MM-dd'),
      'garmin-sync',
      `Synced ${synced} day(s) of Garmin data`
    );

    console.log('Garmin sync complete:', { synced });
    return { synced };
  }

  getMetricsForRange(startDate: string, endDate: string): GarminDayMetrics[] {
    return Object.values(this.data.metrics)
      .filter(m => m.date >= startDate && m.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getLatestMetrics(): GarminDayMetrics | null {
    const dates = Object.keys(this.data.metrics).sort();
    if (dates.length === 0) return null;
    return this.data.metrics[dates[dates.length - 1]];
  }

  getAverages(days: number): Record<string, number | null> {
    const now = new Date();
    const start = format(subDays(now, days - 1), 'yyyy-MM-dd');
    const end = format(now, 'yyyy-MM-dd');
    const range = this.getMetricsForRange(start, end);

    if (range.length === 0) {
      return {
        sleepScore: null,
        hrvStatus: null,
        bodyBatteryHigh: null,
        averageStressLevel: null,
        restingHeartRate: null,
        weight: null,
      };
    }

    const avg = (key: keyof GarminDayMetrics) => {
      const vals = range.map(m => m[key]).filter((v): v is number => typeof v === 'number');
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    return {
      sleepScore: avg('sleepScore'),
      hrvStatus: avg('hrvStatus'),
      bodyBatteryHigh: avg('bodyBatteryHigh'),
      averageStressLevel: avg('averageStressLevel'),
      restingHeartRate: avg('restingHeartRate'),
      weight: avg('weight'),
    };
  }

  getMetricsForDate(date: string): GarminDayMetrics | null {
    return this.data.metrics[date] || null;
  }

  getSyncStatus(): { lastSyncedAt: string; syncStatus: string; syncError: string | null } {
    return {
      lastSyncedAt: this.data.lastSyncedAt,
      syncStatus: this.data.syncStatus,
      syncError: this.data.syncError,
    };
  }

  getAllData(): GarminHealthData {
    return structuredClone(this.data);
  }
}
