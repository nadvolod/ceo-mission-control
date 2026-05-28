import { startOfWeek, subWeeks, format, subDays } from 'date-fns';
import type { FocusCategory, FocusSession, DailyFocusMetrics, FocusData } from './types';
import { loadJSON, saveJSON } from './storage';
import { isLocalDateKey, localDate } from './dates';

const VALID_CATEGORIES: FocusCategory[] = [
  'Temporal', 'Finance', 'Revenue', 'Housing',
  'Tax', 'Personal', 'Health', 'Admin', 'Learning', 'Other'
];

const CATEGORY_KEYWORDS: Record<string, FocusCategory> = {
  'temporal': 'Temporal',
  'client': 'Temporal',
  'delivery': 'Temporal',
  'nexus': 'Temporal',
  'finance': 'Finance',
  'financial': 'Finance',
  'money': 'Finance',
  'heloc': 'Finance',
  'loan': 'Finance',
  'payment': 'Finance',
  'pennymac': 'Finance',
  'revenue': 'Revenue',
  'sales': 'Revenue',
  'artis': 'Revenue',
  'tricentis': 'Revenue',
  'contract': 'Revenue',
  'housing': 'Housing',
  'condo': 'Housing',
  'move': 'Housing',
  'alton': 'Housing',
  'miami': 'Housing',
  'tax': 'Tax',
  'taxes': 'Tax',
  'irs': 'Tax',
  'personal': 'Personal',
  'health': 'Health',
  'exercise': 'Health',
  'workout': 'Health',
  'admin': 'Admin',
  'administrative': 'Admin',
  'learning': 'Learning',
  'study': 'Learning',
  'course': 'Learning',
  'training': 'Learning',
};

export class FocusTracker {
  private data: FocusData = {
    dailyMetrics: {},
    lastUpdated: new Date().toISOString()
  };
  private readonly ownerId: string;

  private constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  static async create(ownerId: string): Promise<FocusTracker> {
    const tracker = new FocusTracker(ownerId);
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    const defaultData: FocusData = { dailyMetrics: {}, lastUpdated: new Date().toISOString() };
    this.data = await loadJSON(this.ownerId, 'focus-tracking.json', defaultData);
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(this.ownerId, 'focus-tracking.json', this.data);
  }

  async addSession(
    category: FocusCategory,
    hours: number,
    description: string,
    date?: string,
    source: 'manual' | 'conversational' | 'temporal-sync' = 'manual'
  ): Promise<FocusSession> {
    if (typeof hours !== 'number' || !isFinite(hours) || hours <= 0 || hours > 24) {
      throw new Error('Hours must be a number greater than 0 and at most 24');
    }

    if (!VALID_CATEGORIES.includes(category)) {
      console.warn(`Unknown focus category "${category}", defaulting to Other`);
      category = 'Other';
    }

    // Prefer the caller-provided date (the v2 client sends its local
    // YYYY-MM-DD); fall back to the server's local zone. UTC was the old
    // default and caused evening logs in EST to land on the next day.
    //
    // Validate before using as an object key — `dailyMetrics` is a plain
    // object so a malformed key like "__proto__" would mutate the
    // prototype chain. isLocalDateKey rejects anything that isn't a real
    // calendar date in YYYY-MM-DD form.
    const candidate = date ?? localDate();
    if (!isLocalDateKey(candidate)) {
      throw new Error(`Invalid date: expected YYYY-MM-DD (received ${candidate})`);
    }
    const sessionDate = candidate;
    const now = new Date().toISOString();

    const session: FocusSession = {
      id: `focus_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      category,
      hours,
      description: description || `${hours}h ${category} focus block`,
      date: sessionDate,
      timestamp: now,
      source
    };

    if (!this.data.dailyMetrics[sessionDate]) {
      this.data.dailyMetrics[sessionDate] = {
        date: sessionDate,
        sessions: [],
        totalHours: 0,
        byCategory: {}
      };
    }

    this.data.dailyMetrics[sessionDate].sessions.push(session);
    this.recalculateDailyMetrics(sessionDate);
    await this.saveData();

    console.log('Focus session logged:', { category, hours, date: sessionDate, source });

    return session;
  }

  private recalculateDailyMetrics(date: string): void {
    const day = this.data.dailyMetrics[date];
    if (!day) return;

    const byCategory: Record<string, number> = {};
    let totalHours = 0;

    for (const session of day.sessions) {
      byCategory[session.category] = (byCategory[session.category] || 0) + session.hours;
      totalHours += session.hours;
    }

    day.totalHours = totalHours;
    day.byCategory = byCategory;
  }

  // `todayKey` is optional so callers (route handlers, tests) can pin
  // today to the user's local day. When omitted we fall back to the
  // server runtime's local zone — never UTC.
  getTodaysMetrics(todayKey?: string): DailyFocusMetrics {
    const today = todayKey || localDate();
    return this.data.dailyMetrics[today] || {
      date: today,
      sessions: [],
      totalHours: 0,
      byCategory: {}
    };
  }

  private anchorDate(todayKey?: string): Date {
    return todayKey ? new Date(`${todayKey}T12:00:00`) : new Date();
  }

  getWeeklyTotals(todayKey?: string): Record<string, number> {
    const anchor = this.anchorDate(todayKey);
    const weekStart = startOfWeek(anchor, { weekStartsOn: 0 }); // Sunday (US convention)
    return this.getTotalsForPeriod(weekStart, anchor);
  }

  getPreviousWeekTotals(todayKey?: string): Record<string, number> {
    const anchor = this.anchorDate(todayKey);
    const thisWeekStart = startOfWeek(anchor, { weekStartsOn: 0 });
    const prevWeekStart = subWeeks(thisWeekStart, 1);
    return this.getTotalsForPeriod(prevWeekStart, subDays(thisWeekStart, 1));
  }

  private getTotalsForPeriod(start: Date, end: Date): Record<string, number> {
    const totals: Record<string, number> = {};
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    for (const [date, day] of Object.entries(this.data.dailyMetrics)) {
      if (date >= startStr && date <= endStr) {
        for (const [cat, hours] of Object.entries(day.byCategory)) {
          totals[cat] = (totals[cat] || 0) + hours;
        }
      }
    }

    return totals;
  }

  getWeekOverWeekGrowth(todayKey?: string): {
    currentTotal: number;
    previousTotal: number;
    absoluteChange: number;
    percentageChange: number;
    byCategoryChange: Record<string, { current: number; previous: number; change: number }>;
  } {
    const current = this.getWeeklyTotals(todayKey);
    const previous = this.getPreviousWeekTotals(todayKey);

    const currentTotal = Object.values(current).reduce((sum, h) => sum + h, 0);
    const previousTotal = Object.values(previous).reduce((sum, h) => sum + h, 0);
    const absoluteChange = currentTotal - previousTotal;
    const percentageChange = previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : currentTotal > 0 ? 100 : 0;

    const allCategories = new Set([...Object.keys(current), ...Object.keys(previous)]);
    const byCategoryChange: Record<string, { current: number; previous: number; change: number }> = {};

    for (const cat of allCategories) {
      const cur = current[cat] || 0;
      const prev = previous[cat] || 0;
      byCategoryChange[cat] = { current: cur, previous: prev, change: cur - prev };
    }

    return { currentTotal, previousTotal, absoluteChange, percentageChange, byCategoryChange };
  }

  getDailyTrend(days: number = 30, todayKey?: string): Array<{ date: string; totalHours: number; byCategory: Record<string, number> }> {
    const trend: Array<{ date: string; totalHours: number; byCategory: Record<string, number> }> = [];
    const anchor = this.anchorDate(todayKey);

    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(anchor, i), 'yyyy-MM-dd');
      const day = this.data.dailyMetrics[date];

      trend.push({
        date,
        totalHours: day?.totalHours || 0,
        byCategory: day?.byCategory || {}
      });
    }

    return trend;
  }

  getRollingAverage(days: number = 30, windowSize: number = 7, todayKey?: string): Array<{ date: string; average: number }> {
    const trend = this.getDailyTrend(days + windowSize - 1, todayKey);
    const result: Array<{ date: string; average: number }> = [];

    for (let i = windowSize - 1; i < trend.length; i++) {
      const window = trend.slice(i - windowSize + 1, i + 1);
      const sum = window.reduce((acc, d) => acc + d.totalHours, 0);
      result.push({
        date: trend[i].date,
        average: Math.round((sum / windowSize) * 100) / 100
      });
    }

    return result;
  }

  getCategoryDistribution(startDate?: Date, endDate?: Date): Record<string, number> {
    const start = startDate || subDays(new Date(), 7);
    const end = endDate || new Date();
    return this.getTotalsForPeriod(start, end);
  }

  getRecentSessions(limit: number = 15): FocusSession[] {
    const allSessions: FocusSession[] = [];

    for (const day of Object.values(this.data.dailyMetrics)) {
      allSessions.push(...day.sessions);
    }

    return allSessions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async processConversationalUpdate(message: string): Promise<{ added: FocusSession[]; message: string }> {
    const added: FocusSession[] = [];

    // Hours-based patterns
    const hourPatterns = [
      // "logged 2h on Temporal" / "logged 2.5 hours on finance tasks"
      /(?:logged|log)\s+(\d+(?:\.\d+)?)\s*(?:h(?:ours?)?|hrs?)\s+(?:on|for|to)\s+([\w][\w\s]*?)(?:\s*[-:–]\s*(.+?))?(?:\.|,|$)/gi,
      // "focused 3 hours on tax prep"
      /(?:focused|focus)\s+(\d+(?:\.\d+)?)\s*(?:h(?:ours?)?|hrs?)\s+(?:on|for)\s+([\w][\w\s]*?)(?:\s*[-:–]\s*(.+?))?(?:\.|,|$)/gi,
      // "blocked 2h for housing tasks"
      /(?:blocked|block)\s+(\d+(?:\.\d+)?)\s*(?:h(?:ours?)?|hrs?)\s+(?:for|on)\s+([\w][\w\s]*?)(?:\s*[-:–]\s*(.+?))?(?:\.|,|$)/gi,
      // "spent 1h on taxes"
      /(?:spent|spend)\s+(\d+(?:\.\d+)?)\s*(?:h(?:ours?)?|hrs?)\s+(?:on|for)\s+([\w][\w\s]*?)(?:\s*[-:–]\s*(.+?))?(?:\.|,|$)/gi,
      // "worked 2 hours on Temporal client delivery"
      /(?:worked|working)\s+(\d+(?:\.\d+)?)\s*(?:h(?:ours?)?|hrs?)\s+(?:on|for)\s+([\w][\w\s]*?)(?:\s*[-:–]\s*(.+?))?(?:\.|,|$)/gi,
      // "deep work 3h: Temporal sprint" / "focus block 1.5h: Tax prep"
      /(?:deep work|focus block|focus session)\s+(\d+(?:\.\d+)?)\s*(?:h(?:ours?)?|hrs?)[\s:–-]+([\w][\w\s]*?)(?:\s*[-:–]\s*(.+?))?(?:\.|,|$)/gi,
    ];

    // Minutes-based pattern: "45 min on taxes"
    const minutePattern = /(\d+)\s*(?:min(?:utes?)?)\s+(?:on|for)\s+([\w][\w\s]*?)(?:\s*[-:–]\s*(.+?))?(?:\.|,|$)/gi;

    const processedRanges: Array<[number, number]> = [];

    const overlaps = (start: number, end: number): boolean => {
      return processedRanges.some(([s, e]) => start < e && end > s);
    };

    for (const pattern of hourPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        if (overlaps(match.index, match.index + match[0].length)) continue;

        const hours = parseFloat(match[1]);
        if (hours <= 0 || hours > 24) continue;

        const categoryText = match[2].trim();
        const description = match[3]?.trim() || `${hours}h on ${categoryText}`;
        const category = this.inferCategory(categoryText);

        added.push(await this.addSession(category, hours, description, undefined, 'conversational'));
        processedRanges.push([match.index, match.index + match[0].length]);

        console.log('Focus pattern detected:', { pattern: match[0], hours, category, raw: categoryText });
      }
    }

    // Process minutes
    let match;
    while ((match = minutePattern.exec(message)) !== null) {
      if (overlaps(match.index, match.index + match[0].length)) continue;

      const minutes = parseInt(match[1], 10);
      if (minutes <= 0 || minutes > 1440) continue;

      const hours = Math.round((minutes / 60) * 100) / 100;
      const categoryText = match[2].trim();
      const description = match[3]?.trim() || `${minutes}min on ${categoryText}`;
      const category = this.inferCategory(categoryText);

      added.push(await this.addSession(category, hours, description, undefined, 'conversational'));
      processedRanges.push([match.index, match.index + match[0].length]);

      console.log('Focus pattern detected (minutes):', { pattern: match[0], minutes, hours, category });
    }

    const resultMessage = added.length > 0
      ? `Logged ${added.length} focus session(s): ${added.map(s => `${s.hours}h ${s.category}`).join(', ')}`
      : 'No focus hour patterns detected in message';

    return { added, message: resultMessage };
  }

  private inferCategory(text: string): FocusCategory {
    const lower = text.toLowerCase().trim();

    // Direct category name match first
    for (const cat of VALID_CATEGORIES) {
      if (lower === cat.toLowerCase() || lower.startsWith(cat.toLowerCase())) {
        return cat;
      }
    }

    // Keyword matching
    for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
      if (lower.includes(keyword)) {
        return category;
      }
    }

    return 'Other';
  }

  getAllData(): FocusData {
    return this.data;
  }
}
