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
});
