import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayDetailCard } from './DayDetailCard';
import type { GarminDayMetrics, DailyHealthNote } from '@/lib/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const fullMetrics: GarminDayMetrics = {
  date: '2026-04-14',
  sleepScore: 82,
  sleepDurationMinutes: 440,
  sleepStartTime: '22:30',
  sleepEndTime: '06:00',
  deepSleepMinutes: 90,
  lightSleepMinutes: 200,
  remSleepMinutes: 100,
  awakeDuringMinutes: 50,
  restingHeartRate: 55,
  hrvStatus: 48,
  averageStressLevel: 28,
  bodyBatteryHigh: 91,
  bodyBatteryLow: 20,
  steps: 8500,
  activeMinutes: 45,
  weight: 175,
  syncedAt: '2026-04-14T08:00:00Z',
};

const fullNote: DailyHealthNote = {
  date: '2026-04-14',
  sleepEnvironment: {
    temperatureF: 67,
    fanRunning: true,
    dogInRoom: false,
    customFields: { 'white noise': true },
  },
  supplements: [
    { name: 'Magnesium', dosageMg: 400, taken: true },
    { name: 'Vitamin D', dosageMg: 5000, taken: false },
  ],
  habits: [
    { name: 'Meditation', done: true },
    { name: 'Cold Shower', done: false },
  ],
  freeformNote: 'Slept well, woke up refreshed.',
  loggedAt: '2026-04-14T07:00:00Z',
};

const baseProps = {
  date: '2026-04-14',
  metrics: fullMetrics,
  note: fullNote,
  onClose: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DayDetailCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Positive: accessibility ---

  it('close button has an accessible name containing "close"', () => {
    render(<DayDetailCard {...baseProps} />);

    // The button text "✕ Close" is computed as its accessible name.
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  // --- Positive: all 6 metric values rendered ---

  it('renders all 6 metric values when metrics are provided', () => {
    render(<DayDetailCard {...baseProps} />);

    // Sleep Score
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Sleep Score')).toBeInTheDocument();

    // HRV
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('HRV')).toBeInTheDocument();

    // Body Battery
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('Body Battery')).toBeInTheDocument();

    // Avg Stress
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('Avg Stress')).toBeInTheDocument();

    // Resting HR
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('Resting HR')).toBeInTheDocument();

    // Weight
    expect(screen.getByText('175')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
  });

  // --- Negative: null metrics ---

  it('shows "No Garmin data" message when metrics is null', () => {
    render(<DayDetailCard {...baseProps} metrics={null} />);

    expect(screen.getByText(/No Garmin data/i)).toBeInTheDocument();

    // Metric labels should not be present
    expect(screen.queryByText('Sleep Score')).not.toBeInTheDocument();
    expect(screen.queryByText('HRV')).not.toBeInTheDocument();
  });

  // --- Negative: null note ---

  it('shows "No morning log" message when note is null', () => {
    render(<DayDetailCard {...baseProps} note={null} />);

    expect(screen.getByText(/No morning log/i)).toBeInTheDocument();

    // Note-specific content should not be present
    expect(screen.queryByText('Supplements')).not.toBeInTheDocument();
    expect(screen.queryByText('Habits')).not.toBeInTheDocument();
  });

  // --- Positive: close callback ---

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(<DayDetailCard {...baseProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
