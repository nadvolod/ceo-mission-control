/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

jest.mock('@/lib/storage', () => {
  let store: Record<string, unknown> = {};
  return {
    loadJSON: jest.fn(
      async (_ownerId: string, key: string, defaultValue: unknown) => store[key] ?? defaultValue
    ),
    saveJSON: jest.fn(async (_ownerId: string, key: string, data: unknown) => {
      store[key] = data;
    }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => {
      store = {};
    },
  };
});

jest.mock('@/lib/session', () => ({
  requireEffectiveUserId: jest.fn(async () => '00000000-0000-0000-0000-000000000001'),
}));

// The battles POST is gated by checkAuth; force it open for these tests.
jest.mock('@/lib/auth', () => ({
  checkAuth: jest.fn(() => true),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@/lib/storage');

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/battles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/battles GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('returns the expected payload shape', async () => {
    const response = await GET(new NextRequest('http://localhost/api/battles'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.todaysMetrics).toBeDefined();
    expect(body.weeklyTotals).toEqual({ count: 0, value: 0 });
    expect(body.allTimeTotals).toEqual({ count: 0, value: 0 });
    expect(Array.isArray(body.recentEntries)).toBe(true);
    expect(Array.isArray(body.dailyBattleTrend)).toBe(true);
    expect(body.dailyBattleTrend).toHaveLength(30);
    expect(body.timestamp).toBeDefined();
  });

  it('anchors today/week/trend to the client date param', async () => {
    storage.loadJSON.mockResolvedValueOnce({
      dailyMetrics: {
        '2026-05-11': {
          date: '2026-05-11',
          entries: [{ id: 'b1', name: 'win', value: 500, timestamp: '2026-05-11T20:00:00.000Z' }],
          totals: { count: 1, value: 500 },
        },
      },
      lastUpdated: new Date().toISOString(),
    });

    const response = await GET(new NextRequest('http://localhost/api/battles?date=2026-05-11'));
    const body = await response.json();

    expect(body.todaysMetrics.date).toBe('2026-05-11');
    expect(body.todaysMetrics.totals.count).toBe(1);
    expect(body.weeklyTotals).toEqual({ count: 1, value: 500 });
    expect(body.allTimeTotals).toEqual({ count: 1, value: 500 });
    expect(body.dailyBattleTrend.at(-1).date).toBe('2026-05-11');
  });
});

describe('/api/battles POST addBattle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('persists a valid battle and echoes the created entry', async () => {
    const response = await POST(
      postReq({ action: 'addBattle', name: 'Closed Acme', value: 2500, date: '2026-05-11' }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entry.name).toBe('Closed Acme');
    expect(body.entry.value).toBe(2500);
    expect(body.entry.id).toBeDefined();
    // Round-trip: a follow-up GET reflects the persisted battle.
    const getRes = await GET(new NextRequest('http://localhost/api/battles?date=2026-05-11'));
    const getBody = await getRes.json();
    expect(getBody.todaysMetrics.totals.count).toBe(1);
    expect(getBody.allTimeTotals.value).toBe(2500);
  });

  it('returns 400 with a clear message on an empty name', async () => {
    const response = await POST(postReq({ action: 'addBattle', name: '   ', value: 100, date: '2026-05-11' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/name is required/i);
  });

  it('returns 400 on a negative value', async () => {
    const response = await POST(postReq({ action: 'addBattle', name: 'x', value: -1, date: '2026-05-11' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/non-negative/i);
  });

  it('returns 400 on an unknown action', async () => {
    const response = await POST(postReq({ action: 'frobnicate' }));
    expect(response.status).toBe(400);
  });
});

describe('/api/battles POST auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('returns 401 when checkAuth fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auth = require('@/lib/auth');
    auth.checkAuth.mockReturnValueOnce(false);
    const response = await POST(postReq({ action: 'addBattle', name: 'x', value: 1 }));
    expect(response.status).toBe(401);
  });
});
