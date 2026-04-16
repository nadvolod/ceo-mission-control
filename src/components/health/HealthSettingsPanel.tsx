'use client';

import { useState, useEffect } from 'react';

interface HealthSettingsPanelProps {
  templates: {
    supplementTemplate: Array<{ name: string; defaultDosageMg: number }>;
    habitTemplate: Array<{ name: string }>;
    environmentTemplate: { customFieldNames: string[] };
  };
  syncStatus: { lastSyncedAt: string; syncStatus: string; syncError: string | null };
  onUpdateTemplate: (operation: string, name: string, defaultDosageMg?: number, extra?: Record<string, unknown>) => Promise<{ success: boolean }>;
  onSync?: () => void | Promise<void>;
}

function DragHandle() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 cursor-move flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  );
}

export function HealthSettingsPanel({
  templates,
  syncStatus,
  onUpdateTemplate,
  onSync,
}: HealthSettingsPanelProps) {
  // Supplement add form state
  const [newSupplementName, setNewSupplementName] = useState('');
  const [newSupplementMg, setNewSupplementMg] = useState('');

  // Supplement edit state
  const [editingSupplement, setEditingSupplement] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMg, setEditMg] = useState('');

  // Habit add form state
  const [newHabitName, setNewHabitName] = useState('');

  // Environment add form state
  const [newEnvFieldName, setNewEnvFieldName] = useState('');

  // Training threshold — persisted to localStorage
  const [trainingThreshold, setTrainingThreshold] = useState<number>(30);

  // Loading states to disable buttons while async calls are in-flight
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('garmin-training-threshold');
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) setTrainingThreshold(parsed);
    }
  }, []);

  function handleThresholdChange(value: number) {
    setTrainingThreshold(value);
    localStorage.setItem('garmin-training-threshold', String(value));
  }

  async function withLoading(key: string, fn: () => Promise<void>) {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  // Supplement handlers
  async function handleAddSupplement() {
    const name = newSupplementName.trim();
    const mg = parseFloat(newSupplementMg);
    if (!name || isNaN(mg) || mg <= 0) return;
    await withLoading('addSupplement', async () => {
      const result = await onUpdateTemplate('addSupplement', name, mg);
      if (result.success) {
        setNewSupplementName('');
        setNewSupplementMg('');
      }
    });
  }

  async function handleRemoveSupplement(name: string) {
    await withLoading(`removeSupplement-${name}`, async () => {
      await onUpdateTemplate('removeSupplement', name);
    });
  }

  function startEditSupplement(name: string, dosageMg: number) {
    setEditingSupplement(name);
    setEditName(name);
    setEditMg(String(dosageMg));
  }

  function cancelEditSupplement() {
    setEditingSupplement(null);
    setEditName('');
    setEditMg('');
  }

  async function handleSaveEditSupplement() {
    if (!editingSupplement) return;
    const trimmedName = editName.trim();
    const mg = parseFloat(editMg);
    if (!trimmedName || isNaN(mg) || mg <= 0) return;
    await withLoading(`editSupplement-${editingSupplement}`, async () => {
      const result = await onUpdateTemplate('editSupplement', editingSupplement, undefined, {
        newName: trimmedName,
        newDosageMg: mg,
      });
      if (result.success) cancelEditSupplement();
    });
  }

  // Habit handlers
  async function handleAddHabit() {
    const name = newHabitName.trim();
    if (!name) return;
    await withLoading('addHabit', async () => {
      const result = await onUpdateTemplate('addHabit', name);
      if (result.success) setNewHabitName('');
    });
  }

  async function handleRemoveHabit(name: string) {
    await withLoading(`removeHabit-${name}`, async () => {
      await onUpdateTemplate('removeHabit', name);
    });
  }

  // Environment handlers
  async function handleAddEnvironmentField() {
    const name = newEnvFieldName.trim();
    if (!name) return;
    await withLoading('addEnvironmentField', async () => {
      const result = await onUpdateTemplate('addEnvironmentField', name);
      if (result.success) setNewEnvFieldName('');
    });
  }

  async function handleRemoveEnvironmentField(name: string) {
    await withLoading(`removeEnvironmentField-${name}`, async () => {
      await onUpdateTemplate('removeEnvironmentField', name);
    });
  }

  // Format last sync timestamp for display
  const lastSyncDisplay = syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const isConnected = !!syncStatus.lastSyncedAt;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Supplement Templates */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Supplement Templates</h3>
        <p className="text-xs text-gray-400 mb-3">
          These appear as options in your morning log. Set the default dosage for quick entry.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          {templates.supplementTemplate.map((s) =>
            editingSupplement === s.name ? (
              <div
                key={s.name}
                data-testid="supplement-edit-row"
                className="bg-blue-50 rounded-lg border border-blue-200 py-2 px-3 flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEditSupplement()}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                  autoFocus
                />
                <input
                  type="number"
                  value={editMg}
                  onChange={(e) => setEditMg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEditSupplement()}
                  className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                  min={1}
                />
                <span className="text-xs text-gray-400">mg</span>
                <button
                  onClick={handleSaveEditSupplement}
                  disabled={loading[`editSupplement-${s.name}`] || !editName.trim() || !editMg || isNaN(parseFloat(editMg)) || parseFloat(editMg) <= 0}
                  className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditSupplement}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                key={s.name}
                className="bg-white rounded-lg border border-gray-100 py-2 px-3 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <DragHandle />
                  <span className="text-sm text-gray-700">{s.name}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400">Default: {s.defaultDosageMg} mg</span>
                  <button
                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    onClick={() => startEditSupplement(s.name, s.defaultDosageMg)}
                    aria-label={`Edit ${s.name}`}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    disabled={loading[`removeSupplement-${s.name}`]}
                    onClick={() => handleRemoveSupplement(s.name)}
                    aria-label={`Remove ${s.name}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
          {templates.supplementTemplate.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No supplements yet.</p>
          )}
          {/* Add row */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <input
              type="text"
              placeholder="Supplement name..."
              value={newSupplementName}
              onChange={(e) => setNewSupplementName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSupplement()}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <input
              type="number"
              placeholder="Default mg"
              value={newSupplementMg}
              onChange={(e) => setNewSupplementMg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSupplement()}
              className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
              min={0}
            />
            <button
              onClick={handleAddSupplement}
              disabled={loading['addSupplement'] || !newSupplementName.trim() || !newSupplementMg}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Habit Templates */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Habit Templates</h3>
        <p className="text-xs text-gray-400 mb-3">
          Boolean toggles that appear in your morning log.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          {templates.habitTemplate.map((h) => (
            <div
              key={h.name}
              className="bg-white rounded-lg border border-gray-100 py-2 px-3 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <DragHandle />
                <span className="text-sm text-gray-700">{h.name}</span>
              </div>
              <button
                className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                disabled={loading[`removeHabit-${h.name}`]}
                onClick={() => handleRemoveHabit(h.name)}
                aria-label={`Remove ${h.name}`}
              >
                Remove
              </button>
            </div>
          ))}
          {templates.habitTemplate.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No habits yet.</p>
          )}
          {/* Add row */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <input
              type="text"
              placeholder="New habit..."
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={handleAddHabit}
              disabled={loading['addHabit'] || !newHabitName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Environment Custom Fields */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Environment Fields</h3>
        <p className="text-xs text-gray-400 mb-3">
          Built-in: Temperature, Fan running, Dog in room. Add custom boolean fields below.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          {templates.environmentTemplate.customFieldNames.map((fieldName) => (
            <div
              key={fieldName}
              className="bg-white rounded-lg border border-gray-100 py-2 px-3 flex items-center justify-between"
            >
              <span className="text-sm text-gray-700">{fieldName}</span>
              <button
                className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                disabled={loading[`removeEnvironmentField-${fieldName}`]}
                onClick={() => handleRemoveEnvironmentField(fieldName)}
                aria-label={`Remove ${fieldName}`}
              >
                Remove
              </button>
            </div>
          ))}
          {templates.environmentTemplate.customFieldNames.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No custom fields yet.</p>
          )}
          {/* Add row */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <input
              type="text"
              placeholder="New field..."
              value={newEnvFieldName}
              onChange={(e) => setNewEnvFieldName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEnvironmentField()}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={handleAddEnvironmentField}
              disabled={loading['addEnvironmentField'] || !newEnvFieldName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Training Auto-Detect */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Training Auto-Detect</h3>
        <p className="text-xs text-gray-400 mb-3">
          Automatically marks &ldquo;trained&rdquo; in weekly tracker when Garmin active minutes
          exceed this threshold.
        </p>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <label htmlFor="training-threshold" className="text-sm text-gray-600">
              Threshold:
            </label>
            <input
              id="training-threshold"
              type="number"
              value={trainingThreshold}
              min={1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) handleThresholdChange(val);
              }}
              className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <span className="text-sm text-gray-400">active minutes</span>
          </div>
        </div>
      </div>

      {/* Garmin Sync Status */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Garmin Sync</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status</span>
            {isConnected ? (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Connected
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full text-xs font-medium">
                Not synced
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Last sync</span>
            <span className="text-sm text-gray-700">
              {lastSyncDisplay ?? '—'}
            </span>
          </div>
          {syncStatus.syncError && (
            <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
              Error: {syncStatus.syncError}
            </div>
          )}
          <div className="pt-2 border-t border-gray-200">
            <button
              onClick={async () => {
                if (!onSync || isSyncing) return;
                setIsSyncing(true);
                try {
                  await onSync();
                } catch {
                  // error handled upstream
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={!onSync || isSyncing}
              className="w-full py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
