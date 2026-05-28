/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

// Mock the storage module
jest.mock('@/lib/storage', () => {
  let store: Record<string, any> = {};
  return {
    loadJSON: jest.fn(async (_ownerId: string, key: string, defaultValue: any) => store[key] ?? defaultValue),
    saveJSON: jest.fn(async (_ownerId: string, key: string, data: any) => { store[key] = data; }),
    loadText: jest.fn(async () => ''),
    saveText: jest.fn(async () => {}),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { store = {}; },
  };
});

jest.mock('@/lib/session', () => ({
  requireEffectiveUserId: jest.fn(async () => '00000000-0000-0000-0000-000000000001'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@/lib/storage');

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/focus-hours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  describe('GET', () => {
    it('should return all dashboard data when no data exists', async () => {
      const response = await GET(new NextRequest('http://localhost/'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.todaysMetrics).toBeDefined();
      expect(data.weeklyTotals).toBeDefined();
      expect(data.weekOverWeek).toBeDefined();
      expect(data.dailyTrend).toBeDefined();
      expect(data.rollingAverage).toBeDefined();
      expect(data.categoryDistribution).toBeDefined();
      expect(data.recentSessions).toBeDefined();
    });

    it('should return correct data when sessions exist', async () => {
      const existingData = {
        dailyMetrics: {
          [TODAY]: {
            date: TODAY,
            sessions: [{
              id: 'test-1', category: 'Temporal', hours: 3,
              description: 'Client work', date: TODAY,
              timestamp: new Date().toISOString(), source: 'manual'
            }],
            totalHours: 3,
            byCategory: { Temporal: 3 }
          }
        },
        lastUpdated: new Date().toISOString()
      };
      storage.loadJSON.mockResolvedValueOnce(existingData);

      const response = await GET(new NextRequest('http://localhost/'));
      const data = await response.json();
      expect(data.todaysMetrics.totalHours).toBe(3);
    });

    it('anchors all today/week/trend snapshots to the client date param', async () => {
      const existingData = {
        dailyMetrics: {
          '2026-05-23': {
            date: '2026-05-23',
            sessions: [{
              id: 'sat', category: 'Temporal', hours: 2,
              description: 'local Saturday', date: '2026-05-23',
              timestamp: '2026-05-23T20:00:00.000Z', source: 'manual'
            }],
            totalHours: 2,
            byCategory: { Temporal: 2 }
          },
          '2026-05-24': {
            date: '2026-05-24',
            sessions: [{
              id: 'sun', category: 'Temporal', hours: 3,
              description: 'future local day', date: '2026-05-24',
              timestamp: '2026-05-24T01:00:00.000Z', source: 'manual'
            }],
            totalHours: 3,
            byCategory: { Temporal: 3 }
          },
        },
        lastUpdated: new Date().toISOString()
      };
      storage.loadJSON.mockResolvedValueOnce(existingData);

      const response = await GET(new NextRequest('http://localhost/?date=2026-05-23'));
      const data = await response.json();

      expect(data.todaysMetrics.date).toBe('2026-05-23');
      expect(data.todaysMetrics.totalHours).toBe(2);
      expect(data.weeklyTotals.Temporal).toBe(2);
      expect(data.dailyTrend.at(-1).date).toBe('2026-05-23');
      expect(data.rollingAverage.at(-1).date).toBe('2026-05-23');
      expect(data.categoryDistribution.Temporal).toBe(2);
    });
  });

  describe('POST addSession', () => {
    it('should add a session and return it', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'addSession', category: 'Temporal', hours: 2.5, description: 'Morning sprint' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.category).toBe('Temporal');
      expect(data.session.hours).toBe(2.5);
    });

    it('should reject invalid hours', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'addSession', category: 'Temporal', hours: -1 }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject invalid category', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'addSession', category: 'InvalidCategory', hours: 1 }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should log to audit log', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'addSession', category: 'Finance', hours: 1, description: 'Budget review' }),
      });
      await POST(request);
      expect(storage.appendAuditLog).toHaveBeenCalled();
    });

    it('should default category to Other when not provided', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'addSession', hours: 1 }),
      });
      const response = await POST(request);
      const data = await response.json();
      expect(data.session.category).toBe('Other');
    });
  });

  describe('POST processMessage', () => {
    it('should detect focus patterns', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'processMessage', message: 'logged 2h on Temporal' }),
      });
      const response = await POST(request);
      const data = await response.json();
      expect(data.added.length).toBe(1);
      expect(data.added[0].category).toBe('Temporal');
    });

    it('should return empty when no patterns', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'processMessage', message: 'Just had lunch' }),
      });
      const response = await POST(request);
      const data = await response.json();
      expect(data.added.length).toBe(0);
    });

    it('should require message', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'processMessage' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST unknown action', () => {
    it('should return 400', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknownAction' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
