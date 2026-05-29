'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

type InlineHoursEditorProps = {
  // Static label rendered before the input (e.g. "Goal").
  label: string;
  // Initial numeric value populated into the input on mount.
  initial: number;
  // Accent color used for the submit button + input border.
  accent: string;
  // Fired with the parsed positive number (in hours) on Enter or ✓.
  // Validation is strict: 0.5–40 inclusive, decimal allowed; anything
  // outside the range or non-numeric refocuses the input instead.
  onSubmit: (hours: number) => void | Promise<void>;
  // Fired on Escape or × click.
  onCancel: () => void;
  // Prevents edits / duplicate submits while an async caller is saving.
  disabled?: boolean;
  // testid prefix; "hours-editor" + the various sub-element suffixes.
  idPrefix?: string;
  // Min/max bounds. Defaults: 0.5 and 40.
  min?: number;
  max?: number;
};

// Tight inline editor for a numeric hours value. Sized to slot into a
// secondary row on a MetricCard (smaller footprint than AmountEditor).
// Used by the Temporal Focus card's goal-edit affordance; the same
// primitive can be reused for any future per-metric goal editor.
export function InlineHoursEditor({
  label,
  initial,
  accent,
  onSubmit,
  onCancel,
  disabled = false,
  idPrefix = 'hours-editor',
  min = 0.5,
  max = 40,
}: InlineHoursEditorProps) {
  const [value, setValue] = useState(String(initial));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input on mount; deliberately do NOT call .select() — that
    // races userEvent.type in tests (the select fires between typed
    // characters and swallows already-entered text). Users can highlight
    // manually with Cmd/Ctrl-A if they want.
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const submit = () => {
    if (disabled) return;
    // Strip whitespace only — no $ / , here, hours don't carry money
    // formatting. Strict positive-decimal regex (matches AmountEditor's
    // post-PR-65 parser) rejects "-5" / "1e3" / "1.2.3" / ".50" / "12.".
    const cleaned = value.replace(/\s/g, '');
    if (!/^\d+(\.\d+)?$/.test(cleaned)) {
      inputRef.current?.focus();
      return;
    }
    const hours = parseFloat(cleaned);
    if (!Number.isFinite(hours) || hours < min || hours > max) {
      inputRef.current?.focus();
      return;
    }
    onSubmit(hours);
  };

  const submitDisabled =
    disabled ||
    value.trim().length === 0 ||
    !/^\d+(\.\d+)?$/.test(value.replace(/\s/g, ''));

  return (
    <div
      className="flex items-center gap-1.5"
      style={{ width: '100%' }}
      data-testid={`${idPrefix}`}
    >
      <span
        className="font-numerics uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'var(--color-mc-fg-dim)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        aria-label={`${label} hours (${min}–${max})`}
        className="font-numerics rounded-md"
        style={{
          flex: '0 0 64px',
          minWidth: 0,
          padding: '4px 8px',
          fontSize: 12,
          background: 'rgba(0,0,0,0.25)',
          color: 'var(--color-mc-ink)',
          border: `1px solid ${accent}66`,
          outline: 'none',
          opacity: disabled ? 0.72 : 1,
        }}
        data-testid={`${idPrefix}-input`}
      />
      <span
        className="font-numerics"
        style={{
          fontSize: 11,
          color: 'var(--color-mc-fg-dim)',
        }}
      >
        h
      </span>
      <button
        type="button"
        onClick={submit}
        disabled={submitDisabled}
        className="rounded-md cursor-pointer flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          background: submitDisabled ? `${accent}22` : accent,
          color: submitDisabled ? accent : '#fff',
          border: `1px solid ${accent}`,
          opacity: submitDisabled ? 0.6 : 1,
        }}
        aria-label="Save hours"
        data-testid={`${idPrefix}-submit`}
      >
        <Check size={11} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md cursor-pointer flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          background: 'transparent',
          color: 'var(--color-mc-fg-dim)',
          border: '1px solid rgba(255,255,255,0.16)',
        }}
        aria-label="Cancel"
        data-testid={`${idPrefix}-cancel`}
      >
        <X size={11} aria-hidden />
      </button>
    </div>
  );
}
