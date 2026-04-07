import { startOfWeek, endOfWeek, subWeeks, format, subDays, addDays } from 'date-fns';
import type { PerformanceDayEntry, WeeklyReview, WeeklySummary, WeeklyTrackerData } from './types';
import { loadJSON, saveJSON, appendAuditLog } from './storage';

const STORAGE_KEY = 'weekly-tracker.json';

function defaultData(): WeeklyTrackerData {
  return { dailyEntries: {}, weeklyReviews: [], lastUpdated: new Date().toISOString() };
}

export class WeeklyTracker {
  private data: WeeklyTrackerData = defaultData();

  private constructor() {}

  static async create(): Promise<WeeklyTracker> {
    const tracker = new WeeklyTracker();
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    this.data = await loadJSON(STORAGE_KEY, defaultData());
    // Backfill temporalTarget for reviews created before this field existed
    for (const review of this.data.weeklyReviews) {
      if (typeof review.temporalTarget !== 'number') {
        review.temporalTarget = 5;
      }
    }
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(STORAGE_KEY, this.data);
  }

  async logDay(
    deepWorkHours: number,
    pipelineActions: number,
    trained: boolean,
    date?: string
  ): Promise<PerformanceDayEntry> {
    if (typeof deepWorkHours !== 'number' || !isFinite(deepWorkHours) || deepWorkHours < 0 || deepWorkHours > 8) {
      throw new Error('deepWorkHours must be a number between 0 and 8');
    }
    if (typeof pipelineActions !== 'number' || !isFinite(pipelineActions) || pipelineActions < 0 || !Number.isInteger(pipelineActions)) {
      throw new Error('pipelineActions must be a non-negative integer');
    }
    if (typeof trained !== 'boolean') {
      throw new Error('trained must be a boolean');
    }

    const entryDate = date || format(new Date(), 'yyyy-MM-dd');
    const now = new Date().toISOString();

    const entry: PerformanceDayEntry = {
      date: entryDate,
      deepWorkHours,
      pipelineActions,
      trained,
      timestamp: now,
    };

    this.data.dailyEntries[entryDate] = entry;
    await this.saveData();

    const flags = WeeklyTracker.getDayFlags(entry);
    await appendAuditLog(
      entryDate,
      'weekly-tracker',
      `Logged day: ${deepWorkHours}h deep work, ${pipelineActions} pipeline, trained=${trained}` +
        (flags.isZeroDay ? ' [ZERO DAY]' : '') +
        (flags.isGoodDay ? ' [GOOD DAY]' : '')
    );

    console.log('Weekly tracker day logged:', { date: entryDate, deepWorkHours, pipelineActions, trained, ...flags });

    return entry;
  }

  async submitWeeklyReview(review: Omit<WeeklyReview, 'id' | 'createdAt' | 'weekStartDate' | 'weekEndDate' | 'temporalTarget'> & {
    weekStartDate?: string;
    weekEndDate?: string;
    temporalTarget?: number;
  }): Promise<WeeklyReview> {
    if (typeof review.revenue !== 'number' || !isFinite(review.revenue) || review.revenue < 0) {
      throw new Error('revenue must be a non-negative number');
    }

    const now = new Date();
    const weekStart = review.weekStartDate || format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = review.weekEndDate || format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const fullReview: WeeklyReview = {
      id: `review_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      revenue: review.revenue,
      slipAnalysis: review.slipAnalysis || '',
      systemAdjustment: review.systemAdjustment || '',
      nextWeekTargets: review.nextWeekTargets || '',
      bottleneck: review.bottleneck || '',
      temporalTarget: typeof review.temporalTarget === 'number' && isFinite(review.temporalTarget) && review.temporalTarget >= 0 ? review.temporalTarget : 5,
      createdAt: now.toISOString(),
    };

    const existingIdx = this.data.weeklyReviews.findIndex(r => r.weekStartDate === weekStart);
    if (existingIdx >= 0) {
      this.data.weeklyReviews[existingIdx] = fullReview;
    } else {
      this.data.weeklyReviews.push(fullReview);
    }
    await this.saveData();

    await appendAuditLog(
      weekStart,
      'weekly-tracker',
      `Weekly review submitted: $${review.revenue} revenue, bottleneck: ${review.bottleneck || 'none'}`
    );

    console.log('Weekly review submitted:', { weekStart, weekEnd, revenue: review.revenue });

    return fullReview;
  }

  getTodaysEntry(): PerformanceDayEntry | null {
    const today = format(new Date(), 'yyyy-MM-dd');
    return this.data.dailyEntries[today] || null;
  }

  getCurrentWeekEntries(): (PerformanceDayEntry | null)[] {
    return this.getWeekEntries(new Date());
  }

  private getWeekEntries(dateInWeek: Date): (PerformanceDayEntry | null)[] {
    const weekStart = startOfWeek(dateInWeek, { weekStartsOn: 1 });
    const entries: (PerformanceDayEntry | null)[] = [];

    for (let i = 0; i < 7; i++) {
      const date = format(addDays(weekStart, i), 'yyyy-MM-dd');
      entries.push(this.data.dailyEntries[date] || null);
    }

    return entries;
  }

  getCurrentWeekSummary(): WeeklySummary {
    return this.getWeekSummary(new Date());
  }

  getPreviousWeekSummary(): WeeklySummary {
    const prevWeek = subWeeks(new Date(), 1);
    return this.getWeekSummary(prevWeek);
  }

  getWeekSummary(dateInWeek: Date): WeeklySummary {
    const weekStart = startOfWeek(dateInWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(dateInWeek, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    const entries = this.getWeekEntries(dateInWeek);
    const filledEntries = entries.filter((e): e is PerformanceDayEntry => e !== null);
    const daysTracked = filledEntries.length;

    let pipelineTotal = 0;
    let deepWorkTotal = 0;
    let zeroDays = 0;
    let goodDays = 0;
    let consistentDays = 0;

    for (const entry of filledEntries) {
      pipelineTotal += entry.pipelineActions;
      deepWorkTotal += entry.deepWorkHours;

      const flags = WeeklyTracker.getDayFlags(entry);
      if (flags.isZeroDay) zeroDays++;
      if (flags.isGoodDay) goodDays++;
      if (entry.deepWorkHours >= 3 && entry.trained) consistentDays++;
    }

    const consistencyScore = daysTracked > 0
      ? Math.round((consistentDays / daysTracked) * 100)
      : 0;

    // Find matching weekly review for revenue
    const review = this.data.weeklyReviews.find(
      r => r.weekStartDate === weekStartStr
    );
    const revenue = review?.revenue ?? 0;
    const temporalTarget = review?.temporalTarget ?? 5;

    return {
      weekStartDate: weekStartStr,
      weekEndDate: weekEndStr,
      revenue,
      pipelineTotal,
      deepWorkTotal: Math.round(deepWorkTotal * 100) / 100,
      consistencyScore,
      daysTracked,
      zeroDays,
      goodDays,
      dailyEntries: entries,
      temporalTarget,
    };
  }

  getDailyTrend(days: number = 30): Array<PerformanceDayEntry & { isEmpty: boolean }> {
    const trend: Array<PerformanceDayEntry & { isEmpty: boolean }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(now, i), 'yyyy-MM-dd');
      const entry = this.data.dailyEntries[date];

      if (entry) {
        trend.push({ ...entry, isEmpty: false });
      } else {
        trend.push({
          date,
          deepWorkHours: 0,
          pipelineActions: 0,
          trained: false,
          timestamp: '',
          isEmpty: true,
        });
      }
    }

    return trend;
  }

  getWeeklyReviews(limit: number = 5): WeeklyReview[] {
    // Reverse to get most-recent-first (push order is chronological)
    return [...this.data.weeklyReviews].reverse().slice(0, limit);
  }

  getLatestReview(): WeeklyReview | null {
    const reviews = this.getWeeklyReviews(1);
    return reviews[0] || null;
  }

  static getDayFlags(entry: PerformanceDayEntry): { isZeroDay: boolean; isGoodDay: boolean } {
    const isZeroDay = entry.deepWorkHours === 0 || entry.pipelineActions === 0;
    const isGoodDay = entry.deepWorkHours >= 3 && entry.pipelineActions >= 2 && entry.trained;
    return { isZeroDay, isGoodDay };
  }

  getAllData(): WeeklyTrackerData {
    return this.data;
  }
}
