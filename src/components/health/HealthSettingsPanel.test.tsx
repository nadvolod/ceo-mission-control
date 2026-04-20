import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthSettingsPanel } from './HealthSettingsPanel';

// ---------------------------------------------------------------------------
// localStorage mock — the component reads from it on mount
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseTemplates = {
  supplementTemplate: [
    { name: 'Magnesium', defaultDosageMg: 400 },
    { name: 'Vitamin D', defaultDosageMg: 5000 },
  ],
  habitTemplate: [
    { name: 'Meditation' },
    { name: 'Cold Shower' },
  ],
  environmentTemplate: {
    customFieldNames: ['white noise'],
  },
};

const baseSyncStatus = {
  lastSyncedAt: '2026-04-14T08:00:00Z',
  syncStatus: 'idle',
  syncError: null,
};

const baseProps = {
  templates: baseTemplates,
  syncStatus: baseSyncStatus,
  garminConfigured: true,
  garminConnected: true,
  onUpdateTemplate: jest.fn().mockResolvedValue({ success: true }),
  onSync: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthSettingsPanel — Sync Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  // --- Positive: sync button is clickable and calls onSync ---

  it('calls onSync when the Sync Now button is clicked', async () => {
    const user = userEvent.setup();
    const onSync = jest.fn();

    render(<HealthSettingsPanel {...baseProps} onSync={onSync} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).not.toBeDisabled();

    await user.click(syncButton);

    expect(onSync).toHaveBeenCalledTimes(1);
  });

  // --- Negative: sync button disabled when onSync is not provided ---

  it('disables the Sync Now button when onSync is not provided', () => {
    render(<HealthSettingsPanel {...baseProps} onSync={undefined} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).toBeDisabled();
  });

  // --- Edge: after sync error, button remains enabled for retry ---

  it('keeps the Sync Now button enabled when there is a sync error so user can retry', () => {
    const syncStatusWithError = {
      lastSyncedAt: '2026-04-14T08:00:00Z',
      syncStatus: 'error',
      syncError: 'Connection timed out',
    };

    render(
      <HealthSettingsPanel
        {...baseProps}
        syncStatus={syncStatusWithError}
        onSync={jest.fn()}
      />
    );

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).not.toBeDisabled();

    // The error message should be visible
    expect(screen.getByText(/Connection timed out/)).toBeInTheDocument();
  });

  // --- Edge: sync button disabled while syncing ---

  it('disables the sync button while sync is in progress', async () => {
    const user = userEvent.setup();
    let resolveSync: () => void;
    const pendingSync = jest.fn(() => new Promise<void>((resolve) => { resolveSync = resolve; }));

    render(<HealthSettingsPanel {...baseProps} onSync={pendingSync} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    await user.click(syncButton);

    // Button should show "Syncing..." and be disabled
    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();

    // Resolve and verify button re-enabled
    await act(async () => { resolveSync!(); });
    expect(screen.getByRole('button', { name: /sync now/i })).not.toBeDisabled();
  });

  // --- Edge: sync error re-enables button ---

  it('re-enables the sync button after a sync error', async () => {
    const user = userEvent.setup();
    const failingSync = jest.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<HealthSettingsPanel {...baseProps} onSync={failingSync} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    await user.click(syncButton);

    // After error, button should be re-enabled
    expect(screen.getByRole('button', { name: /sync now/i })).not.toBeDisabled();
    consoleSpy.mockRestore();
  });

  // --- Positive: displays sync status information ---

  it('shows "Connected" status when garminConnected is true', () => {
    render(<HealthSettingsPanel {...baseProps} garminConnected={true} />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows "Not connected" status when garminConnected is false', () => {
    render(
      <HealthSettingsPanel
        {...baseProps}
        garminConnected={false}
        syncStatus={{ lastSyncedAt: '', syncStatus: 'idle', syncError: null }}
      />
    );

    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  // --- Connect button shows when not connected ---

  it('shows Connect Garmin Account button when not connected', () => {
    render(
      <HealthSettingsPanel
        {...baseProps}
        garminConfigured={true}
        garminConnected={false}
      />
    );

    expect(screen.getByRole('button', { name: /connect garmin/i })).toBeInTheDocument();
  });

  it('shows env var warning when garminConfigured is false', () => {
    render(
      <HealthSettingsPanel
        {...baseProps}
        garminConfigured={false}
        garminConnected={false}
      />
    );

    expect(screen.getByText(/GARMIN_EMAIL/)).toBeInTheDocument();
  });
});
