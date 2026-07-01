import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MonthlyReview } from '@/lib/types';
import { defaultReviewMonth } from './MonthlyReviewTracker';
import { MonthlyReviewTracker } from './MonthlyReviewTracker';

function buildReview(overrides: Partial<MonthlyReview>): MonthlyReview {
  return {
    id: 'review-default',
    month: '2026-06',
    date: '2026-07-01',
    timeAllocation: 'June time',
    hoursWorked: 120,
    temporalHours: 40,
    energyGivers: 'June energy',
    energyDrainers: 'June drains',
    ignoredSignals: 'June signals',
    moneySpent: 'June money',
    expenseJoyVsStress: 'June joy',
    alignmentCheck: 'June alignment',
    monthLesson: 'June lesson',
    decisionSource: 'discipline',
    badHabits: 'June bad habits',
    goodPatterns: 'June good patterns',
    ratings: {
      discipline: 8,
      focus: 7,
      nutrition: 6,
      fitness: 5,
      sleep: 4,
    },
    oneThingToFix: 'June fix',
    disciplinedVersionAction: 'June action',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

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

describe('MonthlyReviewTracker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('restores the default previous-month review when canceling an older edit during month start', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 1, 9));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const juneReview = buildReview({ id: 'review-june' });
    const mayReview = buildReview({
      id: 'review-may',
      month: '2026-05',
      date: '2026-06-01',
      timeAllocation: 'May time',
      energyGivers: 'May energy',
    });

    render(
      <MonthlyReviewTracker
        currentMonthReview={null}
        recentReviews={[juneReview, mayReview]}
        ratingsTrend={[]}
        onSubmitReview={jest.fn()}
        onDeleteReview={jest.fn()}
      />,
    );

    expect(screen.getByTestId('monthly-review-month-input')).toHaveValue('2026-06');
    expect(screen.getByLabelText('What gave me energy?')).toHaveValue('June energy');

    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: /May 2026/ }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByTestId('monthly-review-month-input')).toHaveValue('2026-05');
    expect(screen.getByLabelText('What gave me energy?')).toHaveValue('May energy');

    await user.click(screen.getByRole('button', { name: 'Cancel Edit' }));

    expect(screen.getByTestId('monthly-review-month-input')).toHaveValue('2026-06');
    expect(screen.getByLabelText('What gave me energy?')).toHaveValue('June energy');
  });
});
