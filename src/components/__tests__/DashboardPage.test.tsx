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
    weeklyTotals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
    monthlyTotals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
    recentEntries: [],
  },
  focusData: {
    todaysMetrics: { totalHours: 0, sessions: [], byCategory: {} },
    weeklyTotals: {},
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
      totalDeepWork: 0,
      totalPipeline: 0,
      daysLogged: 0,
      goodDays: 0,
      zeroDays: 0,
      consistency: 0,
      temporalTarget: 5,
      dailyEntries: [],
    },
    previousWeekSummary: {
      weekStartDate: '2026-04-06',
      totalDeepWork: 0,
      totalPipeline: 0,
      daysLogged: 0,
      goodDays: 0,
      zeroDays: 0,
      consistency: 0,
      temporalTarget: 5,
      dailyEntries: [],
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
jest.mock('@/components/FinancialMetricsDashboard', () => ({
  FinancialMetricsDashboard: () => <div data-testid="financial-impact">Financial Impact Tracking</div>,
}));
jest.mock('@/components/WeeklyPerformanceTracker', () => ({
  WeeklyPerformanceTracker: () => <div data-testid="weekly-performance">Weekly Performance Tracker</div>,
}));
jest.mock('@/components/FinancialCommandCenter', () => ({
  FinancialCommandCenter: () => <div data-testid="financial-command">Financial Command Center</div>,
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

  it('renders Financial Impact Tracking as the first section', () => {
    render(<HomePage />);
    const sections = screen.getAllByTestId(/financial-impact|weekly-performance|financial-command|health-intelligence|focus-optimization|mission-tracker|monthly-review|task-dashboard/);
    expect(sections[0]).toHaveAttribute('data-testid', 'financial-impact');
  });

  it('renders Weekly Performance Tracker as the second section', () => {
    render(<HomePage />);
    const sections = screen.getAllByTestId(/financial-impact|weekly-performance|financial-command|health-intelligence|focus-optimization|mission-tracker|monthly-review|task-dashboard/);
    expect(sections[1]).toHaveAttribute('data-testid', 'weekly-performance');
  });

  it('renders Financial Command Center as the third section', () => {
    render(<HomePage />);
    const sections = screen.getAllByTestId(/financial-impact|weekly-performance|financial-command|health-intelligence|focus-optimization|mission-tracker|monthly-review|task-dashboard/);
    expect(sections[2]).toHaveAttribute('data-testid', 'financial-command');
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

  it('renders all 5 dashboard-tab sections on default view', () => {
    render(<HomePage />);
    expect(screen.getByTestId('financial-impact')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-performance')).toBeInTheDocument();
    expect(screen.getByTestId('financial-command')).toBeInTheDocument();
    expect(screen.getByTestId('health-intelligence')).toBeInTheDocument();
    expect(screen.getByTestId('focus-optimization')).toBeInTheDocument();
  });

  it('shows loading spinner when isLoading is true', () => {
    mockUseDashboardData.mockReturnValue({ ...baseDashboardData, isLoading: true } as any);
    render(<HomePage />);
    expect(screen.getByText('Loading Mission Control...')).toBeInTheDocument();
    expect(screen.queryByTestId('financial-impact')).not.toBeInTheDocument();
  });

  it('shows error when scorecard is null', () => {
    mockUseDashboardData.mockReturnValue({ ...baseDashboardData, scorecard: null } as any);
    render(<HomePage />);
    expect(screen.getByText('Cannot Load Workspace Data')).toBeInTheDocument();
    expect(screen.queryByTestId('financial-impact')).not.toBeInTheDocument();
  });

  it('renders page header with CEO Mission Control title', () => {
    render(<HomePage />);
    expect(screen.getByText('CEO Mission Control')).toBeInTheDocument();
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

  it('default tab shows daily sections (Financial Impact, Weekly Perf, etc.)', () => {
    render(<HomePage />);
    expect(screen.getByTestId('financial-impact')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-performance')).toBeInTheDocument();
    expect(screen.getByTestId('financial-command')).toBeInTheDocument();
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
    expect(screen.queryByTestId('financial-impact')).not.toBeInTheDocument();
    expect(screen.queryByTestId('weekly-performance')).not.toBeInTheDocument();
  });

  it('Monthly Review tab shows MonthlyReviewTracker and MissionTracker', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByText('Monthly Review'));

    expect(screen.getByTestId('monthly-review')).toBeInTheDocument();
    expect(screen.getByTestId('mission-tracker')).toBeInTheDocument();
    expect(screen.queryByTestId('financial-impact')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-dashboard')).not.toBeInTheDocument();
  });
});
