/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@/lib/storage');

describe('/api/financial GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('returns the extended payload shape with weekly/30-day financial data', async () => {
    const response = await GET(new NextRequest('http://localhost/'));
    expect(response.status).toBe(200);

    const body = await response.json();

    // Existing fields
    expect(body.todaysMetrics).toBeDefined();
    expect(body.weeklyTotals).toBeDefined();
    expect(body.monthlyTotals).toBeDefined();
    expect(body.recentEntries).toBeDefined();
    expect(body.timestamp).toBeDefined();

    // New: previousWeekTotals
    expect(body.previousWeekTotals).toBeDefined();
    expect(typeof body.previousWeekTotals.moved).toBe('number');
    expect(typeof body.previousWeekTotals.generated).toBe('number');
    expect(typeof body.previousWeekTotals.cut).toBe('number');
    expect(typeof body.previousWeekTotals.netImpact).toBe('number');

    // New: weekFinancialByDay — length 7
    expect(Array.isArray(body.weekFinancialByDay)).toBe(true);
    expect(body.weekFinancialByDay).toHaveLength(7);

    // New: dailyFinancialTrend — length 30
    expect(Array.isArray(body.dailyFinancialTrend)).toBe(true);
    expect(body.dailyFinancialTrend).toHaveLength(30);
  });

  it('anchors all today/week/trend snapshots to the client date param', async () => {
    storage.loadJSON.mockResolvedValueOnce({
      dailyMetrics: {
        '2026-05-23': {
          date: '2026-05-23',
          entries: [{ id: 'sat', amount: 100, description: 'local Saturday', timestamp: '2026-05-23T20:00:00.000Z', category: 'generated' }],
          totals: { moved: 0, generated: 100, cut: 0, netImpact: 100 },
        },
        '2026-05-24': {
          date: '2026-05-24',
          entries: [{ id: 'sun', amount: 250, description: 'future local day', timestamp: '2026-05-24T01:00:00.000Z', category: 'generated' }],
          totals: { moved: 0, generated: 250, cut: 0, netImpact: 250 },
        },
      },
      lastUpdated: new Date().toISOString(),
    });

    const response = await GET(new NextRequest('http://localhost/?date=2026-05-23'));
    const body = await response.json();

    expect(body.todaysMetrics.date).toBe('2026-05-23');
    expect(body.todaysMetrics.totals.generated).toBe(100);
    expect(body.weeklyTotals.generated).toBe(100);
    expect(body.weekFinancialByDay.at(-1).date).toBe('2026-05-23');
    expect(body.dailyFinancialTrend.at(-1).date).toBe('2026-05-23');
  });
});
