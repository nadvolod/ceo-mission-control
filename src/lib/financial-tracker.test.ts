/**
 * @jest-environment node
 */

jest.mock('./storage', () => {
  let store: Record<string, any> = {};
  return {
    loadJSON: jest.fn(async (_ownerId: string, key: string, defaultValue: any) => store[key] ?? defaultValue),
    saveJSON: jest.fn(async (_ownerId: string, key: string, data: any) => { store[key] = data; }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { store = {}; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('./storage');

import { addDays, format, startOfWeek } from 'date-fns';
import { FinancialTracker } from './financial-tracker';
import { UNIT_TEST_OWNER_ID } from '@/__tests__/utils/owner-id';

const DATE = '2026-05-11';

describe('FinancialTracker.recalculateTotals (cent-based accumulation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('sums 49.99 + 0.01 + 100 to exactly 150 for the cut category (and netImpact: 150)', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
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
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addEntry('generated', 0.1, 'a', DATE);
    await tracker.addEntry('generated', 0.2, 'b', DATE);

    const data = tracker.getAllData();
    const totals = data.dailyMetrics[DATE].totals;
    expect(totals.generated).toBe(0.3);
    expect(totals.netImpact).toBe(0.3);
  });

  it('sums large amounts 1_500_000 + 750_000.50 for moved to exactly 2_250_000.5', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addEntry('moved', 1_500_000, 'a', DATE);
    await tracker.addEntry('moved', 750_000.5, 'b', DATE);

    const data = tracker.getAllData();
    const totals = data.dailyMetrics[DATE].totals;
    expect(totals.moved).toBe(2_250_000.5);
    expect(totals.netImpact).toBe(2_250_000.5);
  });

  it('empty day returns { moved: 0, generated: 0, cut: 0, netImpact: 0 }', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    // No entries — getTodaysMetrics returns the default totals shape.
    const today = tracker.getTodaysMetrics();
    expect(today.totals).toEqual({ moved: 0, generated: 0, cut: 0, netImpact: 0 });
  });

  it('three categories on the same day produce netImpact = moved + generated + cut exactly', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
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

describe('FinancialTracker.addEntry (input validation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('rejects amount = 0', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addEntry('cut', 0, 'zero', DATE)).rejects.toThrow(
      /amount must be greater than 0/i
    );
  });

  it('rejects negative amount', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addEntry('generated', -10, 'neg', DATE)).rejects.toThrow(
      /amount must be greater than 0/i
    );
  });

  it('rejects NaN amount', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addEntry('moved', Number.NaN, 'nan', DATE)).rejects.toThrow(
      /amount must be greater than 0/i
    );
  });

  it('rejects Infinity amount', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await expect(
      tracker.addEntry('moved', Number.POSITIVE_INFINITY, 'inf', DATE)
    ).rejects.toThrow(/amount must be greater than 0/i);
  });

  it('rejects whitespace-only description', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addEntry('cut', 10, '   ', DATE)).rejects.toThrow(
      /description.*required/i
    );
  });

  it('rejects empty description', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addEntry('cut', 10, '', DATE)).rejects.toThrow(
      /description.*required/i
    );
  });

  it('does not create a dailyMetrics entry for the day when validation fails', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addEntry('cut', 0, 'zero', DATE)).rejects.toThrow();
    const data = tracker.getAllData();
    expect(data.dailyMetrics[DATE]).toBeUndefined();
  });

  it('trims a valid description before storing it on the entry', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    const entry = await tracker.addEntry('generated', 5, '  hello world  ', DATE);
    expect(entry.description).toBe('hello world');
    const data = tracker.getAllData();
    expect(data.dailyMetrics[DATE].entries[0].description).toBe('hello world');
  });
});

describe('FinancialTracker.getDailyMetricsForWeek', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('returns 7 zero-filled days for an empty week starting 2026-05-11', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    const result = tracker.getDailyMetricsForWeek('2026-05-11');

    expect(result).toHaveLength(7);
    const expectedDates = [
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
    ];
    result.forEach((day, i) => {
      expect(day.date).toBe(expectedDates[i]);
      expect(day.entries).toEqual([]);
      expect(day.totals).toEqual({ moved: 0, generated: 0, cut: 0, netImpact: 0 });
    });
  });

  it('returns 7 days for a sparse week with entries only on Wednesday at index 2', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addEntry('generated', 100, 'wed revenue', '2026-05-13');

    const result = tracker.getDailyMetricsForWeek('2026-05-11');

    expect(result).toHaveLength(7);
    expect(result[2].date).toBe('2026-05-13');
    expect(result[2].entries).toHaveLength(1);
    expect(result[2].entries[0].description).toBe('wed revenue');
    expect(result[2].totals.generated).toBe(100);
    expect(result[2].totals.netImpact).toBe(100);

    // All other days are empty placeholders
    [0, 1, 3, 4, 5, 6].forEach((i) => {
      expect(result[i].entries).toEqual([]);
      expect(result[i].totals).toEqual({ moved: 0, generated: 0, cut: 0, netImpact: 0 });
    });
  });

  it('excludes the previous Sunday (2026-05-10) and includes the upcoming Sunday (2026-05-17)', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addEntry('moved', 500, 'prev sunday', '2026-05-10');
    await tracker.addEntry('cut', 75, 'sunday cut', '2026-05-17');

    const result = tracker.getDailyMetricsForWeek('2026-05-11');

    expect(result).toHaveLength(7);
    expect(result.map((d) => d.date)).toEqual([
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
    ]);
    // Previous Sunday entry is excluded — no day in the result contains 'prev sunday'
    const allDescriptions = result.flatMap((d) => d.entries.map((e) => e.description));
    expect(allDescriptions).not.toContain('prev sunday');

    // Upcoming Sunday entry sits at index 6
    expect(result[6].date).toBe('2026-05-17');
    expect(result[6].entries).toHaveLength(1);
    expect(result[6].entries[0].description).toBe('sunday cut');
    expect(result[6].totals.cut).toBe(75);
  });

  it('handles a month boundary: week starting 2026-04-27 spans April 27 through May 3', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addEntry('generated', 200, 'apr 30 entry', '2026-04-30');
    await tracker.addEntry('moved', 1000, 'may 3 entry', '2026-05-03');

    const result = tracker.getDailyMetricsForWeek('2026-04-27');

    expect(result).toHaveLength(7);
    expect(result.map((d) => d.date)).toEqual([
      '2026-04-27',
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);

    expect(result[3].date).toBe('2026-04-30');
    expect(result[3].entries).toHaveLength(1);
    expect(result[3].entries[0].description).toBe('apr 30 entry');
    expect(result[3].totals.generated).toBe(200);

    expect(result[6].date).toBe('2026-05-03');
    expect(result[6].entries).toHaveLength(1);
    expect(result[6].entries[0].description).toBe('may 3 entry');
    expect(result[6].totals.moved).toBe(1000);
  });
});

describe('FinancialTracker.getDailyMetricsForRange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('returns 5 zero-filled days for an empty range 2026-05-01..2026-05-05', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    const result = tracker.getDailyMetricsForRange('2026-05-01', '2026-05-05');

    expect(result).toHaveLength(5);
    expect(result.map((d) => d.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
    ]);
    result.forEach((day) => {
      expect(day.entries).toEqual([]);
      expect(day.totals).toEqual({ moved: 0, generated: 0, cut: 0, netImpact: 0 });
    });
  });

  it('reflects boundary entries on start and end days at indices 0 and 4', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addEntry('moved', 500, 'start day entry', '2026-05-01');
    await tracker.addEntry('cut', 75, 'end day entry', '2026-05-05');

    const result = tracker.getDailyMetricsForRange('2026-05-01', '2026-05-05');

    expect(result).toHaveLength(5);
    expect(result[0].date).toBe('2026-05-01');
    expect(result[0].entries).toHaveLength(1);
    expect(result[0].entries[0].description).toBe('start day entry');
    expect(result[0].totals.moved).toBe(500);

    expect(result[4].date).toBe('2026-05-05');
    expect(result[4].entries).toHaveLength(1);
    expect(result[4].entries[0].description).toBe('end day entry');
    expect(result[4].totals.cut).toBe(75);

    // Middle days remain empty placeholders
    [1, 2, 3].forEach((i) => {
      expect(result[i].entries).toEqual([]);
      expect(result[i].totals).toEqual({ moved: 0, generated: 0, cut: 0, netImpact: 0 });
    });
  });

  it('handles month crossing: 2026-04-29..2026-05-02 returns the exact 4 dates', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    const result = tracker.getDailyMetricsForRange('2026-04-29', '2026-05-02');

    expect(result).toHaveLength(4);
    expect(result.map((d) => d.date)).toEqual([
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
    ]);
  });

  it('returns a length-1 array for a single-day range (start === end)', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addEntry('generated', 42, 'solo day', '2026-05-11');

    const result = tracker.getDailyMetricsForRange('2026-05-11', '2026-05-11');

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-05-11');
    expect(result[0].entries).toHaveLength(1);
    expect(result[0].entries[0].description).toBe('solo day');
    expect(result[0].totals.generated).toBe(42);
    expect(result[0].totals.netImpact).toBe(42);
  });
});

describe('FinancialTracker.getPreviousWeekTotals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('returns zero totals when no entries exist anywhere', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);
    expect(tracker.getPreviousWeekTotals()).toEqual({
      moved: 0,
      generated: 0,
      cut: 0,
      netImpact: 0,
    });
  });

  it('sums only entries from the previous Mon-Sun week (ignores this week and other days)', async () => {
    const tracker = await FinancialTracker.create(UNIT_TEST_OWNER_ID);

    const thisWeekMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const prevWeekMonday = addDays(thisWeekMonday, -7);
    const prevWeekWednesday = addDays(prevWeekMonday, 2);

    const thisWeekMondayStr = format(thisWeekMonday, 'yyyy-MM-dd');
    const prevWeekMondayStr = format(prevWeekMonday, 'yyyy-MM-dd');
    const prevWeekWednesdayStr = format(prevWeekWednesday, 'yyyy-MM-dd');

    // This week entry — must be excluded
    await tracker.addEntry('generated', 100, 'this week mon', thisWeekMondayStr);
    // Previous week entries — must be summed
    await tracker.addEntry('generated', 50, 'prev week mon', prevWeekMondayStr);
    await tracker.addEntry('cut', 25, 'prev week wed', prevWeekWednesdayStr);

    expect(tracker.getPreviousWeekTotals()).toEqual({
      moved: 0,
      generated: 50,
      cut: 25,
      netImpact: 75,
    });
  });
});
