'use client';

import { ArrowUp, Flame, Zap } from 'lucide-react';
import type { Chip } from './palette';

export function ChipStrip({ chips }: { chips: Chip[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <ChipPill key={chip.id} chip={chip} />
      ))}
    </div>
  );
}

function ChipPill({ chip }: { chip: Chip }) {
  switch (chip.kind) {
    case 'streak':
      return (
        <Pill
          background="rgba(255,255,255,0.04)"
          border="rgba(255,255,255,0.08)"
        >
          <Flame size={12} style={{ color: 'var(--color-mc-amber)' }} aria-hidden />
          <span style={{ color: 'var(--color-mc-ink)', fontWeight: 500 }}>{chip.body}</span>
          <span
            className="font-numerics"
            style={{ color: 'var(--color-mc-fg-muted)', fontSize: 10 }}
          >
            · {chip.meta}
          </span>
        </Pill>
      );
    case 'positive':
      return (
        <Pill
          background="rgba(61,220,151,0.08)"
          border="rgba(61,220,151,0.25)"
        >
          <ArrowUp size={12} style={{ color: 'var(--color-mc-green)' }} aria-hidden />
          <span style={{ color: 'var(--color-mc-ink)', fontWeight: 500 }}>{chip.body}</span>
          <span
            className="font-numerics"
            style={{ color: 'var(--color-mc-green)', fontSize: 11 }}
          >
            {chip.emphasis}
          </span>
        </Pill>
      );
    case 'warning':
      return (
        <Pill
          background="rgba(255,180,84,0.08)"
          border="rgba(255,180,84,0.25)"
        >
          <Zap size={12} style={{ color: 'var(--color-mc-amber)' }} aria-hidden />
          <span style={{ color: 'var(--color-mc-ink)', fontWeight: 500 }}>{chip.body}</span>
        </Pill>
      );
    case 'sync':
      return (
        <Pill
          background="rgba(255,255,255,0.04)"
          border="rgba(255,255,255,0.08)"
        >
          <span
            className="font-numerics"
            style={{ fontSize: 10, letterSpacing: 0, color: 'var(--color-mc-fg-dim)' }}
          >
            {chip.body}
          </span>
        </Pill>
      );
  }
}

function Pill({
  children,
  background,
  border,
}: {
  children: React.ReactNode;
  background: string;
  border: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full"
      style={{
        padding: '3px 7px',
        fontSize: 11.5,
        background,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {children}
    </div>
  );
}
