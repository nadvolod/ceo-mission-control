import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileLayout } from '../MobileLayout';
import { __FIXTURE_METRICS } from './__fixtures__';
import type { ActivityEntry, MetricId, MetricSnapshot } from '../types';

function defaultProps(overrides: Partial<Parameters<typeof MobileLayout>[0]> = {}) {
  const metrics: Record<MetricId, MetricSnapshot> = {
    ...__FIXTURE_METRICS,
    temporal: { ...__FIXTURE_METRICS.temporal, today: 1.5, week: 6.5, goal: 5 },
  };
  return {
    metrics,
    activity: [] as ActivityEntry[],
    tab: 'overview' as const,
    onTab: jest.fn(),
    onOpenReflection: jest.fn(),
    onLog: jest.fn(),
    ...overrides,
  };
}

describe('<MobileLayout />', () => {
  it('renders the mobile shell with header, hero, snapshot strip, quick log, bottom nav', () => {
    render(<MobileLayout {...defaultProps()} />);
    expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-hero-temporal')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-snapshot-strip')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-quick-log')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
  });

  it('hero card shows today\'s Temporal value formatted as hours', () => {
    render(<MobileLayout {...defaultProps()} />);
    expect(screen.getByTestId('mobile-hero-value')).toHaveTextContent('1.5h');
  });

  it('hero +0.5h tap calls onLog with the right args', async () => {
    const user = userEvent.setup();
    const onLog = jest.fn();
    render(<MobileLayout {...defaultProps({ onLog })} />);
    await user.click(screen.getByTestId('mobile-hero-preset-0-5h'));
    expect(onLog).toHaveBeenCalledWith('temporal', 0.5, '+0.5h');
  });

  it('quick log +Generated tap calls onLog with the right args', async () => {
    const user = userEvent.setup();
    const onLog = jest.fn();
    render(<MobileLayout {...defaultProps({ onLog })} />);
    await user.click(screen.getByTestId('mobile-quick-generated'));
    expect(onLog).toHaveBeenCalledWith('moneyMoved', 500, '+ Generated');
  });

  it('snapshot strip renders the 5 expected mini-cards', () => {
    render(<MobileLayout {...defaultProps()} />);
    for (const id of ['cash', 'netWorth', 'pipeline', 'moneyMoved', 'deepWork']) {
      expect(screen.getByTestId(`mobile-snapshot-${id}`)).toBeInTheDocument();
    }
  });

  it('bottom nav: tapping a tab calls onTab; tapping Reflect calls onOpenReflection', async () => {
    const user = userEvent.setup();
    const onTab = jest.fn();
    const onOpenReflection = jest.fn();
    render(<MobileLayout {...defaultProps({ onTab, onOpenReflection })} />);

    await user.click(screen.getByTestId('mobile-nav-insights'));
    expect(onTab).toHaveBeenCalledWith('insights');

    await user.click(screen.getByTestId('mobile-nav-review'));
    expect(onTab).toHaveBeenCalledWith('review');

    await user.click(screen.getByTestId('mobile-nav-reflect'));
    expect(onOpenReflection).toHaveBeenCalled();
  });

  it('active tab in bottom nav gets the UV pill (aria-pressed=true)', () => {
    render(<MobileLayout {...defaultProps({ tab: 'insights' })} />);
    expect(screen.getByTestId('mobile-nav-overview')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('mobile-nav-insights')).toHaveAttribute('aria-pressed', 'true');
    // Reflect is always inactive — it's a drawer trigger, not a tab.
    expect(screen.getByTestId('mobile-nav-reflect')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Reflect ↑ link in the recent activity row calls onOpenReflection', async () => {
    const user = userEvent.setup();
    const onOpenReflection = jest.fn();
    render(<MobileLayout {...defaultProps({ onOpenReflection })} />);
    await user.click(screen.getByTestId('mobile-reflect-link'));
    expect(onOpenReflection).toHaveBeenCalled();
  });

  it('Insights / Review tabs swap the body for a hint pointing at the bottom nav', () => {
    const { rerender } = render(<MobileLayout {...defaultProps({ tab: 'insights' })} />);
    // Hero is not visible when we leave overview.
    expect(screen.queryByTestId('mobile-hero-temporal')).not.toBeInTheDocument();
    expect(screen.getByText(/Insights tab/i)).toBeInTheDocument();

    rerender(<MobileLayout {...defaultProps({ tab: 'review' })} />);
    expect(screen.getByText(/Review tab/i)).toBeInTheDocument();
  });
});
