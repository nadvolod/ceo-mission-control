/**
 * @jest-environment node
 */
import { GET } from './route';

jest.mock('@/lib/storage', () => {
  let store: Record<string, unknown> = {};
  return {
    loadJSON: jest.fn(
      async (key: string, defaultValue: unknown) => store[key] ?? defaultValue
    ),
    saveJSON: jest.fn(async (key: string, data: unknown) => {
      store[key] = data;
    }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => {
      store = {};
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@/lib/storage');

describe('/api/financial GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('returns the extended payload shape with weekly/30-day financial data', async () => {
    const response = await GET();
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
});
