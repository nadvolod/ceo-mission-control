import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinancialMetricsDashboard } from './FinancialMetricsDashboard';

const emptyMetrics = {
  date: '2026-04-02',
  entries: [],
  totals: { moved: 0, generated: 0, cut: 0, netImpact: 0 },
};

const metricsWithActivity = {
  date: '2026-04-02',
  entries: [
    { id: '1', amount: 5000, description: 'Contract signed', timestamp: '2026-04-02T10:00:00Z', category: 'moved' as const },
  ],
  totals: { moved: 5000, generated: 0, cut: 0, netImpact: 5000 },
};

const zeroTotals = { moved: 0, generated: 0, cut: 0, netImpact: 0 };

describe('FinancialMetricsDashboard', () => {
  it('renders the title and metrics cards', () => {
    render(
      <FinancialMetricsDashboard
        todaysMetrics={emptyMetrics}
        weeklyTotals={zeroTotals}
        monthlyTotals={zeroTotals}
        recentEntries={[]}
      />
    );

    expect(screen.getByText('Financial Impact Tracking')).toBeInTheDocument();
    expect(screen.getByText('Money Moved')).toBeInTheDocument();
    expect(screen.getByText('New Revenue')).toBeInTheDocument();
    expect(screen.getByText('Expenses Cut')).toBeInTheDocument();
    expect(screen.getByText('Net Impact')).toBeInTheDocument();
  });

  it('shows daily key question banner when today total is $0 and onAddEntry is provided', () => {
    const mockAdd = jest.fn();

    render(
      <FinancialMetricsDashboard
        todaysMetrics={emptyMetrics}
        weeklyTotals={zeroTotals}
        monthlyTotals={zeroTotals}
        recentEntries={[]}
        onAddEntry={mockAdd}
      />
    );

    expect(screen.getByText('How much money was moved today?')).toBeInTheDocument();
    expect(screen.getByText('+$1K Moved')).toBeInTheDocument();
    expect(screen.getByText('+$5K Revenue')).toBeInTheDocument();
    expect(screen.getByText('Custom amount...')).toBeInTheDocument();
  });

  it('does NOT show daily key question banner when there is already activity today', () => {
    const mockAdd = jest.fn();

    render(
      <FinancialMetricsDashboard
        todaysMetrics={metricsWithActivity}
        weeklyTotals={{ moved: 5000, generated: 0, cut: 0, netImpact: 5000 }}
        monthlyTotals={{ moved: 5000, generated: 0, cut: 0, netImpact: 5000 }}
        recentEntries={metricsWithActivity.entries}
        onAddEntry={mockAdd}
      />
    );

    expect(screen.queryByText('How much money was moved today?')).not.toBeInTheDocument();
  });

  it('does NOT show daily key question banner when onAddEntry is not provided', () => {
    render(
      <FinancialMetricsDashboard
        todaysMetrics={emptyMetrics}
        weeklyTotals={zeroTotals}
        monthlyTotals={zeroTotals}
        recentEntries={[]}
      />
    );

    expect(screen.queryByText('How much money was moved today?')).not.toBeInTheDocument();
  });

  it('opens the add entry form when a quick-add button is clicked', () => {
    const mockAdd = jest.fn();

    render(
      <FinancialMetricsDashboard
        todaysMetrics={emptyMetrics}
        weeklyTotals={zeroTotals}
        monthlyTotals={zeroTotals}
        recentEntries={[]}
        onAddEntry={mockAdd}
      />
    );

    fireEvent.click(screen.getByText('+$1K Moved'));

    expect(screen.getByText('Log Financial Entry')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
  });

  it('submits the add entry form and calls onAddEntry', async () => {
    const mockAdd = jest.fn().mockResolvedValue(undefined);

    render(
      <FinancialMetricsDashboard
        todaysMetrics={emptyMetrics}
        weeklyTotals={zeroTotals}
        monthlyTotals={zeroTotals}
        recentEntries={[]}
        onAddEntry={mockAdd}
      />
    );

    // Click "Custom amount..."
    fireEvent.click(screen.getByText('Custom amount...'));

    // Fill the form
    const amountInput = screen.getByPlaceholderText('Amount ($)');
    fireEvent.change(amountInput, { target: { value: '2500' } });

    const descInput = screen.getByPlaceholderText('Description (optional)');
    fireEvent.change(descInput, { target: { value: 'New deal' } });

    // Submit
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith('moved', 2500, 'New deal');
    });
  });

  it('shows Log Entry button in header when onAddEntry is provided', () => {
    const mockAdd = jest.fn();

    render(
      <FinancialMetricsDashboard
        todaysMetrics={emptyMetrics}
        weeklyTotals={zeroTotals}
        monthlyTotals={zeroTotals}
        recentEntries={[]}
        onAddEntry={mockAdd}
      />
    );

    expect(screen.getByText('Log Entry')).toBeInTheDocument();
  });

  it('shows recent entries when available', () => {
    render(
      <FinancialMetricsDashboard
        todaysMetrics={metricsWithActivity}
        weeklyTotals={{ moved: 5000, generated: 0, cut: 0, netImpact: 5000 }}
        monthlyTotals={{ moved: 5000, generated: 0, cut: 0, netImpact: 5000 }}
        recentEntries={metricsWithActivity.entries}
      />
    );

    expect(screen.getByText('Contract signed')).toBeInTheDocument();
    expect(screen.getByText('Recent Financial Activity')).toBeInTheDocument();
  });

  it('shows quick-add buttons when there is activity and form is closed', () => {
    const mockAdd = jest.fn();

    render(
      <FinancialMetricsDashboard
        todaysMetrics={metricsWithActivity}
        weeklyTotals={{ moved: 5000, generated: 0, cut: 0, netImpact: 5000 }}
        monthlyTotals={{ moved: 5000, generated: 0, cut: 0, netImpact: 5000 }}
        recentEntries={metricsWithActivity.entries}
        onAddEntry={mockAdd}
      />
    );

    // Quick-add buttons should be present (smaller, below the main content)
    expect(screen.getByText('+$1K Revenue')).toBeInTheDocument();
  });

  it('shows usage hint only when onAddEntry is not provided', () => {
    render(
      <FinancialMetricsDashboard
        todaysMetrics={emptyMetrics}
        weeklyTotals={zeroTotals}
        monthlyTotals={zeroTotals}
        recentEntries={[]}
      />
    );

    expect(screen.getByText(/Usage:/)).toBeInTheDocument();
  });
});
