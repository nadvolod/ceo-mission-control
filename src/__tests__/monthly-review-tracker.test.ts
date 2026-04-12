/**
 * @jest-environment node
 */

/**
 * Unit tests for MonthlyReviewTracker.
 *
 * These tests mock the storage module (same pattern as weekly-tracker.test.ts)
 * to avoid filesystem/database dependencies.
 */

jest.mock('../lib/storage', () => {
  let store: Record<string, any> = {};
  return {
    loadJSON: jest.fn(async (key: string, defaultValue: any) => store[key] ?? defaultValue),
    saveJSON: jest.fn(async (key: string, data: any) => { store[key] = data; }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { store = {}; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('../lib/storage');

import { MonthlyReviewTracker } from '@/lib/monthly-review-tracker';
import type { MonthlyReview } from '@/lib/types';

function makeValidReview(overrides: Partial<MonthlyReview> = {}): Omit<MonthlyReview, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    month: '2026-04',
    date: '2026-04-12',
    timeAllocation: '1. Temporal\n2. Vibe coding',
    hoursWorked: 92.5,
    temporalHours: 40,
    energyGivers: 'vibe coding, working out',
    energyDrainers: 'procrastination',
    ignoredSignals: 'sleep schedule slipping',
    moneySpent: '$7k rent, $1k groceries',
    expenseJoyVsStress: 'Passive income: joy. Rent: stress.',
    alignmentCheck: 'Mostly aligned with long-term goals',
    monthLesson: 'Consistency beats intensity',
    decisionSource: 'discipline' as const,
    badHabits: 'Procrastination, late nights',
    goodPatterns: 'Focused work blocks held',
    ratings: {
      discipline: 7,
      focus: 8,
      executive: 6,
      math: 7,
      nutrition: 5,
      fitness: 6,
      sleep: 4,
    },
    oneThingToFix: 'Sleep schedule',
    disciplinedVersionAction: 'Wake at 6am every day, no exceptions',
    ...overrides,
  };
}

describe('MonthlyReviewTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  test('creates with empty data', async () => {
    const tracker = await MonthlyReviewTracker.create();
    const data = tracker.getAllData();
    expect(data.reviews).toEqual([]);
    expect(data.lastUpdated).toBeDefined();
  });

  test('submits a new monthly review', async () => {
    const tracker = await MonthlyReviewTracker.create();
    const input = makeValidReview();
    const review = await tracker.submitReview(input);

    expect(review.id).toMatch(/^review_/);
    expect(review.month).toBe('2026-04');
    expect(review.hoursWorked).toBe(92.5);
    expect(review.ratings.discipline).toBe(7);
    expect(review.createdAt).toBeDefined();
    expect(storage.saveJSON).toHaveBeenCalled();
    expect(storage.appendAuditLog).toHaveBeenCalled();
  });

  test('upserts review for the same month', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await tracker.submitReview(makeValidReview());
    const updated = await tracker.submitReview(makeValidReview({ hoursWorked: 100 }));

    expect(updated.hoursWorked).toBe(100);
    expect(tracker.getAllData().reviews).toHaveLength(1);
  });

  test('stores reviews for different months separately', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await tracker.submitReview(makeValidReview({ month: '2026-03', date: '2026-03-31' }));
    await tracker.submitReview(makeValidReview({ month: '2026-04', date: '2026-04-12' }));

    expect(tracker.getAllData().reviews).toHaveLength(2);
  });

  test('gets review by month', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await tracker.submitReview(makeValidReview({ month: '2026-03', date: '2026-03-31' }));
    await tracker.submitReview(makeValidReview({ month: '2026-04', date: '2026-04-12' }));

    const march = tracker.getReviewByMonth('2026-03');
    expect(march).not.toBeNull();
    expect(march!.month).toBe('2026-03');

    const missing = tracker.getReviewByMonth('2025-12');
    expect(missing).toBeNull();
  });

  test('getRecentReviews returns most-recent-first', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await tracker.submitReview(makeValidReview({ month: '2026-01', date: '2026-01-31' }));
    await tracker.submitReview(makeValidReview({ month: '2026-02', date: '2026-02-28' }));
    await tracker.submitReview(makeValidReview({ month: '2026-03', date: '2026-03-31' }));

    const recent = tracker.getRecentReviews(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].month).toBe('2026-03');
    expect(recent[1].month).toBe('2026-02');
  });

  test('getRatingsTrend returns ratings over time', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await tracker.submitReview(makeValidReview({ month: '2026-01', date: '2026-01-31', ratings: { discipline: 5, focus: 6, executive: 4, math: 5, nutrition: 3, fitness: 4, sleep: 3 } }));
    await tracker.submitReview(makeValidReview({ month: '2026-02', date: '2026-02-28', ratings: { discipline: 7, focus: 8, executive: 6, math: 7, nutrition: 5, fitness: 6, sleep: 4 } }));

    const trend = tracker.getRatingsTrend();
    expect(trend).toHaveLength(2);
    expect(trend[0].month).toBe('2026-01');
    expect(trend[0].discipline).toBe(5);
    expect(trend[1].month).toBe('2026-02');
    expect(trend[1].discipline).toBe(7);
  });

  test('validates hoursWorked is non-negative', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await expect(
      tracker.submitReview(makeValidReview({ hoursWorked: -10 }))
    ).rejects.toThrow('hoursWorked must be a non-negative number');
  });

  test('validates ratings are between 1 and 10', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await expect(
      tracker.submitReview(makeValidReview({ ratings: { discipline: 11, focus: 8, executive: 6, math: 7, nutrition: 5, fitness: 6, sleep: 4 } }))
    ).rejects.toThrow('discipline rating must be between 1 and 10');
  });

  test('validates month format', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await expect(
      tracker.submitReview(makeValidReview({ month: '2026-13' }))
    ).rejects.toThrow('month must be a valid YYYY-MM string');
  });

  test('validates decisionSource enum', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await expect(
      tracker.submitReview(makeValidReview({ decisionSource: 'chaos' as any }))
    ).rejects.toThrow('decisionSource must be one of: discipline, emotion, mixed');
  });

  test('deletes a review by month', async () => {
    const tracker = await MonthlyReviewTracker.create();
    await tracker.submitReview(makeValidReview({ month: '2026-03', date: '2026-03-31' }));
    await tracker.submitReview(makeValidReview({ month: '2026-04', date: '2026-04-12' }));

    const deleted = await tracker.deleteReview('2026-03');
    expect(deleted).toBe(true);
    expect(tracker.getAllData().reviews).toHaveLength(1);

    const notFound = await tracker.deleteReview('2025-12');
    expect(notFound).toBe(false);
  });

  test('persists data across instances', async () => {
    const tracker1 = await MonthlyReviewTracker.create();
    await tracker1.submitReview(makeValidReview());

    const tracker2 = await MonthlyReviewTracker.create();
    expect(tracker2.getAllData().reviews).toHaveLength(1);
    expect(tracker2.getReviewByMonth('2026-04')!.hoursWorked).toBe(92.5);
  });
});
