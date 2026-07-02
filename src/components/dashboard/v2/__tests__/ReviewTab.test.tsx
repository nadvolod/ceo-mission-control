import { render, screen } from '@testing-library/react';
import { ReviewTab } from '../ReviewTab';
import type { MonthlyReview, MonthlyReviewRatings } from '@/lib/types';

function makeReview(overrides: Partial<MonthlyReview> = {}): MonthlyReview {
  return {
    id: 'r1',
    month: '2026-04',
    date: '2026-04-30',
    timeAllocation: '',
    hoursWorked: 160,
    temporalHours: 80,
    energyGivers: '',
    energyDrainers: '',
    ignoredSignals: '',
    moneySpent: '',
    expenseJoyVsStress: '',
    alignmentCheck: '',
    monthLesson: 'Ship the deck on Mondays, polish on Tuesdays.',
    decisionSource: 'discipline',
    badHabits: '',
    goodPatterns: '',
    ratings: { discipline: 7, focus: 6, nutrition: 5, fitness: 8, sleep: 7 },
    oneThingToFix: 'Stop polishing what isn\'t shipping yet.',
    disciplinedVersionAction: '',
    createdAt: '2026-04-30T12:00:00Z',
    updatedAt: '2026-04-30T12:00:00Z',
    ...overrides,
  };
}

describe('<ReviewTab />', () => {
  it('renders the empty-state copy when there is no data', () => {
    render(<ReviewTab currentMonthReview={null} recentReviews={[]} ratingsTrend={[]} />);
    expect(screen.getByTestId('review-tab-empty')).toBeInTheDocument();
    expect(screen.getByText(/No monthly reviews yet/i)).toBeInTheDocument();
  });

  it('renders the editable monthly review form when save handlers are available', () => {
    render(
      <ReviewTab
        currentMonthReview={null}
        recentReviews={[]}
        ratingsTrend={[]}
        onSubmitReview={jest.fn()}
        onDeleteReview={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Monthly Review' })).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Review' })).toBeInTheDocument();
    expect(screen.queryByTestId('review-tab-empty')).not.toBeInTheDocument();
  });

  it('renders current-month card with the month label and lesson when present', () => {
    render(
      <ReviewTab
        currentMonthReview={makeReview({ month: '2026-04', monthLesson: 'Ship faster.' })}
        recentReviews={[]}
        ratingsTrend={[]}
      />,
    );
    expect(screen.getByTestId('review-current-month')).toBeInTheDocument();
    expect(screen.getByText('2026-04')).toBeInTheDocument();
    expect(screen.getByText('Ship faster.')).toBeInTheDocument();
    expect(screen.getByText('160h')).toBeInTheDocument(); // hours worked
  });

  it('renders the ratings trend with one row per metric', () => {
    const trend: Array<MonthlyReviewRatings & { month: string }> = [
      { month: '2026-03', discipline: 5, focus: 6, nutrition: 4, fitness: 7, sleep: 6 },
      { month: '2026-04', discipline: 7, focus: 6, nutrition: 5, fitness: 8, sleep: 7 },
    ];
    render(<ReviewTab currentMonthReview={null} recentReviews={[]} ratingsTrend={trend} />);
    expect(screen.getByTestId('review-ratings-trend')).toBeInTheDocument();
    expect(screen.getByTestId('rating-discipline')).toBeInTheDocument();
    expect(screen.getByTestId('rating-focus')).toBeInTheDocument();
    expect(screen.getByTestId('rating-nutrition')).toBeInTheDocument();
    expect(screen.getByTestId('rating-fitness')).toBeInTheDocument();
    expect(screen.getByTestId('rating-sleep')).toBeInTheDocument();
  });

  it('caps the recent-reviews list at 6 entries', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makeReview({ id: `r${i}`, month: `2026-${String(i + 1).padStart(2, '0')}` }),
    );
    render(<ReviewTab currentMonthReview={null} recentReviews={many} ratingsTrend={[]} />);
    const list = screen.getByTestId('review-recent');
    expect(list.querySelectorAll('li')).toHaveLength(6);
  });
});
