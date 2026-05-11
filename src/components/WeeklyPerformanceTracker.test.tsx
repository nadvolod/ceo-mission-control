import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeeklyPerformanceTracker } from './WeeklyPerformanceTracker';
import type { DailyFinancialMetrics } from '@/lib/financial-tracker';

// Mock recharts to avoid canvas/SVG rendering issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  ReferenceLine: () => null,
}));

const baseWeekSummary = {
  weekStartDate: '2026-04-13',
  weekEndDate: '2026-04-19',
  revenue: 0,
  pipelineTotal: 0,
  deepWorkTotal: 0,
  consistencyScore: 0,
  daysTracked: 0,
  goodDays: 0,
  zeroDays: 0,
  dailyEntries: [],
  temporalTarget: 5,
};

const emptyFin: DailyFinancialMetrics = {
  date: '2026-05-11',
  entries: [],
  totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
};
const emptyTotals = { moved: 0, generated: 0, cut: 0, netImpact: 0 };

const baseProps = {
  todaysEntry: null,
  currentWeekSummary: baseWeekSummary,
  previousWeekSummary: { ...baseWeekSummary, weekStartDate: '2026-04-06' },
  dailyTrend: [],
  recentReviews: [],
  onLogDay: jest.fn().mockResolvedValue(undefined),
  onSubmitReview: jest.fn().mockResolvedValue(undefined),
  onAddFocusSession: jest.fn().mockResolvedValue(undefined),
  temporalActual: 0,
  todaysFinancial: emptyFin,
  weekFinancialByDay: Array.from({ length: 7 }, (_, i) => ({
    ...emptyFin,
    date: `2026-05-${String(11 + i).padStart(2, '0')}`,
  })),
  weekFinancialTotals: emptyTotals,
  previousWeekFinancialTotals: emptyTotals,
  dailyFinancialTrend: Array.from({ length: 30 }, (_, i) => ({
    ...emptyFin,
    date: `2026-04-${String(11 + i).padStart(2, '0')}`,
  })),
  onAddFinancialEntry: jest.fn().mockResolvedValue(undefined),
};

function makeFocusSession(overrides: Record<string, unknown> = {}) {
  return {
    category: 'Temporal',
    hours: 1,
    description: '1h Temporal focus block',
    timestamp: '2026-04-14T10:00:00Z',
    ...overrides,
  };
}

describe('WeeklyPerformanceTracker - Quick-Add Focus Buttons', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Positive cases ---

  it('calls onAddFocusSession when quick-add button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<WeeklyPerformanceTracker {...baseProps} />);

    const button = screen.getByRole('button', { name: /\+1h Temporal/i });
    await user.click(button);

    expect(baseProps.onAddFocusSession).toHaveBeenCalledWith(
      'Temporal',
      1,
      expect.stringContaining('Temporal')
    );
  });

  it('shows success confirmation after quick-add', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<WeeklyPerformanceTracker {...baseProps} />);

    const button = screen.getByRole('button', { name: /\+1h Temporal/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Added!/)).toBeInTheDocument();
    });
  });

  it('displays today focus total when provided', () => {
    render(<WeeklyPerformanceTracker {...baseProps} todaysFocusTotal={3.5} />);

    expect(screen.getByText(/3\.5h/)).toBeInTheDocument();
  });

  it('lists recent focus sessions when provided', () => {
    const sessions = [
      makeFocusSession({ category: 'Temporal', hours: 1, description: '1h Temporal focus block' }),
      makeFocusSession({ category: 'Finance', hours: 2, description: '2h Finance focus block', timestamp: '2026-04-14T11:00:00Z' }),
      makeFocusSession({ category: 'Revenue', hours: 0.5, description: '0.5h Revenue focus block', timestamp: '2026-04-14T12:00:00Z' }),
    ];

    render(<WeeklyPerformanceTracker {...baseProps} todaysFocusSessions={sessions} todaysFocusTotal={3.5} />);

    expect(screen.getByText(/Temporal focus block/)).toBeInTheDocument();
    expect(screen.getByText(/Finance focus block/)).toBeInTheDocument();
    expect(screen.getByText(/Revenue focus block/)).toBeInTheDocument();
  });

  // --- Negative cases ---

  it('handles quick-add API error without crashing', async () => {
    const errorFn = jest.fn().mockRejectedValue(new Error('API error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<WeeklyPerformanceTracker {...baseProps} onAddFocusSession={errorFn} />);

    const button = screen.getByRole('button', { name: /\+1h Temporal/i });
    await user.click(button);

    // Should not crash, button should be re-enabled
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    consoleSpy.mockRestore();
  });

  it('disables quick-add buttons while adding', async () => {
    // Create a promise that we control to keep the add "in progress"
    let resolveAdd: () => void;
    const pendingAdd = new Promise<void>((resolve) => { resolveAdd = resolve; });
    const slowAdd = jest.fn(() => pendingAdd);

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<WeeklyPerformanceTracker {...baseProps} onAddFocusSession={slowAdd} />);

    const buttons = screen.getAllByRole('button', { name: /^\+\d/ });
    await user.click(buttons[0]);

    // All quick-add buttons should be disabled while adding
    const quickAddButtons = screen.getAllByRole('button', { name: /^\+\d/ });
    quickAddButtons.forEach(btn => {
      expect(btn).toBeDisabled();
    });

    // Resolve the promise to clean up
    await act(async () => { resolveAdd!(); });
  });

  // --- Edge cases ---

  it('shows empty state when no focus sessions exist', () => {
    render(<WeeklyPerformanceTracker {...baseProps} todaysFocusSessions={[]} todaysFocusTotal={0} />);

    // Should not show session list, but the section should still exist
    expect(screen.queryByText(/Temporal focus block/)).not.toBeInTheDocument();
  });

  it('auto-clears success confirmation after timeout', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<WeeklyPerformanceTracker {...baseProps} />);

    const button = screen.getByRole('button', { name: /\+1h Temporal/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Added!/)).toBeInTheDocument();
    });

    // Advance past the 2-second timeout
    act(() => { jest.advanceTimersByTime(2500); });

    expect(screen.queryByText(/Added!/)).not.toBeInTheDocument();
  });

  it('shows at most 5 sessions in compact list', () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      makeFocusSession({
        description: `Session ${i + 1}`,
        timestamp: `2026-04-14T${String(10 + i).padStart(2, '0')}:00:00Z`,
      })
    );

    render(<WeeklyPerformanceTracker {...baseProps} todaysFocusSessions={sessions} todaysFocusTotal={8} />);

    // Should show max 5 sessions
    const sessionItems = screen.getAllByText(/^Session \d+$/);
    expect(sessionItems.length).toBeLessThanOrEqual(5);
  });
});

describe('WeeklyPerformanceTracker - Net Today card', () => {
  it('renders Net Today card with currency value and category breakdown', () => {
    render(
      <WeeklyPerformanceTracker
        {...baseProps}
        todaysFinancial={{
          date: '2026-05-11',
          entries: [],
          totals: { moved: 100, generated: 250, cut: 50, netImpact: 400 },
        }}
      />
    );
    expect(screen.getByTestId('net-today-value')).toHaveTextContent('$400');
    expect(screen.getByTestId('net-today-breakdown')).toHaveTextContent('mv $100');
    expect(screen.getByTestId('net-today-breakdown')).toHaveTextContent('gen $250');
    expect(screen.getByTestId('net-today-breakdown')).toHaveTextContent('cut $50');
  });
});

describe('WeeklyPerformanceTracker - Money Move quick-add', () => {
  it('clicking + Cut opens the form with cut preselected and submits to onAddFinancialEntry', async () => {
    const user = userEvent.setup();
    const onAddFinancialEntry = jest.fn().mockResolvedValue(undefined);
    render(<WeeklyPerformanceTracker {...baseProps} onAddFinancialEntry={onAddFinancialEntry} />);

    await user.click(screen.getByRole('button', { name: /\+ cut/i }));
    await user.type(screen.getByLabelText(/amount/i), '150');
    await user.type(screen.getByLabelText(/description/i), 'storage');
    await user.click(screen.getByRole('button', { name: /save move/i }));

    expect(onAddFinancialEntry).toHaveBeenCalledWith('cut', 150, 'storage');
  });

  it('disables Save move when amount is 0/empty or description is empty', async () => {
    const user = userEvent.setup();
    render(<WeeklyPerformanceTracker {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /\+ generated/i }));
    expect(screen.getByRole('button', { name: /save move/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/amount/i), '10');
    expect(screen.getByRole('button', { name: /save move/i })).toBeDisabled();
  });
});

describe('WeeklyPerformanceTracker - Per-day money line', () => {
  it('renders a $ line per day reflecting that day\'s netImpact', () => {
    const week = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(11 + i).padStart(2, '0')}`,
      entries: i === 2 ? [{ id: 'x', category: 'generated' as const, amount: 500, description: 'invoice', timestamp: '2026-05-13T10:00:00Z' }] : [],
      totals: { moved: 0, generated: 0, cut: 0, netImpact: i === 2 ? 500 : 0 },
    }));
    render(<WeeklyPerformanceTracker {...baseProps} weekFinancialByDay={week} />);
    const dayCells = screen.getAllByTestId(/^day-money-/);
    expect(dayCells).toHaveLength(7);
    expect(dayCells[2]).toHaveTextContent('$500');
    expect(dayCells[2].className).toMatch(/text-emerald|text-green/);
    expect(dayCells[0]).toHaveTextContent('—');
  });

  it('hovering a populated day money cell reveals its entries', async () => {
    const user = userEvent.setup();
    const week = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(11 + i).padStart(2, '0')}`,
      entries: i === 2 ? [{
        id: 'wed', category: 'cut' as const, amount: 150,
        description: 'storage units', timestamp: '2026-05-13T10:00:00Z',
      }] : [],
      totals: { moved: 0, generated: 0, cut: i === 2 ? 150 : 0, netImpact: i === 2 ? 150 : 0 },
    }));
    render(<WeeklyPerformanceTracker {...baseProps} weekFinancialByDay={week} />);
    const wed = screen.getByTestId('day-money-2');
    await user.hover(wed);
    expect(screen.getByText('storage units')).toBeInTheDocument();
  });
});

describe('WeeklyPerformanceTracker - Weekly Net Impact', () => {
  it('weekly Net Impact card uses weekFinancialTotals, not review revenue', () => {
    render(
      <WeeklyPerformanceTracker
        {...baseProps}
        weekFinancialTotals={{ moved: 100, generated: 250, cut: 50, netImpact: 400 }}
        previousWeekFinancialTotals={{ moved: 0, generated: 100, cut: 0, netImpact: 100 }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Weekly$/i }));
    expect(screen.getByTestId('weekly-net-impact')).toHaveTextContent('$400');
    expect(screen.getByTestId('weekly-net-impact-prev')).toHaveTextContent('$100');
    expect(screen.getByTestId('weekly-moved')).toHaveTextContent('$100');
    expect(screen.getByTestId('weekly-generated')).toHaveTextContent('$250');
    expect(screen.getByTestId('weekly-cut')).toHaveTextContent('$50');
  });
});

describe('WeeklyPerformanceTracker - Review form without revenue', () => {
  it('does not render a Revenue input in the review form', () => {
    render(<WeeklyPerformanceTracker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /^Review$/i }));
    expect(screen.queryByLabelText(/revenue this week/i)).not.toBeInTheDocument();
  });

  it('submits the review without a revenue field', async () => {
    const user = userEvent.setup();
    const onSubmitReview = jest.fn().mockResolvedValue(undefined);
    render(<WeeklyPerformanceTracker {...baseProps} onSubmitReview={onSubmitReview} />);
    fireEvent.click(screen.getByRole('button', { name: /^Review$/i }));
    await user.type(screen.getByLabelText(/where did I slip/i), 'wed deep work missed');
    await user.click(screen.getByRole('button', { name: /submit weekly review/i }));
    expect(onSubmitReview).toHaveBeenCalledWith(
      expect.not.objectContaining({ revenue: expect.anything() })
    );
  });
});
