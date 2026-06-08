import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('reveals preset buttons for keyboard focus and hides them from tab order otherwise', () => {
    const onLog = jest.fn();
    render(<MetricCard metric={SEED_METRICS.deepWork} onLog={onLog} />);

    const card = screen.getByTestId('metric-card-deepWork');
    const preset = screen.getByTestId('preset-deepWork-0-5h');
    expect(preset).toHaveAttribute('tabindex', '-1');

    fireEvent.focus(card);
    expect(preset).toHaveAttribute('tabindex', '0');
  });

  describe('Battles Won', () => {
    it('headlines the weekly count, shows the swords badge, and renders the all-time note', () => {
      render(
        <MetricCard
          metric={{ ...SEED_METRICS.battles, today: 1, week: 2, note: '47 total · $12.5K won' }}
        />,
      );
      // Big number is the WEEKLY count (2), not today (1).
      expect(screen.getByTestId('metric-card-battles-value')).toHaveTextContent('2');
      expect(screen.getByText('THIS WEEK')).toBeInTheDocument();
      // Swords badge present.
      expect(screen.getByTestId('metric-card-battles-icon')).toBeInTheDocument();
      // All-time note in the sub-line.
      expect(screen.getByText('47 total · $12.5K won')).toBeInTheDocument();
    });

    it('logging a battle requires a name and forwards value + count delta', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.battles} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-battles'));
      await user.click(screen.getByTestId('preset-battles-battle'));

      // Editor open, nothing logged yet.
      expect(onLog).not.toHaveBeenCalled();
      const amount = screen.getByTestId('battles-amount-input');
      const submit = screen.getByTestId('battles-amount-submit');

      // Amount alone is not enough — the battle name (note) is required.
      await user.type(amount, '2500');
      expect(submit).toBeDisabled();

      await user.type(screen.getByTestId('battles-amount-note'), 'Closed Acme renewal');
      expect(submit).toBeEnabled();
      await user.click(submit);

      // delta is the count increment (1); the $ value travels in options.value.
      expect(onLog).toHaveBeenCalledWith('battles', 1, '+ Battle', {
        description: 'Closed Acme renewal',
        value: 2500,
      });
    });

    it('allows a $0 (non-monetary) battle win as long as a name is given', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.battles} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-battles'));
      await user.click(screen.getByTestId('preset-battles-battle'));
      await user.type(screen.getByTestId('battles-amount-input'), '0');
      await user.type(screen.getByTestId('battles-amount-note'), 'Shipped the migration');
      await user.click(screen.getByTestId('battles-amount-submit'));

      expect(onLog).toHaveBeenCalledWith('battles', 1, '+ Battle', {
        description: 'Shipped the migration',
        value: 0,
      });
    });
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
      // When no note is typed, `description: undefined` flows through so
      // the store can fall back to the auto-generated string. (See the
      // note-typing test below for the populated case.)
      expect(onLog).toHaveBeenCalledWith('moneyMoved', 1234.5, '+ Generated', { description: undefined });
    });

    it('strips $ and commas from the typed amount', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-cut'));
      await user.type(screen.getByTestId('moneyMoved-amount-input'), '$1,500');
      await user.click(screen.getByTestId('moneyMoved-amount-submit'));

      expect(onLog).toHaveBeenCalledWith('moneyMoved', 1500, '+ Cut', { description: undefined });
    });

    it('passes the typed note through to onLog as options.description', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-moved'));
      await user.type(screen.getByTestId('moneyMoved-amount-input'), '500');
      // The Money Moved card renders a note input alongside the amount.
      const note = screen.getByTestId('moneyMoved-amount-note');
      await user.type(note, 'Benepass');
      await user.keyboard('{Enter}');

      expect(onLog).toHaveBeenCalledWith('moneyMoved', 500, '+ Moved', { description: 'Benepass' });
    });

    it('whitespace-only note submits as undefined (server falls back to default)', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.moneyMoved} onLog={onLog} />);

      fireEvent.focus(screen.getByTestId('metric-card-moneyMoved'));
      await user.click(screen.getByTestId('preset-moneyMoved-moved'));
      await user.type(screen.getByTestId('moneyMoved-amount-input'), '100');
      await user.type(screen.getByTestId('moneyMoved-amount-note'), '   ');
      await user.keyboard('{Enter}');

      expect(onLog).toHaveBeenCalledWith('moneyMoved', 100, '+ Moved', { description: undefined });
    });

    it('the note input is NOT present on hour-based metrics', () => {
      const onLog = jest.fn();
      render(<MetricCard metric={SEED_METRICS.temporal} onLog={onLog} />);
      // Temporal logs hardcoded deltas, so the editor + note never appear.
      expect(screen.queryByTestId('temporal-amount-note')).not.toBeInTheDocument();
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

  describe('Temporal Focus — editable weekly goal', () => {
    // The Temporal card gets a ✎ pencil button when the parent passes
    // `onUpdateGoal`. Clicking it opens an inline editor row below the
    // eyebrow. Submit calls onUpdateGoal with the parsed hours.

    function temporalMetric(goal = 5) {
      return {
        ...SEED_METRICS.temporal,
        today: 1.5,
        week: 6,
        goal,
        spark: [...SEED_SPARKS.temporal],
      };
    }

    it('pencil button only renders for temporal + onUpdateGoal + active', () => {
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn();
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      // At rest the pencil is hidden (card not active).
      expect(screen.queryByTestId('temporal-edit-goal')).not.toBeInTheDocument();

      // Hover/focus activates the card → pencil appears.
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      expect(screen.getByTestId('temporal-edit-goal')).toBeInTheDocument();
    });

    it('pencil does NOT render without an onUpdateGoal callback', () => {
      const onLog = jest.fn();
      render(<MetricCard metric={temporalMetric()} onLog={onLog} />);
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      expect(screen.queryByTestId('temporal-edit-goal')).not.toBeInTheDocument();
    });

    it('pencil does NOT render on non-temporal metrics even when callback present', () => {
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn();
      // Deep work has a goal; ensure the pencil is gated on metric.id.
      const deepWork = { ...SEED_METRICS.deepWork };
      render(
        <MetricCard
          metric={deepWork}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-deepWork'));
      expect(screen.queryByTestId('deepWork-edit-goal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('temporal-edit-goal')).not.toBeInTheDocument();
    });

    it('clicking the pencil opens the goal editor row pre-filled with the current goal', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn();
      render(
        <MetricCard
          metric={temporalMetric(5)}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));

      expect(screen.getByTestId('temporal-goal-editor-row')).toBeInTheDocument();
      const input = screen.getByTestId('temporal-goal-editor-input');
      expect(input).toHaveValue('5');
    });

    it('typing a new value + Enter calls onUpdateGoal with the parsed hours', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn().mockResolvedValue(undefined);
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      const input = screen.getByTestId('temporal-goal-editor-input');
      await user.clear(input);
      await user.type(input, '8');
      await user.keyboard('{Enter}');

      expect(onUpdateGoal).toHaveBeenCalledWith(8);
    });

    it('clicking ✓ submits same as Enter', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn().mockResolvedValue(undefined);
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      const input = screen.getByTestId('temporal-goal-editor-input');
      await user.clear(input);
      await user.type(input, '12.5');
      await user.click(screen.getByTestId('temporal-goal-editor-submit'));

      expect(onUpdateGoal).toHaveBeenCalledWith(12.5);
    });

    it('Escape cancels and closes the editor without calling onUpdateGoal', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn();
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      await user.type(screen.getByTestId('temporal-goal-editor-input'), '99');
      await user.keyboard('{Escape}');

      expect(onUpdateGoal).not.toHaveBeenCalled();
      expect(screen.queryByTestId('temporal-goal-editor-row')).not.toBeInTheDocument();
    });

    it('× cancels and closes the editor', async () => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn();
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      await user.click(screen.getByTestId('temporal-goal-editor-cancel'));
      expect(onUpdateGoal).not.toHaveBeenCalled();
      expect(screen.queryByTestId('temporal-goal-editor-row')).not.toBeInTheDocument();
    });

    // Validation edge cases — same parser shape as AmountEditor.
    it.each([
      ['empty input',          ''],
      ['zero',                 '0'],
      ['negative',             '-5'],
      ['scientific notation',  '1e3'],
      ['double decimal',       '12..3'],
      ['multi-segment',        '1.2.3'],
      ['leading dot',          '.50'],
      ['trailing dot',         '12.'],
      ['letters mixed in',     '12abc'],
      ['above max 40',         '50'],
      ['below min 0.5',        '0.25'],
    ])('rejects invalid input — %s', async (_label, bad) => {
      const user = userEvent.setup();
      const onLog = jest.fn();
      const onUpdateGoal = jest.fn();
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={onLog}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      const input = screen.getByTestId('temporal-goal-editor-input');
      await user.clear(input);
      if (bad.length > 0) await user.type(input, bad);
      await user.keyboard('{Enter}');
      expect(onUpdateGoal).not.toHaveBeenCalled();
      // Editor stays open so the user can correct.
      expect(screen.getByTestId('temporal-goal-editor-row')).toBeInTheDocument();
    });

    it('accepts boundary values 0.5 and 40', async () => {
      const user = userEvent.setup();
      const onUpdateGoal = jest.fn().mockResolvedValue(undefined);
      const { rerender } = render(
        <MetricCard
          metric={temporalMetric()}
          onLog={jest.fn()}
          onUpdateGoal={onUpdateGoal}
        />,
      );

      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      await user.clear(screen.getByTestId('temporal-goal-editor-input'));
      await user.type(screen.getByTestId('temporal-goal-editor-input'), '0.5');
      await user.keyboard('{Enter}');
      expect(onUpdateGoal).toHaveBeenLastCalledWith(0.5);

      rerender(
        <MetricCard
          metric={temporalMetric()}
          onLog={jest.fn()}
          onUpdateGoal={onUpdateGoal}
        />,
      );
      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      await user.clear(screen.getByTestId('temporal-goal-editor-input'));
      await user.type(screen.getByTestId('temporal-goal-editor-input'), '40');
      await user.keyboard('{Enter}');
      expect(onUpdateGoal).toHaveBeenLastCalledWith(40);
    });

    // CodeRabbit PR-68 catch: `finally { setEditingGoal(false) }` hid the
    // editor on failure too, making errors look like silent successes. The
    // editor must stay open if the update rejects so the user can retry.
    it('keeps the editor open when onUpdateGoal rejects', async () => {
      const user = userEvent.setup();
      const onUpdateGoal = jest.fn().mockRejectedValue(new Error('boom'));
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={jest.fn()}
          onUpdateGoal={onUpdateGoal}
        />,
      );

      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      await user.clear(screen.getByTestId('temporal-goal-editor-input'));
      await user.type(screen.getByTestId('temporal-goal-editor-input'), '7');
      await user.keyboard('{Enter}');

      // Editor stays mounted so the user can retry in place.
      await waitFor(() => {
        expect(screen.getByTestId('temporal-goal-editor-error')).toHaveTextContent('boom');
      });
      expect(screen.getByTestId('temporal-goal-editor-row')).toBeInTheDocument();
      expect(screen.getByTestId('temporal-goal-editor-input')).toHaveValue('7');
      expect(onUpdateGoal).toHaveBeenCalledWith(7);
    });

    it('disables the editor while saving so duplicate submits do not double-post', async () => {
      const user = userEvent.setup();
      let resolveSave!: () => void;
      const onUpdateGoal = jest.fn(
        () => new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
      );
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={jest.fn()}
          onUpdateGoal={onUpdateGoal}
        />,
      );

      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      const input = screen.getByTestId('temporal-goal-editor-input');
      await user.clear(input);
      await user.type(input, '9');
      await user.click(screen.getByTestId('temporal-goal-editor-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('temporal-goal-editor-saving')).toBeInTheDocument();
        expect(input).toBeDisabled();
      });

      await user.click(screen.getByTestId('temporal-goal-editor-submit'));
      expect(onUpdateGoal).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSave();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(screen.queryByTestId('temporal-goal-editor-row')).not.toBeInTheDocument();
      });
    });

    it('closes the editor on successful update', async () => {
      const user = userEvent.setup();
      const onUpdateGoal = jest.fn().mockResolvedValue(undefined);
      render(
        <MetricCard
          metric={temporalMetric()}
          onLog={jest.fn()}
          onUpdateGoal={onUpdateGoal}
        />,
      );

      fireEvent.focus(screen.getByTestId('metric-card-temporal'));
      await user.click(screen.getByTestId('temporal-edit-goal'));
      await user.clear(screen.getByTestId('temporal-goal-editor-input'));
      await user.type(screen.getByTestId('temporal-goal-editor-input'), '6');
      await user.keyboard('{Enter}');

      // wait a microtask so the async onSubmit resolves
      await Promise.resolve();
      expect(onUpdateGoal).toHaveBeenCalledWith(6);
      expect(screen.queryByTestId('temporal-goal-editor-row')).not.toBeInTheDocument();
    });
  });
});
