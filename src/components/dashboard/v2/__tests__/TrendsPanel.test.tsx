import { render, screen } from '@testing-library/react';
import { TrendsPanel, buildOverviewTrendSeries } from '../TrendsPanel';

describe('buildOverviewTrendSeries', () => {
  const goals = { temporalWeekly: 5, deepWorkWeekly: 10 };

  it('returns 2 series (Temporal / Deep Work) even with empty inputs', () => {
    const series = buildOverviewTrendSeries(undefined, goals);
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.label)).toEqual(['TEMPORAL', 'DEEP WORK']);
    expect(series[0].data).toEqual([]);
    expect(series[0].deltaPct).toBeUndefined(); // can't compute delta with no data
  });

  it('Deep Work series sums Other + Temporal point-wise', () => {
    // Temporal hours ARE deep work — the v2 model is that Temporal is the
    // strategic project tag, not a separate category of work. So each day's
    // Deep Work data point should equal Other + Temporal.
    const focus = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      totalHours: 0,
      byCategory: { Temporal: 1, Revenue: 0.5, Other: 2 },
    }));
    const series = buildOverviewTrendSeries(focus, goals);
    expect(series[0].data.every((v) => v === 1)).toBe(true);   // Temporal
    expect(series[1].data.every((v) => v === 3)).toBe(true);   // Deep work = Other (2) + Temporal (1)
  });

  it('Deep Work falls back to Temporal alone when there are no Other hours', () => {
    const focus = Array.from({ length: 14 }, () => ({
      date: '2026-05-27',
      byCategory: { Temporal: 2 },
    }));
    const series = buildOverviewTrendSeries(focus, goals);
    expect(series[1].label).toBe('DEEP WORK');
    expect(series[1].data.every((v) => v === 2)).toBe(true);
  });

  it('Deep Work falls back to Other alone when there are no Temporal hours', () => {
    const focus = Array.from({ length: 14 }, () => ({
      date: '2026-05-27',
      byCategory: { Other: 1.5 },
    }));
    const series = buildOverviewTrendSeries(focus, goals);
    expect(series[1].data.every((v) => v === 1.5)).toBe(true);
  });

  it('computes week-over-week delta correctly', () => {
    // Prior 7 days mean = 1, recent 7 days mean = 2 → +100%
    const focus = [
      ...Array.from({ length: 7 }, () => ({ date: '2026-05-13', byCategory: { Temporal: 1 } })),
      ...Array.from({ length: 7 }, () => ({ date: '2026-05-20', byCategory: { Temporal: 2 } })),
    ];
    const series = buildOverviewTrendSeries(focus, goals);
    expect(series[0].deltaPct).toBe(100);
  });

  it('returns undefined delta when the prior window is zero and recent is non-zero', () => {
    const focus = [
      ...Array.from({ length: 7 }, () => ({ date: 'd', byCategory: { Temporal: 0 } })),
      ...Array.from({ length: 7 }, () => ({ date: 'd', byCategory: { Temporal: 1 } })),
    ];
    const series = buildOverviewTrendSeries(focus, goals);
    expect(series[0].deltaPct).toBeUndefined();
  });
});

describe('<TrendsPanel />', () => {
  it('renders the empty-state copy when given no series', () => {
    render(<TrendsPanel series={[]} />);
    expect(screen.getByText(/No trend data/i)).toBeInTheDocument();
  });

  it('renders 2 trend cells when given 2 series, even all-zero', () => {
    const series = buildOverviewTrendSeries(
      Array.from({ length: 14 }, () => ({ date: 'd', byCategory: { Temporal: 0, Other: 0 } })),
      { temporalWeekly: 5, deepWorkWeekly: 10 },
    );
    render(<TrendsPanel series={series} />);
    expect(screen.getByTestId('trends-panel')).toBeInTheDocument();
    expect(screen.getByTestId('trend-temporal')).toBeInTheDocument();
    expect(screen.getByTestId('trend-deep work')).toBeInTheDocument();
    expect(screen.queryByTestId('trend-pipeline')).not.toBeInTheDocument();
  });

  it('uses responsive trend columns instead of leaving a fixed empty third slot', () => {
    const series = buildOverviewTrendSeries(
      Array.from({ length: 14 }, () => ({ date: 'd', byCategory: { Temporal: 1, Other: 1 } })),
      { temporalWeekly: 5, deepWorkWeekly: 10 },
    );
    render(<TrendsPanel series={series} />);

    expect(screen.getByTestId('trends-panel')).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    });
  });

  it('lets non-empty sparklines fill their trend cell width', () => {
    const series = buildOverviewTrendSeries(
      Array.from({ length: 14 }, (_, i) => ({
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        byCategory: { Temporal: i % 4, Other: 1 },
      })),
      { temporalWeekly: 5, deepWorkWeekly: 10 },
    );
    render(<TrendsPanel series={series} />);

    const temporalSparkline = screen.getByTestId('trend-temporal').querySelector('svg');
    expect(temporalSparkline).toHaveStyle({ width: '100%' });
    expect(temporalSparkline).not.toHaveStyle({ maxWidth: '260px' });
  });
});
