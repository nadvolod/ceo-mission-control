import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricCard } from '../MetricCard';
import { __FIXTURE_METRICS as SEED_METRICS, __FIXTURE_SPARKS as SEED_SPARKS } from './__fixtures__';
import { MC_COLORS } from '../palette';

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
    expect(screen.getByTestId('metric-card-temporal-value')).toHaveTextContent('1.5h');
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

  it('reveals preset buttons for keyboard focus and hides them from tab order otherwise', () => {
    const onLog = jest.fn();
    render(<MetricCard metric={SEED_METRICS.pipeline} onLog={onLog} />);

    const card = screen.getByTestId('metric-card-pipeline');
    const call = screen.getByTestId('preset-pipeline-call');
    expect(call).toHaveAttribute('tabindex', '-1');

    fireEvent.focus(card);
    expect(call).toHaveAttribute('tabindex', '0');
  });

  describe('Money Moved — custom amount input', () => {
    // The user's request: don't log a hardcoded amount when a money category
    // is clicked. Instead show an inline input so they type the real number.

    it('clicking a money preset opens the amount editor without logging', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      // Reveal the preset row first.
      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-moved'));

      // No log fired yet — the click selects the category, doesn't submit.
      expect(onLog).not.toHaveBeenCalled();
      // Editor visible.
      expect(screen.getByTestId('moneyMoved-amount-editor')).toBeInTheDocument();
      expect(screen.getByTestId('moneyMoved-amount-input')).toBeInTheDocument();
    });

    it('typing an amount and pressing Enter logs the parsed value with the category label', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-generated'));
      const input = screen.getByTestId('moneyMoved-amount-input');
      await user.type(input, '1234.5');
      await user.keyboard('{Enter}');

      expect(onLog).toHaveBeenCalledTimes(1);
      expect(onLog).toHaveBeenCalledWith('moneyMoved', 1234.5, '+ Generated');
    });

    it('strips $ and commas from the typed amount', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-cut'));
      await user.type(screen.getByTestId('moneyMoved-amount-input'), '$1,500');
      await user.click(screen.getByTestId('moneyMoved-amount-submit'));

      expect(onLog).toHaveBeenCalledWith('moneyMoved', 1500, '+ Cut');
    });

    it('rejects zero / non-numeric input and does not log', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-moved'));
      const input = screen.getByTestId('moneyMoved-amount-input');

      // Empty submit — onLog still not called, editor still open.
      await user.click(screen.getByTestId('moneyMoved-amount-submit'));
      expect(onLog).not.toHaveBeenCalled();
      expect(screen.getByTestId('moneyMoved-amount-editor')).toBeInTheDocument();

      // Zero — same.
      await user.type(input, '0');
      await user.keyboard('{Enter}');
      expect(onLog).not.toHaveBeenCalled();

      // Pure garbage — still rejected.
      await user.clear(input);
      await user.type(input, 'abc');
      await user.keyboard('{Enter}');
      expect(onLog).not.toHaveBeenCalled();
    });

    // Edge cases the old permissive parser silently mis-handled.
    // Both Copilot and CodeRabbit flagged these on PR #65 — pinning them
    // here so a future regression to the lax parser surfaces in CI.
    it.each([
      ['negative numbers (sign would be stripped, falsely logging +5)', '-5'],
      ['scientific notation (would log 13 instead of 1000)',            '1e3'],
      ['uppercase scientific notation',                                 '1E3'],
      ['double-decimal (parseFloat truncates to 12)',                  '12..3'],
      ['multi-segment decimal (parseFloat truncates to 1.2)',          '1.2.3'],
      ['decimal-only with no integer',                                  '.50'],
      ['trailing dot only',                                             '12.'],
      ['letters mixed in',                                              '12abc'],
    ])('rejects malformed numeric input — %s', async (_label, bad) => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);
      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-moved'));
      await user.type(screen.getByTestId('moneyMoved-amount-input'), bad);
      await user.keyboard('{Enter}');
      expect(onLog).not.toHaveBeenCalled();
      expect(screen.getByTestId('moneyMoved-amount-editor')).toBeInTheDocument();
    });

    it('Escape cancels and reverts to the preset row', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-generated'));
      await user.type(screen.getByTestId('moneyMoved-amount-input'), '999');
      await user.keyboard('{Escape}');

      expect(onLog).not.toHaveBeenCalled();
      expect(screen.queryByTestId('moneyMoved-amount-editor')).not.toBeInTheDocument();
      // Preset row is back.
      expect(screen.getByTestId('preset-moneyMoved-moved')).toBeInTheDocument();
    });

    it('the × cancel button reverts to the preset row', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-moved'));
      await user.type(screen.getByTestId('moneyMoved-amount-input'), '500');
      await user.click(screen.getByTestId('moneyMoved-amount-cancel'));

      expect(onLog).not.toHaveBeenCalled();
      expect(screen.queryByTestId('moneyMoved-amount-editor')).not.toBeInTheDocument();
    });

    it('hour-based metrics still log a hardcoded delta on preset click (unchanged)', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.temporal} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('preset-temporal-1h'));

      expect(onLog).toHaveBeenCalledWith('temporal', 1, '+1h');
      // No editor for temporal — it logs directly.
      expect(screen.queryByTestId('temporal-amount-editor')).not.toBeInTheDocument();
    });
  });
});
