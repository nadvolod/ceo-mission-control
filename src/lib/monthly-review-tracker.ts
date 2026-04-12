import type { MonthlyReview, MonthlyReviewData, MonthlyReviewRatings } from './types';
import { loadJSON, saveJSON, appendAuditLog } from './storage';

const STORAGE_KEY = 'monthly-review.json';

const RATING_KEYS: (keyof MonthlyReviewRatings)[] = [
  'discipline', 'focus', 'executive', 'math', 'nutrition', 'fitness', 'sleep',
];

const VALID_DECISION_SOURCES = ['discipline', 'emotion', 'mixed'] as const;

function defaultData(): MonthlyReviewData {
  return { reviews: [], lastUpdated: new Date().toISOString() };
}

export class MonthlyReviewTracker {
  private data: MonthlyReviewData = defaultData();

  private constructor() {}

  static async create(): Promise<MonthlyReviewTracker> {
    const tracker = new MonthlyReviewTracker();
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    this.data = await loadJSON(STORAGE_KEY, defaultData());
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(STORAGE_KEY, this.data);
  }

  async submitReview(
    input: Omit<MonthlyReview, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MonthlyReview> {
    // Validate month format
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) {
      throw new Error('month must be a valid YYYY-MM string');
    }

    // Validate numeric fields
    if (typeof input.hoursWorked !== 'number' || !isFinite(input.hoursWorked) || input.hoursWorked < 0) {
      throw new Error('hoursWorked must be a non-negative number');
    }
    if (typeof input.temporalHours !== 'number' || !isFinite(input.temporalHours) || input.temporalHours < 0) {
      throw new Error('temporalHours must be a non-negative number');
    }

    // Validate decisionSource
    if (!VALID_DECISION_SOURCES.includes(input.decisionSource as typeof VALID_DECISION_SOURCES[number])) {
      throw new Error('decisionSource must be one of: discipline, emotion, mixed');
    }

    // Validate ratings
    for (const key of RATING_KEYS) {
      const val = input.ratings[key];
      if (typeof val !== 'number' || !isFinite(val) || val < 1 || val > 10 || !Number.isInteger(val)) {
        throw new Error(`${key} rating must be between 1 and 10`);
      }
    }

    const now = new Date().toISOString();
    const existingIdx = this.data.reviews.findIndex(r => r.month === input.month);

    const review: MonthlyReview = {
      id: existingIdx >= 0
        ? this.data.reviews[existingIdx].id
        : `review_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      ...input,
      createdAt: existingIdx >= 0 ? this.data.reviews[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      this.data.reviews[existingIdx] = review;
    } else {
      this.data.reviews.push(review);
    }

    await this.saveData();

    await appendAuditLog(
      input.date,
      'monthly-review',
      `Monthly review submitted for ${input.month}: ${input.hoursWorked}h worked, ` +
        `${input.temporalHours}h Temporal, discipline=${input.ratings.discipline}/10`
    );

    console.log('Monthly review submitted:', { month: input.month, hoursWorked: input.hoursWorked });

    return review;
  }

  async deleteReview(month: string): Promise<boolean> {
    const idx = this.data.reviews.findIndex(r => r.month === month);
    if (idx < 0) return false;

    this.data.reviews.splice(idx, 1);
    await this.saveData();

    await appendAuditLog(
      new Date().toISOString().split('T')[0],
      'monthly-review',
      `Monthly review deleted for ${month}`
    );

    return true;
  }

  getReviewByMonth(month: string): MonthlyReview | null {
    return this.data.reviews.find(r => r.month === month) ?? null;
  }

  getRecentReviews(limit: number = 6): MonthlyReview[] {
    return [...this.data.reviews]
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, limit);
  }

  getCurrentMonthReview(): MonthlyReview | null {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getReviewByMonth(currentMonth);
  }

  getRatingsTrend(): Array<MonthlyReviewRatings & { month: string }> {
    return [...this.data.reviews]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({ month: r.month, ...r.ratings }));
  }

  getAllData(): MonthlyReviewData {
    return this.data;
  }
}
