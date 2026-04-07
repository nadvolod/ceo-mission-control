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

import { WeeklyTracker } from './weekly-tracker';
import { format, startOfWeek, addDays } from 'date-fns';

// Use local date (consistent with date-fns format) — not UTC toISOString
const TODAY = format(new Date(), 'yyyy-MM-dd');

// Helper: get a date string for a specific day of the current week (0=Mon)
function weekDay(offset: number): string {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(addDays(weekStart, offset), 'yyyy-MM-dd');
}

describe('WeeklyTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  describe('logDay', () => {
    it('should create a daily entry and save', async () => {
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
      await tracker.logDay(2, 1, false, TODAY);
      await tracker.logDay(4, 3, true, TODAY);

      const entry = tracker.getTodaysEntry();
      expect(entry?.deepWorkHours).toBe(4);
      expect(entry?.pipelineActions).toBe(3);
      expect(entry?.trained).toBe(true);
    });

    it('should default to today if no date provided', async () => {
      const tracker = await WeeklyTracker.create();
      const entry = await tracker.logDay(3, 2, true);
      expect(entry.date).toBe(TODAY);
    });

    it('should reject deepWorkHours > 8', async () => {
      const tracker = await WeeklyTracker.create();
      await expect(tracker.logDay(9, 2, true)).rejects.toThrow('deepWorkHours must be a number between 0 and 8');
    });

    it('should reject deepWorkHours < 0', async () => {
      const tracker = await WeeklyTracker.create();
      await expect(tracker.logDay(-1, 2, true)).rejects.toThrow('deepWorkHours must be a number between 0 and 8');
    });

    it('should reject NaN deepWorkHours', async () => {
      const tracker = await WeeklyTracker.create();
      await expect(tracker.logDay(NaN, 2, true)).rejects.toThrow('deepWorkHours must be a number between 0 and 8');
    });

    it('should allow deepWorkHours = 0', async () => {
      const tracker = await WeeklyTracker.create();
      const entry = await tracker.logDay(0, 2, true, TODAY);
      expect(entry.deepWorkHours).toBe(0);
    });

    it('should reject non-integer pipelineActions', async () => {
      const tracker = await WeeklyTracker.create();
      await expect(tracker.logDay(3, 2.5, true)).rejects.toThrow('pipelineActions must be a non-negative integer');
    });

    it('should reject negative pipelineActions', async () => {
      const tracker = await WeeklyTracker.create();
      await expect(tracker.logDay(3, -1, true)).rejects.toThrow('pipelineActions must be a non-negative integer');
    });

    it('should reject non-boolean trained', async () => {
      const tracker = await WeeklyTracker.create();
      await expect(tracker.logDay(3, 2, 'yes' as unknown as boolean)).rejects.toThrow('trained must be a boolean');
    });
  });

  describe('submitWeeklyReview', () => {
    it('should save a review with generated ID', async () => {
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
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
  });

  describe('getTodaysEntry', () => {
    it('returns null when no entry exists', async () => {
      const tracker = await WeeklyTracker.create();
      expect(tracker.getTodaysEntry()).toBeNull();
    });

    it('returns entry when it exists', async () => {
      const tracker = await WeeklyTracker.create();
      await tracker.logDay(3, 2, true, TODAY);
      const entry = tracker.getTodaysEntry();
      expect(entry).not.toBeNull();
      expect(entry?.deepWorkHours).toBe(3);
    });
  });

  describe('getCurrentWeekSummary', () => {
    it('returns zeros when no data exists', async () => {
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
      const summary = tracker.getCurrentWeekSummary();
      expect(summary.consistencyScore).toBe(0);
    });

    it('includes revenue from weekly review', async () => {
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
      const trend = tracker.getDailyTrend(7);
      expect(trend.length).toBe(7);
    });

    it('fills empty days with isEmpty=true', async () => {
      const tracker = await WeeklyTracker.create();
      const trend = tracker.getDailyTrend(7);
      trend.forEach(day => {
        expect(day.isEmpty).toBe(true);
        expect(day.deepWorkHours).toBe(0);
        expect(day.pipelineActions).toBe(0);
        expect(day.trained).toBe(false);
      });
    });

    it('includes logged data with isEmpty=false', async () => {
      const tracker = await WeeklyTracker.create();
      await tracker.logDay(3, 2, true, TODAY);

      const trend = tracker.getDailyTrend(7);
      const todayEntry = trend.find(d => d.date === TODAY);
      expect(todayEntry?.isEmpty).toBe(false);
      expect(todayEntry?.deepWorkHours).toBe(3);
    });
  });

  describe('getWeeklyReviews', () => {
    it('returns reviews in reverse chronological order', async () => {
      const tracker = await WeeklyTracker.create();
      // Use different weekStartDate values so upsert doesn't collapse them
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: 'first', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-23', weekEndDate: '2026-03-29' });
      await tracker.submitWeeklyReview({ revenue: 2000, slipAnalysis: 'second', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-30', weekEndDate: '2026-04-05' });

      const reviews = tracker.getWeeklyReviews(5);
      expect(reviews.length).toBe(2);
      expect(reviews[0].revenue).toBe(2000);
      expect(reviews[1].revenue).toBe(1000);
    });

    it('upserts review for the same week', async () => {
      const tracker = await WeeklyTracker.create();
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: 'first', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });
      await tracker.submitWeeklyReview({ revenue: 2000, slipAnalysis: 'updated', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });

      const reviews = tracker.getWeeklyReviews(5);
      expect(reviews.length).toBe(1);
      expect(reviews[0].revenue).toBe(2000);
      expect(reviews[0].slipAnalysis).toBe('updated');
    });

    it('respects limit', async () => {
      const tracker = await WeeklyTracker.create();
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-16', weekEndDate: '2026-03-22' });
      await tracker.submitWeeklyReview({ revenue: 2000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-23', weekEndDate: '2026-03-29' });
      await tracker.submitWeeklyReview({ revenue: 3000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5, weekStartDate: '2026-03-30', weekEndDate: '2026-04-05' });

      const reviews = tracker.getWeeklyReviews(2);
      expect(reviews.length).toBe(2);
    });
  });

  describe('getLatestReview', () => {
    it('returns null when no reviews exist', async () => {
      const tracker = await WeeklyTracker.create();
      expect(tracker.getLatestReview()).toBeNull();
    });

    it('returns the most recent review', async () => {
      const tracker = await WeeklyTracker.create();
      await tracker.submitWeeklyReview({ revenue: 1000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });
      await tracker.submitWeeklyReview({ revenue: 5000, slipAnalysis: '', systemAdjustment: '', nextWeekTargets: '', bottleneck: '', temporalTarget: 5 });

      const latest = tracker.getLatestReview();
      expect(latest?.revenue).toBe(5000);
    });
  });

  describe('week entries alignment', () => {
    it('returns 7-element array with nulls for missing days', async () => {
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
      await tracker.logDay(3, 2, true, weekDay(0));
      await tracker.logDay(4, 1, false, weekDay(2));

      const summary = tracker.getCurrentWeekSummary();
      expect(summary.daysTracked).toBe(2);
      expect(summary.dailyEntries[0]?.deepWorkHours).toBe(3);
      expect(summary.dailyEntries[2]?.deepWorkHours).toBe(4);
    });

    it('correctly aggregates only non-null entries', async () => {
      const tracker = await WeeklyTracker.create();
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
      const tracker = await WeeklyTracker.create();
      const review = await tracker.submitWeeklyReview({
        revenue: 1000, slipAnalysis: '', systemAdjustment: '',
        nextWeekTargets: '', bottleneck: '', temporalTarget: 8,
      });
      expect(review.temporalTarget).toBe(8);
    });

    it('defaults temporalTarget to 5 when not provided', async () => {
      const tracker = await WeeklyTracker.create();
      const review = await tracker.submitWeeklyReview({
        revenue: 1000, slipAnalysis: '', systemAdjustment: '',
        nextWeekTargets: '', bottleneck: '', temporalTarget: undefined as unknown as number,
      });
      expect(review.temporalTarget).toBe(5);
    });

    it('surfaces temporalTarget in week summary', async () => {
      const tracker = await WeeklyTracker.create();
      await tracker.submitWeeklyReview({
        revenue: 1000, slipAnalysis: '', systemAdjustment: '',
        nextWeekTargets: '', bottleneck: '', temporalTarget: 10,
      });
      const summary = tracker.getCurrentWeekSummary();
      expect(summary.temporalTarget).toBe(10);
    });

    it('defaults summary temporalTarget to 5 with no review', async () => {
      const tracker = await WeeklyTracker.create();
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

      const tracker = await WeeklyTracker.create();
      const entry = tracker.getTodaysEntry();
      expect(entry?.deepWorkHours).toBe(4);
      expect(entry?.pipelineActions).toBe(3);
    });
  });
});
