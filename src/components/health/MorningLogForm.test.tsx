import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MorningLogForm } from './MorningLogForm';
import type { DailyHealthNote } from '@/lib/types';

// ---------------------------------------------------------------------------
// Mock scrollIntoView (jsdom does not implement it)
// ---------------------------------------------------------------------------

const scrollIntoViewMock = jest.fn();
let originalScrollIntoView: typeof window.HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
  originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoViewMock,
  });
});

afterAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: originalScrollIntoView,
  });
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseTemplates = {
  supplementTemplate: [
    { name: 'Guanfacine', defaultDosageMg: 1 },
    { name: 'Magnesium', defaultDosageMg: 400 },
  ],
  habitTemplate: [{ name: 'Red light therapy' }],
  environmentTemplate: { customFieldNames: [] },
};

const pastNote: DailyHealthNote = {
  date: '2026-04-20',
  sleepEnvironment: {
    temperatureF: 67,
    fanRunning: false,
    dogInRoom: false,
    customFields: {},
  },
  supplements: [
    { name: 'Guanfacine', dosageMg: 1, taken: true },
    { name: 'Magnesium', dosageMg: 400, taken: false },
  ],
  habits: [{ name: 'Red light therapy', done: true }],
  freeformNote: 'Slept great',
  loggedAt: '2026-04-20T07:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MorningLogForm – Edit button in Recent Entries', () => {
  const onSave = jest.fn().mockResolvedValue({ success: true });
  const onUpdateTemplate = jest.fn().mockResolvedValue({ success: true });

  const notes: Record<string, DailyHealthNote> = {
    '2026-04-20': pastNote,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    scrollIntoViewMock.mockClear();
  });

  it('renders the Edit button for the recent entry', () => {
    render(
      <MorningLogForm
        templates={baseTemplates}
        notes={notes}
        onSave={onSave}
        onUpdateTemplate={onUpdateTemplate}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('clicking Edit loads the entry data into the form', async () => {
    const user = userEvent.setup();

    render(
      <MorningLogForm
        templates={baseTemplates}
        notes={notes}
        onSave={onSave}
        onUpdateTemplate={onUpdateTemplate}
      />,
    );

    const editButton = screen.getByRole('button', { name: 'Edit' });
    await user.click(editButton);

    // The date input should now reflect the selected entry's date
    const dateInput = screen.getByLabelText<HTMLInputElement>('Date:');
    expect(dateInput.value).toBe('2026-04-20');
  });

  it('clicking Edit scrolls the form top into view', async () => {
    const user = userEvent.setup();

    render(
      <MorningLogForm
        templates={baseTemplates}
        notes={notes}
        onSave={onSave}
        onUpdateTemplate={onUpdateTemplate}
      />,
    );

    const editButton = screen.getByRole('button', { name: 'Edit' });
    await user.click(editButton);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});
