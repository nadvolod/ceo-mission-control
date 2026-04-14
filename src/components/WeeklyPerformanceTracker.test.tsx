import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeeklyPerformanceTracker } from './WeeklyPerformanceTracker';

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

    const buttons = screen.getAllByRole('button', { name: /^\+/ });
    await user.click(buttons[0]);

    // All quick-add buttons should be disabled while adding
    const quickAddButtons = screen.getAllByRole('button', { name: /^\+/ });
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
