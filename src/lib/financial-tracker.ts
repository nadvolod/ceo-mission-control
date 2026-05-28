import { addDays, format, startOfWeek } from 'date-fns';
import { loadJSON, saveJSON } from './storage';
import { localDate } from './dates';

export class FinancialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialValidationError';
  }
}

export interface FinancialEntry {
  id: string;
  amount: number;
  description: string;
  timestamp: string;
  category: 'moved' | 'generated' | 'cut';
}

export interface DailyFinancialMetrics {
  date: string;
  entries: FinancialEntry[];
  totals: {
    moved: number;
    generated: number;
    cut: number;
    netImpact: number;
  };
}

export interface FinancialData {
  dailyMetrics: Record<string, DailyFinancialMetrics>;
  lastUpdated: string;
}

export class FinancialTracker {
  private data: FinancialData = {
    dailyMetrics: {},
    lastUpdated: new Date().toISOString()
  };
  private readonly ownerId: string;
  private static readonly DATE_VALIDATION_TIME_UTC = 'T12:00:00Z';

  private constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  static async create(ownerId: string): Promise<FinancialTracker> {
    const tracker = new FinancialTracker(ownerId);
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    const defaultData: FinancialData = { dailyMetrics: {}, lastUpdated: new Date().toISOString() };
    const loaded = await loadJSON(this.ownerId, 'financial-metrics.json', defaultData);
    this.data = this.normalizeLoadedData(loaded, defaultData);
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(this.ownerId, 'financial-metrics.json', this.data);
  }

  async addEntry(category: 'moved' | 'generated' | 'cut', amount: number, description: string, date?: string): Promise<FinancialEntry> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new FinancialValidationError(`Invalid amount: amount must be greater than 0 (received ${amount})`);
    }
    const trimmedDescription = (description ?? '').trim();
    if (trimmedDescription.length === 0) {
      throw new FinancialValidationError('Invalid description: description is required');
    }

    // Prefer the caller-provided date (the v2 client sends its local
    // YYYY-MM-DD); fall back to the server's local zone. UTC was the old
    // default and caused evening logs in EST to land on the next day.
    const entryDate = date || localDate();
    if (!this.isSafeDateKey(entryDate)) {
      throw new FinancialValidationError(`Invalid date: expected YYYY-MM-DD (received ${entryDate})`);
    }
    const timestamp = new Date().toISOString();

    const entry: FinancialEntry = {
      id: `${category}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      amount,
      description: trimmedDescription,
      timestamp,
      category
    };

    // Initialize daily metrics if not exists
    if (!this.data.dailyMetrics[entryDate]) {
      this.data.dailyMetrics[entryDate] = {
        date: entryDate,
        entries: [],
        totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 }
      };
    }
    this.ensureDayShape(entryDate);

    // Add entry
    this.data.dailyMetrics[entryDate].entries.push(entry);

    // Recalculate totals
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

    const moved = this.centSum(dayMetrics.entries.filter(e => e.category === 'moved').map(e => e.amount));
    const generated = this.centSum(dayMetrics.entries.filter(e => e.category === 'generated').map(e => e.amount));
    const cut = this.centSum(dayMetrics.entries.filter(e => e.category === 'cut').map(e => e.amount));
    // Net impact = money moved + revenue generated + expenses cut
    const netImpact = this.centSum([moved, generated, cut]);

    dayMetrics.totals = { moved, generated, cut, netImpact };
  }

  private normalizeLoadedData(data: unknown, fallback: FinancialData): FinancialData {
    if (!data || typeof data !== 'object') return fallback;

    const loaded = data as Partial<FinancialData>;
    const normalized: FinancialData = {
      dailyMetrics: Object.create(null) as Record<string, DailyFinancialMetrics>,
      lastUpdated: typeof loaded.lastUpdated === 'string' ? loaded.lastUpdated : fallback.lastUpdated,
    };

    if (loaded.dailyMetrics && typeof loaded.dailyMetrics === 'object') {
      for (const [date, dayMetrics] of Object.entries(loaded.dailyMetrics)) {
        if (!this.isSafeDateKey(date)) continue;
        normalized.dailyMetrics[date] = dayMetrics as DailyFinancialMetrics;
      }
    }

    Object.keys(normalized.dailyMetrics).forEach(date => this.ensureDayShape(date, normalized.dailyMetrics));
    return normalized;
  }

  private ensureDayShape(date: string, dailyMetrics = this.data.dailyMetrics): void {
    if (!this.isSafeDateKey(date)) return;
    const existing = dailyMetrics[date];
    if (!existing || typeof existing !== 'object') {
      dailyMetrics[date] = {
        date,
        entries: [],
        totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
      };
      return;
    }

    const withDefaults = existing as Partial<DailyFinancialMetrics>;
    if (!Array.isArray(withDefaults.entries)) {
      withDefaults.entries = [];
    }
    const totals = withDefaults.totals as Partial<DailyFinancialMetrics['totals']> | undefined;
    if (!totals || typeof totals !== 'object') {
      withDefaults.totals = { moved: 0, generated: 0, cut: 0, netImpact: 0 };
    } else {
      const toFiniteNumber = (value: unknown): number =>
        typeof value === 'number' && Number.isFinite(value) ? value : 0;
      withDefaults.totals = {
        moved: toFiniteNumber(totals.moved),
        generated: toFiniteNumber(totals.generated),
        cut: toFiniteNumber(totals.cut),
        netImpact: toFiniteNumber(totals.netImpact),
      };
    }
    withDefaults.date = withDefaults.date || date;
    dailyMetrics[date] = withDefaults as DailyFinancialMetrics;
  }

  private isSafeDateKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}${FinancialTracker.DATE_VALIDATION_TIME_UTC}`);
    if (!Number.isFinite(parsed.getTime())) return false;
    return parsed.toISOString().slice(0, 10) === value;
  }

  getTodaysMetrics(todayKey?: string): DailyFinancialMetrics {
    const today = todayKey || localDate();
    return this.data.dailyMetrics[today] || {
      date: today,
      entries: [],
      totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 }
    };
  }

  /**
   * Returns a length-7 array of DailyFinancialMetrics, one per day from
   * `weekStartDate` (Sunday, YYYY-MM-DD) through the following Saturday inclusive.
   * Days with no recorded entries return zero-filled placeholders.
   */
  getDailyMetricsForWeek(weekStartDate: string): DailyFinancialMetrics[] {
    const start = new Date(`${weekStartDate}T12:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = format(addDays(start, i), 'yyyy-MM-dd');
      return this.data.dailyMetrics[d] ?? {
        date: d,
        entries: [],
        totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
      };
    });
  }

  /**
   * Returns DailyFinancialMetrics for each day in [startDate, endDate] inclusive.
   * Days with no recorded entries return zero-filled placeholders.
   */
  getDailyMetricsForRange(startDate: string, endDate: string): DailyFinancialMetrics[] {
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days <= 0) return [];
    return Array.from({ length: days }, (_, i) => {
      const d = format(addDays(start, i), 'yyyy-MM-dd');
      return this.data.dailyMetrics[d] ?? {
        date: d,
        entries: [],
        totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
      };
    });
  }

  /**
   * Returns totals across the previous Sun-Sat week (relative to today).
   * Uses cent-based arithmetic via centSum for precision.
   */
  getPreviousWeekTotals(): { moved: number; generated: number; cut: number; netImpact: number } {
    const now = new Date();
    const prevWeekStart = addDays(startOfWeek(now, { weekStartsOn: 0 }), -7);
    const prevWeekStartStr = format(prevWeekStart, 'yyyy-MM-dd');
    const days = this.getDailyMetricsForWeek(prevWeekStartStr);
    return {
      moved: this.centSum(days.map(d => d.totals.moved)),
      generated: this.centSum(days.map(d => d.totals.generated)),
      cut: this.centSum(days.map(d => d.totals.cut)),
      netImpact: this.centSum(days.map(d => d.totals.netImpact)),
    };
  }

  getWeeklyTotals(): { moved: number; generated: number; cut: number; netImpact: number } {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return this.getTotalsForPeriod(weekAgo, now);
  }

  getMonthlyTotals(): { moved: number; generated: number; cut: number; netImpact: number } {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return this.getTotalsForPeriod(monthAgo, now);
  }

  private getTotalsForPeriod(startDate: Date, endDate: Date): { moved: number; generated: number; cut: number; netImpact: number } {
    const totals = { moved: 0, generated: 0, cut: 0, netImpact: 0 };

    Object.values(this.data.dailyMetrics).forEach(dayMetrics => {
      const metricDate = new Date(dayMetrics.date);
      if (metricDate >= startDate && metricDate <= endDate) {
        totals.moved += dayMetrics.totals.moved;
        totals.generated += dayMetrics.totals.generated;
        totals.cut += dayMetrics.totals.cut;
        totals.netImpact += dayMetrics.totals.netImpact;
      }
    });

    return totals;
  }

  // Process conversational input for financial updates
  async processConversationalUpdate(message: string): Promise<{ added: FinancialEntry[]; message: string }> {
    const added: FinancialEntry[] = [];

    // Pattern: "Moved $12K: description" or "moved $12,000: description"
    const movedPattern = /moved\s+\$(\d+(?:,\d{3})*(?:\.\d{2})?[kK]?|[\d.]+[kK])\s*:?\s*([^.\n]+)/gi;
    let match;
    
    while ((match = movedPattern.exec(message)) !== null) {
      const amount = this.parseAmount(match[1]);
      const description = match[2].trim();
      if (amount > 0) {
        added.push(await this.addEntry('moved', amount, description));
      }
    }

    // Pattern: "Generated $2K: description" or "new revenue $2000: description"
    const generatedPattern = /(?:generated|new revenue|revenue)\s+\$(\d+(?:,\d{3})*(?:\.\d{2})?[kK]?|[\d.]+[kK])\s*:?\s*([^.\n]+)/gi;
    while ((match = generatedPattern.exec(message)) !== null) {
      const amount = this.parseAmount(match[1]);
      const description = match[2].trim();
      if (amount > 0) {
        added.push(await this.addEntry('generated', amount, description));
      }
    }

    // Pattern: "Cut $850: description" or "saved $500: description"
    const cutPattern = /(?:cut|saved|reduced)\s+\$(\d+(?:,\d{3})*(?:\.\d{2})?[kK]?|[\d.]+[kK])\s*:?\s*([^.\n]+)/gi;
    while ((match = cutPattern.exec(message)) !== null) {
      const amount = this.parseAmount(match[1]);
      const description = match[2].trim();
      if (amount > 0) {
        added.push(await this.addEntry('cut', amount, description));
      }
    }

    const resultMessage = added.length > 0 
      ? `Added ${added.length} financial entries: ${added.map(e => `${e.category} $${e.amount.toLocaleString()}`).join(', ')}`
      : 'No financial metrics detected in message';

    return { added, message: resultMessage };
  }

  private parseAmount(amountStr: string): number {
    // Remove commas and handle K suffix
    const cleanAmount = amountStr.replace(/,/g, '').toLowerCase().trim();
    
    if (cleanAmount.endsWith('k')) {
      const numPart = cleanAmount.slice(0, -1);
      return parseFloat(numPart) * 1000;
    }
    
    return parseFloat(cleanAmount);
  }

  getAllData(): FinancialData {
    return this.data;
  }

  // Get recent entries for display
  getRecentEntries(limit: number = 10): FinancialEntry[] {
    const allEntries: FinancialEntry[] = [];
    
    Object.values(this.data.dailyMetrics).forEach(dayMetrics => {
      allEntries.push(...dayMetrics.entries);
    });

    return allEntries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}
