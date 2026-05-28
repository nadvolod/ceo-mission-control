import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightsTab, __insightsInternals } from '../InsightsTab';

const { buildInsightCards, periodDelta, meanOf, sumOf } = __insightsInternals;

describe('Insights internals', () => {
  it('meanOf empty array = 0', () => {
    expect(meanOf([])).toBe(0);
  });
  it('sumOf adds the values', () => {
    expect(sumOf([1, 2, 3])).toBe(6);
  });
  it('periodDelta is 0 when prior and recent are both 0', () => {
    expect(periodDelta([0, 0, 0, 0])).toBe(0);
  });
  it('periodDelta is undefined when prior is 0 and recent isn\'t', () => {
    expect(periodDelta([0, 0, 1, 2])).toBeUndefined();
  });
  it('periodDelta computes percentage change between halves', () => {
    // first half mean 1, second half mean 2 → +100%
    expect(periodDelta([1, 1, 2, 2])).toBe(100);
  });
});

describe('buildInsightCards', () => {
  it('returns 4 cards always (Temporal, Deep work, Pipeline, Money moved)', () => {
    const cards = buildInsightCards(7, undefined, undefined, undefined);
    expect(cards.map((c) => c.label)).toEqual(['Temporal', 'Deep work', 'Pipeline', 'Money moved']);
    cards.forEach((c) => {
      expect(c.data).toEqual([]);
      expect(c.total).toBe(0);
    });
  });

  it('respects the period — only takes the last N entries', () => {
    const focus = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      byCategory: { Temporal: 1 },
    }));
    const card7 = buildInsightCards(7, focus, undefined, undefined);
    const card30 = buildInsightCards(30, focus, undefined, undefined);
    expect(card7[0].data).toHaveLength(7);
    expect(card7[0].total).toBe(7);
    expect(card30[0].data).toHaveLength(30);
    expect(card30[0].total).toBe(30);
  });

  it('totals money moved across moved/generated/cut', () => {
    const fin = [
      { date: 'd1', totals: { moved: 100, generated: 200, cut: 50, netImpact: 350 } },
      { date: 'd2', totals: { moved: 0,   generated: 500, cut: 0,  netImpact: 500 } },
    ];
    const cards = buildInsightCards(7, undefined, fin, undefined);
    const money = cards.find((c) => c.label === 'Money moved')!;
    expect(money.total).toBe(850);
  });
});

describe('<InsightsTab />', () => {
  it('renders the 4 insight cards with the default 14d period', () => {
    render(<InsightsTab />);
    expect(screen.getByTestId('insights-tab')).toBeInTheDocument();
    expect(screen.getByTestId('insight-card-temporal')).toBeInTheDocument();
    expect(screen.getByTestId('insight-card-deep work')).toBeInTheDocument();
    expect(screen.getByTestId('insight-card-pipeline')).toBeInTheDocument();
    expect(screen.getByTestId('insight-card-money moved')).toBeInTheDocument();
  });

  it('switching the period selector re-renders with the new window', async () => {
    const user = userEvent.setup();
    const focus = Array.from({ length: 30 }, () => ({
      date: 'd',
      byCategory: { Temporal: 1 },
    }));
    render(<InsightsTab focusDailyTrend={focus} />);
    // Default 14d → temporal total should be 14
    expect(screen.getByTestId('insight-card-temporal').textContent).toMatch(/14\.0h/);
    // Switch to 30d → temporal total should be 30
    await user.click(screen.getByTestId('insights-period-30'));
    expect(screen.getByTestId('insight-card-temporal').textContent).toMatch(/30\.0h/);
  });
});
