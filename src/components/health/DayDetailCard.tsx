'use client';

import type { GarminDayMetrics, DailyHealthNote } from '@/lib/types';

interface DayDetailCardProps {
  date: string;
  metrics: GarminDayMetrics | null;
  note: DailyHealthNote | null;
  onClose: () => void;
}

export function DayDetailCard({ date, metrics, note, onClose }: DayDetailCardProps) {
  // Format date for display
  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="mt-3">
      <div className="bg-white border border-indigo-200 rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-50 px-4 py-2.5 flex items-center justify-between border-b border-indigo-100">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-indigo-800">{displayDate}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕ Close</button>
        </div>

        <div className="p-4">
          {/* Metrics grid */}
          {metrics ? (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
              <div className="text-center p-2 bg-indigo-50 rounded-lg">
                <div className="text-lg font-bold text-indigo-700">{metrics.sleepScore ?? '—'}</div>
                <div className="text-[10px] text-indigo-400">Sleep Score</div>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-700">
                  {metrics.hrvStatus ?? '—'}
                  {metrics.hrvStatus != null && <span className="text-xs font-normal">ms</span>}
                </div>
                <div className="text-[10px] text-purple-400">HRV</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-700">{metrics.bodyBatteryHigh ?? '—'}</div>
                <div className="text-[10px] text-amber-400">Body Battery</div>
              </div>
              <div className="text-center p-2 bg-emerald-50 rounded-lg">
                <div className="text-lg font-bold text-emerald-700">{metrics.averageStressLevel ?? '—'}</div>
                <div className="text-[10px] text-emerald-400">Avg Stress</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">
                  {metrics.restingHeartRate ?? '—'}
                  {metrics.restingHeartRate != null && <span className="text-xs font-normal">bpm</span>}
                </div>
                <div className="text-[10px] text-red-400">Resting HR</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-700">
                  {metrics.weight ?? '—'}
                  {metrics.weight != null && <span className="text-xs font-normal">lb</span>}
                </div>
                <div className="text-[10px] text-gray-400">Weight</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center mb-4">No Garmin data for this day</div>
          )}

          {/* Notes section */}
          {note ? (
            <div className="border-t border-gray-100 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="font-medium text-gray-600 mb-1">Supplements</div>
                  <div className="text-gray-800 space-y-0.5">
                    {note.supplements.filter(s => s.taken).length > 0
                      ? note.supplements.filter(s => s.taken).map(s => (
                          <div key={s.name}>{s.name} <span className="text-gray-400">{s.dosageMg} mg</span></div>
                        ))
                      : <div className="text-gray-400">None taken</div>
                    }
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-600 mb-1">Habits</div>
                  <div className="space-y-0.5">
                    {note.habits.map(h => (
                      <div key={h.name} className={h.done ? 'text-green-600' : 'text-red-500'}>
                        {h.done ? '✓' : '✗'} {h.name}
                      </div>
                    ))}
                    {note.habits.length === 0 && <div className="text-gray-400">No habits logged</div>}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-600 mb-1">Environment</div>
                  <div className="text-gray-800 space-y-0.5">
                    {note.sleepEnvironment.temperatureF != null && <div>{note.sleepEnvironment.temperatureF}°F</div>}
                    <div>Fan <span className={note.sleepEnvironment.fanRunning ? 'text-green-600' : 'text-gray-400'}>{note.sleepEnvironment.fanRunning ? 'on' : 'off'}</span></div>
                    <div>Dog <span className={note.sleepEnvironment.dogInRoom ? 'text-amber-600' : 'text-gray-400'}>{note.sleepEnvironment.dogInRoom ? 'in room' : 'not in room'}</span></div>
                    {Object.entries(note.sleepEnvironment.customFields).map(([key, val]) => (
                      <div key={key}>{key}: <span className={val ? 'text-green-600' : 'text-gray-400'}>{val ? 'yes' : 'no'}</span></div>
                    ))}
                  </div>
                  {note.freeformNote && <div className="mt-2 text-gray-400 italic">{note.freeformNote}</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-3 text-xs text-gray-400 italic text-center">
              No morning log for this day
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
