import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFeed } from '../ActivityFeed';
import type { ActivityEntry } from '../types';

const entry: ActivityEntry = {
  id: 'e1',
  t: '08:14',
  tsMs: 1,
  kind: 'morning',
  delta: '',
  label: 'Morning Log',
  meta: 'Sleep 87 · 7h22m · 1 supplement · 2 habits',
  source: 'morning',
  refKey: '2026-06-05',
};

describe('ActivityFeed clickable rows', () => {
  it('fires onOpenDetail with the entry when a row is clicked', async () => {
    const onOpenDetail = jest.fn();
    render(<ActivityFeed entries={[entry]} onOpenDetail={onOpenDetail} />);
    await userEvent.click(screen.getByTestId('activity-row-e1'));
    expect(onOpenDetail).toHaveBeenCalledWith(entry);
  });

  it('fires onOpenDetail when Enter is pressed on a focused row', async () => {
    const onOpenDetail = jest.fn();
    render(<ActivityFeed entries={[entry]} onOpenDetail={onOpenDetail} />);
    const row = screen.getByTestId('activity-row-e1');
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpenDetail).toHaveBeenCalledWith(entry);
  });

  it('fires onOpenDetail when Space is pressed on a focused row', async () => {
    const onOpenDetail = jest.fn();
    render(<ActivityFeed entries={[entry]} onOpenDetail={onOpenDetail} />);
    const row = screen.getByTestId('activity-row-e1');
    row.focus();
    // The handler checks e.key === ' ' (a literal space character)
    await userEvent.keyboard(' ');
    expect(onOpenDetail).toHaveBeenCalledWith(entry);
  });

  it('renders rows as non-interactive when onOpenDetail is absent', () => {
    render(<ActivityFeed entries={[entry]} />);
    // data-testid and role="button" are only applied when the handler is provided
    expect(screen.queryByTestId('activity-row-e1')).toBeNull();
    // The entry content still renders
    expect(screen.getByText('Morning Log')).toBeInTheDocument();
  });

  it('renders the row with role="button" and tabIndex=0 when handler is provided', () => {
    render(<ActivityFeed entries={[entry]} onOpenDetail={jest.fn()} />);
    const row = screen.getByTestId('activity-row-e1');
    expect(row).toHaveAttribute('role', 'button');
    expect(row).toHaveAttribute('tabIndex', '0');
  });

  it('does not fire onOpenDetail when a different entry row is absent', async () => {
    const onOpenDetail = jest.fn();
    render(<ActivityFeed entries={[entry]} onOpenDetail={onOpenDetail} />);
    expect(screen.queryByTestId('activity-row-e2')).toBeNull();
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('renders multiple rows each with their own testid', () => {
    const second: ActivityEntry = { ...entry, id: 'e2', label: 'Focus Block' };
    render(<ActivityFeed entries={[entry, second]} onOpenDetail={jest.fn()} />);
    expect(screen.getByTestId('activity-row-e1')).toBeInTheDocument();
    expect(screen.getByTestId('activity-row-e2')).toBeInTheDocument();
  });

  it('shows empty state message when entries is empty', () => {
    render(<ActivityFeed entries={[]} />);
    expect(screen.getByText('No activity yet today.')).toBeInTheDocument();
  });
});
