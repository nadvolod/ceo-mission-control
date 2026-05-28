import { render, screen } from '@testing-library/react';
import { TrendsPanel, buildOverviewTrendSeries } from '../TrendsPanel';

describe('buildOverviewTrendSeries', () => {
  const goals = { temporalWeekly: 5, deepWorkWeekly: 10, pipelineWeekly: 3 };

  it('returns 3 series (Temporal / Deep Work / Pipeline) even with empty inputs', () => {
    const series = buildOverviewTrendSeries(undefined, goals);
    expect(series).toHaveLength(3);
    expect(series.map((s) => s.label)).toEqual(['TEMPORAL', 'DEEP WORK', 'PIPELINE']);
    expect(series[0].data).toEqual([]);
    expect(series[0].deltaPct).toBeUndefined(); // can't compute delta with no data
  });

  it('uses focus byCategory.Temporal/Revenue/Other for the 3 series', () => {
    const focus = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      totalHours: 0,
      byCategory: { Temporal: 1, Revenue: 0.5, Other: 2 },
    }));
    const series = buildOverviewTrendSeries(focus, goals);
    expect(series[0].data.every((v) => v === 1)).toBe(true);   // Temporal
    expect(series[1].data.every((v) => v === 2)).toBe(true);   // Deep work via Other
    expect(series[2].data.every((v) => v === 0.5)).toBe(true); // Pipeline via Revenue
  });

  it('uses focus-hours Other for Deep Work so trends match the v2 metric source', () => {
    const focus = Array.from({ length: 14 }, () => ({
      date: '2026-05-27',
      byCategory: { Other: 2 },
    }));
    const series = buildOverviewTrendSeries(focus, goals);
    expect(series[1].label).toBe('DEEP WORK');
    expect(series[1].data.every((v) => v === 2)).toBe(true);
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

  it('renders 3 trend cells when given 3 series, even all-zero', () => {
    const series = buildOverviewTrendSeries(
      Array.from({ length: 14 }, () => ({ date: 'd', byCategory: { Temporal: 0, Revenue: 0, Other: 0 } })),
      { temporalWeekly: 5, deepWorkWeekly: 10, pipelineWeekly: 3 },
    );
    render(<TrendsPanel series={series} />);
    expect(screen.getByTestId('trends-panel')).toBeInTheDocument();
    expect(screen.getByTestId('trend-temporal')).toBeInTheDocument();
    expect(screen.getByTestId('trend-deep work')).toBeInTheDocument();
    expect(screen.getByTestId('trend-pipeline')).toBeInTheDocument();
  });
});
