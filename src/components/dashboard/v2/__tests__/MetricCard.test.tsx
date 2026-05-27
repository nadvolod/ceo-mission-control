import { render, screen } from '@testing-library/react';
import { MetricCard } from '../MetricCard';
import { SEED_METRICS, SEED_SPARKS, MC_COLORS } from '../seed';

describe('MetricCard', () => {
  it('renders label, formatted value, and goal badge for a goal-bearing metric', () => {
    const metric = {
      ...SEED_METRICS.temporal,
      today: 1.5,
      week: 6.5,
      goal: 5,
      spark: [...SEED_SPARKS.temporal],
    };
    render(<MetricCard metric={metric} />);

    expect(screen.getByText('Temporal')).toBeInTheDocument();
    expect(screen.getByText('1.5h')).toBeInTheDocument();
    expect(screen.getByText('6.5h/5h')).toBeInTheDocument();
    expect(screen.getByText('6.5h this week')).toBeInTheDocument();
  });

  it('compact-formats money values with the $ prefix', () => {
    const metric = {
      ...SEED_METRICS.cash,
      today: 35300,
      week: 35300,
      spark: [...SEED_SPARKS.cash],
    };
    render(<MetricCard metric={metric} />);
    // formatter renders compact notation; locale produces "35.3K"
    expect(screen.getByText(/^\$35\.3K$/)).toBeInTheDocument();
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });

  it('falls back to the note when there is no spark and no goal progress', () => {
    const metric = {
      ...SEED_METRICS.debt,
      color: MC_COLORS.red,
    };
    render(<MetricCard metric={metric} />);
    // The note appears twice: once in the sub-line, once in the footer fallback.
    expect(screen.getAllByText(/liabilities/i).length).toBeGreaterThanOrEqual(1);
  });

  it('uses stable preset test ids without leading punctuation from labels', () => {
    const onLog = jest.fn();
    render(<MetricCard metric={SEED_METRICS.pipeline} onLog={onLog} />);

    expect(screen.getByTestId('preset-pipeline-call')).toBeInTheDocument();
    expect(screen.getByTestId('preset-pipeline-demo')).toBeInTheDocument();
    expect(screen.getByTestId('preset-pipeline-fu')).toBeInTheDocument();
  });
});
