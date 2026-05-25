import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mock useDashboardData so the page doesn't hit real APIs
// ---------------------------------------------------------------------------
const mockLoadAllData = jest.fn();
const mockHandlers = {
  loadAllData: mockLoadAllData,
  handleCreateTask: jest.fn(),
  handleUpdateTask: jest.fn(),
  handleDeleteTask: jest.fn(),
  handleMonarchRefresh: jest.fn(),
  handleAddProjectionAdjustment: jest.fn(),
  handleRemoveProjectionAdjustment: jest.fn(),
  handleAddFinancialEntry: jest.fn(),
  handleAddFocusSession: jest.fn(),
  handleLogDay: jest.fn(),
  handleSubmitWeeklyReview: jest.fn(),
  handleSubmitMonthlyReview: jest.fn(),
  handleDeleteMonthlyReview: jest.fn(),
};

const baseDashboardData = {
  aiTasks: [],
  taskStats: { total: 0, todo: 0, doing: 0, doneToday: 0, overdue: 0 },
  initiatives: [],
  scorecard: {
    date: '2026-04-14',
    topThree: [],
    biggestBlocker: '',
    ignoreToday: [],
    criticalMoves: { moneyMove: '', strategicMove: '', riskReduction: '' },
    focusBlocks: [],
    temporalTarget: 5,
    temporalActual: 2,
  },
  financialData: {
    todaysMetrics: { date: '2026-04-14', entries: [], totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 } },
    weeklyTotals: { moved: 1200, generated: 0, cut: 0, netImpact: 1200 },
    monthlyTotals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
    recentEntries: [],
  },
  focusData: {
    todaysMetrics: { totalHours: 0, sessions: [], byCategory: {} },
    weeklyTotals: { Temporal: 6.5 },
    weekOverWeek: { currentTotal: 0, previousTotal: 0, absoluteChange: 0, percentageChange: 0, byCategoryChange: {} },
    dailyTrend: [],
    rollingAverage: [],
    categoryDistribution: {},
    recentSessions: [],
  },
  monarchData: null,
  monarchError: null,
  monarchLoading: false,
  projectionData: null,
  weeklyTrackerData: {
    success: true,
    todaysEntry: null,
    currentWeekSummary: {
      weekStartDate: '2026-04-13',
      weekEndDate: '2026-04-19',
      revenue: 0,
      pipelineTotal: 0,
      deepWorkTotal: 12.5,
      consistencyScore: 0,
      daysTracked: 0,
      zeroDays: 0,
      goodDays: 0,
      dailyEntries: [],
      temporalTarget: 5,
    },
    previousWeekSummary: {
      weekStartDate: '2026-04-06',
      weekEndDate: '2026-04-12',
      revenue: 0,
      pipelineTotal: 0,
      deepWorkTotal: 0,
      consistencyScore: 0,
      daysTracked: 0,
      zeroDays: 0,
      goodDays: 0,
      dailyEntries: [],
      temporalTarget: 5,
    },
    dailyTrend: [],
    recentReviews: [],
    timestamp: '2026-04-14T00:00:00Z',
  },
  monthlyReviewData: {
    success: true,
    currentMonthReview: null,
    recentReviews: [],
    ratingsTrend: [],
    timestamp: '2026-04-14T00:00:00Z',
  },
  hasGarminData: false,
  isLoading: false,
  ...mockHandlers,
};

jest.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: jest.fn(() => baseDashboardData),
}));

// ---------------------------------------------------------------------------
// Mock heavy child components as lightweight stubs (keeps tests fast & focused
// on page composition, not component internals)
// ---------------------------------------------------------------------------
jest.mock('@/components/WeeklyPerformanceTracker', () => ({
  WeeklyPerformanceTracker: () => <div data-testid="weekly-performance">Weekly Performance Tracker</div>,
}));
jest.mock('@/components/HealthIntelligenceDashboard', () => ({
  HealthIntelligenceDashboard: () => <div data-testid="health-intelligence">Health Intelligence</div>,
}));
jest.mock('@/components/FocusOptimization', () => ({
  FocusOptimization: () => <div data-testid="focus-optimization">Focus Optimization</div>,
}));
jest.mock('@/components/MissionTracker', () => ({
  MissionTracker: () => <div data-testid="mission-tracker">Mission Command</div>,
}));
jest.mock('@/components/MonthlyReviewTracker', () => ({
  MonthlyReviewTracker: () => <div data-testid="monthly-review">Monthly Review</div>,
}));
jest.mock('@/components/TaskDashboard', () => ({
  TaskDashboard: () => <div data-testid="task-dashboard">Tasks</div>,
}));
// These two should NOT be imported/rendered after cleanup
jest.mock('@/components/RevenueProjectionWidget', () => ({
  RevenueProjectionWidget: () => <div data-testid="revenue-projections">Revenue Projections</div>,
}));
jest.mock('@/components/FocusHoursTracker', () => ({
  FocusHoursTracker: () => <div data-testid="focus-hours">Focus Hours Dashboard</div>,
}));
jest.mock('@/components/DashboardTabs', () => ({
  DashboardTabs: ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => (
    <div data-testid="dashboard-tabs">
      <button onClick={() => onTabChange('dashboard')} data-active={activeTab === 'dashboard'}>Dashboard</button>
      <button onClick={() => onTabChange('tasks')} data-active={activeTab === 'tasks'}>Tasks</button>
      <button onClick={() => onTabChange('monthly-review')} data-active={activeTab === 'monthly-review'}>Monthly Review</button>
    </div>
  ),
  TAB_IDS: ['dashboard', 'tasks', 'monthly-review'],
}));
jest.mock('@/lib/derive-focus', () => ({
  enrichScorecard: jest.fn((s) => s),
}));

import { useDashboardData } from '@/hooks/useDashboardData';
import HomePage from '@/app/dashboard/page';

const mockUseDashboardData = useDashboardData as jest.MockedFunction<typeof useDashboardData>;

describe('Dashboard Page - Phase 1: Component removal & reorder', () => {
  beforeEach(() => {
    mockUseDashboardData.mockReturnValue(baseDashboardData as any);
  });

  // --- Positive cases ---

  it('renders Weekly Performance Tracker as the first section', () => {
    render(<HomePage />);
    const sections = screen.getAllByTestId(/weekly-performance|health-intelligence|focus-optimization|mission-tracker|monthly-review|task-dashboard/);
    expect(sections[0]).toHaveAttribute('data-testid', 'weekly-performance');
  });

  it('renders Health Intelligence as the second section after the strip relocation', () => {
    render(<HomePage />);
    const sections = screen.getAllByTestId(/weekly-performance|health-intelligence|focus-optimization|mission-tracker|monthly-review|task-dashboard/);
    expect(sections[1]).toHaveAttribute('data-testid', 'health-intelligence');
  });

  it('does NOT render the removed Financial Command Center', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('financial-command')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Financial Command Center/i })).not.toBeInTheDocument();
  });

  it('does NOT render the removed FinancialMetricsDashboard (Financial Impact Tracking)', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('financial-impact')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Financial Impact Tracking/i })).not.toBeInTheDocument();
  });

  // --- Negative cases ---

  it('does NOT render Revenue Projections', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('revenue-projections')).not.toBeInTheDocument();
    expect(screen.queryByText('Revenue Projections')).not.toBeInTheDocument();
  });

  it('does NOT render Focus Hours Dashboard', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('focus-hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Focus Hours Dashboard')).not.toBeInTheDocument();
  });

  // --- Edge cases ---

  it('renders the remaining 3 dashboard-tab sections on default view', () => {
    render(<HomePage />);
    expect(screen.getByTestId('weekly-performance')).toBeInTheDocument();
    expect(screen.getByTestId('health-intelligence')).toBeInTheDocument();
    expect(screen.getByTestId('focus-optimization')).toBeInTheDocument();
  });

  it('shows loading spinner when isLoading is true', () => {
    mockUseDashboardData.mockReturnValue({ ...baseDashboardData, isLoading: true } as any);
    render(<HomePage />);
    expect(screen.getByText('Loading Mission Control...')).toBeInTheDocument();
    expect(screen.queryByTestId('weekly-performance')).not.toBeInTheDocument();
  });

  it('shows error when scorecard is null', () => {
    mockUseDashboardData.mockReturnValue({ ...baseDashboardData, scorecard: null } as any);
    render(<HomePage />);
    expect(screen.getByText('Cannot Load Workspace Data')).toBeInTheDocument();
    expect(screen.queryByTestId('weekly-performance')).not.toBeInTheDocument();
  });

  it('renders compact header with Mission Control title', () => {
    render(<HomePage />);
    expect(screen.getByText('Mission Control')).toBeInTheDocument();
  });

  it('renders the top-of-dashboard key metrics strip with all seven cards', () => {
    render(<HomePage />);
    expect(screen.getByTestId('key-metrics-strip')).toBeInTheDocument();
    expect(screen.getByTestId('metric-cash')).toBeInTheDocument();
    expect(screen.getByTestId('metric-cash-mom')).toBeInTheDocument();
    expect(screen.getByTestId('metric-net-worth')).toBeInTheDocument();
    expect(screen.getByTestId('metric-total-debt')).toBeInTheDocument();
    expect(screen.getByTestId('metric-temporal')).toBeInTheDocument();
    expect(screen.getByTestId('metric-focus-hours')).toBeInTheDocument();
    expect(screen.getByTestId('metric-money-moved')).toBeInTheDocument();
  });

  it('renders Focus Hours tile with the weekly deepWorkTotal from the tracker', () => {
    render(<HomePage />);
    // baseDashboardData mocks currentWeekSummary.deepWorkTotal = 12.5
    expect(screen.getByTestId('metric-focus-hours')).toHaveTextContent('12.5h');
  });

  it('renders dash fallbacks for monarch-derived metrics when monarchData is null', () => {
    mockUseDashboardData.mockReturnValue({ ...baseDashboardData, monarchData: null } as any);
    render(<HomePage />);
    // 4 monarch-backed metric cards (cash, MoM, net worth, total debt) render "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('renders key metric values from dashboard data', () => {
    mockUseDashboardData.mockReturnValue({
      ...baseDashboardData,
      monarchData: {
        cashPosition: 10000,
        netWorth: 150000,
        totalAssets: 200000,
        totalLiabilities: 50000,
        runwayMonths: 18,
        monthlyIncome: 5000,
        monthlyExpenses: 3000,
        previousMonthIncome: 4000,
        previousMonthExpenses: 3000,
      },
    } as any);
    render(<HomePage />);
    // Compact formatting: $10K, $150K, $50K, +100.0%, 6.5h, $1.2K
    expect(screen.getByTestId('metric-cash')).toHaveTextContent('$10.0K');
    expect(screen.getByTestId('metric-cash-mom')).toHaveTextContent('+100.0%');
    expect(screen.getByTestId('metric-net-worth')).toHaveTextContent('$150.0K');
    expect(screen.getByTestId('metric-total-debt')).toHaveTextContent('$50.0K');
    expect(screen.getByTestId('metric-temporal')).toHaveTextContent('6.5h');
    expect(screen.getByTestId('metric-money-moved')).toHaveTextContent('$1.2K');
  });

  it('renders cash growth dash when previous net is zero and current net is non-zero', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseDashboardData.mockReturnValue({
      ...baseDashboardData,
      monarchData: {
        cashPosition: 10000,
        netWorth: 0,
        totalAssets: 10000,
        totalLiabilities: 10000,
        runwayMonths: 0,
        monthlyIncome: 0,
        monthlyExpenses: 500,
        previousMonthIncome: 1000,
        previousMonthExpenses: 1000,
      },
    } as any);
    render(<HomePage />);
    expect(screen.getByTestId('metric-cash-mom')).toHaveTextContent('—');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('cash growth MoM is undefined'),
    );
    warnSpy.mockRestore();
  });
});

describe('Dashboard Page - Phase 3: Tab-based layout', () => {
  beforeEach(() => {
    mockUseDashboardData.mockReturnValue(baseDashboardData as any);
  });

  // --- Positive cases ---

  it('renders the tab bar', () => {
    render(<HomePage />);
    expect(screen.getByTestId('dashboard-tabs')).toBeInTheDocument();
  });

  it('default tab shows daily sections (Weekly Perf, Health, Focus)', () => {
    render(<HomePage />);
    expect(screen.getByTestId('weekly-performance')).toBeInTheDocument();
    expect(screen.getByTestId('health-intelligence')).toBeInTheDocument();
    expect(screen.getByTestId('focus-optimization')).toBeInTheDocument();
  });

  it('default tab does NOT show Tasks or Monthly Review sections', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('task-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('monthly-review')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mission-tracker')).not.toBeInTheDocument();
  });

  it('Tasks tab shows only TaskDashboard', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByText('Tasks'));

    expect(screen.getByTestId('task-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('weekly-performance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('focus-optimization')).not.toBeInTheDocument();
  });

  it('Monthly Review tab shows MonthlyReviewTracker and MissionTracker', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByText('Monthly Review'));

    expect(screen.getByTestId('monthly-review')).toBeInTheDocument();
    expect(screen.getByTestId('mission-tracker')).toBeInTheDocument();
    expect(screen.queryByTestId('weekly-performance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-dashboard')).not.toBeInTheDocument();
  });
});
