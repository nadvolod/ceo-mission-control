/**
 * @jest-environment node
 */

jest.mock('./storage', () => {
  let store: Record<string, any> = {};
  return {
    loadJSON: jest.fn(async (key: string, defaultValue: any) => store[key] ?? defaultValue),
    saveJSON: jest.fn(async (key: string, data: any) => { store[key] = data; }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { store = {}; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('./storage');

import { FinancialTracker } from './financial-tracker';

const DATE = '2026-05-11';

describe('FinancialTracker.recalculateTotals (cent-based accumulation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('sums 49.99 + 0.01 + 100 to exactly 150 for the cut category (and netImpact: 150)', async () => {
    const tracker = await FinancialTracker.create();
    await tracker.addEntry('cut', 49.99, 'a', DATE);
    await tracker.addEntry('cut', 0.01, 'b', DATE);
    await tracker.addEntry('cut', 100, 'c', DATE);

    const data = tracker.getAllData();
    const totals = data.dailyMetrics[DATE].totals;
    expect(totals.cut).toBe(150);
    expect(totals.moved).toBe(0);
    expect(totals.generated).toBe(0);
    expect(totals.netImpact).toBe(150);
  });

  it('sums 0.1 + 0.2 to exactly 0.3 for the generated category', async () => {
    const tracker = await FinancialTracker.create();
    await tracker.addEntry('generated', 0.1, 'a', DATE);
    await tracker.addEntry('generated', 0.2, 'b', DATE);

    const data = tracker.getAllData();
    const totals = data.dailyMetrics[DATE].totals;
    expect(totals.generated).toBe(0.3);
    expect(totals.netImpact).toBe(0.3);
  });

  it('sums large amounts 1_500_000 + 750_000.50 for moved to exactly 2_250_000.5', async () => {
    const tracker = await FinancialTracker.create();
    await tracker.addEntry('moved', 1_500_000, 'a', DATE);
    await tracker.addEntry('moved', 750_000.5, 'b', DATE);

    const data = tracker.getAllData();
    const totals = data.dailyMetrics[DATE].totals;
    expect(totals.moved).toBe(2_250_000.5);
    expect(totals.netImpact).toBe(2_250_000.5);
  });

  it('empty day returns { moved: 0, generated: 0, cut: 0, netImpact: 0 }', async () => {
    const tracker = await FinancialTracker.create();
    // No entries — getTodaysMetrics returns the default totals shape.
    const today = tracker.getTodaysMetrics();
    expect(today.totals).toEqual({ moved: 0, generated: 0, cut: 0, netImpact: 0 });
  });

  it('three categories on the same day produce netImpact = moved + generated + cut exactly', async () => {
    const tracker = await FinancialTracker.create();
    await tracker.addEntry('moved', 0.1, 'm1', DATE);
    await tracker.addEntry('moved', 0.2, 'm2', DATE);
    await tracker.addEntry('generated', 0.1, 'g1', DATE);
    await tracker.addEntry('generated', 0.2, 'g2', DATE);
    await tracker.addEntry('cut', 0.1, 'c1', DATE);
    await tracker.addEntry('cut', 0.2, 'c2', DATE);

    const data = tracker.getAllData();
    const totals = data.dailyMetrics[DATE].totals;
    expect(totals.moved).toBe(0.3);
    expect(totals.generated).toBe(0.3);
    expect(totals.cut).toBe(0.3);
    // netImpact is computed via cent-based arithmetic, so it is exactly 0.9
    // (more accurate than naive float addition, which would yield 0.8999999999999999).
    expect(totals.netImpact).toBe(0.9);
  });
});
