import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyMovePopover } from './MoneyMovePopover';
import type { FinancialEntry } from '@/lib/financial-tracker';

const entries: FinancialEntry[] = [
  { id: '1', category: 'cut', amount: 150, description: 'storage', timestamp: '2026-05-11T10:00:00Z' },
  { id: '2', category: 'generated', amount: 500, description: 'invoice', timestamp: '2026-05-11T14:00:00Z' },
];

describe('MoneyMovePopover', () => {
  it('renders entries on hover and on keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <MoneyMovePopover entries={entries}>
        <span tabIndex={0}>$650</span>
      </MoneyMovePopover>
    );
    expect(screen.queryByText('storage')).not.toBeInTheDocument();

    await user.hover(screen.getByText('$650'));
    expect(screen.getByText('storage')).toBeInTheDocument();
    expect(screen.getByText('invoice')).toBeInTheDocument();
  });

  it('opens via keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <MoneyMovePopover entries={entries}>
        <span tabIndex={0}>$650</span>
      </MoneyMovePopover>
    );
    await user.tab();
    expect(screen.getByText('storage')).toBeInTheDocument();
  });

  it('shows "No moves logged" when entries is empty', async () => {
    const user = userEvent.setup();
    render(
      <MoneyMovePopover entries={[]}>
        <span tabIndex={0}>—</span>
      </MoneyMovePopover>
    );
    await user.hover(screen.getByText('—'));
    expect(screen.getByText(/no moves logged/i)).toBeInTheDocument();
  });
});
