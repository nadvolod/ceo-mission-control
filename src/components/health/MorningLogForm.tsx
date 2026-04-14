'use client';

import { useState, useCallback } from 'react';
import type { DailyHealthNote } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MorningLogFormProps {
  templates: {
    supplementTemplate: Array<{ name: string; defaultDosageMg: number }>;
    habitTemplate: Array<{ name: string }>;
    environmentTemplate: { customFieldNames: string[] };
  };
  notes: Record<string, DailyHealthNote>;
  onSave: (note: {
    date: string;
    sleepEnvironment: {
      temperatureF: number | null;
      fanRunning: boolean;
      dogInRoom: boolean;
      customFields: Record<string, boolean>;
    };
    supplements: Array<{ name: string; dosageMg: number; taken: boolean }>;
    habits: Array<{ name: string; done: boolean }>;
    freeformNote: string;
  }) => Promise<{ success: boolean }>;
  onUpdateTemplate: (
    operation: string,
    name: string,
    defaultDosageMg?: number,
  ) => Promise<{ success: boolean }>;
}

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

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string): string {
  // Parse as local date (add T12:00:00 to avoid timezone shift)
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Toggle switch sub-component
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

function Toggle({ checked, onChange, disabled = false, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex items-center w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        checked ? 'bg-blue-500' : 'bg-gray-300',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Build initial form state from templates and optional existing note
// ---------------------------------------------------------------------------

function buildSupplements(
  templateItems: Array<{ name: string; defaultDosageMg: number }>,
  existing?: DailyHealthNote,
): SupplementState[] {
  return templateItems.map((t) => {
    const found = existing?.supplements.find((s) => s.name === t.name);
    return {
      name: t.name,
      dosageMg: found?.dosageMg ?? t.defaultDosageMg,
      taken: found?.taken ?? false,
    };
  });
}

function buildHabits(
  templateItems: Array<{ name: string }>,
  existing?: DailyHealthNote,
): HabitState[] {
  return templateItems.map((t) => {
    const found = existing?.habits.find((h) => h.name === t.name);
    return { name: t.name, done: found?.done ?? false };
  });
}

function buildEnv(
  customFieldNames: string[],
  existing?: DailyHealthNote,
): EnvState {
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MorningLogForm({ templates, notes, onSave, onUpdateTemplate }: MorningLogFormProps) {
  const today = todayStr();

  // ── Date ──────────────────────────────────────────────────────────────────
  const [date, setDate] = useState<string>(today);

  // ── Environment ───────────────────────────────────────────────────────────
  const [env, setEnv] = useState<EnvState>(() =>
    buildEnv(templates.environmentTemplate.customFieldNames, notes[today]),
  );
  const [newFieldName, setNewFieldName] = useState('');
  const [addingField, setAddingField] = useState(false);

  // ── Supplements ───────────────────────────────────────────────────────────
  const [supplements, setSupplements] = useState<SupplementState[]>(() =>
    buildSupplements(templates.supplementTemplate, notes[today]),
  );
  const [newSuppName, setNewSuppName] = useState('');
  const [newSuppDosage, setNewSuppDosage] = useState('');
  const [addingSupp, setAddingSupp] = useState(false);

  // ── Habits ────────────────────────────────────────────────────────────────
  const [habits, setHabits] = useState<HabitState[]>(() =>
    buildHabits(templates.habitTemplate, notes[today]),
  );
  const [newHabitName, setNewHabitName] = useState('');
  const [addingHabit, setAddingHabit] = useState(false);

  // ── Freeform note ─────────────────────────────────────────────────────────
  const [freeformNote, setFreeformNote] = useState<string>(notes[today]?.freeformNote ?? '');

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // ── Date change handler — loads existing note data ─────────────────────────
  const handleDateChange = useCallback(
    (newDate: string) => {
      setDate(newDate);
      const existing = notes[newDate];
      setEnv(buildEnv(templates.environmentTemplate.customFieldNames, existing));
      setSupplements(buildSupplements(templates.supplementTemplate, existing));
      setHabits(buildHabits(templates.habitTemplate, existing));
      setFreeformNote(existing?.freeformNote ?? '');
      setSaveStatus('idle');
    },
    [notes, templates],
  );

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const result = await onSave({
        date,
        sleepEnvironment: env,
        supplements,
        habits,
        freeformNote,
      });
      setSaveStatus(result.success ? 'success' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [date, env, supplements, habits, freeformNote, onSave]);

  // ── Add environment field ─────────────────────────────────────────────────
  const handleAddField = useCallback(async () => {
    const name = newFieldName.trim();
    if (!name) return;
    setAddingField(true);
    try {
      const result = await onUpdateTemplate('addEnvironmentField', name);
      if (result.success) {
        setEnv((prev) => ({
          ...prev,
          customFields: { ...prev.customFields, [name]: false },
        }));
        setNewFieldName('');
      }
    } finally {
      setAddingField(false);
    }
  }, [newFieldName, onUpdateTemplate]);

  // ── Add supplement ────────────────────────────────────────────────────────
  const handleAddSupplement = useCallback(async () => {
    const name = newSuppName.trim();
    const dosage = parseFloat(newSuppDosage);
    if (!name || isNaN(dosage) || dosage <= 0) return;
    setAddingSupp(true);
    try {
      const result = await onUpdateTemplate('addSupplement', name, dosage);
      if (result.success) {
        setSupplements((prev) => [...prev, { name, dosageMg: dosage, taken: false }]);
        setNewSuppName('');
        setNewSuppDosage('');
      }
    } finally {
      setAddingSupp(false);
    }
  }, [newSuppName, newSuppDosage, onUpdateTemplate]);

  // ── Add habit ─────────────────────────────────────────────────────────────
  const handleAddHabit = useCallback(async () => {
    const name = newHabitName.trim();
    if (!name) return;
    setAddingHabit(true);
    try {
      const result = await onUpdateTemplate('addHabit', name);
      if (result.success) {
        setHabits((prev) => [...prev, { name, done: false }]);
        setNewHabitName('');
      }
    } finally {
      setAddingHabit(false);
    }
  }, [newHabitName, onUpdateTemplate]);

  // ── Recent entries (last 5) ────────────────────────────────────────────────
  const recentEntries = Object.entries(notes)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">

      {/* Date selector */}
      <div className="flex items-center space-x-3 mb-6">
        <label htmlFor="morning-log-date" className="text-sm font-medium text-gray-700 flex-shrink-0">
          Date:
        </label>
        <input
          id="morning-log-date"
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <span className="text-xs text-gray-400">Fill this out each morning after waking</span>
      </div>

      {/* ── Sleep Environment ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span>Sleep Environment</span>
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {/* Temperature */}
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-600 w-32 flex-shrink-0">Temperature</label>
            <input
              type="number"
              value={env.temperatureF ?? ''}
              onChange={(e) =>
                setEnv((prev) => ({
                  ...prev,
                  temperatureF: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="—"
              className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-400">&deg;F</span>
          </div>

          {/* Fan running */}
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-600 w-32 flex-shrink-0">Fan running</label>
            <Toggle
              checked={env.fanRunning}
              onChange={(v) => setEnv((prev) => ({ ...prev, fanRunning: v }))}
              ariaLabel="Fan running"
            />
          </div>

          {/* Dog in room */}
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-600 w-32 flex-shrink-0">Dog in room</label>
            <Toggle
              checked={env.dogInRoom}
              onChange={(v) => setEnv((prev) => ({ ...prev, dogInRoom: v }))}
              ariaLabel="Dog in room"
            />
          </div>

          {/* Custom fields */}
          {Object.keys(env.customFields).map((fieldName) => (
            <div key={fieldName} className="flex items-center space-x-4">
              <label className="text-sm text-gray-600 w-32 flex-shrink-0 truncate" title={fieldName}>
                {fieldName}
              </label>
              <Toggle
                checked={env.customFields[fieldName]}
                onChange={(v) =>
                  setEnv((prev) => ({
                    ...prev,
                    customFields: { ...prev.customFields, [fieldName]: v },
                  }))
                }
                ariaLabel={fieldName}
              />
            </div>
          ))}

          {/* Add custom field row */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
              placeholder="New field name..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleAddField}
              disabled={addingField || !newFieldName.trim()}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingField ? '…' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Supplements ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span>Supplements</span>
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {supplements.map((supp, idx) => (
            <div key={supp.name} className="flex items-center space-x-4">
              <Toggle
                checked={supp.taken}
                onChange={(v) =>
                  setSupplements((prev) =>
                    prev.map((s, i) => (i === idx ? { ...s, taken: v } : s)),
                  )
                }
                ariaLabel={`${supp.name} taken`}
              />
              <span
                className={[
                  'text-sm w-32 flex-shrink-0 truncate',
                  supp.taken ? 'text-gray-700' : 'text-gray-400',
                ].join(' ')}
                title={supp.name}
              >
                {supp.name}
              </span>
              <input
                type="number"
                value={supp.taken ? supp.dosageMg : ''}
                onChange={(e) =>
                  setSupplements((prev) =>
                    prev.map((s, i) =>
                      i === idx ? { ...s, dosageMg: Number(e.target.value) } : s,
                    ),
                  )
                }
                disabled={!supp.taken}
                placeholder="—"
                step="0.5"
                min="0"
                className={[
                  'w-20 px-3 py-1.5 border rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                  supp.taken
                    ? 'border-gray-300 bg-white'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed',
                ].join(' ')}
              />
              <span className={supp.taken ? 'text-sm text-gray-400' : 'text-sm text-gray-300'}>
                mg
              </span>
            </div>
          ))}

          {/* Add supplement row */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <input
              type="text"
              value={newSuppName}
              onChange={(e) => setNewSuppName(e.target.value)}
              placeholder="Supplement name..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="number"
              value={newSuppDosage}
              onChange={(e) => setNewSuppDosage(e.target.value)}
              placeholder="mg"
              min="0"
              step="0.5"
              className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleAddSupplement}
              disabled={addingSupp || !newSuppName.trim() || !newSuppDosage}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingSupp ? '…' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Habits ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Habits</span>
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {habits.map((habit, idx) => (
            <div key={habit.name} className="flex items-center space-x-4">
              <Toggle
                checked={habit.done}
                onChange={(v) =>
                  setHabits((prev) =>
                    prev.map((h, i) => (i === idx ? { ...h, done: v } : h)),
                  )
                }
                ariaLabel={habit.name}
              />
              <span
                className={[
                  'text-sm',
                  habit.done ? 'text-gray-700' : 'text-gray-400',
                ].join(' ')}
              >
                {habit.name}
              </span>
            </div>
          ))}

          {/* Add habit row */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
              placeholder="New habit..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleAddHabit}
              disabled={addingHabit || !newHabitName.trim()}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingHabit ? '…' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Freeform note ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Notes</span>
        </h3>
        <textarea
          rows={2}
          value={freeformNote}
          onChange={(e) => setFreeformNote(e.target.value)}
          placeholder="Anything else notable about last night's sleep..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
        />
      </div>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || supplements.some((s) => s.taken && s.dosageMg <= 0)}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : 'Save Morning Log'}
      </button>

      {saveStatus === 'success' && (
        <p className="mt-2 text-sm text-center text-green-600">Morning log saved.</p>
      )}
      {saveStatus === 'error' && (
        <p className="mt-2 text-sm text-center text-red-500">Failed to save. Please try again.</p>
      )}

      {/* ── Recent entries ────────────────────────────────────────────────── */}
      {recentEntries.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 mb-3">Recent Entries</h4>
          <div className="space-y-2">
            {recentEntries.map(([entryDate, note]) => {
              const takenSupps = note.supplements.filter((s) => s.taken);
              const firstSupp = takenSupps[0];
              const suppLabel =
                takenSupps.length > 0
                  ? `${firstSupp.name} ${firstSupp.dosageMg}mg${takenSupps.length > 1 ? ` +${takenSupps.length - 1}` : ''}`
                  : null;
              const firstHabit = note.habits[0];
              const tempLabel =
                note.sleepEnvironment.temperatureF != null
                  ? `${note.sleepEnvironment.temperatureF}°F`
                  : null;

              return (
                <div
                  key={entryDate}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg gap-2"
                >
                  <span className="text-sm text-gray-700 flex-shrink-0">
                    {formatDisplayDate(entryDate)}
                  </span>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 min-w-0 flex-1">
                    {suppLabel && <span className="truncate">{suppLabel}</span>}
                    {firstHabit && (
                      <span className={firstHabit.done ? 'text-green-500' : 'text-red-400'}>
                        {firstHabit.name} {firstHabit.done ? '✓' : '✗'}
                      </span>
                    )}
                    {tempLabel && <span>{tempLabel}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDateChange(entryDate)}
                    className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
