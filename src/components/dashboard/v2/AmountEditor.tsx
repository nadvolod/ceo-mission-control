'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

type AmountEditorProps = {
  // Visible category label rendered as a "tag" on the left
  // (e.g. "+ Moved", "+ Generated", "+ Cut").
  label: string;
  // Accent color used for the tag, input border, and submit button.
  accent: string;
  // Called with the parsed positive number on Enter or ✓ click.
  onSubmit: (amount: number) => void;
  // Called on Escape or × click.
  onCancel: () => void;
  // Optional testid prefix. Defaults to "amount" so the submit button is
  // `${idPrefix}-submit` etc. The desktop MetricCard passes `${metricId}`.
  idPrefix?: string;
};

// Inline category + amount + save/cancel form. Used by:
//   - MetricCard money-category presets (desktop)
//   - MobileLayout quick-log money entries (mobile)
// The user types the actual amount instead of accepting a hardcoded
// preset like $500 — that pattern made sense for hours but never made
// sense for money.
export function AmountEditor({
  label,
  accent,
  onSubmit,
  onCancel,
  idPrefix = 'amount',
}: AmountEditorProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const submit = () => {
    // Accept "$1,234.50" / "1234" / "1.5" — strip $, commas, spaces.
    const cleaned = value.replace(/[^0-9.]/g, '');
    const amount = parseFloat(cleaned);
    if (!Number.isFinite(amount) || amount <= 0) {
      // Invalid; leave the field open with focus so the user can correct.
      inputRef.current?.focus();
      return;
    }
    onSubmit(amount);
  };

  const disabled = value.trim().length === 0;

  return (
    <div
      className="flex items-center gap-1"
      style={{ width: '100%' }}
      data-testid={`${idPrefix}-editor`}
    >
      <span
        className="rounded-md font-numerics"
        style={{
          padding: '6px 6px',
          fontSize: 11,
          fontWeight: 500,
          background: `${accent}22`,
          color: accent,
          border: `1px solid ${accent}66`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
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
        placeholder="$"
        aria-label={`${label} amount`}
        className="font-numerics rounded-md"
        style={{
          flex: 1,
          minWidth: 0,
          padding: '6px 8px',
          fontSize: 12,
          background: 'rgba(0,0,0,0.25)',
          color: 'var(--color-mc-ink)',
          border: `1px solid ${accent}66`,
          outline: 'none',
        }}
        data-testid={`${idPrefix}-input`}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className="rounded-md cursor-pointer flex items-center justify-center"
        style={{
          width: 24,
          height: 24,
          background: disabled ? `${accent}22` : accent,
          color: disabled ? accent : '#fff',
          border: `1px solid ${accent}`,
          opacity: disabled ? 0.6 : 1,
        }}
        aria-label="Save amount"
        data-testid={`${idPrefix}-submit`}
      >
        <Check size={12} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md cursor-pointer flex items-center justify-center"
        style={{
          width: 24,
          height: 24,
          background: 'transparent',
          color: 'var(--color-mc-fg-dim)',
          border: '1px solid rgba(255,255,255,0.16)',
        }}
        aria-label="Cancel amount entry"
        data-testid={`${idPrefix}-cancel`}
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}
