/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

// Mock the storage module
jest.mock('@/lib/storage', () => {
  let jsonStore: Record<string, any> = {};
  let textStore: Record<string, string> = {};
  return {
    loadJSON: jest.fn(async (key: string, defaultValue: any) => jsonStore[key] ?? defaultValue),
    saveJSON: jest.fn(async (key: string, data: any) => { jsonStore[key] = data; }),
    loadText: jest.fn(async (key: string, defaultValue: string = '') => textStore[key] ?? defaultValue),
    saveText: jest.fn(async (key: string, content: string) => { textStore[key] = content; }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { jsonStore = {}; textStore = {}; },
    _setJSON: (key: string, data: any) => { jsonStore[key] = data; },
    _setText: (key: string, content: string) => { textStore[key] = content; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@/lib/storage');

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/temporal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  describe('GET /api/temporal', () => {
    it('should return empty sessions when no data exists', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        sessions: [],
        dailyTotals: {}
      });
    });

    it('should return existing temporal data', async () => {
      storage._setJSON('temporal-tracking.json', {
        sessions: [{
          id: 'test-session-1',
          startTime: '2026-03-23T06:30:00.000Z',
          endTime: '2026-03-23T08:30:00.000Z',
          duration: 2,
          description: 'Morning focus block',
          date: TODAY
        }],
        dailyTotals: { [TODAY]: 2 }
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].duration).toBe(2);
      expect(data.dailyTotals[TODAY]).toBe(2);
    });
  });

  describe('POST /api/temporal', () => {
    it('should add a new temporal session', async () => {
      storage._setText('DAILY_SCORECARD.md', '# DAILY_SCORECARD.md\n- Target today: 4.0\n- Actual:');

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 2.5,
          description: 'Morning focus blocks completed'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.duration).toBe(2.5);
      expect(data.session.description).toBe('Morning focus blocks completed');
      expect(data.newTotal).toBe(2.5);
      expect(storage.saveJSON).toHaveBeenCalled();
    });

    it('should accumulate hours when multiple sessions are added', async () => {
      storage._setJSON('temporal-tracking.json', {
        sessions: [{
          id: 'existing-session',
          startTime: '2026-03-23T06:30:00.000Z',
          endTime: '2026-03-23T08:30:00.000Z',
          duration: 2,
          description: 'First session',
          date: TODAY
        }],
        dailyTotals: { [TODAY]: 2 }
      });
      storage._setText('DAILY_SCORECARD.md', '# DAILY_SCORECARD.md\n- Target today: 4.0\n- Actual: 2');

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 1.5,
          description: 'Afternoon session'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newTotal).toBe(3.5);
    });

    it('should write audit log entry', async () => {
      storage._setText('DAILY_SCORECARD.md', '# DAILY_SCORECARD.md\n- Target today: 4.0\n- Actual:');

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 1,
          description: 'Test session'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(storage.appendAuditLog).toHaveBeenCalled();
    });

    it('should reject invalid actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidAction', hours: 2 })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject missing hours', async () => {
      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addSession' })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject negative hours', async () => {
      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addSession', hours: -2 })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject hours exceeding 24', async () => {
      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addSession', hours: 25 })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should use default description when none provided', async () => {
      storage._setText('DAILY_SCORECARD.md', '# DAILY_SCORECARD.md\n- Target today: 4.0\n- Actual:');

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addSession', hours: 1.5 })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.description).toBe('1.5h Temporal block completed');
    });
  });
});
