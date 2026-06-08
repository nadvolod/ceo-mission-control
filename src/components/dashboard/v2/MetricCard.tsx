'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AmountEditor } from './AmountEditor';
import { InlineHoursEditor } from './InlineHoursEditor';
import { Sparkline } from './primitives/Sparkline';
import { fmtMetric, clamp } from './format';
import type { MetricIcon, MetricId, MetricSnapshot } from './types';

// Presentational badge icons keyed by the snapshot's `icon` field.
const METRIC_ICONS: Record<MetricIcon, LucideIcon> = {
  swords: Swords,
};

type Preset = { label: string; delta: number };

// Hour-based metrics keep their fixed quick-add deltas — `+1h Temporal` is a
// useful muscle-memory shortcut. Money is different: every entry is a
// different dollar amount, so the preset buttons just identify the
// CATEGORY and the actual amount comes from a typed input. See the
// `requiresAmountInput` branch in the render path below.
const PRESETS: Partial<Record<MetricId, Preset[]>> = {
  temporal:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  focus:      [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  deepWork:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }],
  trained:    [{ label: '+ Session', delta: 1 }],
  moneyMoved: [{ label: '+ Moved', delta: 0 }, { label: '+ Generated', delta: 0 }, { label: '+ Cut', delta: 0 }],
  battles:    [{ label: '+ Battle', delta: 1 }],
};

// Metrics whose preset buttons act as a CATEGORY selector, with the
// amount typed by the user. Adding a metric here turns its preset row
// into a two-step flow: click category → input amount → submit.
const REQUIRES_AMOUNT_INPUT: ReadonlySet<MetricId> = new Set(['moneyMoved', 'battles']);

type MetricCardProps = {
  metric: MetricSnapshot;
  big?: boolean;
  // The 4th arg `options.description` is forwarded to the store's log()
  // so money entries can attach a user-typed note (e.g. "Benepass") in
  // place of the auto-generated string.
  onLog?: (
    metricId: MetricId,
    delta: number,
    label: string,
    options?: { description?: string; value?: number },
  ) => void;
  // When provided AND `metric.id === 'temporal'`, a ✎ pencil button
  // renders next to the goal text in the eyebrow row. Clicking it opens
  // an inline editor below the eyebrow; submit calls this callback with
  // the new hours value. Resolves once the server has acknowledged.
  onUpdateGoal?: (newGoal: number) => Promise<void> | void;
};

function presetTestId(metricId: MetricId, label: string): string {
  const slug = label
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `preset-${metricId}-${slug}`;
}

export function MetricCard({ metric, big = false, onLog, onUpdateGoal }: MetricCardProps) {
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [flash, setFlash] = useState(false);
  // Tracks which category preset the user is in the middle of entering an
  // amount for. Only used when REQUIRES_AMOUNT_INPUT.has(metric.id).
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  // Open/closed state for the goal-edit row (Temporal Focus only). When
  // true, a new row renders below the eyebrow with an InlineHoursEditor.
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const prevRef = useRef<number | undefined>(undefined);

  // The big number is `today` for most cards; battles (headline === 'week')
  // headline the weekly count instead.
  const headline = metric.headline ?? 'today';
  const headlineValue = headline === 'week' ? (metric.week ?? 0) : metric.today;

  // Flash the border when the headline value changes. The setState is
  // deferred via setTimeout so the lint rule sees it as an external-event
  // callback rather than a synchronous effect-body setter.
  useEffect(() => {
    if (prevRef.current === undefined) {
      prevRef.current = headlineValue;
      return;
    }
    if (prevRef.current === headlineValue) return;
    prevRef.current = headlineValue;
    const on = setTimeout(() => setFlash(true), 0);
    const off = setTimeout(() => setFlash(false), 900);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [headlineValue]);

  const accent = metric.color;
  const week = metric.week;
  const goal = metric.goal;
  const Icon = metric.icon ? METRIC_ICONS[metric.icon] : null;
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

  // When the card already headlines the weekly value (battles), the sub-line
  // carries the contextual note (all-time count + $ won) rather than repeating
  // "N this week". Otherwise the sub-line shows weekly progress.
  const subLine =
    headline === 'week'
      ? metric.note || ''
      : week != null && week !== 0
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
          className="inline-flex items-center gap-1 font-numerics uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--color-mc-fg-dim)',
            fontWeight: 500,
          }}
        >
          {Icon && (
            <Icon
              size={11}
              aria-hidden
              style={{ color: accent }}
              data-testid={`metric-card-${metric.id}-icon`}
            />
          )}
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
            {/* Pencil edit button: only on the Temporal Focus card, only
                when the parent passes an onUpdateGoal callback, and only
                while the card is active (hover/focus) so it doesn't add
                visual noise at rest. */}
            {metric.id === 'temporal' && onUpdateGoal && active && !editingGoal && (
              <button
                type="button"
                onClick={() => {
                  setGoalError(null);
                  setEditingGoal(true);
                }}
                className="rounded-md flex items-center justify-center cursor-pointer"
                style={{
                  width: 16,
                  height: 16,
                  marginLeft: 2,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-mc-fg-dim)',
                  padding: 0,
                }}
                aria-label="Edit weekly goal"
                data-testid={`${metric.id}-edit-goal`}
              >
                <Pencil size={11} aria-hidden />
              </button>
            )}
          </span>
        )}
      </div>

      {/* Goal-edit row — renders below the eyebrow when editingGoal is on.
          Only on the Temporal Focus card. Submitting calls onUpdateGoal
          and closes the editor; Escape or × cancels. */}
      {editingGoal && metric.id === 'temporal' && onUpdateGoal && (
        <div
          className="relative"
          style={{ marginTop: 4 }}
          data-testid={`${metric.id}-goal-editor-row`}
        >
          <InlineHoursEditor
            label="Goal"
            initial={goal ?? 5}
            accent={accent}
            idPrefix={`${metric.id}-goal-editor`}
            disabled={goalSaving}
            onSubmit={async (newGoal) => {
              // Close the editor only on success. If onUpdateGoal rejects
              // (network/API failure), keep the editor open so the user can
              // retry without re-opening.
              if (goalSaving) return;
              setGoalSaving(true);
              setGoalError(null);
              try {
                await onUpdateGoal(newGoal);
                setEditingGoal(false);
              } catch (err) {
                setGoalError(err instanceof Error ? err.message : 'Save failed. Try again.');
              } finally {
                setGoalSaving(false);
              }
            }}
            onCancel={() => {
              setGoalError(null);
              setEditingGoal(false);
            }}
          />
          {goalSaving && (
            <div
              className="font-numerics uppercase"
              style={{
                marginTop: 4,
                fontSize: 10,
                letterSpacing: 0,
                color: 'var(--color-mc-fg-dim)',
              }}
              data-testid={`${metric.id}-goal-editor-saving`}
            >
              Saving...
            </div>
          )}
          {goalError && !goalSaving && (
            <div
              role="alert"
              className="font-numerics uppercase"
              style={{
                marginTop: 4,
                fontSize: 10,
                letterSpacing: 0,
                color: 'var(--color-mc-red)',
              }}
              data-testid={`${metric.id}-goal-editor-error`}
            >
              {goalError || 'Save failed. Try again.'}
            </div>
          )}
        </div>
      )}

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
          {fmtMetric(headlineValue, metric.fmt)}
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
            {headline === 'week' ? 'THIS WEEK' : 'TODAY'}
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
          ) : headline === 'week' ? (
            // The note already renders in the sub-line for week-headline cards
            // (battles); don't duplicate it in the footer.
            null
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
            selected. Submit via Enter or the ✓ button; cancel with × or Esc.
            For money, an additional note input lets the user describe the
            entry ("Benepass") rather than the auto "via Mission Control". */}
        {isEditing && onLog && editingLabel && (
          <div className="absolute inset-0">
            <AmountEditor
              label={editingLabel}
              accent={accent}
              idPrefix={`${metric.id}-amount`}
              withNote={metric.id === 'moneyMoved' || metric.id === 'battles'}
              requireNote={metric.id === 'battles'}
              notePlaceholder={metric.id === 'battles' ? 'Battle name' : undefined}
              amountPlaceholder={metric.id === 'battles' ? '$ won' : undefined}
              onSubmit={(amount, note) => {
                if (metric.id === 'battles') {
                  // Battles: the $ value travels in options.value; the delta is
                  // the count increment (1); the name is the note.
                  onLog(metric.id, 1, editingLabel, { description: note, value: amount });
                } else {
                  onLog(metric.id, amount, editingLabel, { description: note });
                }
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
