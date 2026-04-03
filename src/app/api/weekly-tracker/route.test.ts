/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

jest.mock('@/lib/storage', () => {
  let store: Record<string, any> = {};
  return {
    loadJSON: jest.fn(async (key: string, defaultValue: any) => store[key] ?? defaultValue),
    saveJSON: jest.fn(async (key: string, data: any) => { store[key] = data; }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { store = {}; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@/lib/storage');

describe('/api/weekly-tracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  describe('GET', () => {
    it('should return correct structure with empty data', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.todaysEntry).toBeNull();
      expect(data.currentWeekSummary).toBeDefined();
      expect(data.currentWeekSummary.daysTracked).toBe(0);
      expect(data.previousWeekSummary).toBeDefined();
      expect(data.dailyTrend).toBeDefined();
      expect(Array.isArray(data.dailyTrend)).toBe(true);
      expect(data.recentReviews).toBeDefined();
      expect(Array.isArray(data.recentReviews)).toBe(true);
      expect(data.timestamp).toBeDefined();
    });

    it('should return data when entries exist', async () => {
      const today = new Date().toISOString().split('T')[0];
      const existingData = {
        dailyEntries: {
          [today]: {
            date: today,
            deepWorkHours: 4,
            pipelineActions: 3,
            trained: true,
            timestamp: new Date().toISOString(),
          }
        },
        weeklyReviews: [],
        lastUpdated: new Date().toISOString(),
      };
      storage.loadJSON.mockResolvedValueOnce(existingData);

      const response = await GET();
      const data = await response.json();

      expect(data.todaysEntry).not.toBeNull();
      expect(data.todaysEntry.deepWorkHours).toBe(4);
    });
  });

  describe('POST logDay', () => {
    it('should create an entry and return it', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.entry.deepWorkHours).toBe(3);
      expect(data.entry.pipelineActions).toBe(2);
      expect(data.entry.trained).toBe(true);
      expect(data.currentWeekSummary).toBeDefined();
    });

    it('should reject deepWorkHours > 8', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 9, pipelineActions: 2, trained: true }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('deepWorkHours');
    });

    it('should reject negative deepWorkHours', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: -1, pipelineActions: 2, trained: true }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject non-integer pipelineActions', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2.5, trained: true }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('pipelineActions');
    });

    it('should reject non-boolean trained', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: 'yes' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('trained');
    });

    it('should write to audit log', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true }),
      });
      await POST(request);
      expect(storage.appendAuditLog).toHaveBeenCalled();
    });
  });

  describe('POST submitReview', () => {
    it('should save and return a review', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'submitReview',
          revenue: 5000,
          slipAnalysis: 'Missed Wednesday',
          systemAdjustment: 'Block mornings',
          nextWeekTargets: '4h daily',
          bottleneck: 'Context switching',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.review.revenue).toBe(5000);
      expect(data.review.slipAnalysis).toBe('Missed Wednesday');
      expect(data.review.id).toMatch(/^review_/);
    });

    it('should reject negative revenue', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'submitReview', revenue: -100 }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('revenue');
    });

    it('should reject non-number revenue', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'submitReview', revenue: 'abc' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST unknown action', () => {
    it('should return 400', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknownAction' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Unknown action');
    });
  });
});
