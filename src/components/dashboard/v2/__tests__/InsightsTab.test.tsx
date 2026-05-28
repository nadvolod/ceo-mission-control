import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightsTab, __insightsInternals } from '../InsightsTab';

const { buildInsightCards, weekOverWeekDelta, meanOf, sumOf } = __insightsInternals;

describe('Insights internals', () => {
  it('meanOf empty array = 0', () => {
    expect(meanOf([])).toBe(0);
  });
  it('sumOf adds the values', () => {
    expect(sumOf([1, 2, 3])).toBe(6);
  });

  describe('weekOverWeekDelta', () => {
    it('returns undefined when the series has fewer than 14 days', () => {
      expect(weekOverWeekDelta(new Array(13).fill(1))).toBeUndefined();
      expect(weekOverWeekDelta([])).toBeUndefined();
    });

    it('is 0 when both 7-day windows are 0', () => {
      expect(weekOverWeekDelta(new Array(14).fill(0))).toBe(0);
    });

    it('is undefined when prior 7 are 0 and recent 7 are non-zero (cant divide)', () => {
      const series = [...new Array(7).fill(0), ...new Array(7).fill(1)];
      expect(weekOverWeekDelta(series)).toBeUndefined();
    });

    it('computes percentage change between the last 7 and prior 7 days', () => {
      // prior 7 mean = 1, recent 7 mean = 2 → +100%
      const series = [...new Array(7).fill(1), ...new Array(7).fill(2)];
      expect(weekOverWeekDelta(series)).toBe(100);
    });

    it('always uses the last 14 days even when given a longer series (30-day case)', () => {
      // The first 16 entries should be ignored. Last 14: prior 7 = 1, recent 7 = 2 → +100%.
      const series = [
        ...new Array(16).fill(999),
        ...new Array(7).fill(1),
        ...new Array(7).fill(2),
      ];
      expect(weekOverWeekDelta(series)).toBe(100);
    });
  });
});

describe('buildInsightCards', () => {
  it('returns 4 cards always (Temporal, Deep work, Pipeline, Money moved)', () => {
    const cards = buildInsightCards(7, undefined, undefined);
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
    const card7 = buildInsightCards(7, focus, undefined);
    const card30 = buildInsightCards(30, focus, undefined);
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
    const cards = buildInsightCards(7, undefined, fin);
    const money = cards.find((c) => c.label === 'Money moved')!;
    expect(money.total).toBe(850);
  });

  it('sums Other + Temporal into Deep work (Temporal IS deep work)', () => {
    const focus = Array.from({ length: 14 }, () => ({
      date: 'd',
      byCategory: { Other: 2, Temporal: 1 },
    }));
    const cards = buildInsightCards(14, focus, undefined);
    const deepWork = cards.find((c) => c.label === 'Deep work')!;
    // Each day = Other (2) + Temporal (1) = 3. Over 14 days = 42.
    expect(deepWork.total).toBe(42);
    expect(deepWork.data.every((v) => v === 3)).toBe(true);
  });

  it('falls back to Other alone when no Temporal hours are present', () => {
    const focus = Array.from({ length: 14 }, () => ({
      date: 'd',
      byCategory: { Other: 2 },
    }));
    const cards = buildInsightCards(14, focus, undefined);
    const deepWork = cards.find((c) => c.label === 'Deep work')!;
    expect(deepWork.total).toBe(28);
  });

  it('falls back to Temporal alone when no Other hours are present', () => {
    const focus = Array.from({ length: 14 }, () => ({
      date: 'd',
      byCategory: { Temporal: 1.5 },
    }));
    const cards = buildInsightCards(14, focus, undefined);
    const deepWork = cards.find((c) => c.label === 'Deep work')!;
    expect(deepWork.total).toBe(21);
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
