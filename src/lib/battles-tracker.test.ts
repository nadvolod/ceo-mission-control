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

import { BattlesTracker, BattlesValidationError } from './battles-tracker';
import { UNIT_TEST_OWNER_ID } from '@/__tests__/utils/owner-id';

const DATE = '2026-05-11';

describe('BattlesTracker.addBattle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('records a battle with name + value and recomputes daily totals', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addBattle('Closed Acme renewal', 2500, DATE);
    await tracker.addBattle('Won pricing negotiation', 1500, DATE);

    const today = tracker.getTodaysMetrics(DATE);
    expect(today.totals.count).toBe(2);
    expect(today.totals.value).toBe(4000);
    expect(today.entries).toHaveLength(2);
    expect(today.entries[0].name).toBe('Closed Acme renewal');
  });

  it('sums values via integer cents to avoid float drift (0.1 + 0.2 = 0.3)', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addBattle('a', 0.1, DATE);
    await tracker.addBattle('b', 0.2, DATE);
    expect(tracker.getTodaysMetrics(DATE).totals.value).toBe(0.3);
  });

  it('allows a non-monetary win (value 0)', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    const entry = await tracker.addBattle('Shipped the migration', 0, DATE);
    expect(entry.value).toBe(0);
    expect(tracker.getTodaysMetrics(DATE).totals.count).toBe(1);
  });

  it('trims the name before storing', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    const entry = await tracker.addBattle('   spaced   ', 100, DATE);
    expect(entry.name).toBe('spaced');
  });

  it('rejects an empty name', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addBattle('   ', 100, DATE)).rejects.toThrow(BattlesValidationError);
  });

  it('rejects a negative value', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addBattle('bad', -5, DATE)).rejects.toThrow(BattlesValidationError);
  });

  it('rejects a non-finite value', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addBattle('bad', Number.NaN, DATE)).rejects.toThrow(BattlesValidationError);
  });

  it('rejects a malformed date key', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await expect(tracker.addBattle('x', 1, '2026-13-99')).rejects.toThrow(BattlesValidationError);
  });

  it('persists across tracker instances (real save/load round-trip via storage)', async () => {
    const t1 = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await t1.addBattle('persisted', 999, DATE);

    const t2 = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    expect(t2.getTodaysMetrics(DATE).totals.value).toBe(999);
  });
});

describe('BattlesTracker totals & recent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  it('getWeeklyTotals sums the trailing 7 days and excludes older days', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    // anchor = 2026-05-11; trailing-7 window is [2026-05-04, 2026-05-11].
    await tracker.addBattle('in-window', 100, '2026-05-08');
    await tracker.addBattle('also-in', 200, '2026-05-11');
    await tracker.addBattle('too-old', 999, '2026-05-01');

    const weekly = tracker.getWeeklyTotals('2026-05-11');
    expect(weekly.count).toBe(2);
    expect(weekly.value).toBe(300);
  });

  it('getAllTimeTotals sums across every recorded day', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addBattle('a', 100, '2026-01-01');
    await tracker.addBattle('b', 250, '2026-05-11');
    await tracker.addBattle('c', 50, '2026-05-11');

    const all = tracker.getAllTimeTotals();
    expect(all.count).toBe(3);
    expect(all.value).toBe(400);
  });

  it('getRecentEntries returns newest-first, capped at the limit', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addBattle('first', 1, '2026-05-09');
    await new Promise((r) => setTimeout(r, 2));
    await tracker.addBattle('second', 2, '2026-05-10');
    await new Promise((r) => setTimeout(r, 2));
    await tracker.addBattle('third', 3, '2026-05-11');

    const recent = tracker.getRecentEntries(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].name).toBe('third');
    expect(recent[1].name).toBe('second');
  });

  it('getDailyMetricsForRange zero-fills days with no battles', async () => {
    const tracker = await BattlesTracker.create(UNIT_TEST_OWNER_ID);
    await tracker.addBattle('mid', 100, '2026-05-10');
    const range = tracker.getDailyMetricsForRange('2026-05-09', '2026-05-11');
    expect(range).toHaveLength(3);
    expect(range[0].totals.count).toBe(0);
    expect(range[1].totals.count).toBe(1);
    expect(range[2].totals.count).toBe(0);
  });
});
