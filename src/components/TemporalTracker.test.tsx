import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemporalTracker } from './TemporalTracker';

// Mock fetch globally
global.fetch = jest.fn();

// Local date string that matches how the component filters sessions
const LOCAL_TODAY = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

const mockOnUpdateHours = jest.fn();

const defaultProps = {
  temporalTarget: 4,
  temporalActual: 2.5,
  onUpdateHours: mockOnUpdateHours,
};

describe('TemporalTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('should render temporal tracker with correct progress', async () => {
    // Mock the API response for sessions
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [],
        dailyTotals: {}
      }),
    } as Response);

    render(<TemporalTracker {...defaultProps} />);

    expect(screen.getByText('Temporal Execution Tracker')).toBeInTheDocument();
    expect(screen.getByText('Daily Target: 4h')).toBeInTheDocument();
    expect(screen.getByText('2.5h')).toBeInTheDocument();
    expect(screen.getByText('/ 4h')).toBeInTheDocument();
    expect(screen.getByText('62.5% complete')).toBeInTheDocument();
    expect(screen.getByText('1.5h remaining')).toBeInTheDocument();
  });

  it('should show target exceeded when actual exceeds target', async () => {
    // Mock the API response
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    render(
      <TemporalTracker
        temporalTarget={3}
        temporalActual={4.5}
        onUpdateHours={mockOnUpdateHours}
      />
    );

    expect(screen.getByText('Target exceeded!')).toBeInTheDocument();
    expect(screen.getByText('150.0% complete')).toBeInTheDocument();
  });

  it('should display today\'s sessions correctly', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 2,
        description: 'Morning focus block',
        date: LOCAL_TODAY,
      },
      {
        id: 'session-2',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1.5,
        description: 'Afternoon session',
        date: LOCAL_TODAY,
      },
    ];

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: mockSessions,
        dailyTotals: {}
      }),
    } as Response);

    render(<TemporalTracker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Today\'s Sessions (2)')).toBeInTheDocument();
      expect(screen.getByText('Morning focus block')).toBeInTheDocument();
      expect(screen.getByText('Afternoon session')).toBeInTheDocument();
      expect(screen.getByText('2h')).toBeInTheDocument();
      expect(screen.getByText('1.5h')).toBeInTheDocument();
    });
  });

  it('should open report form when Report Hours button is clicked', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    const user = userEvent.setup();
    render(<TemporalTracker {...defaultProps} />);

    const reportButton = screen.getByText('Report Hours');
    await user.click(reportButton);

    expect(screen.getByText('Report Temporal Hours')).toBeInTheDocument();
    expect(screen.getByLabelText('Hours Completed')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByText('Add Hours')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should submit hours report successfully', async () => {
    // Mock initial sessions load
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    // Mock report submission
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        session: {
          id: 'new-session',
          duration: 2.5,
          description: 'Test session',
        },
        newTotal: 5,
      }),
    } as Response);

    // Mock sessions reload after submission
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    const user = userEvent.setup();
    render(<TemporalTracker {...defaultProps} />);

    // Open report form
    const reportButton = screen.getByText('Report Hours');
    await user.click(reportButton);

    // Fill out form
    const hoursInput = screen.getByLabelText('Hours Completed');
    const descriptionInput = screen.getByLabelText('Description (optional)');
    
    await user.type(hoursInput, '2.5');
    await user.type(descriptionInput, 'Test session');

    // Submit form
    const addButton = screen.getByText('Add Hours');
    await user.click(addButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 2.5,
          description: 'Test session',
        }),
      });
      expect(mockOnUpdateHours).toHaveBeenCalledWith(2.5);
    });
  });

  it('should use quick report buttons correctly', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    const user = userEvent.setup();
    render(<TemporalTracker {...defaultProps} />);

    // Click +2h quick button
    const quickButton = screen.getByText('+2h');
    await user.click(quickButton);

    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByText('Report Temporal Hours')).toBeInTheDocument();
  });

  it('should cancel report form', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    const user = userEvent.setup();
    render(<TemporalTracker {...defaultProps} />);

    // Open report form
    const reportButton = screen.getByText('Report Hours');
    await user.click(reportButton);

    expect(screen.getByText('Report Temporal Hours')).toBeInTheDocument();

    // Cancel form
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(screen.queryByText('Report Temporal Hours')).not.toBeInTheDocument();
  });

  it('should disable submit button when hours input is empty', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    const user = userEvent.setup();
    render(<TemporalTracker {...defaultProps} />);

    // Open report form
    const reportButton = screen.getByText('Report Hours');
    await user.click(reportButton);

    const addButton = screen.getByText('Add Hours');
    expect(addButton).toBeDisabled();
  });

  it('should handle API errors gracefully', async () => {
    // Mock initial sessions load failure
    (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
      new Error('Network error')
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<TemporalTracker {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading temporal sessions:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should show no sessions message when no sessions exist', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    render(<TemporalTracker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Today\'s Sessions (0)')).toBeInTheDocument();
      expect(screen.getByText('No temporal sessions recorded yet today')).toBeInTheDocument();
    });
  });

  it('should validate hours input range', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [], dailyTotals: {} }),
    } as Response);

    const user = userEvent.setup();
    render(<TemporalTracker {...defaultProps} />);

    // Open report form
    const reportButton = screen.getByText('Report Hours');
    await user.click(reportButton);

    const hoursInput = screen.getByLabelText('Hours Completed') as HTMLInputElement;

    expect(hoursInput.min).toBe('0.1');
    expect(hoursInput.max).toBe('12');
    expect(hoursInput.step).toBe('0.1');
  });
});