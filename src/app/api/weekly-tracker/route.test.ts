/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { format, startOfWeek, addDays } from 'date-fns';
import { GET, POST } from './route';

// Helper: get a date string for a specific day of the current week (0=Mon)
function weekDay(offset: number): string {
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(addDays(ws, offset), 'yyyy-MM-dd');
}

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
      const today = format(new Date(), 'yyyy-MM-dd');
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

    it('should accept and persist temporalTarget', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'submitReview', revenue: 3000, temporalTarget: 8,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.review.temporalTarget).toBe(8);

      // Verify it appears in GET response
      const getResponse = await GET();
      const getData = await getResponse.json();
      expect(getData.currentWeekSummary.temporalTarget).toBe(8);
    });

    it('should reject negative temporalTarget', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'submitReview', revenue: 1000, temporalTarget: -5 }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('temporalTarget');
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

  describe('POST logDay with client-sent date', () => {
    it('should use the client-provided date', async () => {
      const monday = weekDay(0);
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true, date: monday }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entry.date).toBe(monday);
    });

    it('should reject invalid date format', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true, date: 'not-a-date' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('date');
    });

    it('should reject invalid calendar date', async () => {
      const request = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true, date: '2026-13-99' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should preserve entries for different dates', async () => {
      const monday = weekDay(0);
      const wednesday = weekDay(2);
      const req1 = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true, date: monday }),
      });
      await POST(req1);

      const req2 = new NextRequest('http://localhost/api/weekly-tracker', {
        method: 'POST',
        body: JSON.stringify({ action: 'logDay', deepWorkHours: 5, pipelineActions: 4, trained: false, date: wednesday }),
      });
      await POST(req2);

      const getResponse = await GET();
      const data = await getResponse.json();

      // Both entries should be present in the week summary
      const entries = data.currentWeekSummary.dailyEntries;

      expect(entries[0]).not.toBeNull();
      expect(entries[0].deepWorkHours).toBe(3);
      expect(entries[2]).not.toBeNull();
      expect(entries[2].deepWorkHours).toBe(5);
      // Tuesday should be null
      expect(entries[1]).toBeNull();
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
