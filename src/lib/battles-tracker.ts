import { addDays, format } from 'date-fns';
import { loadJSON, saveJSON } from './storage';
import { localDate } from './dates';

export class BattlesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattlesValidationError';
  }
}

export interface BattleEntry {
  id: string;
  /** Short human description of the battle won (e.g. "Closed Acme renewal"). */
  name: string;
  /** Dollar value won in this battle. >= 0 (a win can be non-monetary). */
  value: number;
  timestamp: string;
}

export interface DailyBattleMetrics {
  date: string;
  entries: BattleEntry[];
  totals: {
    /** Number of battles won that day. */
    count: number;
    /** Sum of battle values won that day (dollars). */
    value: number;
  };
}

export interface BattlesData {
  dailyMetrics: Record<string, DailyBattleMetrics>;
  lastUpdated: string;
}

export interface BattleTotals {
  count: number;
  value: number;
}

/**
 * Tracks "battles won" — discrete wins logged daily, each carrying a name and a
 * dollar value. Mirrors FinancialTracker: per-day records in a single per-user
 * JSON blob (`battles.json`) so the full history is retained for all-time totals
 * and future trend charts.
 */
export class BattlesTracker {
  private data: BattlesData = {
    dailyMetrics: {},
    lastUpdated: new Date().toISOString(),
  };
  private readonly ownerId: string;
  private static readonly DATE_VALIDATION_TIME_UTC = 'T12:00:00Z';

  private constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  static async create(ownerId: string): Promise<BattlesTracker> {
    const tracker = new BattlesTracker(ownerId);
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    const defaultData: BattlesData = { dailyMetrics: {}, lastUpdated: new Date().toISOString() };
    const loaded = await loadJSON(this.ownerId, 'battles.json', defaultData);
    this.data = this.normalizeLoadedData(loaded, defaultData);
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(this.ownerId, 'battles.json', this.data);
  }

  async addBattle(name: string, value: number, date?: string): Promise<BattleEntry> {
    const trimmedName = (name ?? '').trim();
    if (trimmedName.length === 0) {
      throw new BattlesValidationError('Invalid battle: name is required');
    }
    if (!Number.isFinite(value) || value < 0) {
      throw new BattlesValidationError(`Invalid value: value must be a non-negative number (received ${value})`);
    }

    // Prefer the caller-provided local YYYY-MM-DD (the v2 client sends it) so
    // an evening log in EST doesn't land on tomorrow per UTC. Fall back to the
    // server's local zone.
    const entryDate = date || localDate();
    if (!this.isSafeDateKey(entryDate)) {
      throw new BattlesValidationError(`Invalid date: expected YYYY-MM-DD (received ${entryDate})`);
    }
    const timestamp = new Date().toISOString();

    const entry: BattleEntry = {
      id: `battle_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: trimmedName,
      value,
      timestamp,
    };

    this.ensureDayShape(entryDate);
    this.data.dailyMetrics[entryDate].entries.push(entry);
    this.recalculateTotals(entryDate);
    await this.saveData();

    return entry;
  }

  /** Sums monetary values via integer cents to avoid float drift (0.1 + 0.2 !== 0.3). */
  private centSum(values: number[]): number {
    const cents = values.reduce((acc, v) => acc + Math.round(v * 100), 0);
    return cents / 100;
  }

  private recalculateTotals(date: string): void {
    this.ensureDayShape(date);
    const dayMetrics = this.data.dailyMetrics[date];
    if (!dayMetrics) return;
    dayMetrics.totals = {
      count: dayMetrics.entries.length,
      value: this.centSum(dayMetrics.entries.map((e) => e.value)),
    };
  }

  private normalizeLoadedData(data: unknown, fallback: BattlesData): BattlesData {
    if (!data || typeof data !== 'object') return fallback;

    const loaded = data as Partial<BattlesData>;
    const normalized: BattlesData = {
      dailyMetrics: Object.create(null) as Record<string, DailyBattleMetrics>,
      lastUpdated: typeof loaded.lastUpdated === 'string' ? loaded.lastUpdated : fallback.lastUpdated,
    };

    if (loaded.dailyMetrics && typeof loaded.dailyMetrics === 'object') {
      for (const [date, dayMetrics] of Object.entries(loaded.dailyMetrics)) {
        if (!this.isSafeDateKey(date)) continue;
        normalized.dailyMetrics[date] = dayMetrics as DailyBattleMetrics;
      }
    }

    Object.keys(normalized.dailyMetrics).forEach((date) =>
      this.ensureDayShape(date, normalized.dailyMetrics),
    );
    return normalized;
  }

  private ensureDayShape(date: string, dailyMetrics = this.data.dailyMetrics): void {
    if (!this.isSafeDateKey(date)) return;
    const existing = dailyMetrics[date];
    if (!existing || typeof existing !== 'object') {
      dailyMetrics[date] = { date, entries: [], totals: { count: 0, value: 0 } };
      return;
    }

    const withDefaults = existing as Partial<DailyBattleMetrics>;
    if (!Array.isArray(withDefaults.entries)) {
      withDefaults.entries = [];
    }
    const totals = withDefaults.totals as Partial<DailyBattleMetrics['totals']> | undefined;
    const toFiniteNumber = (value: unknown): number =>
      typeof value === 'number' && Number.isFinite(value) ? value : 0;
    if (!totals || typeof totals !== 'object') {
      withDefaults.totals = {
        count: withDefaults.entries.length,
        value: 0,
      };
    } else {
      withDefaults.totals = {
        count: toFiniteNumber(totals.count),
        value: toFiniteNumber(totals.value),
      };
    }
    withDefaults.date = withDefaults.date || date;
    dailyMetrics[date] = withDefaults as DailyBattleMetrics;
  }

  private isSafeDateKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}${BattlesTracker.DATE_VALIDATION_TIME_UTC}`);
    if (!Number.isFinite(parsed.getTime())) return false;
    return parsed.toISOString().slice(0, 10) === value;
  }

  private anchorDate(todayKey?: string): Date {
    return todayKey ? new Date(`${todayKey}T12:00:00`) : new Date();
  }

  private emptyDay(date: string): DailyBattleMetrics {
    return { date, entries: [], totals: { count: 0, value: 0 } };
  }

  getTodaysMetrics(todayKey?: string): DailyBattleMetrics {
    const today = todayKey || localDate();
    return this.data.dailyMetrics[today] || this.emptyDay(today);
  }

  /** Totals over the trailing 7 days (relative to today/anchor), inclusive. */
  getWeeklyTotals(todayKey?: string): BattleTotals {
    const anchor = this.anchorDate(todayKey);
    const weekAgo = new Date(anchor.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.getTotalsForPeriod(weekAgo, anchor);
  }

  /** Cumulative totals across the entire recorded history. */
  getAllTimeTotals(): BattleTotals {
    const count = Object.values(this.data.dailyMetrics).reduce(
      (acc, d) => acc + (d.totals?.count ?? 0),
      0,
    );
    const value = this.centSum(
      Object.values(this.data.dailyMetrics).map((d) => d.totals?.value ?? 0),
    );
    return { count, value };
  }

  private getTotalsForPeriod(startDate: Date, endDate: Date): BattleTotals {
    const startKey = format(startDate, 'yyyy-MM-dd');
    const endKey = format(endDate, 'yyyy-MM-dd');
    let count = 0;
    const values: number[] = [];
    Object.values(this.data.dailyMetrics).forEach((dayMetrics) => {
      if (dayMetrics.date >= startKey && dayMetrics.date <= endKey) {
        count += dayMetrics.totals?.count ?? 0;
        values.push(dayMetrics.totals?.value ?? 0);
      }
    });
    return { count, value: this.centSum(values) };
  }

  /**
   * Returns DailyBattleMetrics for each day in [startDate, endDate] inclusive.
   * Days with no recorded battles return zero-filled placeholders.
   */
  getDailyMetricsForRange(startDate: string, endDate: string): DailyBattleMetrics[] {
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days <= 0) return [];
    return Array.from({ length: days }, (_, i) => {
      const d = format(addDays(start, i), 'yyyy-MM-dd');
      return this.data.dailyMetrics[d] ?? this.emptyDay(d);
    });
  }

  getAllData(): BattlesData {
    return this.data;
  }

  /** Most-recent battle entries across all days, newest first. */
  getRecentEntries(limit: number = 10): BattleEntry[] {
    const allEntries: BattleEntry[] = [];
    Object.values(this.data.dailyMetrics).forEach((dayMetrics) => {
      allEntries.push(...dayMetrics.entries);
    });
    return allEntries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}
