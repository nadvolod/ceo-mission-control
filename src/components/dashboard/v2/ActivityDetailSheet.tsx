'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { DailyHealthNote, ThreeToThriveEntry } from '@/lib/types';

export type ActivityDetail =
  | { source: 'morning'; title: string; note: DailyHealthNote | null }
  | { source: 'reflection'; title: string; entry: ThreeToThriveEntry | null }
  | { source: 'money'; title: string; amount: number; category: string; note: string; when: string }
  | { source: 'focus'; title: string; category: string; hours: number; description: string; when: string }
  | { source: 'battle'; title: string; value: number; name: string; when: string };

function fmtDuration(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return '—';
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between" style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-mc-ink)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Body({ detail }: { detail: ActivityDetail }) {
  if (detail.source === 'morning') {
    const n = detail.note;
    if (!n) return <p style={{ fontSize: 13, color: 'var(--color-mc-fg-muted)' }}>No data for this entry.</p>;
    const sm = n.sleepMetrics;
    return (
      <div>
        <Row label="Sleep score" value={sm?.sleepScore ?? '—'} />
        <Row label="Duration" value={fmtDuration(sm?.durationMinutes)} />
        <Row label="Body battery" value={sm?.bodyBattery ?? '—'} />
        <Row label="Resting HR" value={sm?.restingHeartRate ?? '—'} />
        <Row label="HRV" value={sm?.hrv ?? '—'} />
        <Row label="Temperature" value={n.sleepEnvironment.temperatureF != null ? `${n.sleepEnvironment.temperatureF}°F` : '—'} />
        <Row label="Fan" value={n.sleepEnvironment.fanRunning ? 'On' : 'Off'} />
        <Row label="Dog in room" value={n.sleepEnvironment.dogInRoom ? 'Yes' : 'No'} />
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>Supplements</div>
        {n.supplements.length === 0 && <div style={{ fontSize: 13 }}>—</div>}
        {n.supplements.map((s) => (
          <Row key={s.name} label={s.name} value={s.taken ? `${s.dosageMg}mg ✓` : 'skipped'} />
        ))}
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>Habits</div>
        {n.habits.length === 0 && <div style={{ fontSize: 13 }}>—</div>}
        {n.habits.map((h) => (
          <Row key={h.name} label={h.name} value={h.done ? '✓' : '✗'} />
        ))}
        {n.freeformNote.trim() && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-mc-ink)' }}>{n.freeformNote}</p>
        )}
      </div>
    );
  }
  if (detail.source === 'reflection') {
    const e = detail.entry;
    if (!e) return <p style={{ fontSize: 13, color: 'var(--color-mc-fg-muted)' }}>No data for this entry.</p>;
    return (
      <div>
        {e.questions.map((q) => {
          const ans = e.answers.find((a) => a.question === q);
          return (
            <div key={q} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>{q}</div>
              <div style={{ fontSize: 13, color: 'var(--color-mc-ink)', marginTop: 2 }}>{ans?.answer?.trim() || '—'}</div>
            </div>
          );
        })}
      </div>
    );
  }
  if (detail.source === 'money') {
    return (
      <div>
        <Row label="Amount" value={`$${detail.amount.toLocaleString()}`} />
        <Row label="Category" value={detail.category} />
        <Row label="When" value={detail.when} />
        {detail.note && <p style={{ marginTop: 12, fontSize: 13 }}>{detail.note}</p>}
      </div>
    );
  }
  if (detail.source === 'battle') {
    return (
      <div>
        <Row label="Value won" value={`$${detail.value.toLocaleString()}`} />
        <Row label="Battle" value={detail.name || '—'} />
        <Row label="When" value={detail.when} />
      </div>
    );
  }
  return (
    <div>
      <Row label="Category" value={detail.category} />
      <Row label="Hours" value={`${detail.hours}h`} />
      <Row label="When" value={detail.when} />
      {detail.description && <p style={{ marginTop: 12, fontSize: 13 }}>{detail.description}</p>}
    </div>
  );
}

export function ActivityDetailSheet({
  open,
  onOpenChange,
  detail,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ActivityDetail | null;
  onEdit?: (detail: ActivityDetail) => void;
}) {
  const canEdit = !!detail && (detail.source === 'morning' || detail.source === 'reflection');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />
        <Dialog.Content
          data-testid="activity-detail-sheet"
          style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)', zIndex: 41,
            background: 'var(--color-mc-bg)', borderLeft: '1px solid rgba(255,255,255,0.1)',
            padding: '18px 18px 24px', overflowY: 'auto', color: 'var(--color-mc-fg)',
            fontFamily: 'var(--font-mc-sans)',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-mc-ink)' }}>
              {detail?.title ?? 'Detail'}
            </Dialog.Title>
            <Dialog.Close aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--color-mc-fg-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Read-only details for the selected activity entry.
          </Dialog.Description>
          {detail && <Body detail={detail} />}
          {canEdit && onEdit && detail && (
            <button
              type="button"
              data-testid="activity-detail-edit"
              onClick={() => onEdit(detail)}
              style={{
                marginTop: 18, padding: '8px 14px', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                background: 'rgba(124,124,255,0.14)', color: 'var(--color-mc-uv-hi)',
                border: '1px solid rgba(124,124,255,0.33)', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
