'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { AmountEditor } from './AmountEditor';
import { Sparkline } from './primitives/Sparkline';
import { fmtMetric, clamp } from './format';
import type { MetricId, MetricSnapshot } from './types';

type Preset = { label: string; delta: number };

// Hour-based metrics keep their fixed quick-add deltas — `+1h Temporal` is a
// useful muscle-memory shortcut. Money is different: every entry is a
// different dollar amount, so the preset buttons just identify the
// CATEGORY and the actual amount comes from a typed input. See the
// `requiresAmountInput` branch in the render path below.
const PRESETS: Partial<Record<MetricId, Preset[]>> = {
  temporal:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  focus:      [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  pipeline:   [{ label: '+ Call', delta: 0.5 }, { label: '+ Demo', delta: 1 }, { label: '+ FU', delta: 0.5 }],
  deepWork:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }],
  trained:    [{ label: '+ Session', delta: 1 }],
  moneyMoved: [{ label: '+ Moved', delta: 0 }, { label: '+ Generated', delta: 0 }, { label: '+ Cut', delta: 0 }],
};

// Metrics whose preset buttons act as a CATEGORY selector, with the
// amount typed by the user. Adding a metric here turns its preset row
// into a two-step flow: click category → input amount → submit.
const REQUIRES_AMOUNT_INPUT: ReadonlySet<MetricId> = new Set(['moneyMoved']);

type MetricCardProps = {
  metric: MetricSnapshot;
  big?: boolean;
  onLog?: (metricId: MetricId, delta: number, label: string) => void;
};

function presetTestId(metricId: MetricId, label: string): string {
  const slug = label
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `preset-${metricId}-${slug}`;
}

export function MetricCard({ metric, big = false, onLog }: MetricCardProps) {
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [flash, setFlash] = useState(false);
  // Tracks which category preset the user is in the middle of entering an
  // amount for. Only used when REQUIRES_AMOUNT_INPUT.has(metric.id).
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const prevRef = useRef<number | undefined>(undefined);

  // Flash the border when the metric.today value changes. The setState is
  // deferred via setTimeout so the lint rule sees it as an external-event
  // callback rather than a synchronous effect-body setter.
  useEffect(() => {
    if (prevRef.current === undefined) {
      prevRef.current = metric.today;
      return;
    }
    if (prevRef.current === metric.today) return;
    prevRef.current = metric.today;
    const on = setTimeout(() => setFlash(true), 0);
    const off = setTimeout(() => setFlash(false), 900);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [metric.today]);

  const accent = metric.color;
  const week = metric.week;
  const goal = metric.goal;
  const goalPct = goal != null && week != null ? clamp(week / goal, 0, 1) : null;
  const ahead = goal != null && week != null && week >= goal;
  const presets = PRESETS[metric.id] ?? [];
  const active = hover || focusWithin;
  const showPresets = active && presets.length > 0 && !!onLog;
  const requiresAmount = REQUIRES_AMOUNT_INPUT.has(metric.id);
  const isEditing = editingLabel !== null && requiresAmount;

  // Reset the editing state when the card loses both hover and keyboard
  // focus. Deferred via rAF so the setState isn't a synchronous effect-
  // body setter (React 19 lint rule); the visible effect is the same.
  useEffect(() => {
    if (!(!active && isEditing)) return;
    const id = requestAnimationFrame(() => {
      setEditingLabel(null);
    });
    return () => cancelAnimationFrame(id);
  }, [active, isEditing]);

  const handlePresetClick = (preset: Preset) => {
    if (!onLog) return;
    if (requiresAmount) {
      // Don't log a hardcoded amount — open the input. The user types the
      // real number and submits via Enter / ✓.
      setEditingLabel(preset.label);
    } else {
      onLog(metric.id, preset.delta, preset.label);
    }
  };

  const subLine =
    week != null && week !== 0
      ? `${fmtMetric(week, metric.fmt)} this week`
      : metric.note || '';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) setFocusWithin(false);
      }}
      className="relative flex flex-col gap-2 overflow-hidden rounded-xl p-[14px]"
      style={{
        minHeight: 134,
        background: active ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${flash ? accent : active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)'}`,
        backdropFilter: 'blur(20px)',
        transition: 'border-color .35s, background .15s, box-shadow .35s',
        boxShadow: flash ? `0 0 24px ${accent}88, inset 0 0 0 1px ${accent}` : 'none',
      }}
      data-testid={`metric-card-${metric.id}`}
      tabIndex={presets.length > 0 && onLog ? 0 : undefined}
      aria-label={`${metric.label} metric`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -30,
          right: -30,
          width: 90,
          height: 90,
          background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
          opacity: active ? 0.32 : 0.18,
          transition: 'opacity .2s',
        }}
      />

      <div className="relative flex items-baseline justify-between gap-2">
        <span
          className="font-numerics uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--color-mc-fg-dim)',
            fontWeight: 500,
          }}
        >
          {metric.label}
        </span>
        {goal != null && week != null && (
          <span
            className="inline-flex items-center gap-1 font-numerics"
            style={{
              fontSize: 10,
              color: ahead ? 'var(--color-mc-green)' : 'var(--color-mc-fg-muted)',
            }}
          >
            {ahead && <Check size={10} aria-hidden />}
            {fmtMetric(week, metric.fmt)}/{fmtMetric(goal, metric.fmt)}
          </span>
        )}
      </div>

      <div className="relative flex items-baseline gap-1.5">
        <span
          className="font-numerics"
          style={{
            fontSize: big ? 30 : 26,
            color: 'var(--color-mc-ink)',
            lineHeight: 1,
          }}
          data-testid={`metric-card-${metric.id}-value`}
        >
          {fmtMetric(metric.today, metric.fmt)}
        </span>
        {metric.fmt !== 'pct' && metric.id !== 'cashMoM' && (
          <span
            className="font-numerics"
            style={{
              fontSize: 10,
              color: 'var(--color-mc-fg-muted)',
              letterSpacing: '0.06em',
            }}
          >
            TODAY
          </span>
        )}
      </div>

      <div
        className="relative flex items-center gap-1.5"
        style={{ fontSize: 11, color: 'var(--color-mc-fg-dim)' }}
      >
        <span>{subLine}</span>
      </div>

      <div className="relative mt-auto" style={{ height: 32 }}>
        {/* Default footer */}
        <div
          className="absolute inset-0"
          style={{
            opacity: showPresets ? 0 : 1,
            transition: 'opacity .12s',
            pointerEvents: showPresets ? 'none' : 'auto',
          }}
        >
          {metric.spark && metric.spark.length > 0 ? (
            <Sparkline data={metric.spark} color={accent} fill={accent} height={32} width={232} />
          ) : goalPct != null ? (
            <div
              className="overflow-hidden"
              style={{
                width: '100%',
                height: 4,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 2,
                marginTop: 14,
              }}
            >
              <div
                style={{
                  width: `${goalPct * 100}%`,
                  height: '100%',
                  background: ahead ? 'var(--color-mc-green)' : accent,
                  boxShadow: `0 0 8px ${accent}66`,
                  transition: 'width .3s',
                }}
              />
            </div>
          ) : (
            <div
              className="font-numerics uppercase"
              style={{
                marginTop: 14,
                fontSize: 10,
                color: 'var(--color-mc-fg-muted)',
                letterSpacing: '0.08em',
              }}
            >
              {metric.note}
            </div>
          )}
        </div>

        {/* Preset row (hover-revealed) — shown when not editing an amount. */}
        {presets.length > 0 && onLog && !isEditing && (
          <div
            className="absolute inset-0 flex items-center gap-1"
            style={{
              opacity: showPresets ? 1 : 0,
              transition: 'opacity .12s',
              pointerEvents: showPresets ? 'auto' : 'none',
            }}
            aria-hidden={!showPresets}
          >
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetClick(preset)}
                tabIndex={showPresets ? 0 : -1}
                className="flex-1 rounded-md cursor-pointer"
                style={{
                  padding: '6px 4px',
                  fontSize: 11,
                  fontWeight: 500,
                  background: `${accent}22`,
                  color: accent,
                  border: `1px solid ${accent}66`,
                  font: 'inherit',
                }}
                data-testid={presetTestId(metric.id, preset.label)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {/* Amount-entry row — replaces the presets when a money category is
            selected. Submit via Enter or the ✓ button; cancel with × or Esc. */}
        {isEditing && onLog && editingLabel && (
          <div className="absolute inset-0">
            <AmountEditor
              label={editingLabel}
              accent={accent}
              idPrefix={`${metric.id}-amount`}
              onSubmit={(amount) => {
                onLog(metric.id, amount, editingLabel);
                setEditingLabel(null);
              }}
              onCancel={() => setEditingLabel(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
