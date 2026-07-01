import { defaultReviewMonth } from './MonthlyReviewTracker';

describe('defaultReviewMonth', () => {
  it('targets the previous month during the first three days of a month', () => {
    expect(defaultReviewMonth(new Date(2026, 6, 1))).toBe('2026-06');
    expect(defaultReviewMonth(new Date(2026, 6, 3))).toBe('2026-06');
  });

  it('targets the current month after the opening review window', () => {
    expect(defaultReviewMonth(new Date(2026, 6, 4))).toBe('2026-07');
  });

  it('rolls January back to the prior year', () => {
    expect(defaultReviewMonth(new Date(2026, 0, 1))).toBe('2025-12');
  });
});
