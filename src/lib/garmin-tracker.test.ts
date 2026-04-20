/**
 * @jest-environment node
 */
import { GarminTracker } from './garmin-tracker';
import * as storage from './storage';
import type { GarminDayMetrics, GarminHealthData } from './types';

jest.mock('./storage', () => ({
  loadJSON: jest.fn(),
  saveJSON: jest.fn(),
  appendAuditLog: jest.fn(),
}));

const mockLoadJSON = storage.loadJSON as jest.MockedFunction<typeof storage.loadJSON>;
const mockSaveJSON = storage.saveJSON as jest.MockedFunction<typeof storage.saveJSON>;

function makeMetrics(overrides: Partial<GarminDayMetrics> = {}): GarminDayMetrics {
  return {
    date: '2026-04-13',
    sleepScore: 82,
    sleepDurationMinutes: 420,
    sleepStartTime: '22:30',
    sleepEndTime: '06:30',
    deepSleepMinutes: 90,
    lightSleepMinutes: 200,
    remSleepMinutes: 100,
    awakeDuringMinutes: 30,
    restingHeartRate: 58,
    hrvStatus: 48,
    averageStressLevel: 24,
    bodyBatteryHigh: 78,
    bodyBatteryLow: 22,
    steps: 8500,
    activeMinutes: 45,
    weight: 182,
    syncedAt: '2026-04-13T07:42:00Z',
    ...overrides,
  };
}

describe('GarminTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadJSON.mockResolvedValue({
      metrics: {},
      lastSyncedAt: '',
      syncStatus: 'idle' as const,
      syncError: null,
    });
    mockSaveJSON.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('loads data from storage on creation', async () => {
      await GarminTracker.create();
      expect(mockLoadJSON).toHaveBeenCalledWith('garmin-health.json', expect.any(Object));
    });
  });

  describe('syncMetrics', () => {
    it('merges new metrics into existing data', async () => {
      const existing = makeMetrics({ date: '2026-04-12', sleepScore: 70 });
      mockLoadJSON.mockResolvedValue({
        metrics: { '2026-04-12': existing },
        lastSyncedAt: '2026-04-12T08:00:00Z',
        syncStatus: 'idle' as const,
        syncError: null,
      });

      const tracker = await GarminTracker.create();
      const newMetrics = [makeMetrics({ date: '2026-04-13' })];
      await tracker.syncMetrics(newMetrics);

      expect(mockSaveJSON).toHaveBeenCalledWith(
        'garmin-health.json',
        expect.objectContaining({
          metrics: expect.objectContaining({
            '2026-04-12': existing,
            '2026-04-13': newMetrics[0],
          }),
        })
      );
    });

    it('overwrites existing day on re-sync', async () => {
      mockLoadJSON.mockResolvedValue({
        metrics: { '2026-04-13': makeMetrics({ sleepScore: 70 }) },
        lastSyncedAt: '',
        syncStatus: 'idle' as const,
        syncError: null,
      });

      const tracker = await GarminTracker.create();
      await tracker.syncMetrics([makeMetrics({ sleepScore: 85 })]);

      const savedData = (mockSaveJSON.mock.calls[0][1] as GarminHealthData);
      expect(savedData.metrics['2026-04-13'].sleepScore).toBe(85);
    });

    it('updates lastSyncedAt timestamp', async () => {
      const tracker = await GarminTracker.create();
      await tracker.syncMetrics([makeMetrics()]);

      const savedData = (mockSaveJSON.mock.calls[0][1] as GarminHealthData);
      expect(savedData.lastSyncedAt).toBeTruthy();
      expect(savedData.syncStatus).toBe('idle');
    });
  });

  describe('getMetricsForRange', () => {
    it('returns metrics within date range', async () => {
      const days: Record<string, GarminDayMetrics> = {
        '2026-04-10': makeMetrics({ date: '2026-04-10' }),
        '2026-04-11': makeMetrics({ date: '2026-04-11' }),
        '2026-04-12': makeMetrics({ date: '2026-04-12' }),
        '2026-04-13': makeMetrics({ date: '2026-04-13' }),
      };
      mockLoadJSON.mockResolvedValue({
        metrics: days,
        lastSyncedAt: '',
        syncStatus: 'idle' as const,
        syncError: null,
      });

      const tracker = await GarminTracker.create();
      const result = tracker.getMetricsForRange('2026-04-11', '2026-04-12');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-04-11');
      expect(result[1].date).toBe('2026-04-12');
    });

    it('returns empty array for range with no data', async () => {
      const tracker = await GarminTracker.create();
      const result = tracker.getMetricsForRange('2026-04-01', '2026-04-05');
      expect(result).toEqual([]);
    });
  });

  describe('getLatestMetrics', () => {
    it('returns the most recent day of data', async () => {
      mockLoadJSON.mockResolvedValue({
        metrics: {
          '2026-04-12': makeMetrics({ date: '2026-04-12', sleepScore: 70 }),
          '2026-04-13': makeMetrics({ date: '2026-04-13', sleepScore: 82 }),
        },
        lastSyncedAt: '',
        syncStatus: 'idle' as const,
        syncError: null,
      });

      const tracker = await GarminTracker.create();
      const latest = tracker.getLatestMetrics();

      expect(latest?.date).toBe('2026-04-13');
      expect(latest?.sleepScore).toBe(82);
    });

    it('returns null when no data', async () => {
      const tracker = await GarminTracker.create();
      expect(tracker.getLatestMetrics()).toBeNull();
    });
  });

  describe('getAverages', () => {
    it('computes 7-day rolling averages', async () => {
      const metrics: Record<string, GarminDayMetrics> = {};
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - (6 - i));
        const d = dt.toISOString().slice(0, 10);
        metrics[d] = makeMetrics({ date: d, sleepScore: 70 + i * 2 });
      }
      mockLoadJSON.mockResolvedValue({
        metrics,
        lastSyncedAt: '',
        syncStatus: 'idle' as const,
        syncError: null,
      });

      const tracker = await GarminTracker.create();
      const avg = tracker.getAverages(7);

      // Average depends on "today" — the 7-day window is relative to current date.
      // Verify we get a valid numeric average in the expected range.
      expect(typeof avg.sleepScore).toBe('number');
      expect(avg.sleepScore).toBeGreaterThanOrEqual(70);
      expect(avg.sleepScore).toBeLessThanOrEqual(82);
    });
  });

  describe('getAllData defensive copy', () => {
    it('returns a copy — mutating the returned object does not change internal state', async () => {
      mockLoadJSON.mockResolvedValue({
        metrics: { '2026-04-13': makeMetrics({ date: '2026-04-13', sleepScore: 82 }) },
        lastSyncedAt: '2026-04-13T08:00:00Z',
        syncStatus: 'idle' as const,
        syncError: null,
      });

      const tracker = await GarminTracker.create();

      // Get first copy and mutate it
      const firstCopy = tracker.getAllData();
      firstCopy.metrics['2026-04-13'].sleepScore = 999;
      delete firstCopy.metrics['2026-04-13'];
      firstCopy.lastSyncedAt = 'MUTATED';

      // Get second copy and verify it is unaffected
      const secondCopy = tracker.getAllData();
      expect(secondCopy.metrics['2026-04-13']).toBeDefined();
      expect(secondCopy.metrics['2026-04-13'].sleepScore).toBe(82);
      expect(secondCopy.lastSyncedAt).toBe('2026-04-13T08:00:00Z');
    });
  });
});
