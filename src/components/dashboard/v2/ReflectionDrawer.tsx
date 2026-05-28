'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';
import { OrbitStar } from './primitives/OrbitStar';
import { Aurora } from './primitives/Aurora';
import { MC_COLORS } from './seed';
import type { ThreeToThriveApiResponse } from '@/hooks/useDashboardData';

type Save = (date: string, question: string, answer: string) => Promise<void>;

type ReflectionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ThreeToThriveApiResponse | null;
  onSave: Save;
};

const PROMPT_COLORS = [MC_COLORS.uv, MC_COLORS.pink, MC_COLORS.amber];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function todayHeader(): string {
  const d = new Date();
  const day = DAY_LABELS[d.getDay()];
  return `${day} · ${todayKey()}`;
}

export function ReflectionDrawer({ open, onOpenChange, data, onSave }: ReflectionDrawerProps) {
  const today = data?.todaysEntry;
  const questions = useMemo(() => today?.questions ?? [], [today]);
  const initialAnswers = useMemo(() => {
    const map = new Map<string, string>();
    today?.answers.forEach((a) => map.set(a.question, a.answer));
    return map;
  }, [today]);

  // Local edit buffer per question so typing isn't latency-bound on saves.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  useEffect(() => {
    if (!open) return;
    // Defer via rAF so the setState is treated as an external-event callback,
    // not a synchronous effect-body setter (React 19 lint rule).
    const id = requestAnimationFrame(() => {
      const next: Record<string, string> = {};
      questions.forEach((q) => {
        next[q] = initialAnswers.get(q) ?? '';
      });
      setDrafts(next);
      setSaveStatus(
        Object.fromEntries(
          questions.map((q) => [q, (initialAnswers.get(q) ?? '').trim() ? 'saved' : 'idle']),
        ),
      );
    });
    return () => cancelAnimationFrame(id);
  }, [open, questions, initialAnswers]);

  // Per-question debounced save. The hook stores the last typed value
  // and fires the server save 600ms after the last keystroke.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  const onChange = (question: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [question]: value }));
    setSaveStatus((prev) => ({ ...prev, [question]: value.trim() ? 'saving' : 'idle' }));
    const t = timers.current;
    if (t[question]) clearTimeout(t[question]);
    t[question] = setTimeout(() => {
      void onSave(todayKey(), question, value)
        .then(() => {
          delete t[question];
          setSaveStatus((prev) => ({ ...prev, [question]: value.trim() ? 'saved' : 'idle' }));
        })
        .catch((err) => {
          delete t[question];
          setSaveStatus((prev) => ({ ...prev, [question]: 'error' }));
          console.error('Reflection save failed', err);
        });
    }, 600);
  };

  const answeredCount = questions.filter((q) => (drafts[q] ?? '').trim()).length;

  const flushAndClose = useCallback(async () => {
    const date = todayKey();
    const pending = questions.map(async (q) => {
      const timer = timers.current[q];
      if (timer) {
        clearTimeout(timer);
        delete timers.current[q];
      }
      const answer = drafts[q] ?? '';
      setSaveStatus((prev) => ({ ...prev, [q]: answer.trim() ? 'saving' : 'idle' }));
      try {
        await onSave(date, q, answer);
        setSaveStatus((prev) => ({ ...prev, [q]: answer.trim() ? 'saved' : 'idle' }));
      } catch (err) {
        setSaveStatus((prev) => ({ ...prev, [q]: 'error' }));
        console.error('Reflection save failed', err);
        throw err;
      }
    });

    const results = await Promise.allSettled(pending);
    if (results.every((r) => r.status === 'fulfilled')) {
      onOpenChange(false);
    }
  }, [drafts, onOpenChange, onSave, questions]);

  // Yesterday's first answer to surface in the bottom card.
  const yesterdayCopy = useMemo(() => {
    if (!data?.history) return null;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ykey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const entry = data.history.find((e) => e.date === ykey);
    if (!entry) return null;
    const total = entry.questions.length;
    const answered = entry.answers.filter((a) => a.answer.trim()).length;
    const first = entry.answers.find((a) => a.answer.trim())?.answer;
    if (!first) return null;
    return { count: `${answered}/${total}`, text: first };
  }, [data]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
        } else {
          void flushAndClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        />
        <Dialog.Content
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void flushAndClose();
            }
          }}
          className="mc-root fixed inset-y-0 right-0 z-50 flex flex-col overflow-hidden"
          style={{
            width: 'min(460px, 95vw)',
            background: 'var(--color-mc-bg)',
            color: 'var(--color-mc-fg)',
            borderLeft: '1px solid rgba(255,255,255,0.16)',
            boxShadow: '-24px 0 60px rgba(0,0,0,0.5)',
            fontFamily: 'var(--font-mc-sans)',
            fontSize: 13,
          }}
          aria-describedby={undefined}
          data-testid="reflection-drawer"
        >
          <Aurora intensity={0.7} />

          <div className="relative flex h-full flex-col">
            {/* Header */}
            <div
              className="flex items-center gap-3"
              style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${MC_COLORS.uv}, ${MC_COLORS.pink})`,
                  boxShadow: `0 0 18px ${MC_COLORS.uv}66`,
                }}
              >
                <OrbitStar size={20} color="#fff" />
              </div>
              <div className="flex-1">
                <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-mc-ink)' }}>
                  Reflection
                </Dialog.Title>
                <div
                  className="font-numerics"
                  style={{
                    fontSize: 11,
                    color: 'var(--color-mc-fg-dim)',
                    letterSpacing: '0.06em',
                    marginTop: 1,
                  }}
                >
                  {todayHeader()} · {answeredCount}/{questions.length || 3} answered
                </div>
              </div>
              <button
                type="button"
                aria-label="Close reflection drawer"
                className="flex items-center justify-center"
                onClick={() => { void flushAndClose(); }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--color-mc-fg-dim)',
                  cursor: 'pointer',
                }}
                data-testid="reflection-close"
              >
                <X size={14} aria-hidden />
              </button>
            </div>

            {/* Progress */}
            <div style={{ padding: '14px 22px 0' }}>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                      height: 4,
                      background:
                        i < answeredCount
                          ? `linear-gradient(90deg, ${MC_COLORS.uv}, ${MC_COLORS.pink})`
                          : 'rgba(255,255,255,0.07)',
                      boxShadow: i < answeredCount ? `0 0 10px ${MC_COLORS.uv}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Prompts */}
            <div
              className="flex-1 overflow-auto"
              style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {questions.map((q, i) => {
                const value = drafts[q] ?? '';
                const done = !!value.trim();
                const color = PROMPT_COLORS[i] ?? MC_COLORS.uv;
                return (
                  <div key={q}>
                    <div
                      className="flex items-start gap-2.5"
                      style={{ marginBottom: 8 }}
                    >
                      <span
                        className="flex items-center justify-center font-numerics"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: done
                            ? `linear-gradient(135deg, ${MC_COLORS.uv}, ${MC_COLORS.pink})`
                            : `${color}22`,
                          color: done ? '#fff' : color,
                          fontSize: 11,
                          fontWeight: 600,
                          flexShrink: 0,
                          boxShadow: done ? `0 0 10px ${MC_COLORS.uv}66` : 'none',
                        }}
                        aria-hidden
                      >
                        {done ? <Check size={11} aria-hidden /> : i + 1}
                      </span>
                      <div className="flex-1">
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 500,
                            lineHeight: 1.4,
                            color: 'var(--color-mc-ink)',
                            fontFamily: 'var(--font-mc-serif)',
                            letterSpacing: '-0.005em',
                          }}
                        >
                          {q}
                        </div>
                      </div>
                    </div>
                    <textarea
                      value={value}
                      onChange={(e) => onChange(q, e.target.value)}
                      placeholder="Type your answer · auto-saves"
                      rows={3}
                      data-testid={`reflection-input-${i}`}
                      style={{
                        width: '100%',
                        resize: 'vertical',
                        padding: '10px 12px',
                        fontSize: 13,
                        lineHeight: 1.5,
                        fontFamily: 'inherit',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--color-mc-ink)',
                        outline: 'none',
                        backdropFilter: 'blur(12px)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = color;
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${color}22`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    {done && (
                      <div
                        className="font-numerics"
                        style={{
                          marginTop: 4,
                          fontSize: 10,
                          color: saveStatus[q] === 'error' ? 'var(--color-mc-red)' : 'var(--color-mc-green)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {saveStatus[q] === 'saved'
                          ? `● SAVED · ${value.length} CHARS`
                          : saveStatus[q] === 'error'
                            ? `● SAVE FAILED · ${value.length} CHARS`
                            : `● SAVING · ${value.length} CHARS`}
                      </div>
                    )}
                  </div>
                );
              })}

              {yesterdayCopy && (
                <div
                  style={{
                    marginTop: 6,
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    borderLeft: `3px solid ${MC_COLORS.pink}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div
                    className="font-numerics"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      color: MC_COLORS.pink,
                      marginBottom: 6,
                    }}
                  >
                    YESTERDAY · {yesterdayCopy.count}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--color-mc-fg)',
                      lineHeight: 1.5,
                      fontStyle: 'italic',
                      fontFamily: 'var(--font-mc-serif)',
                    }}
                  >
                    &ldquo;{yesterdayCopy.text}&rdquo;
                  </div>
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-2"
              style={{
                padding: '12px 22px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(14,12,20,0.6)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <span
                className="font-numerics"
                style={{
                  fontSize: 10,
                  color: 'var(--color-mc-fg-muted)',
                  letterSpacing: '0.06em',
                }}
              >
                ⌘↩ TO SAVE &amp; CLOSE
              </span>
              <button
                type="button"
                onClick={() => { void flushAndClose(); }}
                className="ml-auto"
                style={{
                  padding: '9px 16px',
                  background: `linear-gradient(135deg, ${MC_COLORS.uv}, ${MC_COLORS.pink})`,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: `0 4px 12px ${MC_COLORS.uv}55`,
                }}
                data-testid="reflection-save-close"
              >
                Save &amp; close
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
