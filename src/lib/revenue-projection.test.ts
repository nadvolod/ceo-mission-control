import { RevenueProjectionService } from './revenue-projection';
import type { RevenueAdjustment, MonthProjection } from './types';

// Mock storage to avoid DB dependency in unit tests
jest.mock('./storage', () => ({
  loadJSON: jest.fn().mockImplementation(() =>
    Promise.resolve({
      baseMonthlyIncome: null,
      baseMonthlyExpenses: null,
      adjustments: [],
      lastUpdated: new Date().toISOString(),
    })
  ),
  saveJSON: jest.fn().mockResolvedValue(undefined),
}));

describe('RevenueProjectionService', () => {
  let service: RevenueProjectionService;

  beforeEach(async () => {
    service = await RevenueProjectionService.create();
  });

  describe('computeProjections', () => {
    it('computes flat projections with no adjustments', () => {
      const projections = service.computeProjections(10000, 7000, 50000, '2026-04', '2026-06');

      expect(projections).toHaveLength(3);
      expect(projections[0].month).toBe('2026-04');
      expect(projections[0].monthLabel).toBe('Apr 2026');
      expect(projections[0].baseIncome).toBe(10000);
      expect(projections[0].baseExpenses).toBe(7000);
      expect(projections[0].projectedIncome).toBe(10000);
      expect(projections[0].projectedExpenses).toBe(7000);
      expect(projections[0].netCashFlow).toBe(3000);
      expect(projections[0].incomeAdjustments).toBe(0);
      expect(projections[0].expenseAdjustments).toBe(0);
    });

    it('applies one-time revenue loss in correct month', async () => {
      await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 8500,
        description: 'WHO contract ends',
        type: 'revenue_loss',
        recurring: false,
      });

      const projections = service.computeProjections(10000, 7000, 50000, '2026-06', '2026-08');

      // June: no adjustment
      expect(projections[0].incomeAdjustments).toBe(0);
      expect(projections[0].projectedIncome).toBe(10000);

      // July: -8500 one-time
      expect(projections[1].incomeAdjustments).toBe(-8500);
      expect(projections[1].projectedIncome).toBe(1500);

      // August: one-time doesn't carry over
      expect(projections[2].incomeAdjustments).toBe(0);
      expect(projections[2].projectedIncome).toBe(10000);
    });

    it('applies recurring revenue loss starting from effective month', async () => {
      await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 8500,
        description: 'WHO contract ends',
        type: 'revenue_loss',
        recurring: true,
      });

      const projections = service.computeProjections(10000, 7000, 50000, '2026-06', '2026-09');

      // June: no adjustment
      expect(projections[0].incomeAdjustments).toBe(0);

      // July onward: recurring loss
      expect(projections[1].incomeAdjustments).toBe(-8500);
      expect(projections[2].incomeAdjustments).toBe(-8500);
      expect(projections[3].incomeAdjustments).toBe(-8500);
    });

    it('applies recurring expense decrease', async () => {
      await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 3000,
        description: 'No more alimony + rent',
        type: 'expense_decrease',
        recurring: true,
      });

      const projections = service.computeProjections(10000, 7000, 50000, '2026-06', '2026-08');

      // June: no change
      expect(projections[0].expenseAdjustments).toBe(0);
      expect(projections[0].projectedExpenses).toBe(7000);

      // July: -3000 expenses
      expect(projections[1].expenseAdjustments).toBe(-3000);
      expect(projections[1].projectedExpenses).toBe(4000);
    });

    it('combines multiple adjustments in same month', async () => {
      await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 8500,
        description: 'WHO contract ends',
        type: 'revenue_loss',
        recurring: true,
      });
      await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 3000,
        description: 'No alimony/rent',
        type: 'expense_decrease',
        recurring: true,
      });

      const projections = service.computeProjections(10000, 7000, 50000, '2026-07', '2026-07');

      expect(projections[0].incomeAdjustments).toBe(-8500);
      expect(projections[0].projectedIncome).toBe(1500);
      expect(projections[0].expenseAdjustments).toBe(-3000);
      expect(projections[0].projectedExpenses).toBe(4000);
      expect(projections[0].netCashFlow).toBe(-2500); // 1500 - 4000
    });

    it('computes cumulative cash impact correctly', () => {
      const projections = service.computeProjections(10000, 7000, 50000, '2026-04', '2026-06');

      // Each month nets +3000
      expect(projections[0].cumulativeCashImpact).toBe(53000); // 50000 + 3000
      expect(projections[1].cumulativeCashImpact).toBe(56000); // + 3000
      expect(projections[2].cumulativeCashImpact).toBe(59000); // + 3000
    });

    it('uses base overrides when set', async () => {
      await service.setBaseIncome(15000);
      await service.setBaseExpenses(5000);

      const projections = service.computeProjections(10000, 7000, 50000, '2026-04', '2026-04');

      // Should use override values, not monarch values
      expect(projections[0].baseIncome).toBe(15000);
      expect(projections[0].baseExpenses).toBe(5000);
    });

    it('includes adjustment details per month', async () => {
      await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 8500,
        description: 'WHO contract ends',
        type: 'revenue_loss',
        recurring: true,
      });
      await service.addAdjustment({
        effectiveMonth: '2026-08',
        amount: 2000,
        description: 'New client',
        type: 'revenue_gain',
        recurring: true,
      });

      const projections = service.computeProjections(10000, 7000, 50000, '2026-07', '2026-08');

      // July: only WHO loss
      expect(projections[0].adjustmentDetails).toHaveLength(1);
      expect(projections[0].adjustmentDetails[0].description).toBe('WHO contract ends');

      // August: WHO loss (recurring) + new client
      expect(projections[1].adjustmentDetails).toHaveLength(2);
    });

    it('handles revenue_gain adjustment', async () => {
      await service.addAdjustment({
        effectiveMonth: '2026-08',
        amount: 5000,
        description: 'New consulting gig',
        type: 'revenue_gain',
        recurring: true,
      });

      const projections = service.computeProjections(10000, 7000, 50000, '2026-07', '2026-09');

      expect(projections[0].incomeAdjustments).toBe(0); // July
      expect(projections[1].incomeAdjustments).toBe(5000); // Aug
      expect(projections[1].projectedIncome).toBe(15000);
      expect(projections[2].incomeAdjustments).toBe(5000); // Sep (recurring)
    });

    it('handles expense_increase adjustment', async () => {
      await service.addAdjustment({
        effectiveMonth: '2026-09',
        amount: 1500,
        description: 'New office lease',
        type: 'expense_increase',
        recurring: true,
      });

      const projections = service.computeProjections(10000, 7000, 50000, '2026-08', '2026-10');

      expect(projections[0].expenseAdjustments).toBe(0); // Aug
      expect(projections[1].expenseAdjustments).toBe(1500); // Sep
      expect(projections[1].projectedExpenses).toBe(8500);
    });
  });

  describe('CRUD operations', () => {
    it('adds an adjustment and returns it with id', async () => {
      const adj = await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 8500,
        description: 'WHO contract ends',
        type: 'revenue_loss',
        recurring: true,
      });

      expect(adj.id).toBeTruthy();
      expect(adj.amount).toBe(8500);
      expect(adj.type).toBe('revenue_loss');
      expect(adj.createdAt).toBeTruthy();
    });

    it('removes an adjustment', async () => {
      const adj = await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 8500,
        description: 'Test',
        type: 'revenue_loss',
        recurring: false,
      });

      const removed = await service.removeAdjustment(adj.id);
      expect(removed).toBe(true);

      const data = service.getData();
      expect(data.adjustments).toHaveLength(0);
    });

    it('updates an adjustment', async () => {
      const adj = await service.addAdjustment({
        effectiveMonth: '2026-07',
        amount: 8500,
        description: 'Old description',
        type: 'revenue_loss',
        recurring: false,
      });

      const updated = await service.updateAdjustment(adj.id, {
        amount: 9000,
        description: 'New description',
      });

      expect(updated).not.toBeNull();
      expect(updated!.amount).toBe(9000);
      expect(updated!.description).toBe('New description');
      expect(updated!.type).toBe('revenue_loss'); // unchanged
    });

    it('returns false when removing non-existent adjustment', async () => {
      const removed = await service.removeAdjustment('nonexistent');
      expect(removed).toBe(false);
    });

    it('returns null when updating non-existent adjustment', async () => {
      const updated = await service.updateAdjustment('nonexistent', { amount: 100 });
      expect(updated).toBeNull();
    });
  });

  describe('base value overrides', () => {
    it('sets and clears base income', async () => {
      await service.setBaseIncome(15000);
      expect(service.getData().baseMonthlyIncome).toBe(15000);

      await service.setBaseIncome(null);
      expect(service.getData().baseMonthlyIncome).toBeNull();
    });

    it('sets and clears base expenses', async () => {
      await service.setBaseExpenses(5000);
      expect(service.getData().baseMonthlyExpenses).toBe(5000);

      await service.setBaseExpenses(null);
      expect(service.getData().baseMonthlyExpenses).toBeNull();
    });
  });
});
