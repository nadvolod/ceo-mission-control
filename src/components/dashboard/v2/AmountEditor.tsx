'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

type AmountEditorProps = {
  // Visible category label rendered as a "tag" on the left
  // (e.g. "+ Moved", "+ Generated", "+ Cut").
  label: string;
  // Accent color used for the tag, input border, and submit button.
  accent: string;
  // Called with the parsed positive number on Enter or ✓ click. If a
  // note field is shown and the user typed into it, the trimmed string
  // is passed as the second arg (otherwise undefined).
  onSubmit: (amount: number, note?: string) => void;
  // Called on Escape or × click.
  onCancel: () => void;
  // Optional testid prefix. Defaults to "amount" so the submit button is
  // `${idPrefix}-submit` etc. The desktop MetricCard passes `${metricId}`.
  idPrefix?: string;
  // When true, an additional free-form text input ("Note") is rendered
  // alongside the amount. Used by money entries so the user can attach
  // a description like "Benepass" instead of the auto-generated
  // "+ Moved via Mission Control".
  withNote?: boolean;
  // Placeholder shown in the note input. Defaults to "Note".
  notePlaceholder?: string;
  // When true (and withNote), the note becomes REQUIRED: submit is blocked
  // until it's non-empty. Used by battles, where the battle name is mandatory.
  requireNote?: boolean;
  // Placeholder shown in the amount input. Defaults to "$".
  amountPlaceholder?: string;
  // When true, an amount of exactly 0 is accepted (e.g. a non-monetary
  // battle win that still counts). Money entries keep the strict > 0 rule.
  allowZero?: boolean;
};

// Inline category + amount [+ optional note] + save/cancel form. Used by:
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
  withNote = false,
  notePlaceholder = 'Note (e.g. Benepass)',
  requireNote = false,
  amountPlaceholder = '$',
  allowZero = false,
}: AmountEditorProps) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const submit = () => {
    // Strict positive-decimal parse. Accepts "$1,234.50" / "1234" / "1.5".
    // Rejects "-5" (negative sign stripped → would silently log +5),
    // "1e3" / "1E3" (exponent stripped → silently logs 13), and any
    // malformed decimal like "12..3" or "1.2.3" that parseFloat would
    // silently truncate.
    const cleaned = value.replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d+)?$/.test(cleaned)) {
      amountRef.current?.focus();
      return;
    }
    const amount = parseFloat(cleaned);
    // The regex above never yields a negative, so the only question is whether
    // 0 is acceptable. Battles allow a $0 (non-monetary) win; money requires >0.
    const amountOk = Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0);
    if (!amountOk) {
      amountRef.current?.focus();
      return;
    }
    const trimmedNote = note.trim();
    // When the note is required (battles), block submit until it's filled.
    if (requireNote && trimmedNote.length === 0) {
      noteRef.current?.focus();
      return;
    }
    onSubmit(amount, trimmedNote.length > 0 ? trimmedNote : undefined);
  };

  const disabled =
    value.trim().length === 0 || (requireNote && note.trim().length === 0);

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
        ref={amountRef}
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
        placeholder={amountPlaceholder}
        aria-label={`${label} amount`}
        className="font-numerics rounded-md"
        style={{
          // The amount input is narrower when a note input shares the row,
          // wider when it's the only one.
          flex: withNote ? '0 0 90px' : 1,
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
      {withNote && (
        <input
          ref={noteRef}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder={notePlaceholder}
          aria-label={`${label} note`}
          className="rounded-md"
          maxLength={120}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '6px 8px',
            fontSize: 12,
            fontFamily: 'inherit',
            background: 'rgba(0,0,0,0.25)',
            color: 'var(--color-mc-ink)',
            border: '1px solid rgba(255,255,255,0.12)',
            outline: 'none',
          }}
          data-testid={`${idPrefix}-note`}
        />
      )}
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
