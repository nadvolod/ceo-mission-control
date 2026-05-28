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

import { WeeklyTracker } from './weekly-tracker';
import { format, startOfWeek, addDays } from 'date-fns';
import { UNIT_TEST_OWNER_ID } from '@/__tests__/utils/owner-id';

// Use local date (consistent with date-fns format) — not UTC toISOString
const TODAY = format(new Date(), 'yyyy-MM-dd');

// Helper: get a date string for a specific day of the current week (0=Sun)
function weekDay(offset: number): string {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  return format(addDays(weekStart, offset), 'yyyy-MM-dd');
}

describe('WeeklyTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  describe('addToDay', () => {
    it('creates a fresh entry when none exists', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const entry = await tracker.addToDay(1.5, 1, false, TODAY);
      expect(entry).toMatchObject({
        date: TODAY,
        deepWorkHours: 1.5,
        pipelineActions: 1,
        trained: false,
      });
    });

    it('accumulates deep-work hours and pipeline actions across calls', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.addToDay(1, 1, false, TODAY);
      await tracker.addToDay(0.5, 2, false, TODAY);
      const after = tracker.getTodaysEntry();
      expect(after?.deepWorkHours).toBe(1.5);
      expect(after?.pipelineActions).toBe(3);
      expect(after?.trained).toBe(false);
    });

    it('latches trained=true and never flips it back to false on subsequent calls', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.addToDay(0, 0, true, TODAY);
      await tracker.addToDay(0.5, 1, false, TODAY);
      const after = tracker.getTodaysEntry();
      expect(after?.trained).toBe(true);
    });

    it('caps cumulative deepWorkHours at 8', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.addToDay(6, 0, false, TODAY);
      await tracker.addToDay(4, 0, false, TODAY); // would push to 10 → clamp to 8
      const after = tracker.getTodaysEntry();
      expect(after?.deepWorkHours).toBe(8);
    });

    it('rejects negative or non-finite deltas', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.addToDay(-1, 0, false, TODAY)).rejects.toThrow(/deepWorkDelta/);
      await expect(tracker.addToDay(0, -1, false, TODAY)).rejects.toThrow(/pipelineDelta/);
      await expect(tracker.addToDay(Number.NaN, 0, false, TODAY)).rejects.toThrow(/deepWorkDelta/);
      await expect(tracker.addToDay(0, 1.5, false, TODAY)).rejects.toThrow(/pipelineDelta/);
    });
  });

  describe('logDay', () => {
    it('should create a daily entry and save', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const entry = await tracker.logDay(3.5, 2, true, TODAY);

      expect(entry.date).toBe(TODAY);
      expect(entry.deepWorkHours).toBe(3.5);
      expect(entry.pipelineActions).toBe(2);
      expect(entry.trained).toBe(true);
      expect(entry.timestamp).toBeTruthy();
      expect(storage.saveJSON).toHaveBeenCalled();
      expect(storage.appendAuditLog).toHaveBeenCalled();
    });

    it('should upsert an existing day', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.logDay(2, 1, false, TODAY);
      await tracker.logDay(4, 3, true, TODAY);

      const entry = tracker.getTodaysEntry();
      expect(entry?.deepWorkHours).toBe(4);
      expect(entry?.pipelineActions).toBe(3);
      expect(entry?.trained).toBe(true);
    });

    it('should default to today if no date provided', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const entry = await tracker.logDay(3, 2, true);
      expect(entry.date).toBe(TODAY);
    });

    it('should reject deepWorkHours > 8', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.logDay(9, 2, true)).rejects.toThrow('deepWorkHours must be a number between 0 and 8');
    });

    it('should reject deepWorkHours < 0', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.logDay(-1, 2, true)).rejects.toThrow('deepWorkHours must be a number between 0 and 8');
    });

    it('should reject NaN deepWorkHours', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.logDay(NaN, 2, true)).rejects.toThrow('deepWorkHours must be a number between 0 and 8');
    });

    it('should allow deepWorkHours = 0', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const entry = await tracker.logDay(0, 2, true, TODAY);
      expect(entry.deepWorkHours).toBe(0);
    });

    it('should reject non-integer pipelineActions', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.logDay(3, 2.5, true)).rejects.toThrow('pipelineActions must be a non-negative integer');
    });

    it('should reject negative pipelineActions', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.logDay(3, -1, true)).rejects.toThrow('pipelineActions must be a non-negative integer');
    });

    it('should reject non-boolean trained', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.logDay(3, 2, 'yes' as unknown as boolean)).rejects.toThrow('trained must be a boolean');
    });
  });

  describe('submitWeeklyReview', () => {
    it('should save a review with generated ID', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const review = await tracker.submitWeeklyReview({
        revenue: 5000,
        slipAnalysis: 'Missed Wednesday',
        systemAdjustment: 'Block mornings',
        nextWeekTargets: '4h daily',
        bottleneck: 'Context switching',
        temporalTarget: 5,
      });

      expect(review.id).toMatch(/^review_/);
      expect(review.revenue).toBe(5000);
      expect(review.slipAnalysis).toBe('Missed Wednesday');
      expect(review.weekStartDate).toBeTruthy();
      expect(review.weekEndDate).toBeTruthy();
      expect(storage.saveJSON).toHaveBeenCalled();
    });

    it('should reject negative revenue', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.submitWeeklyReview({
        revenue: -100,
        slipAnalysis: '',
        systemAdjustment: '',
        nextWeekTargets: '',
        bottleneck: '',
        temporalTarget: 5,
      })).rejects.toThrow('revenue must be a non-negative number');
    });

    it('should allow revenue = 0', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const review = await tracker.submitWeeklyReview({
        revenue: 0,
        slipAnalysis: '',
        systemAdjustment: '',
        nextWeekTargets: '',
        bottleneck: '',
        temporalTarget: 5,
      });
      expect(review.revenue).toBe(0);
    });

    it('accepts a payload without revenue and stores 0', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.submitWeeklyReview({
        slipAnalysis: 'x',
        systemAdjustment: 'y',
        nextWeekTargets: 'z',
        bottleneck: 'b',
        temporalTarget: 5,
      });
      const reviews = tracker.getWeeklyReviews(1);
      expect(reviews[0].revenue ?? 0).toBe(0);
    });

    describe('partial update preserves prior fields (regression for Copilot PR-68 catch)', () => {
      // Inline Temporal target edits only send `{ temporalTarget }`. Before
      // the fix, omitted text fields were coerced to '' and overwrote the
      // user's saved review notes.
      it('partial { temporalTarget } preserves prior slipAnalysis/systemAdjustment/nextWeekTargets/bottleneck/revenue', async () => {
        const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
        await tracker.submitWeeklyReview({
          revenue: 7500,
          slipAnalysis: 'Skipped Mon mornings',
          systemAdjustment: 'Block 6-8am',
          nextWeekTargets: '4h deep work',
          bottleneck: 'Email triage',
          temporalTarget: 5,
        });

        await tracker.submitWeeklyReview({ temporalTarget: 8 });

        const reviews = tracker.getWeeklyReviews(1);
        expect(reviews[0].temporalTarget).toBe(8);
        expect(reviews[0].revenue).toBe(7500);
        expect(reviews[0].slipAnalysis).toBe('Skipped Mon mornings');
        expect(reviews[0].systemAdjustment).toBe('Block 6-8am');
        expect(reviews[0].nextWeekTargets).toBe('4h deep work');
        expect(reviews[0].bottleneck).toBe('Email triage');
      });

      it('partial update without prior review for the week stores defaults', async () => {
        const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
        await tracker.submitWeeklyReview({ temporalTarget: 10 });
        const reviews = tracker.getWeeklyReviews(1);
        expect(reviews[0].temporalTarget).toBe(10);
        expect(reviews[0].revenue).toBe(0);
        expect(reviews[0].slipAnalysis).toBe('');
        expect(reviews[0].systemAdjustment).toBe('');
        expect(reviews[0].nextWeekTargets).toBe('');
        expect(reviews[0].bottleneck).toBe('');
      });

      it('explicit empty string clears a field intentionally (not treated as omitted)', async () => {
        const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
        await tracker.submitWeeklyReview({
          revenue: 1000,
          slipAnalysis: 'old slip',
          systemAdjustment: 'old adj',
          nextWeekTargets: 'old targets',
          bottleneck: 'old bottleneck',
          temporalTarget: 5,
        });

        await tracker.submitWeeklyReview({
          slipAnalysis: '',
          systemAdjustment: 'old adj',
          nextWeekTargets: 'old targets',
          bottleneck: 'old bottleneck',
          temporalTarget: 5,
        });

        const reviews = tracker.getWeeklyReviews(1);
        expect(reviews[0].slipAnalysis).toBe('');
        expect(reviews[0].systemAdjustment).toBe('old adj');
        expect(reviews[0].revenue).toBe(1000);
      });

      it('omitted temporalTarget preserves prior target instead of resetting to 5', async () => {
        const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
        await tracker.submitWeeklyReview({
          revenue: 0,
          slipAnalysis: '',
          systemAdjustment: '',
          nextWeekTargets: '',
          bottleneck: '',
          temporalTarget: 12,
        });

        await tracker.submitWeeklyReview({
          revenue: 2000,
          slipAnalysis: 'new slip',
        });

        const reviews = tracker.getWeeklyReviews(1);
        expect(reviews[0].temporalTarget).toBe(12);
        expect(reviews[0].revenue).toBe(2000);
        expect(reviews[0].slipAnalysis).toBe('new slip');
      });
    });
  });

  describe('getTodaysEntry', () => {
    it('returns null when no entry exists', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      expect(tracker.getTodaysEntry()).toBeNull();
    });

    it('returns entry when it exists', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.logDay(3, 2, true, TODAY);
      const entry = tracker.getTodaysEntry();
      expect(entry).not.toBeNull();
      expect(entry?.deepWorkHours).toBe(3);
    });
  });

  describe('getCurrentWeekSummary', () => {
    it('returns zeros when no data exists', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const summary = tracker.getCurrentWeekSummary();

      expect(summary.daysTracked).toBe(0);
      expect(summary.deepWorkTotal).toBe(0);
      expect(summary.pipelineTotal).toBe(0);
      expect(summary.consistencyScore).toBe(0);
      expect(summary.zeroDays).toBe(0);
      expect(summary.goodDays).toBe(0);
      expect(summary.revenue).toBe(0);
    });

    it('computes correct totals from multiple days', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const mon = weekDay(0);
      const tue = weekDay(1);
      const wed = weekDay(2);

      await tracker.logDay(4, 3, true, mon);   // good day
      await tracker.logDay(2, 0, false, tue);   // zero day (pipeline=0)
      await tracker.logDay(3, 2, true, wed);    // good day

      const summary = tracker.getCurrentWeekSummary();
      expect(summary.daysTracked).toBe(3);
      expect(summary.deepWorkTotal).toBe(9);
      expect(summary.pipelineTotal).toBe(5);
      expect(summary.goodDays).toBe(2);
      expect(summary.zeroDays).toBe(1);
    });

    it('computes consistency score correctly', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const mon = weekDay(0);
      const tue = weekDay(1);
      const wed = weekDay(2);
      const thu = weekDay(3);

      await tracker.logDay(4, 3, true, mon);    // consistent (DW >= 3 AND trained)
      await tracker.logDay(2, 2, true, tue);     // not consistent (DW < 3)
      await tracker.logDay(3, 0, true, wed);     // consistent (DW >= 3 AND trained)
      await tracker.logDay(5, 3, false, thu);    // not consistent (not trained)

      const summary = tracker.getCurrentWeekSummary();
      // 2 consistent days out of 4 = 50%
      expect(summary.consistencyScore).toBe(50);
    });

    it('consistency is 0 when no days tracked', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const summary = tracker.getCurrentWeekSummary();
      expect(summary.consistencyScore).toBe(0);
    });

    it('includes revenue from weekly review', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.logDay(3, 2, true, weekDay(0));

      const summary1 = tracker.getCurrentWeekSummary();
      expect(summary1.revenue).toBe(0);

      await tracker.submitWeeklyReview({
        revenue: 7500,
        slipAnalysis: '',
        systemAdjustment: '',
        nextWeekTargets: '',
        bottleneck: '',
        temporalTarget: 5,
      });

      const summary2 = tracker.getCurrentWeekSummary();
      expect(summary2.revenue).toBe(7500);
    });
  });

  describe('getDayFlags (static)', () => {
    it('identifies zero day (deepWork=0)', () => {
      const flags = WeeklyTracker.getDayFlags({
        date: TODAY, deepWorkHours: 0, pipelineActions: 3, trained: true, timestamp: '',
      });
      expect(flags.isZeroDay).toBe(true);
      expect(flags.isGoodDay).toBe(false);
    });

    it('identifies zero day (pipeline=0)', () => {
      const flags = WeeklyTracker.getDayFlags({
        date: TODAY, deepWorkHours: 4, pipelineActions: 0, trained: true, timestamp: '',
      });
      expect(flags.isZeroDay).toBe(true);
      expect(flags.isGoodDay).toBe(false);
    });

    it('identifies good day', () => {
      const flags = WeeklyTracker.getDayFlags({
        date: TODAY, deepWorkHours: 3, pipelineActions: 2, trained: true, timestamp: '',
      });
      expect(flags.isZeroDay).toBe(false);
      expect(flags.isGoodDay).toBe(true);
    });

    it('partial day is neither zero nor good', () => {
      const flags = WeeklyTracker.getDayFlags({
        date: TODAY, deepWorkHours: 2, pipelineActions: 1, trained: false, timestamp: '',
      });
      expect(flags.isZeroDay).toBe(false);
      expect(flags.isGoodDay).toBe(false);
    });
  });

  describe('getDailyTrend', () => {
    it('returns correct number of days', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const trend = tracker.getDailyTrend(7);
      expect(trend.length).toBe(7);
    });

    it('fills empty days with isEmpty=true', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const trend = tracker.getDailyTrend(7);
      trend.forEach(day => {
        expect(day.isEmpty).toBe(true);
        expect(day.deepWorkHours).toBe(0);
        expect(day.pipelineActions).toBe(0);
        expect(day.trained).toBe(false);
      });
    });

    it('includes logged data with isEmpty=false', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.logDay(3, 2, true, TODAY);

      const trend = tracker.getDailyTrend(7);
      const todayEntry = trend.find(d => d.date === TODAY);
      expect(todayEntry?.isEmpty).toBe(false);
      expect(todayEntry?.deepWorkHours).toBe(3);
    });
  });

  describe('getWeeklyReviews', () => {
    it('returns reviews in reverse chronological order', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      // Use different weekStartDate values so upsert doesn't collapse them
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: 'first', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-23', weekEndDate: '2026-03-29' });
      await tracker.submitWeeklyReview({ revenue: 2000, slipAnalysis: 'second', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-30', weekEndDate: '2026-04-05' });

      const reviews = tracker.getWeeklyReviews(5);
      expect(reviews.length).toBe(2);
      expect(reviews[0].revenue).toBe(2000);
      expect(reviews[1].revenue).toBe(1000);
    });

    it('upserts review for the same week', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: 'first', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });
      await tracker.submitWeeklyReview({ revenue: 2000, slipAnalysis: 'updated', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });

      const reviews = tracker.getWeeklyReviews(5);
      expect(reviews.length).toBe(1);
      expect(reviews[0].revenue).toBe(2000);
      expect(reviews[0].slipAnalysis).toBe('updated');
    });

    it('respects limit', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-16', weekEndDate: '2026-03-22' });
      await tracker.submitWeeklyReview({ revenue: 2000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-23', weekEndDate: '2026-03-29' });
      await tracker.submitWeeklyReview({ revenue: 3000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-30', weekEndDate: '2026-04-05' });

      const reviews = tracker.getWeeklyReviews(2);
      expect(reviews.length).toBe(2);
    });
  });

  describe('getLatestReview', () => {
    it('returns null when no reviews exist', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      expect(tracker.getLatestReview()).toBeNull();
    });

    it('returns the most recent review', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });
      await tracker.submitWeeklyReview({ revenue: 5000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });

      const latest = tracker.getLatestReview();
      expect(latest?.revenue).toBe(5000);
    });
  });

  describe('week entries alignment', () => {
    it('returns 7-element array with nulls for missing days', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      // Log only Monday (offset 0)
      await tracker.logDay(3, 2, true, weekDay(0));

      const summary = tracker.getCurrentWeekSummary();
      expect(summary.dailyEntries).toHaveLength(7);
      expect(summary.dailyEntries[0]).not.toBeNull();
      expect(summary.dailyEntries[0]?.date).toBe(weekDay(0));
      for (let i = 1; i < 7; i++) {
        expect(summary.dailyEntries[i]).toBeNull();
      }
    });

    it('places sparse entries at correct day positions', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      // Log Monday (0) and Wednesday (2) only
      await tracker.logDay(3, 2, true, weekDay(0));
      await tracker.logDay(4, 3, false, weekDay(2));

      const summary = tracker.getCurrentWeekSummary();
      expect(summary.dailyEntries[0]?.deepWorkHours).toBe(3);  // Monday
      expect(summary.dailyEntries[1]).toBeNull();                // Tuesday empty
      expect(summary.dailyEntries[2]?.deepWorkHours).toBe(4);  // Wednesday
      expect(summary.dailyEntries[3]).toBeNull();                // Thursday empty
    });

    it('preserves existing day entries when logging a new day', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.logDay(3, 2, true, weekDay(0));
      await tracker.logDay(4, 1, false, weekDay(2));

      const summary = tracker.getCurrentWeekSummary();
      expect(summary.daysTracked).toBe(2);
      expect(summary.dailyEntries[0]?.deepWorkHours).toBe(3);
      expect(summary.dailyEntries[2]?.deepWorkHours).toBe(4);
    });

    it('correctly aggregates only non-null entries', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.logDay(3, 2, true, weekDay(0));
      await tracker.logDay(5, 4, true, weekDay(3));

      const summary = tracker.getCurrentWeekSummary();
      expect(summary.daysTracked).toBe(2);
      expect(summary.deepWorkTotal).toBe(8);
      expect(summary.pipelineTotal).toBe(6);
      expect(summary.goodDays).toBe(2);
      expect(summary.zeroDays).toBe(0);
    });
  });

  describe('temporalTarget', () => {
    it('includes temporalTarget in weekly review', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const review = await tracker.submitWeeklyReview({
        revenue: 1000, slipAnalysis: '', systemAdjustment: '',
        nextWeekTargets: '', bottleneck: '', temporalTarget: 8,
      });
      expect(review.temporalTarget).toBe(8);
    });

    it('defaults temporalTarget to 5 when not provided', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const review = await tracker.submitWeeklyReview({
        revenue: 1000, slipAnalysis: '', systemAdjustment: '',
        nextWeekTargets: '', bottleneck: '',
      });
      expect(review.temporalTarget).toBe(5);
    });

    it('surfaces temporalTarget in week summary', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.submitWeeklyReview({
        revenue: 1000, slipAnalysis: '', systemAdjustment: '',
        nextWeekTargets: '', bottleneck: '', temporalTarget: 10,
      });
      const summary = tracker.getCurrentWeekSummary();
      expect(summary.temporalTarget).toBe(10);
    });

    it('defaults summary temporalTarget to 5 with no review', async () => {
      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const summary = tracker.getCurrentWeekSummary();
      expect(summary.temporalTarget).toBe(5);
    });
  });

  describe('data persistence', () => {
    it('should load existing data on create', async () => {
      const existingData = {
        dailyEntries: {
          [TODAY]: {
            date: TODAY,
            deepWorkHours: 4,
            pipelineActions: 3,
            trained: true,
            timestamp: new Date().toISOString(),
          }
        },
        weeklyReviews: [],
        lastUpdated: new Date().toISOString(),
      };

      storage.loadJSON.mockResolvedValueOnce(existingData);

      const tracker = await WeeklyTracker.create(UNIT_TEST_OWNER_ID);
      const entry = tracker.getTodaysEntry();
      expect(entry?.deepWorkHours).toBe(4);
      expect(entry?.pipelineActions).toBe(3);
    });
  });
});
