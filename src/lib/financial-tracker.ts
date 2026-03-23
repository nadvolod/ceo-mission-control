import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE_PATH = process.env.NODE_ENV === 'development' 
  ? '/Users/nikolay/.openclaw/workspace'
  : '/app/workspace';

const FINANCIAL_DATA_FILE = join(WORKSPACE_PATH, 'financial-metrics.json');

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
  private data: FinancialData;

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    try {
      if (existsSync(FINANCIAL_DATA_FILE)) {
        const rawData = readFileSync(FINANCIAL_DATA_FILE, 'utf8');
        this.data = JSON.parse(rawData);
      } else {
        this.data = {
          dailyMetrics: {},
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
      this.data = {
        dailyMetrics: {},
        lastUpdated: new Date().toISOString()
      };
    }
  }

  private saveData(): void {
    try {
      this.data.lastUpdated = new Date().toISOString();
      writeFileSync(FINANCIAL_DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving financial data:', error);
    }
  }

  addEntry(category: 'moved' | 'generated' | 'cut', amount: number, description: string, date?: string): FinancialEntry {
    const entryDate = date || new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();
    
    const entry: FinancialEntry = {
      id: `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      description,
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

    // Add entry
    this.data.dailyMetrics[entryDate].entries.push(entry);

    // Recalculate totals
    this.recalculateTotals(entryDate);
    this.saveData();

    return entry;
  }

  private recalculateTotals(date: string): void {
    const dayMetrics = this.data.dailyMetrics[date];
    if (!dayMetrics) return;

    const totals = { moved: 0, generated: 0, cut: 0, netImpact: 0 };

    dayMetrics.entries.forEach(entry => {
      totals[entry.category] += entry.amount;
    });

    // Net impact = money moved + revenue generated + expenses cut
    totals.netImpact = totals.moved + totals.generated + totals.cut;

    dayMetrics.totals = totals;
  }

  getTodaysMetrics(): DailyFinancialMetrics {
    const today = new Date().toISOString().split('T')[0];
    return this.data.dailyMetrics[today] || {
      date: today,
      entries: [],
      totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 }
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
  processConversationalUpdate(message: string): { added: FinancialEntry[]; message: string } {
    const added: FinancialEntry[] = [];

    // Pattern: "Moved $12K: description" or "moved $12,000: description"
    const movedPattern = /moved\s+\$(\d+(?:,\d{3})*(?:\.\d{2})?[kK]?|[\d.]+[kK])\s*:?\s*([^.\n]+)/gi;
    let match;
    
    while ((match = movedPattern.exec(message)) !== null) {
      const amount = this.parseAmount(match[1]);
      const description = match[2].trim();
      if (amount > 0) {
        added.push(this.addEntry('moved', amount, description));
      }
    }

    // Pattern: "Generated $2K: description" or "new revenue $2000: description"
    const generatedPattern = /(?:generated|new revenue|revenue)\s+\$(\d+(?:,\d{3})*(?:\.\d{2})?[kK]?|[\d.]+[kK])\s*:?\s*([^.\n]+)/gi;
    while ((match = generatedPattern.exec(message)) !== null) {
      const amount = this.parseAmount(match[1]);
      const description = match[2].trim();
      if (amount > 0) {
        added.push(this.addEntry('generated', amount, description));
      }
    }

    // Pattern: "Cut $850: description" or "saved $500: description"
    const cutPattern = /(?:cut|saved|reduced)\s+\$(\d+(?:,\d{3})*(?:\.\d{2})?[kK]?|[\d.]+[kK])\s*:?\s*([^.\n]+)/gi;
    while ((match = cutPattern.exec(message)) !== null) {
      const amount = this.parseAmount(match[1]);
      const description = match[2].trim();
      if (amount > 0) {
        added.push(this.addEntry('cut', amount, description));
      }
    }

    const resultMessage = added.length > 0 
      ? `Added ${added.length} financial entries: ${added.map(e => `${e.category} $${e.amount.toLocaleString()}`).join(', ')}`
      : 'No financial metrics detected in message';

    return { added, message: resultMessage };
  }

  private parseAmount(amountStr: string): number {
    // Remove commas and handle K suffix
    let cleanAmount = amountStr.replace(/,/g, '').toLowerCase().trim();
    
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