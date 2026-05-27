'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

type CollapsiblePanelProps = {
  title: string;
  count?: string;
  defaultOpen?: boolean;
  accent?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export function CollapsiblePanel({
  title,
  count,
  defaultOpen = false,
  accent,
  action,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-mc-fg)',
          font: 'inherit',
        }}
        aria-expanded={open}
      >
        <ChevronRight
          size={12}
          aria-hidden
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform .15s',
            color: 'var(--color-mc-fg-dim)',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-mc-ink)' }}>
          {title}
        </span>
        {count != null && (
          <span
            className="font-numerics"
            style={{ fontSize: 11, color: 'var(--color-mc-fg-muted)' }}
          >
            {count}
          </span>
        )}
        {accent}
        <div className="ml-auto flex items-center gap-2">{action}</div>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '4px 0' }}>
          {children}
        </div>
      )}
    </div>
  );
}
