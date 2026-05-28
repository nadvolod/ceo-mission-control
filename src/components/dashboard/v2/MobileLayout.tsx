'use client';

import { Sparkles, Brain, Check, BarChart3 } from 'lucide-react';
import { Aurora } from './primitives/Aurora';
import { OrbitStar } from './primitives/OrbitStar';
import { ActivityFeed } from './ActivityFeed';
import { MC_COLORS } from './palette';
import { fmtMetric, clamp } from './format';
import type { ActivityEntry, MetricId, MetricSnapshot } from './types';

type Tab = 'overview' | 'insights' | 'review';

type Props = {
  metrics: Record<MetricId, MetricSnapshot>;
  activity: ActivityEntry[];
  tab: Tab;
  onTab: (t: Tab) => void;
  onOpenReflection: () => void;
  onLog: (metricId: MetricId, delta: number, label: string) => void;
};

function slugifyLabel(label: string): string {
  // Match MetricCard.tsx's presetTestId: replace non-alphanum runs with `-`
  // then strip leading/trailing dashes so labels like "+ Moved" or "+0.5h"
  // produce clean testid suffixes ("moved", "0-5h") instead of "-moved", "-0-5h".
  return label
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// Mobile dashboard. Rendered under md:hidden; the desktop layout takes
// over at md+. Built to the ★ Conservative · Dark mobile artboard in
// design_handoff_mission_control/screenshots/02-mobile.png.
export function MobileLayout({
  metrics,
  activity,
  tab,
  onTab,
  onOpenReflection,
  onLog,
}: Props) {
  return (
    <div
      className="mc-root relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background: 'var(--color-mc-bg)',
        color: 'var(--color-mc-fg)',
        fontFamily: 'var(--font-mc-sans)',
        fontSize: 14,
      }}
      data-testid="mobile-layout"
    >
      <Aurora intensity={0.9} />

      <div className="relative flex h-full flex-col" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <MobileHeader />

        {/* Body — gated on tab */}
        {tab === 'overview' && (
          <>
            <HeroTemporal metric={metrics.temporal} onLog={onLog} />
            <SnapshotStrip metrics={metrics} />
            <QuickLogGrid onLog={onLog} />
            <RecentActivity activity={activity} onOpenReflection={onOpenReflection} />
          </>
        )}

        {tab === 'insights' && (
          <div style={{ padding: '12px 18px', fontSize: 13, color: 'var(--color-mc-fg-dim)' }}>
            Insights renders inside the desktop tab on small screens too — open the
            Insights tab in the bottom nav to switch between the four cards.
          </div>
        )}

        {tab === 'review' && (
          <div style={{ padding: '12px 18px', fontSize: 13, color: 'var(--color-mc-fg-dim)' }}>
            Open the Review tab in the bottom nav for monthly review history.
          </div>
        )}
      </div>

      <BottomNav tab={tab} onTab={onTab} onOpenReflection={onOpenReflection} />
    </div>
  );
}

// ----- Header -----------------------------------------------------------

function MobileHeader() {
  return (
    <div
      className="flex items-center gap-2.5"
      style={{ padding: '14px 18px 14px' }}
      data-testid="mobile-header"
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: MC_COLORS.uv,
          boxShadow: `0 0 16px ${MC_COLORS.uv}88`,
        }}
      >
        <OrbitStar size={18} color="#fff" />
      </div>
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-mc-ink)',
          }}
        >
          Mission Control
        </h1>
        <div
          className="font-numerics"
          style={{
            fontSize: 11,
            color: 'var(--color-mc-fg-dim)',
            letterSpacing: '0.06em',
            marginTop: 1,
          }}
          suppressHydrationWarning
        >
          {todayHeader()}
        </div>
      </div>
    </div>
  );
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function todayHeader(): string {
  // Rendered client-side — server doesn't know the user's tz. We
  // intentionally accept the brief mismatch between SSR (empty) and
  // CSR (real date) via suppressHydrationWarning.
  const d = new Date();
  const day = DAY_LABELS[d.getDay()];
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${day} · ${date}`;
}

// ----- Hero Temporal card ----------------------------------------------

function HeroTemporal({
  metric,
  onLog,
}: {
  metric: MetricSnapshot;
  onLog: (metricId: MetricId, delta: number, label: string) => void;
}) {
  const week = metric.week ?? 0;
  const goal = metric.goal ?? 5;
  const pct = clamp(week / goal, 0, 1);

  return (
    <div style={{ padding: '0 18px 14px' }}>
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${MC_COLORS.uv}26 0%, ${MC_COLORS.pink}1A 100%)`,
          border: `1px solid ${MC_COLORS.uv}55`,
          borderRadius: 16,
          padding: '16px 18px',
        }}
        data-testid="mobile-hero-temporal"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: -30,
            right: -30,
            width: 140,
            height: 140,
            background: `radial-gradient(circle, ${MC_COLORS.uv} 0%, transparent 70%)`,
            opacity: 0.4,
          }}
        />
        <div className="relative">
          <div
            className="font-numerics uppercase"
            style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--color-mc-uv-hi)',
            }}
          >
            TEMPORAL · TODAY
          </div>
          <div
            className="flex items-baseline justify-between"
            style={{ marginTop: 6 }}
          >
            <span
              className="font-numerics"
              style={{ fontSize: 46, color: 'var(--color-mc-ink)', lineHeight: 1 }}
              data-testid="mobile-hero-value"
            >
              {fmtMetric(metric.today, metric.fmt)}
            </span>
            <span
              className="font-numerics"
              style={{ fontSize: 11, color: 'var(--color-mc-fg-dim)', textAlign: 'right' }}
            >
              {fmtMetric(week, metric.fmt)} / {fmtMetric(goal, metric.fmt)}
              <br />wk
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              marginTop: 10,
              height: 5,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct * 100}%`,
                height: '100%',
                background: MC_COLORS.uv,
                boxShadow: `0 0 8px ${MC_COLORS.uv}88`,
                transition: 'width .3s',
              }}
            />
          </div>
          {/* Fat preset buttons */}
          <div className="flex gap-1.5" style={{ marginTop: 14 }}>
            {[
              ['+0.5h', 0.5],
              ['+1h', 1],
              ['+2h', 2],
            ].map(([label, delta]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => onLog('temporal', delta as number, label as string)}
                className="flex-1 rounded-lg cursor-pointer"
                style={{
                  padding: '11px 0',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--color-mc-ink)',
                  border: `1px solid ${MC_COLORS.uv}55`,
                  fontSize: 13,
                  fontWeight: 500,
                  font: 'inherit',
                }}
                data-testid={`mobile-hero-preset-${slugifyLabel(label as string)}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Snapshot strip (horizontal scroll) -------------------------------

const SNAPSHOT_IDS: Array<{ id: MetricId; color: string }> = [
  { id: 'cash',       color: MC_COLORS.uv },
  { id: 'netWorth',   color: MC_COLORS.cyan },
  { id: 'pipeline',   color: MC_COLORS.amber },
  { id: 'moneyMoved', color: MC_COLORS.green },
  { id: 'deepWork',   color: MC_COLORS.cyan },
];

function SnapshotStrip({ metrics }: { metrics: Record<MetricId, MetricSnapshot> }) {
  return (
    <div style={{ padding: '0 0 14px' }} data-testid="mobile-snapshot-strip">
      <div
        className="flex gap-2"
        style={{
          padding: '0 18px',
          overflowX: 'auto',
          // Hide the scrollbar but keep the scrollable behavior.
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {SNAPSHOT_IDS.map(({ id, color }) => {
          const m = metrics[id];
          if (!m) return null;
          return (
            <div
              key={id}
              className="relative overflow-hidden"
              style={{
                minWidth: 130,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '10px 12px',
                backdropFilter: 'blur(20px)',
              }}
              data-testid={`mobile-snapshot-${id}`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  top: -20,
                  right: -20,
                  width: 60,
                  height: 60,
                  background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                  opacity: 0.25,
                }}
              />
              <div className="relative">
                <div
                  className="font-numerics uppercase"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    color: 'var(--color-mc-fg-dim)',
                  }}
                >
                  {m.label}
                </div>
                <div
                  className="font-numerics"
                  style={{
                    fontSize: 20,
                    color: 'var(--color-mc-ink)',
                    marginTop: 4,
                  }}
                >
                  {fmtMetric(m.today, m.fmt)}
                </div>
                <div
                  className="font-numerics"
                  style={{ fontSize: 10, color: 'var(--color-mc-fg-dim)', marginTop: 2 }}
                >
                  {m.note || ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Quick log grid (3×2) ---------------------------------------------

type QuickAction = [label: string, metricId: MetricId, delta: number, color: string];

const QUICK_ACTIONS: QuickAction[] = [
  ['+ Moved',     'moneyMoved', 250, MC_COLORS.green],
  ['+ Generated', 'moneyMoved', 500, MC_COLORS.green],
  ['+ Call',      'pipeline',   0.5, MC_COLORS.amber],
  ['+ Demo',      'pipeline',   1,   MC_COLORS.amber],
  ['+ Deep 0.5h', 'deepWork',   0.5, MC_COLORS.cyan],
  ['+ Train',     'trained',    1,   MC_COLORS.pink],
];

function QuickLogGrid({
  onLog,
}: {
  onLog: (metricId: MetricId, delta: number, label: string) => void;
}) {
  return (
    <div style={{ padding: '0 18px 14px' }} data-testid="mobile-quick-log">
      <div
        className="font-numerics uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-mc-fg-dim)',
          marginBottom: 6,
        }}
      >
        QUICK LOG
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}
      >
        {QUICK_ACTIONS.map(([label, metricId, delta, color]) => (
          <button
            key={label}
            type="button"
            onClick={() => onLog(metricId, delta, label.trim())}
            className="cursor-pointer"
            style={{
              padding: '12px 0',
              background: `${color}1A`,
              color,
              border: `1px solid ${color}40`,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              font: 'inherit',
            }}
            data-testid={`mobile-quick-${slugifyLabel(label)}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ----- Recent activity --------------------------------------------------

function RecentActivity({
  activity,
  onOpenReflection,
}: {
  activity: ActivityEntry[];
  onOpenReflection: () => void;
}) {
  return (
    <div style={{ padding: '0 18px 12px', flex: 1, minHeight: 0 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span
          className="font-numerics uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--color-mc-fg-dim)',
          }}
        >
          RECENT
        </span>
        <button
          type="button"
          onClick={onOpenReflection}
          className="cursor-pointer"
          style={{
            background: 'transparent',
            border: 'none',
            font: 'inherit',
            fontSize: 11,
            color: 'var(--color-mc-fg-dim)',
          }}
          data-testid="mobile-reflect-link"
          aria-label="Open reflection drawer"
        >
          Reflect ↑
        </button>
      </div>
      <ActivityFeed entries={activity.slice(0, 5)} />
    </div>
  );
}

// ----- Bottom nav -------------------------------------------------------

type NavItem = {
  id: 'overview' | 'insights' | 'review' | 'reflect';
  label: string;
  icon: 'dot' | 'bolt' | 'brain' | 'check';
};

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'dot' },
  { id: 'insights', label: 'Insights', icon: 'bolt' },
  { id: 'review',   label: 'Review',   icon: 'check' },
  { id: 'reflect',  label: 'Reflect',  icon: 'brain' },
];

function BottomNav({
  tab,
  onTab,
  onOpenReflection,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onOpenReflection: () => void;
}) {
  return (
    <div
      className="flex justify-around"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '10px 18px 22px',
        background: 'rgba(14,12,20,0.85)',
        backdropFilter: 'blur(18px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        zIndex: 20,
      }}
      data-testid="mobile-bottom-nav"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.id === 'reflect' ? false : item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === 'reflect') onOpenReflection();
              else onTab(item.id);
            }}
            className="flex flex-col items-center gap-0.5 cursor-pointer"
            style={{
              background: 'transparent',
              border: 'none',
              font: 'inherit',
              fontSize: 11,
              fontWeight: 500,
              color: active ? 'var(--color-mc-uv-hi)' : 'var(--color-mc-fg-dim)',
            }}
            data-testid={`mobile-nav-${item.id}`}
            aria-pressed={active}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: active ? 'rgba(124,124,255,0.14)' : 'transparent',
                border: active ? '1px solid rgba(124,124,255,0.33)' : 'none',
              }}
            >
              <NavIcon kind={item.icon} active={active} />
            </span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function NavIcon({ kind, active }: { kind: NavItem['icon']; active: boolean }) {
  const color = active ? 'var(--color-mc-uv-hi)' : 'var(--color-mc-fg-muted)';
  const size = 14;
  switch (kind) {
    case 'dot':
      return (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            display: 'inline-block',
          }}
        />
      );
    case 'bolt':
      return <BarChart3 size={size} color={color} aria-hidden />;
    case 'brain':
      return <Brain size={size} color={color} aria-hidden />;
    case 'check':
      return <Check size={size} color={color} aria-hidden />;
    default:
      return <Sparkles size={size} color={color} aria-hidden />;
  }
}
