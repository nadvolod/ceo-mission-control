/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/focus-hours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe('GET', () => {
    it('should return all dashboard data when no file exists', async () => {
      const response = await GET();
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
      expect(data.timestamp).toBeDefined();
    });

    it('should return correct data when file has sessions', async () => {
      const existingData = {
        dailyMetrics: {
          [TODAY]: {
            date: TODAY,
            sessions: [{
              id: 'test-1',
              category: 'Temporal',
              hours: 3,
              description: 'Client work',
              date: TODAY,
              timestamp: new Date().toISOString(),
              source: 'manual'
            }],
            totalHours: 3,
            byCategory: { Temporal: 3 }
          }
        },
        lastUpdated: new Date().toISOString()
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingData));

      const response = await GET();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.todaysMetrics.totalHours).toBe(3);
      expect(data.recentSessions.length).toBe(1);
    });
  });

  describe('POST addSession', () => {
    it('should add a session and return it', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addSession',
          category: 'Temporal',
          hours: 2.5,
          description: 'Morning sprint'
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.category).toBe('Temporal');
      expect(data.session.hours).toBe(2.5);
      expect(data.session.description).toBe('Morning sprint');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should reject invalid hours (negative)', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addSession',
          category: 'Temporal',
          hours: -1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Hours must be');
    });

    it('should reject invalid hours (> 24)', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addSession',
          category: 'Temporal',
          hours: 25,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject invalid category', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addSession',
          category: 'InvalidCategory',
          hours: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid category');
    });

    it('should log to memory file', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addSession',
          category: 'Finance',
          hours: 1,
          description: 'Budget review'
        }),
      });

      // Memory file does not exist yet (first entry)
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('memory/')) {
          throw new Error('ENOENT');
        }
        throw new Error('ENOENT');
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should have written to both focus-tracking.json and memory file
      const writeCalls = mockWriteFileSync.mock.calls;
      expect(writeCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should default category to Other when not provided', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addSession',
          hours: 1,
          description: 'Random work'
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.category).toBe('Other');
    });
  });

  describe('POST processMessage', () => {
    it('should detect focus patterns and create sessions', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'processMessage',
          message: 'logged 2h on Temporal client delivery'
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.added.length).toBe(1);
      expect(data.added[0].hours).toBe(2);
      expect(data.added[0].category).toBe('Temporal');
    });

    it('should return empty when no patterns detected', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'processMessage',
          message: 'Just had lunch'
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.added.length).toBe(0);
    });

    it('should require message parameter', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({
          action: 'processMessage',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST unknown action', () => {
    it('should return 400 for unknown action', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknownAction' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown action');
    });
  });

  describe('POST getAllData', () => {
    it('should return all data', async () => {
      const request = new NextRequest('http://localhost/api/focus-hours', {
        method: 'POST',
        body: JSON.stringify({ action: 'getAllData' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.dailyMetrics).toBeDefined();
    });
  });
});
