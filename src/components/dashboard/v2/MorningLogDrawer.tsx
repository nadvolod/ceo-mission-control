'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Moon, Plus, X } from 'lucide-react';
import { Aurora } from './primitives/Aurora';
import { MC_COLORS } from './palette';
import { useHealthData } from '@/hooks/useHealthData';
import type { DailyHealthNote, SleepMetrics } from '@/lib/types';

// ---------------------------------------------------------------------------
// Shared date helpers — match the rest of the v2 dashboard (local wall clock).
// ---------------------------------------------------------------------------

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string): string {
  // Parse at noon to avoid a timezone shift flipping the calendar day.
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Local form state shapes
// ---------------------------------------------------------------------------

interface SupplementState {
  name: string;
  dosageMg: number;
  taken: boolean;
}
interface HabitState {
  name: string;
  done: boolean;
}
interface EnvState {
  temperatureF: number | null;
  fanRunning: boolean;
  dogInRoom: boolean;
  customFields: Record<string, boolean>;
}
// Duration is split into hours/minutes inputs but persisted as total minutes.
interface MetricsState {
  sleepScore: number | null;
  durH: number | null;
  durM: number | null;
  bodyBattery: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
}

// ---------------------------------------------------------------------------
// Builders — initialize form state from templates + an optional existing note
// ---------------------------------------------------------------------------

function buildSupplements(
  template: Array<{ name: string; defaultDosageMg: number }>,
  existing?: DailyHealthNote,
): SupplementState[] {
  return template.map((t) => {
    const found = existing?.supplements.find((s) => s.name === t.name);
    return { name: t.name, dosageMg: found?.dosageMg ?? t.defaultDosageMg, taken: found?.taken ?? false };
  });
}

function buildHabits(template: Array<{ name: string }>, existing?: DailyHealthNote): HabitState[] {
  return template.map((t) => {
    const found = existing?.habits.find((h) => h.name === t.name);
    return { name: t.name, done: found?.done ?? false };
  });
}

function buildEnv(customFieldNames: string[], existing?: DailyHealthNote): EnvState {
  const customFields: Record<string, boolean> = {};
  for (const name of customFieldNames) {
    customFields[name] = existing?.sleepEnvironment.customFields[name] ?? false;
  }
  return {
    temperatureF: existing?.sleepEnvironment.temperatureF ?? null,
    fanRunning: existing?.sleepEnvironment.fanRunning ?? false,
    dogInRoom: existing?.sleepEnvironment.dogInRoom ?? false,
    customFields,
  };
}

function buildMetrics(existing?: DailyHealthNote): MetricsState {
  const m = existing?.sleepMetrics;
  const total = m?.durationMinutes ?? null;
  return {
    sleepScore: m?.sleepScore ?? null,
    durH: total == null ? null : Math.floor(total / 60),
    durM: total == null ? null : total % 60,
    bodyBattery: m?.bodyBattery ?? null,
    restingHeartRate: m?.restingHeartRate ?? null,
    hrv: m?.hrv ?? null,
  };
}

// ---------------------------------------------------------------------------
// v2-styled toggle
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className="relative inline-flex items-center flex-shrink-0"
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.12)',
        background: checked ? MC_COLORS.uv : 'rgba(255,255,255,0.07)',
        boxShadow: checked ? `0 0 10px ${MC_COLORS.uv}66` : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background .2s, box-shadow .2s',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transform: checked ? 'translateX(18px)' : 'translateX(3px)',
          transition: 'transform .2s',
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section + label primitives matching the drawer aesthetic
// ---------------------------------------------------------------------------

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="font-numerics uppercase"
        style={{ fontSize: 10, letterSpacing: '0.1em', color: accent, marginBottom: 8 }}
      >
        {title}
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 14,
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: 72,
  padding: '6px 8px',
  fontSize: 13,
  textAlign: 'center',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  background: 'var(--color-mc-bg-warm)',
  color: 'var(--color-mc-ink)',
  outline: 'none',
  fontFamily: 'inherit',
};

const rowLabelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--color-mc-fg)', flex: 1, minWidth: 0 };

// A single numeric metric row (sleep score, body battery, etc.).
function MetricRow({
  label,
  value,
  onChange,
  unit,
  testId,
  placeholder = '—',
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  testId: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span style={rowLabelStyle}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        data-testid={testId}
        style={inputStyle}
      />
      {unit && <span style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)', width: 28 }}>{unit}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer shell — keeps useHealthData inside the body so it only fetches on open
// (Radix mounts Content lazily when `open` is true).
// ---------------------------------------------------------------------------

export function MorningLogDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        />
        <Dialog.Content
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
          data-testid="morning-log-drawer"
        >
          <Aurora intensity={0.7} />
          <MorningLogBody onClose={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Drawer body — all form logic + persistence via useHealthData
// ---------------------------------------------------------------------------

function MorningLogBody({ onClose }: { onClose: () => void }) {
  const { notes, templates, logNote, updateTemplate, isLoading } = useHealthData();
  const today = todayKey();

  const [date, setDate] = useState<string>(today);
  const [env, setEnv] = useState<EnvState>(() => buildEnv([], undefined));
  const [supplements, setSupplements] = useState<SupplementState[]>([]);
  const [habits, setHabits] = useState<HabitState[]>([]);
  const [metrics, setMetrics] = useState<MetricsState>(() => buildMetrics(undefined));
  const [freeformNote, setFreeformNote] = useState('');

  // Add-new template inputs
  const [newFieldName, setNewFieldName] = useState('');
  const [newSuppName, setNewSuppName] = useState('');
  const [newSuppDosage, setNewSuppDosage] = useState('');
  const [newHabitName, setNewHabitName] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Hydrate the form once data has loaded. Keyed on isLoading so it runs after
  // the initial fetch resolves; the rAF defers the setState out of the effect
  // body to satisfy the React 19 lint rule.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (isLoading || hydrated) return;
    const id = requestAnimationFrame(() => {
      const existing = notes[today];
      setEnv(buildEnv(templates.environmentTemplate.customFieldNames, existing));
      setSupplements(buildSupplements(templates.supplementTemplate, existing));
      setHabits(buildHabits(templates.habitTemplate, existing));
      setMetrics(buildMetrics(existing));
      setFreeformNote(existing?.freeformNote ?? '');
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, [isLoading, hydrated, notes, templates, today]);

  // Switching the date loads that day's saved entry for edit (data is already
  // loaded by the time the user can interact with the picker).
  const handleDateChange = useCallback(
    (newDate: string) => {
      setDate(newDate);
      const existing = notes[newDate];
      setEnv(buildEnv(templates.environmentTemplate.customFieldNames, existing));
      setSupplements(buildSupplements(templates.supplementTemplate, existing));
      setHabits(buildHabits(templates.habitTemplate, existing));
      setMetrics(buildMetrics(existing));
      setFreeformNote(existing?.freeformNote ?? '');
      setSaveStatus('idle');
    },
    [notes, templates],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');
    const durationMinutes =
      metrics.durH == null && metrics.durM == null ? null : (metrics.durH ?? 0) * 60 + (metrics.durM ?? 0);
    const sleepMetrics: SleepMetrics = {
      sleepScore: metrics.sleepScore,
      durationMinutes,
      bodyBattery: metrics.bodyBattery,
      restingHeartRate: metrics.restingHeartRate,
      hrv: metrics.hrv,
    };
    try {
      const result = await logNote({
        date,
        sleepEnvironment: env,
        sleepMetrics,
        supplements,
        habits,
        freeformNote,
      });
      setSaveStatus(result.success ? 'success' : 'error');
    } catch (err) {
      console.error('Morning log save failed', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [date, env, metrics, supplements, habits, freeformNote, logNote]);

  const handleAddField = useCallback(async () => {
    const name = newFieldName.trim();
    if (!name) return;
    const result = await updateTemplate('addEnvironmentField', name);
    if (result.success) {
      setEnv((prev) => ({ ...prev, customFields: { ...prev.customFields, [name]: false } }));
      setNewFieldName('');
    }
  }, [newFieldName, updateTemplate]);

  const handleAddSupplement = useCallback(async () => {
    const name = newSuppName.trim();
    const dosage = parseFloat(newSuppDosage);
    if (!name || isNaN(dosage) || dosage <= 0) return;
    const result = await updateTemplate('addSupplement', name, dosage);
    if (result.success) {
      setSupplements((prev) => [...prev, { name, dosageMg: dosage, taken: false }]);
      setNewSuppName('');
      setNewSuppDosage('');
    }
  }, [newSuppName, newSuppDosage, updateTemplate]);

  const handleAddHabit = useCallback(async () => {
    const name = newHabitName.trim();
    if (!name) return;
    const result = await updateTemplate('addHabit', name);
    if (result.success) {
      setHabits((prev) => [...prev, { name, done: false }]);
      setNewHabitName('');
    }
  }, [newHabitName, updateTemplate]);

  const recentEntries = useMemo(
    () =>
      Object.entries(notes)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 5),
    [notes],
  );

  const saveDisabled = saving || supplements.some((s) => s.taken && s.dosageMg <= 0);

  return (
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
            background: `linear-gradient(135deg, ${MC_COLORS.uv}, ${MC_COLORS.cyan})`,
            boxShadow: `0 0 18px ${MC_COLORS.uv}66`,
          }}
        >
          <Moon size={18} color="#fff" aria-hidden />
        </div>
        <div className="flex-1">
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-mc-ink)' }}>
            Morning Log
          </Dialog.Title>
          <div
            className="font-numerics"
            style={{ fontSize: 11, color: 'var(--color-mc-fg-dim)', letterSpacing: '0.06em', marginTop: 1 }}
          >
            Log last night&apos;s sleep
          </div>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label="Close morning log drawer"
            className="flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--color-mc-fg-dim)',
              cursor: 'pointer',
            }}
            data-testid="morning-log-close"
          >
            <X size={14} aria-hidden />
          </button>
        </Dialog.Close>
      </div>

      {/* Scrollable form */}
      <div
        className="flex-1 overflow-auto"
        style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        {/* Date */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="morning-log-date"
            className="font-numerics uppercase"
            style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-mc-fg-dim)' }}
          >
            Date
          </label>
          <input
            id="morning-log-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => handleDateChange(e.target.value)}
            data-testid="morning-log-date"
            style={{
              padding: '6px 10px',
              fontSize: 13,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              background: 'var(--color-mc-bg-warm)',
              color: 'var(--color-mc-ink)',
              outline: 'none',
              fontFamily: 'inherit',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Sleep Metrics */}
        <Section title="Sleep Metrics" accent={MC_COLORS.cyan}>
          <MetricRow
            label="Sleep score"
            value={metrics.sleepScore}
            onChange={(v) => setMetrics((m) => ({ ...m, sleepScore: v }))}
            testId="metric-sleep-score"
          />
          <div className="flex items-center gap-3">
            <span style={rowLabelStyle}>Duration</span>
            <input
              type="number"
              inputMode="numeric"
              value={metrics.durH ?? ''}
              placeholder="0"
              onChange={(e) => setMetrics((m) => ({ ...m, durH: e.target.value === '' ? null : Number(e.target.value) }))}
              data-testid="metric-duration-hours"
              style={{ ...inputStyle, width: 56 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>h</span>
            <input
              type="number"
              inputMode="numeric"
              value={metrics.durM ?? ''}
              placeholder="0"
              onChange={(e) => setMetrics((m) => ({ ...m, durM: e.target.value === '' ? null : Number(e.target.value) }))}
              data-testid="metric-duration-minutes"
              style={{ ...inputStyle, width: 56 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)' }}>m</span>
          </div>
          <MetricRow
            label="Body battery"
            value={metrics.bodyBattery}
            onChange={(v) => setMetrics((m) => ({ ...m, bodyBattery: v }))}
            testId="metric-body-battery"
          />
          <MetricRow
            label="Resting HR"
            value={metrics.restingHeartRate}
            onChange={(v) => setMetrics((m) => ({ ...m, restingHeartRate: v }))}
            unit="bpm"
            testId="metric-resting-hr"
          />
          <MetricRow
            label="HRV"
            value={metrics.hrv}
            onChange={(v) => setMetrics((m) => ({ ...m, hrv: v }))}
            unit="ms"
            testId="metric-hrv"
          />
        </Section>

        {/* Sleep Environment */}
        <Section title="Sleep Environment" accent={MC_COLORS.uv}>
          <MetricRow
            label="Temperature"
            value={env.temperatureF}
            onChange={(v) => setEnv((p) => ({ ...p, temperatureF: v }))}
            unit="°F"
            testId="env-temperature"
          />
          <div className="flex items-center gap-3">
            <span style={rowLabelStyle}>Fan running</span>
            <Toggle
              checked={env.fanRunning}
              onChange={(v) => setEnv((p) => ({ ...p, fanRunning: v }))}
              ariaLabel="Fan running"
              testId="env-fan"
            />
          </div>
          <div className="flex items-center gap-3">
            <span style={rowLabelStyle}>Dog in room</span>
            <Toggle
              checked={env.dogInRoom}
              onChange={(v) => setEnv((p) => ({ ...p, dogInRoom: v }))}
              ariaLabel="Dog in room"
              testId="env-dog"
            />
          </div>
          {Object.keys(env.customFields).map((name) => (
            <div key={name} className="flex items-center gap-3">
              <span style={rowLabelStyle} title={name}>
                {name}
              </span>
              <Toggle
                checked={env.customFields[name]}
                onChange={(v) =>
                  setEnv((p) => ({ ...p, customFields: { ...p.customFields, [name]: v } }))
                }
                ariaLabel={name}
              />
            </div>
          ))}
          <AddRow
            placeholder="New field name…"
            value={newFieldName}
            onChange={setNewFieldName}
            onAdd={handleAddField}
            testId="env-add"
          />
        </Section>

        {/* Supplements */}
        <Section title="Supplements" accent={MC_COLORS.green}>
          {supplements.map((supp, idx) => (
            <div key={supp.name} className="flex items-center gap-3">
              <Toggle
                checked={supp.taken}
                onChange={(v) =>
                  setSupplements((prev) => prev.map((s, i) => (i === idx ? { ...s, taken: v } : s)))
                }
                ariaLabel={`${supp.name} taken`}
                testId={`supp-toggle-${idx}`}
              />
              <span
                style={{
                  fontSize: 13,
                  flex: 1,
                  minWidth: 0,
                  color: supp.taken ? 'var(--color-mc-fg)' : 'var(--color-mc-fg-muted)',
                }}
                title={supp.name}
              >
                {supp.name}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={supp.taken ? supp.dosageMg : ''}
                disabled={!supp.taken}
                placeholder="—"
                onChange={(e) =>
                  setSupplements((prev) =>
                    prev.map((s, i) => (i === idx ? { ...s, dosageMg: Number(e.target.value) } : s)),
                  )
                }
                data-testid={`supp-dosage-${idx}`}
                style={{ ...inputStyle, opacity: supp.taken ? 1 : 0.4 }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)', width: 24 }}>mg</span>
            </div>
          ))}
          <AddRow
            placeholder="Supplement name…"
            value={newSuppName}
            onChange={setNewSuppName}
            onAdd={handleAddSupplement}
            testId="supp-add"
            extra={
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={newSuppDosage}
                onChange={(e) => setNewSuppDosage(e.target.value)}
                placeholder="mg"
                data-testid="supp-add-dosage"
                style={{ ...inputStyle, width: 56 }}
              />
            }
          />
        </Section>

        {/* Habits */}
        <Section title="Habits" accent={MC_COLORS.amber}>
          {habits.map((habit, idx) => (
            <div key={habit.name} className="flex items-center gap-3">
              <Toggle
                checked={habit.done}
                onChange={(v) =>
                  setHabits((prev) => prev.map((h, i) => (i === idx ? { ...h, done: v } : h)))
                }
                ariaLabel={habit.name}
                testId={`habit-toggle-${idx}`}
              />
              <span
                style={{
                  fontSize: 13,
                  color: habit.done ? 'var(--color-mc-fg)' : 'var(--color-mc-fg-muted)',
                }}
              >
                {habit.name}
              </span>
            </div>
          ))}
          <AddRow
            placeholder="New habit…"
            value={newHabitName}
            onChange={setNewHabitName}
            onAdd={handleAddHabit}
            testId="habit-add"
          />
        </Section>

        {/* Note */}
        <Section title="Notes" accent={MC_COLORS.pink}>
          <textarea
            rows={2}
            value={freeformNote}
            onChange={(e) => setFreeformNote(e.target.value)}
            placeholder="Anything else notable about last night's sleep…"
            data-testid="morning-log-note"
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '8px 10px',
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'inherit',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              background: 'var(--color-mc-bg-warm)',
              color: 'var(--color-mc-ink)',
              outline: 'none',
            }}
          />
        </Section>

        {/* Recent entries */}
        {recentEntries.length > 0 && (
          <div>
            <div
              className="font-numerics uppercase"
              style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-mc-fg-muted)', marginBottom: 8 }}
            >
              Recent entries
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentEntries.map(([entryDate, note]) => {
                const taken = note.supplements.filter((s) => s.taken);
                const suppLabel =
                  taken.length > 0
                    ? `${taken[0].name} ${taken[0].dosageMg}mg${taken.length > 1 ? ` +${taken.length - 1}` : ''}`
                    : null;
                const score = note.sleepMetrics?.sleepScore;
                const dur = note.sleepMetrics?.durationMinutes;
                return (
                  <button
                    key={entryDate}
                    type="button"
                    onClick={() => handleDateChange(entryDate)}
                    className="flex items-center justify-between text-left cursor-pointer"
                    style={{
                      padding: '8px 12px',
                      gap: 10,
                      background: entryDate === date ? 'rgba(124,124,255,0.10)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${entryDate === date ? 'rgba(124,124,255,0.33)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8,
                      font: 'inherit',
                      color: 'var(--color-mc-fg)',
                    }}
                    data-testid={`recent-entry-${entryDate}`}
                  >
                    <span style={{ fontSize: 12.5, flexShrink: 0, color: 'var(--color-mc-ink)' }}>
                      {formatDisplayDate(entryDate)}
                    </span>
                    <span
                      className="font-numerics"
                      style={{ fontSize: 11, color: 'var(--color-mc-fg-dim)', textAlign: 'right', minWidth: 0 }}
                    >
                      {score != null && <>score {score} · </>}
                      {dur != null && <>{Math.floor(dur / 60)}h {dur % 60}m · </>}
                      {suppLabel ?? 'logged'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer save bar */}
      <div
        className="flex items-center gap-3"
        style={{
          padding: '12px 22px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(14,12,20,0.6)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {saveStatus === 'success' && (
          <span
            className="font-numerics"
            style={{ fontSize: 10, color: MC_COLORS.green, letterSpacing: '0.06em' }}
            data-testid="morning-log-status"
          >
            ● SAVED
          </span>
        )}
        {saveStatus === 'error' && (
          <span
            className="font-numerics"
            style={{ fontSize: 10, color: MC_COLORS.red, letterSpacing: '0.06em' }}
            data-testid="morning-log-status"
          >
            ● SAVE FAILED · TRY AGAIN
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="ml-auto"
          style={{
            padding: '9px 18px',
            background: saveDisabled
              ? 'rgba(255,255,255,0.07)'
              : `linear-gradient(135deg, ${MC_COLORS.uv}, ${MC_COLORS.cyan})`,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: saveDisabled ? 0.6 : 1,
            boxShadow: saveDisabled ? 'none' : `0 4px 12px ${MC_COLORS.uv}55`,
          }}
          data-testid="morning-log-save"
        >
          {saving ? 'Saving…' : 'Save morning log'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '9px 14px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            fontSize: 12.5,
            color: 'var(--color-mc-fg-dim)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          data-testid="morning-log-done"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// Inline "add to template" row reused by environment / supplement / habit
// sections. `extra` slots an additional input (e.g. dosage) before the button.
function AddRow({
  placeholder,
  value,
  onChange,
  onAdd,
  testId,
  extra,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  testId: string;
  extra?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2"
      style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        data-testid={`${testId}-name`}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '6px 10px',
          fontSize: 13,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          background: 'var(--color-mc-bg-warm)',
          color: 'var(--color-mc-ink)',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {extra}
      <button
        type="button"
        onClick={onAdd}
        disabled={!value.trim()}
        data-testid={`${testId}-button`}
        className="flex items-center gap-1"
        style={{
          padding: '6px 10px',
          fontSize: 12,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          color: 'var(--color-mc-fg-dim)',
          cursor: value.trim() ? 'pointer' : 'not-allowed',
          opacity: value.trim() ? 1 : 0.5,
          fontFamily: 'inherit',
        }}
      >
        <Plus size={12} aria-hidden /> Add
      </button>
    </div>
  );
}
