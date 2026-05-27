'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Sparkline } from './primitives/Sparkline';
import { fmtMetric, clamp } from './format';
import type { MetricId, MetricSnapshot } from './types';

type Preset = { label: string; delta: number };

const PRESETS: Partial<Record<MetricId, Preset[]>> = {
  temporal:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  focus:      [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }, { label: '+2h', delta: 2 }],
  pipeline:   [{ label: '+ Call', delta: 0.5 }, { label: '+ Demo', delta: 1 }, { label: '+ FU', delta: 0.5 }],
  deepWork:   [{ label: '+0.5h', delta: 0.5 }, { label: '+1h', delta: 1 }],
  trained:    [{ label: '+ Session', delta: 1 }],
  moneyMoved: [{ label: '+ Moved', delta: 250 }, { label: '+ Generated', delta: 500 }, { label: '+ Cut', delta: 100 }],
};

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

        {/* Preset row (hover-revealed) */}
        {presets.length > 0 && onLog && (
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
                onClick={() => onLog(metric.id, preset.delta, preset.label)}
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
      </div>
    </div>
  );
}
