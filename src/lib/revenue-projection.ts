import { loadJSON, saveJSON } from './storage';
import type { RevenueAdjustment, RevenueProjectionData, MonthProjection } from './types';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export class RevenueProjectionService {
  private data: RevenueProjectionData = {
    baseMonthlyIncome: null,
    baseMonthlyExpenses: null,
    adjustments: [],
    lastUpdated: new Date().toISOString(),
  };

  private constructor() {}

  static async create(): Promise<RevenueProjectionService> {
    const svc = new RevenueProjectionService();
    await svc.loadData();
    return svc;
  }

  private async loadData(): Promise<void> {
    const defaultData: RevenueProjectionData = {
      baseMonthlyIncome: null,
      baseMonthlyExpenses: null,
      adjustments: [],
      lastUpdated: new Date().toISOString(),
    };
    this.data = await loadJSON('revenue-projections.json', defaultData);
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON('revenue-projections.json', this.data);
  }

  async addAdjustment(
    adj: Omit<RevenueAdjustment, 'id' | 'createdAt'>
  ): Promise<RevenueAdjustment> {
    if (!adj.effectiveMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(adj.effectiveMonth)) {
      throw new Error('Invalid effectiveMonth format (expected YYYY-MM)');
    }
    if (!Number.isFinite(adj.amount) || adj.amount <= 0) {
      throw new Error('Amount must be a positive finite number');
    }
    const validTypes = ['revenue_gain', 'revenue_loss', 'expense_increase', 'expense_decrease'];
    if (!validTypes.includes(adj.type)) {
      throw new Error(`Invalid type: ${adj.type}`);
    }
    const entry: RevenueAdjustment = {
      ...adj,
      description: (adj.description || '').trim(),
      id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.adjustments.push(entry);
    await this.saveData();
    return entry;
  }

  async updateAdjustment(
    id: string,
    updates: Partial<Omit<RevenueAdjustment, 'id' | 'createdAt'>>
  ): Promise<RevenueAdjustment | null> {
    const idx = this.data.adjustments.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.data.adjustments[idx] = { ...this.data.adjustments[idx], ...updates };
    await this.saveData();
    return this.data.adjustments[idx];
  }

  async removeAdjustment(id: string): Promise<boolean> {
    const before = this.data.adjustments.length;
    this.data.adjustments = this.data.adjustments.filter((a) => a.id !== id);
    if (this.data.adjustments.length === before) return false;
    await this.saveData();
    return true;
  }

  async setBaseIncome(amount: number | null): Promise<void> {
    this.data.baseMonthlyIncome = amount;
    await this.saveData();
  }

  async setBaseExpenses(amount: number | null): Promise<void> {
    this.data.baseMonthlyExpenses = amount;
    await this.saveData();
  }

  getData(): RevenueProjectionData {
    return this.data;
  }

  /**
   * Compute month-by-month projections.
   * @param monarchIncome  Monarch live monthly income (used when baseMonthlyIncome is null)
   * @param monarchExpenses Monarch live monthly expenses (used when baseMonthlyExpenses is null)
   * @param cashPosition   Current cash position for cumulative calculation
   * @param startMonth     "YYYY-MM" (defaults to current month)
   * @param endMonth       "YYYY-MM" (defaults to Dec of current year)
   */
  computeProjections(
    monarchIncome: number,
    monarchExpenses: number,
    cashPosition: number,
    startMonth?: string,
    endMonth?: string
  ): MonthProjection[] {
    const now = new Date();
    const start = startMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const end = endMonth || `${now.getFullYear()}-12`;

    const baseIncome = this.data.baseMonthlyIncome ?? monarchIncome;
    const baseExpenses = this.data.baseMonthlyExpenses ?? monarchExpenses;

    const months = generateMonthRange(start, end);
    const projections: MonthProjection[] = [];
    let cumulative = cashPosition;

    for (const month of months) {
      // Find active adjustments for this month
      const activeAdjs = this.data.adjustments.filter((adj) => {
        if (adj.recurring) {
          return adj.effectiveMonth <= month;
        }
        return adj.effectiveMonth === month;
      });

      let incomeAdj = 0;
      let expenseAdj = 0;

      for (const adj of activeAdjs) {
        switch (adj.type) {
          case 'revenue_gain':
            incomeAdj += adj.amount;
            break;
          case 'revenue_loss':
            incomeAdj -= adj.amount;
            break;
          case 'expense_increase':
            expenseAdj += adj.amount;
            break;
          case 'expense_decrease':
            expenseAdj -= adj.amount;
            break;
        }
      }

      const projectedIncome = baseIncome + incomeAdj;
      const projectedExpenses = baseExpenses + expenseAdj;
      const netCashFlow = projectedIncome - projectedExpenses;
      cumulative += netCashFlow;

      const [yearStr, monthStr] = month.split('-');
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthLabel = `${MONTH_LABELS[monthIdx]} ${yearStr}`;

      projections.push({
        month,
        monthLabel,
        baseIncome,
        incomeAdjustments: incomeAdj,
        projectedIncome,
        baseExpenses,
        expenseAdjustments: expenseAdj,
        projectedExpenses,
        netCashFlow,
        cumulativeCashImpact: cumulative,
        adjustmentDetails: activeAdjs,
      });
    }

    return projections;
  }
}

/** Generate array of "YYYY-MM" strings from start to end inclusive */
function generateMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}
