'use client';

import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';

// Small inline edit/remove controls for a template item (supplement, habit,
// or environment field). View-only by default; clicking the pencil reveals
// an inline text input. Rename calls onRename(originalName, newName) only
// when the trimmed value is non-empty and actually changed.
export function EditableItemControls({
  name,
  onRemove,
  onRename,
  testIdBase,
  idx,
}: {
  name: string;
  onRemove: (name: string) => void;
  onRename: (originalName: string, newName: string) => void;
  testIdBase: string;
  idx: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const iconBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-mc-fg-muted)',
    cursor: 'pointer',
    padding: 2,
    lineHeight: 0,
  };

  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(name, next);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          data-testid={`${testIdBase}-edit-input-${idx}`}
          style={{
            width: 110,
            padding: '2px 6px',
            fontSize: 12,
            fontFamily: 'inherit',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            background: 'var(--color-mc-bg-warm)',
            color: 'var(--color-mc-ink)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          style={iconBtn}
          aria-label={`Save ${name}`}
          data-testid={`${testIdBase}-edit-save-${idx}`}
          onClick={commit}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          style={iconBtn}
          aria-label={`Cancel editing ${name}`}
          data-testid={`${testIdBase}-edit-cancel-${idx}`}
          onClick={cancel}
        >
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        style={iconBtn}
        aria-label={`Edit ${name}`}
        data-testid={`${testIdBase}-edit-${idx}`}
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        style={iconBtn}
        aria-label={`Remove ${name}`}
        data-testid={`${testIdBase}-remove-${idx}`}
        onClick={() => onRemove(name)}
      >
        <Trash2 size={13} />
      </button>
    </span>
  );
}
