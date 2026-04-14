/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as storage from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  loadJSON: jest.fn(),
  saveJSON: jest.fn(),
  appendAuditLog: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  checkAuth: jest.fn((req: NextRequest) => {
    return req.headers.get('x-sync-api-key') === 'test-key';
  }),
}));

const mockLoadJSON = storage.loadJSON as jest.MockedFunction<typeof storage.loadJSON>;

function makeRequest(method: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  const url = 'http://localhost:3000/api/garmin';
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/garmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadJSON.mockImplementation((key: string) => {
      if (key === 'garmin-health.json') {
        return Promise.resolve({ metrics: {}, lastSyncedAt: '', syncStatus: 'idle', syncError: null });
      }
      if (key === 'health-notes.json') {
        return Promise.resolve({ notes: {}, supplementTemplate: [], habitTemplate: [], environmentTemplate: { customFieldNames: [] }, lastUpdated: '' });
      }
      if (key === 'weekly-tracker.json') {
        return Promise.resolve({
          dailyEntries: {
            '2026-04-11': { date: '2026-04-11', deepWorkHours: 3, pipelineActions: 2, trained: false, loggedAt: '' },
            '2026-04-12': { date: '2026-04-12', deepWorkHours: 3, pipelineActions: 2, trained: false, loggedAt: '' },
            '2026-04-13': { date: '2026-04-13', deepWorkHours: 3, pipelineActions: 2, trained: false, loggedAt: '' },
          },
          weeklyReviews: [],
          lastUpdated: '',
        });
      }
      return Promise.resolve({});
    });
    (storage.saveJSON as jest.Mock).mockResolvedValue(undefined);
  });

  describe('GET', () => {
    it('returns garmin metrics and health notes', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('notes');
      expect(data).toHaveProperty('syncStatus');
    });
  });

  describe('POST sync', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await POST(makeRequest('POST', { action: 'sync', metrics: [] }));
      expect(response.status).toBe(401);
    });

    it('syncs metrics with valid auth', async () => {
      const metrics = [{
        date: '2026-04-13', sleepScore: 82, sleepDurationMinutes: 420,
        sleepStartTime: '22:30', sleepEndTime: '06:30',
        deepSleepMinutes: 90, lightSleepMinutes: 200,
        remSleepMinutes: 100, awakeDuringMinutes: 30,
        restingHeartRate: 58, hrvStatus: 48,
        averageStressLevel: 24, bodyBatteryHigh: 78, bodyBatteryLow: 22,
        steps: 8500, activeMinutes: 45, weight: 182,
        syncedAt: '2026-04-13T07:42:00Z',
      }];

      const response = await POST(makeRequest('POST', { action: 'sync', metrics }, { 'x-sync-api-key': 'test-key' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.synced).toBe(1);
    });

    it('rejects sync with missing metrics', async () => {
      const response = await POST(makeRequest('POST', { action: 'sync' }, { 'x-sync-api-key': 'test-key' }));
      expect(response.status).toBe(400);
    });
  });

  describe('POST unknown action', () => {
    it('returns 400 for unknown action', async () => {
      const response = await POST(makeRequest('POST', { action: 'bad' }, { 'x-sync-api-key': 'test-key' }));
      expect(response.status).toBe(400);
    });
  });

  describe('POST sync with auto-training', () => {
    it('applies training when activeMinutes >= default threshold (30)', async () => {
      const metrics = [{
        date: '2026-04-13', sleepScore: 82, sleepDurationMinutes: 420,
        sleepStartTime: '22:30', sleepEndTime: '06:30',
        deepSleepMinutes: 90, lightSleepMinutes: 200,
        remSleepMinutes: 100, awakeDuringMinutes: 30,
        restingHeartRate: 58, hrvStatus: 48,
        averageStressLevel: 24, bodyBatteryHigh: 78, bodyBatteryLow: 22,
        steps: 8500, activeMinutes: 45, weight: 182,
        syncedAt: '2026-04-13T07:42:00Z',
      }];

      const response = await POST(makeRequest('POST', { action: 'sync', metrics }, { 'x-sync-api-key': 'test-key' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.synced).toBe(1);
      expect(data.trained).toBe(1);
    });

    it('applies training with custom threshold when activeMinutes exceeds it', async () => {
      const metrics = [{
        date: '2026-04-13', sleepScore: 80, sleepDurationMinutes: 400,
        sleepStartTime: '23:00', sleepEndTime: '06:00',
        deepSleepMinutes: 80, lightSleepMinutes: 190,
        remSleepMinutes: 90, awakeDuringMinutes: 40,
        restingHeartRate: 60, hrvStatus: 45,
        averageStressLevel: 30, bodyBatteryHigh: 70, bodyBatteryLow: 25,
        steps: 6000, activeMinutes: 25, weight: 180,
        syncedAt: '2026-04-13T07:00:00Z',
      }];

      const response = await POST(makeRequest('POST', {
        action: 'sync',
        metrics,
        trainingThreshold: 20,
      }, { 'x-sync-api-key': 'test-key' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.synced).toBe(1);
      expect(data.trained).toBe(1);
    });

    it('does NOT apply training when activeMinutes is below default threshold', async () => {
      const metrics = [{
        date: '2026-04-13', sleepScore: 75, sleepDurationMinutes: 380,
        sleepStartTime: '23:30', sleepEndTime: '06:00',
        deepSleepMinutes: 70, lightSleepMinutes: 180,
        remSleepMinutes: 80, awakeDuringMinutes: 50,
        restingHeartRate: 62, hrvStatus: 42,
        averageStressLevel: 35, bodyBatteryHigh: 65, bodyBatteryLow: 20,
        steps: 4000, activeMinutes: 10, weight: 183,
        syncedAt: '2026-04-13T07:00:00Z',
      }];

      const response = await POST(makeRequest('POST', { action: 'sync', metrics }, { 'x-sync-api-key': 'test-key' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.synced).toBe(1);
      expect(data.trained).toBe(0);
    });

    it('does not crash when metrics are missing activeMinutes and skips training', async () => {
      const metrics = [{
        date: '2026-04-13', sleepScore: 78, sleepDurationMinutes: 400,
        sleepStartTime: '22:45', sleepEndTime: '06:15',
        deepSleepMinutes: 85, lightSleepMinutes: 195,
        remSleepMinutes: 95, awakeDuringMinutes: 25,
        restingHeartRate: 59, hrvStatus: 46,
        averageStressLevel: 28, bodyBatteryHigh: 72, bodyBatteryLow: 18,
        steps: 7000, weight: 181,
        syncedAt: '2026-04-13T07:30:00Z',
        // activeMinutes intentionally omitted
      }];

      const response = await POST(makeRequest('POST', { action: 'sync', metrics }, { 'x-sync-api-key': 'test-key' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.synced).toBe(1);
      expect(data.trained).toBe(0);
    });

    it('correctly counts trained days with mixed activeMinutes across 3 days', async () => {
      const metrics = [
        {
          date: '2026-04-11', sleepScore: 70, sleepDurationMinutes: 360,
          sleepStartTime: '23:00', sleepEndTime: '05:00',
          deepSleepMinutes: 60, lightSleepMinutes: 180,
          remSleepMinutes: 80, awakeDuringMinutes: 40,
          restingHeartRate: 65, hrvStatus: 40,
          averageStressLevel: 40, bodyBatteryHigh: 60, bodyBatteryLow: 15,
          steps: 3000, activeMinutes: 10, weight: 184,
          syncedAt: '2026-04-11T07:00:00Z',
        },
        {
          date: '2026-04-12', sleepScore: 80, sleepDurationMinutes: 420,
          sleepStartTime: '22:30', sleepEndTime: '06:30',
          deepSleepMinutes: 90, lightSleepMinutes: 200,
          remSleepMinutes: 100, awakeDuringMinutes: 30,
          restingHeartRate: 58, hrvStatus: 48,
          averageStressLevel: 24, bodyBatteryHigh: 78, bodyBatteryLow: 22,
          steps: 9000, activeMinutes: 35, weight: 182,
          syncedAt: '2026-04-12T07:00:00Z',
        },
        {
          date: '2026-04-13', sleepScore: 85, sleepDurationMinutes: 450,
          sleepStartTime: '22:00', sleepEndTime: '06:30',
          deepSleepMinutes: 100, lightSleepMinutes: 210,
          remSleepMinutes: 110, awakeDuringMinutes: 30,
          restingHeartRate: 55, hrvStatus: 52,
          averageStressLevel: 20, bodyBatteryHigh: 85, bodyBatteryLow: 30,
          steps: 12000, activeMinutes: 50, weight: 181,
          syncedAt: '2026-04-13T07:00:00Z',
        },
      ];

      const response = await POST(makeRequest('POST', { action: 'sync', metrics }, { 'x-sync-api-key': 'test-key' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.synced).toBe(3);
      expect(data.trained).toBe(2);
    });
  });
});
