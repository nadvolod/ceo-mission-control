'use client';

import { Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ActivityEntry, MetricIcon } from './types';

// Presentational badge icons keyed by an activity row's `icon` field.
const ROW_ICONS: Record<MetricIcon, LucideIcon> = {
  swords: Swords,
};

export function ActivityFeed({
  entries,
  onOpenDetail,
}: {
  entries: ActivityEntry[];
  onOpenDetail?: (entry: ActivityEntry) => void;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-mc-ink)' }}>
            Activity
          </span>
          <span
            aria-hidden
            className="mc-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-mc-green)',
              boxShadow: '0 0 8px var(--color-mc-green)',
              display: 'inline-block',
            }}
          />
        </div>
        <span
          className="font-numerics"
          style={{ fontSize: 10, color: 'var(--color-mc-fg-dim)', letterSpacing: '0.08em' }}
        >
          LIVE
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {entries.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} onOpenDetail={onOpenDetail} />
        ))}
        {entries.length === 0 && (
          <div
            style={{
              padding: '18px 14px',
              fontSize: 12,
              color: 'var(--color-mc-fg-dim)',
            }}
          >
            No activity yet today.
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({
  entry,
  onOpenDetail,
}: {
  entry: ActivityEntry;
  onOpenDetail?: (entry: ActivityEntry) => void;
}) {
  const isPositive = entry.delta.startsWith('+');
  const RowIcon = entry.icon ? ROW_ICONS[entry.icon] : null;
  // Only make the row interactive when it can actually resolve to a detail
  // view. Optimistic/local store entries have no `source`/`refKey`, so the
  // page's openDetail early-returns for them — gating on `entry.source`
  // prevents rows that look clickable but do nothing (a11y/UX defect).
  const clickable = !!onOpenDetail && !!entry.source;
  return (
    <div
      className="flex items-start gap-2.5"
      style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        cursor: clickable ? 'pointer' : undefined,
      }}
      {...(clickable
        ? {
            role: 'button',
            tabIndex: 0,
            'data-testid': `activity-row-${entry.id}`,
            onClick: () => onOpenDetail(entry),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenDetail(entry);
              }
            },
          }
        : {})}
    >
      <span
        className="font-numerics"
        style={{
          fontSize: 10,
          color: 'var(--color-mc-fg-muted)',
          paddingTop: 2,
          minWidth: 34,
        }}
      >
        {entry.t}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {RowIcon && (
            <RowIcon
              size={11}
              aria-hidden
              style={{ color: 'var(--color-mc-amber)', alignSelf: 'center' }}
              data-testid={`activity-row-icon-${entry.id}`}
            />
          )}
          <span
            className="font-numerics"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: isPositive ? 'var(--color-mc-green)' : 'var(--color-mc-fg)',
            }}
          >
            {entry.delta}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-mc-ink)', fontWeight: 500 }}>
            {entry.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-mc-fg-dim)', marginTop: 1 }}>
          {entry.meta}
        </div>
      </div>
    </div>
  );
}
