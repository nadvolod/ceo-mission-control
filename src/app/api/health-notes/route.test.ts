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

function defaultNotesData() {
  return {
    notes: {},
    supplementTemplate: [{ name: 'Guanfacine', defaultDosageMg: 1 }],
    habitTemplate: [{ name: 'Red light therapy' }],
    environmentTemplate: { customFieldNames: [] },
    lastUpdated: '',
  };
}

function makeRequest(method: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/health-notes', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/health-notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadJSON.mockResolvedValue(defaultNotesData());
    (storage.saveJSON as jest.Mock).mockResolvedValue(undefined);
  });

  describe('GET', () => {
    it('returns notes and templates', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('notes');
      expect(data).toHaveProperty('templates');
    });
  });

  describe('POST log', () => {
    it('saves a health note', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'log',
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [{ name: 'Guanfacine', dosageMg: 1, taken: true }],
        habits: [{ name: 'Red light therapy', done: true }],
        freeformNote: 'Slept well',
      }, { 'x-sync-api-key': 'test-key' }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.note.date).toBe('2026-04-13');
    });

    it('rejects log without auth', async () => {
      const response = await POST(makeRequest('POST', { action: 'log', date: '2026-04-13' }));
      expect(response.status).toBe(401);
    });
  });

  describe('POST update-templates', () => {
    it('adds a new supplement', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'update-templates',
        operation: 'addSupplement',
        name: 'Melatonin',
        defaultDosageMg: 3,
      }, { 'x-sync-api-key': 'test-key' }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('adds a new habit', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'update-templates',
        operation: 'addHabit',
        name: 'Meditation',
      }, { 'x-sync-api-key': 'test-key' }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST log input validation', () => {
    it('accepts valid log with empty supplements, habits, and valid sleepEnvironment', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'log',
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [],
        habits: [],
        freeformNote: '',
      }, { 'x-sync-api-key': 'test-key' }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.note.date).toBe('2026-04-13');
      expect(data.note.supplements).toEqual([]);
      expect(data.note.habits).toEqual([]);
    });

    it('rejects log with supplements as a string instead of array', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'log',
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: 'string',
        habits: [],
      }, { 'x-sync-api-key': 'test-key' }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects log with habits as a number instead of array', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'log',
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [],
        habits: 123,
      }, { 'x-sync-api-key': 'test-key' }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects log with sleepEnvironment as null', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'log',
        date: '2026-04-13',
        sleepEnvironment: null,
        supplements: [],
        habits: [],
      }, { 'x-sync-api-key': 'test-key' }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('POST update-templates input validation', () => {
    it('rejects addSupplement with negative defaultDosageMg', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'update-templates',
        operation: 'addSupplement',
        name: 'Melatonin',
        defaultDosageMg: -5,
      }, { 'x-sync-api-key': 'test-key' }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects addSupplement with non-numeric defaultDosageMg', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'update-templates',
        operation: 'addSupplement',
        name: 'Melatonin',
        defaultDosageMg: 'abc',
      }, { 'x-sync-api-key': 'test-key' }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects addSupplement with defaultDosageMg of 0', async () => {
      const response = await POST(makeRequest('POST', {
        action: 'update-templates',
        operation: 'addSupplement',
        name: 'Melatonin',
        defaultDosageMg: 0,
      }, { 'x-sync-api-key': 'test-key' }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});
