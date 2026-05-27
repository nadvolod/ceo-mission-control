import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardTabs, TAB_IDS } from './DashboardTabs';

describe('DashboardTabs', () => {
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Positive cases ---

  it('renders all 3 tab buttons', () => {
    render(<DashboardTabs activeTab="dashboard" onTabChange={mockOnTabChange} />);

    expect(screen.getByRole('button', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Monthly Review/i })).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<DashboardTabs activeTab="dashboard" onTabChange={mockOnTabChange} />);

    const dashboardTab = screen.getByRole('button', { name: /Dashboard/i });
    expect(dashboardTab.className).toMatch(/bg-blue|border-blue|text-blue/);
  });

  it('calls onTabChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardTabs activeTab="dashboard" onTabChange={mockOnTabChange} />);

    await user.click(screen.getByRole('button', { name: /Tasks/i }));
    expect(mockOnTabChange).toHaveBeenCalledWith('tasks');
  });

  // --- Negative cases ---

  it('does not call onTabChange when clicking the already-active tab', async () => {
    const user = userEvent.setup();
    render(<DashboardTabs activeTab="dashboard" onTabChange={mockOnTabChange} />);

    await user.click(screen.getByRole('button', { name: /Dashboard/i }));
    expect(mockOnTabChange).not.toHaveBeenCalled();
  });

  // --- Edge cases ---

  it('preserves active state on re-render with same props', () => {
    const { rerender } = render(<DashboardTabs activeTab="tasks" onTabChange={mockOnTabChange} />);

    const tasksTab = screen.getByRole('button', { name: /Tasks/i });
    expect(tasksTab.className).toMatch(/bg-blue|border-blue|text-blue/);

    rerender(<DashboardTabs activeTab="tasks" onTabChange={mockOnTabChange} />);

    const tasksTabAfter = screen.getByRole('button', { name: /Tasks/i });
    expect(tasksTabAfter.className).toMatch(/bg-blue|border-blue|text-blue/);
  });

  it('exports TAB_IDS for external use', () => {
    expect(TAB_IDS).toContain('dashboard');
    expect(TAB_IDS).toContain('tasks');
    expect(TAB_IDS).toContain('monthly-review');
  });

  it('renders tabs in order: Dashboard, Monthly Review, Tasks', () => {
    render(<DashboardTabs activeTab="dashboard" onTabChange={mockOnTabChange} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent?.trim())).toEqual([
      'Dashboard',
      'Monthly Review',
      'Tasks',
    ]);
  });

  it('TAB_IDS array order is dashboard, monthly-review, tasks', () => {
    expect(Array.from(TAB_IDS)).toEqual(['dashboard', 'monthly-review', 'tasks']);
  });

  it('renders tabs in a horizontally scrollable container for mobile', () => {
    render(<DashboardTabs activeTab="dashboard" onTabChange={mockOnTabChange} />);

    expect(screen.getByTestId('dashboard-tabs-scroll').className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('dashboard-tabs').className).toMatch(/min-w-max/);
  });
});
