'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import type { MetricId } from './types';
import { MC_COLORS } from './seed';

export type CmdAction = {
  kw: string;
  label: string;
  hint: string;
  icon: string;
  accent: string;
  run: () => void;
};

type CmdKProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLog: (metricId: MetricId, delta: number, label: string) => void;
  onOpenReflection: () => void;
  onSwitchTab?: (tab: 'overview' | 'insights' | 'review') => void;
};

function actionsFor({ onLog, onOpenReflection, onSwitchTab }: Pick<CmdKProps, 'onLog' | 'onOpenReflection' | 'onSwitchTab'>): CmdAction[] {
  return [
    { kw: '+0.5h temporal', label: 'Log +0.5h Temporal',  hint: 'temp 0.5', icon: '⏱', accent: MC_COLORS.pink,  run: () => onLog('temporal', 0.5, '+0.5h') },
    { kw: '+1h temporal',   label: 'Log +1h Temporal',    hint: 'temp 1',   icon: '⏱', accent: MC_COLORS.pink,  run: () => onLog('temporal', 1, '+1h') },
    { kw: '+2h temporal',   label: 'Log +2h Temporal',    hint: 'temp 2',   icon: '⏱', accent: MC_COLORS.pink,  run: () => onLog('temporal', 2, '+2h') },
    { kw: '+gen generated gen 2000 generated 2000', label: '+ Generated $2,000', hint: '$ gen', icon: '$', accent: MC_COLORS.green, run: () => onLog('moneyMoved', 2000, '+ Generated') },
    { kw: '+moved',         label: '+ Moved $500',        hint: '$ moved',  icon: '$', accent: MC_COLORS.green, run: () => onLog('moneyMoved', 500, '+ Moved') },
    { kw: '+cut',           label: '+ Cut $250',          hint: '$ cut',    icon: '$', accent: MC_COLORS.green, run: () => onLog('moneyMoved', 250, '+ Cut') },
    { kw: '+call pipeline', label: '+ Pipeline call',     hint: 'pipe',     icon: '☎', accent: MC_COLORS.amber, run: () => onLog('pipeline', 0.5, '+ Call') },
    { kw: '+demo pipeline', label: '+ Pipeline demo',     hint: 'pipe',     icon: '☎', accent: MC_COLORS.amber, run: () => onLog('pipeline', 1, '+ Demo') },
    { kw: '+0.5h deep',     label: '+0.5h Deep work',     hint: 'deep',     icon: '◆', accent: MC_COLORS.cyan,  run: () => onLog('deepWork', 0.5, '+0.5h') },
    { kw: '+1h deep',       label: '+1h Deep work',       hint: 'deep 1',   icon: '◆', accent: MC_COLORS.cyan,  run: () => onLog('deepWork', 1, '+1h') },
    { kw: '+train session', label: '+ Training session',  hint: 'train',    icon: '△', accent: MC_COLORS.amber, run: () => onLog('trained', 1, '+ Session') },
    { kw: 'reflect t3t',    label: 'Open reflection',     hint: '⌘R',       icon: '❋', accent: MC_COLORS.pink,  run: onOpenReflection },
    ...(onSwitchTab
      ? [
          { kw: 'insights trends', label: 'Open insights', hint: 'tab 2', icon: '∿', accent: MC_COLORS.uv, run: () => onSwitchTab('insights') } as CmdAction,
          { kw: 'review',          label: 'Open review',   hint: 'tab 3', icon: '▸', accent: MC_COLORS.uv, run: () => onSwitchTab('review')   } as CmdAction,
        ]
      : []),
  ];
}

// Substring fuzz match across the keyword string + label. The order is
// intentional: untyped → first 8 actions in declaration order.
export function filterActions(actions: CmdAction[], query: string): CmdAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return actions.slice(0, 8);
  return actions.filter(
    (a) => a.kw.toLowerCase().includes(q) || a.label.toLowerCase().includes(q),
  );
}

export function CmdK({ open, onOpenChange, onLog, onOpenReflection, onSwitchTab }: CmdKProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo(
    () => actionsFor({ onLog, onOpenReflection, onSwitchTab }),
    [onLog, onOpenReflection, onSwitchTab],
  );
  const filtered = useMemo(() => filterActions(actions, query), [actions, query]);

  // Reset query + focus the input on open. Both happen inside an rAF callback
  // so the linter sees them as external-event setters, not synchronous-in-effect.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      setQuery('');
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const run = (action: CmdAction) => {
    action.run();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 z-50 -translate-x-1/2 overflow-hidden"
          style={{
            top: 80,
            width: 'min(560px, 92vw)',
            background: 'var(--color-mc-bg-warm)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 14,
            boxShadow:
              '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,124,255,0.13), 0 0 80px rgba(124,124,255,0.10)',
            color: 'var(--color-mc-fg)',
            fontFamily: 'var(--font-mc-sans)',
          }}
          aria-describedby={undefined}
          data-testid="cmdk-dialog"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div
            className="flex items-center gap-2.5"
            style={{
              padding: '14px 16px',
              borderBottom: filtered.length ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}
          >
            <Search size={15} style={{ color: 'var(--color-mc-uv-hi)' }} aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault();
                  run(filtered[0]);
                }
              }}
              placeholder='Log, jump, search… try "+1h temporal" or "gen 2000"'
              className="flex-1"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: 'var(--color-mc-ink)',
                fontFamily: 'inherit',
              }}
              data-testid="cmdk-input"
              aria-label="Command palette search"
            />
            <span
              className="font-numerics"
              style={{
                fontSize: 10,
                color: 'var(--color-mc-fg-muted)',
                padding: '2px 6px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                letterSpacing: '0.06em',
              }}
            >
              ESC
            </span>
          </div>

          <div
            className="overflow-auto"
            style={{ maxHeight: 340, padding: '6px 0' }}
            role="listbox"
            data-testid="cmdk-results"
          >
            {filtered.map((action, i) => (
              <button
                key={action.kw + i}
                type="button"
                onClick={() => run(action)}
                className="flex w-full items-center gap-3 text-left cursor-pointer"
                style={{
                  padding: '10px 14px',
                  background: i === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: 'none',
                  color: 'var(--color-mc-fg)',
                  font: 'inherit',
                }}
                role="option"
                aria-selected={i === 0}
                data-testid={`cmdk-action-${i}`}
              >
                <span
                  className="flex items-center justify-center font-numerics"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: `${action.accent}22`,
                    color: action.accent,
                    fontSize: 14,
                  }}
                  aria-hidden
                >
                  {action.icon}
                </span>
                <span className="flex-1" style={{ fontSize: 13, color: 'var(--color-mc-ink)' }}>
                  {action.label}
                </span>
                <span
                  className="font-numerics"
                  style={{
                    fontSize: 10,
                    color: 'var(--color-mc-fg-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {action.hint}
                </span>
                {i === 0 && (
                  <span
                    className="font-numerics"
                    style={{
                      fontSize: 10,
                      color: 'var(--color-mc-uv-hi)',
                      padding: '2px 6px',
                      background: 'rgba(124,124,255,0.14)',
                      border: '1px solid rgba(124,124,255,0.33)',
                      borderRadius: 4,
                    }}
                  >
                    ↩
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '18px 16px', color: 'var(--color-mc-fg-dim)', fontSize: 13 }}>
                No match. Try &ldquo;temp&rdquo;, &ldquo;gen&rdquo;, &ldquo;call&rdquo;, &ldquo;train&rdquo;, &ldquo;reflect&rdquo;.
              </div>
            )}
          </div>

          <div
            className="flex items-center gap-3"
            style={{
              padding: '8px 14px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <span
              className="font-numerics"
              style={{ fontSize: 10, color: 'var(--color-mc-fg-muted)', letterSpacing: '0.06em' }}
            >
              ↩ RUN
            </span>
            <span
              className="font-numerics"
              style={{ fontSize: 10, color: 'var(--color-mc-fg-muted)', letterSpacing: '0.06em' }}
            >
              ESC CLOSE
            </span>
            <span
              className="ml-auto font-numerics"
              style={{ fontSize: 10, color: 'var(--color-mc-fg-dim)', letterSpacing: '0.06em' }}
            >
              {filtered.length} · {actions.length} ACTIONS
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
