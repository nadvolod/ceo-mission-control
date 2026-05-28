import { startOfWeek, endOfWeek, subWeeks, format, subDays, addDays } from 'date-fns';
import type { PerformanceDayEntry, WeeklyReview, WeeklySummary, WeeklyTrackerData } from './types';
import { loadJSON, saveJSON, appendAuditLog } from './storage';

const STORAGE_KEY = 'weekly-tracker.json';

function defaultData(): WeeklyTrackerData {
  return { dailyEntries: {}, weeklyReviews: [], lastUpdated: new Date().toISOString() };
}

export class WeeklyTracker {
  private data: WeeklyTrackerData = defaultData();
  private readonly ownerId: string;

  private constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  static async create(ownerId: string): Promise<WeeklyTracker> {
    const tracker = new WeeklyTracker(ownerId);
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    this.data = await loadJSON(this.ownerId, STORAGE_KEY, defaultData());
    // Backfill temporalTarget for reviews created before this field existed
    for (const review of this.data.weeklyReviews) {
      if (typeof review.temporalTarget !== 'number') {
        review.temporalTarget = 5;
      }
    }
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(this.ownerId, STORAGE_KEY, this.data);
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
      this.ownerId,
      entryDate,
      'weekly-tracker',
      `Logged day: ${deepWorkHours}h deep work, ${pipelineActions} pipeline, trained=${trained}` +
        (flags.isZeroDay ? ' [ZERO DAY]' : '') +
        (flags.isGoodDay ? ' [GOOD DAY]' : '')
    );

    console.log('Weekly tracker day logged:', { date: entryDate, deepWorkHours, pipelineActions, trained, ...flags });

    return entry;
  }

  // Adds (does not overwrite) to a day's running totals. Deep work hours and
  // pipeline counts accumulate; trained latches true once set.
  async addToDay(
    deepWorkDelta: number,
    pipelineDelta: number,
    setTrained: boolean,
    date?: string,
  ): Promise<PerformanceDayEntry> {
    if (typeof deepWorkDelta !== 'number' || !isFinite(deepWorkDelta) || deepWorkDelta < 0) {
      throw new Error('deepWorkDelta must be a non-negative number');
    }
    if (typeof pipelineDelta !== 'number' || !isFinite(pipelineDelta) || pipelineDelta < 0 || !Number.isInteger(pipelineDelta)) {
      throw new Error('pipelineDelta must be a non-negative integer');
    }
    if (typeof setTrained !== 'boolean') {
      throw new Error('setTrained must be a boolean');
    }

    const entryDate = date || format(new Date(), 'yyyy-MM-dd');
    const existing = this.data.dailyEntries[entryDate];
    const now = new Date().toISOString();

    const nextDeepWork = Math.min(8, (existing?.deepWorkHours ?? 0) + deepWorkDelta);
    const nextPipeline = (existing?.pipelineActions ?? 0) + pipelineDelta;
    const nextTrained = setTrained ? true : (existing?.trained ?? false);

    const entry: PerformanceDayEntry = {
      date: entryDate,
      deepWorkHours: Math.round(nextDeepWork * 100) / 100,
      pipelineActions: nextPipeline,
      trained: nextTrained,
      timestamp: now,
    };

    this.data.dailyEntries[entryDate] = entry;
    await this.saveData();

    await appendAuditLog(
      this.ownerId,
      entryDate,
      'weekly-tracker',
      `Incremented day: +${deepWorkDelta}h deep work (→${entry.deepWorkHours}h), ` +
        `+${pipelineDelta} pipeline (→${entry.pipelineActions}), ` +
        `trained=${entry.trained}`,
    );
    console.log('Weekly tracker day incremented:', {
      date: entryDate,
      deepWorkDelta,
      pipelineDelta,
      setTrained,
      nextEntry: entry,
    });

    return entry;
  }

  async submitWeeklyReview(review: {
    slipAnalysis?: string;
    systemAdjustment?: string;
    nextWeekTargets?: string;
    bottleneck?: string;
    temporalTarget?: number;
    revenue?: number;
    weekStartDate?: string;
    weekEndDate?: string;
  }): Promise<WeeklyReview> {
    if (review.revenue !== undefined && (typeof review.revenue !== 'number' || !isFinite(review.revenue) || review.revenue < 0)) {
      throw new Error('revenue must be a non-negative number');
    }

    const now = new Date();
    const weekStart = review.weekStartDate || format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const weekEnd = review.weekEndDate || format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    // Partial-update support: when a caller omits a field, preserve the prior
    // value stored for this week. Without this, inline target edits would wipe
    // the user's saved review notes (slipAnalysis/systemAdjustment/etc.) with
    // empty strings. `??` (not `||`) so an explicit '' from the caller still
    // clears a field intentionally.
    const existingForWeek = this.data.weeklyReviews.find(r => r.weekStartDate === weekStart);
    const revenue = review.revenue ?? existingForWeek?.revenue ?? 0;
    const temporalTargetValid =
      typeof review.temporalTarget === 'number' && isFinite(review.temporalTarget) && review.temporalTarget >= 0;
    const temporalTarget = temporalTargetValid
      ? (review.temporalTarget as number)
      : existingForWeek?.temporalTarget ?? 5;

    const fullReview: WeeklyReview = {
      id: `review_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      revenue,
      slipAnalysis: review.slipAnalysis ?? existingForWeek?.slipAnalysis ?? '',
      systemAdjustment: review.systemAdjustment ?? existingForWeek?.systemAdjustment ?? '',
      nextWeekTargets: review.nextWeekTargets ?? existingForWeek?.nextWeekTargets ?? '',
      bottleneck: review.bottleneck ?? existingForWeek?.bottleneck ?? '',
      temporalTarget,
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
      this.ownerId,
      weekStart,
      'weekly-tracker',
      `Weekly review submitted: $${revenue} revenue, bottleneck: ${review.bottleneck || 'none'}`
    );

    console.log('Weekly review submitted:', { weekStart, weekEnd, revenue });

    return fullReview;
  }

  /** Delete the daily entry for a specific YYYY-MM-DD. Returns true if it existed. */
  async deleteDailyEntry(date: string): Promise<boolean> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('date must be a valid YYYY-MM-DD string');
    }
    if (!this.data.dailyEntries[date]) return false;
    delete this.data.dailyEntries[date];
    await this.saveData();
    await appendAuditLog(
      this.ownerId,
      date,
      'weekly-tracker',
      `Daily entry deleted for ${date}`,
    );
    return true;
  }

  /** Delete a weekly review by id. Returns true if it existed. */
  async deleteWeeklyReview(id: string): Promise<boolean> {
    const matched = this.data.weeklyReviews.find((r) => r.id === id);
    if (!matched) return false;
    this.data.weeklyReviews = this.data.weeklyReviews.filter((r) => r.id !== id);
    await this.saveData();
    // Audit-log under the week the review covered, not today — preserves
    // forensic locality when reviewing the trail months later.
    await appendAuditLog(
      this.ownerId,
      matched.weekStartDate,
      'weekly-tracker',
      `Weekly review deleted: ${id} (week of ${matched.weekStartDate})`,
    );
    return true;
  }

  getTodaysEntry(): PerformanceDayEntry | null {
    const today = format(new Date(), 'yyyy-MM-dd');
    return this.data.dailyEntries[today] || null;
  }

  getCurrentWeekEntries(): (PerformanceDayEntry | null)[] {
    return this.getWeekEntries(new Date());
  }

  private getWeekEntries(dateInWeek: Date): (PerformanceDayEntry | null)[] {
    const weekStart = startOfWeek(dateInWeek, { weekStartsOn: 0 });
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
    const weekStart = startOfWeek(dateInWeek, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(dateInWeek, { weekStartsOn: 0 });
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

  async applyGarminTraining(date: string, activeMinutes: number, threshold: number = 30): Promise<boolean> {
    const entry = this.data.dailyEntries[date];
    if (!entry) return false;

    const autoTrained = activeMinutes >= threshold;
    if (autoTrained) {
      entry.trained = true;
    }
    entry.timestamp = new Date().toISOString();
    await this.saveData();

    await appendAuditLog(this.ownerId, date, 'weekly-tracker', `Auto-training from Garmin: ${activeMinutes} active min (threshold: ${threshold}) → trained=${autoTrained}`);
    return autoTrained;
  }

  getAllData(): WeeklyTrackerData {
    return this.data;
  }
}
