'use client';

import type { GarminDayMetrics } from '@/lib/types';

interface TodaySummaryCardProps {
  latest: GarminDayMetrics | null;
  averages: Record<string, number | null>;
}

export function TodaySummaryCard({ latest, averages }: TodaySummaryCardProps) {
  // If no data, show empty state
  if (!latest) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
        No Garmin data yet. Run the sync script to pull your health metrics.
      </div>
    );
  }

  // 6 tiles matching the mockup
  const tiles = [
    { label: 'Sleep Score', value: latest.sleepScore, avgKey: 'sleepScore', color: 'indigo', unit: '' },
    { label: 'HRV', value: latest.hrvStatus, avgKey: 'hrvStatus', color: 'purple', unit: 'ms' },
    { label: 'Body Battery', value: latest.bodyBatteryHigh, avgKey: 'bodyBatteryHigh', color: 'amber', unit: '' },
    { label: 'Avg Stress', value: latest.averageStressLevel, avgKey: 'averageStressLevel', color: 'blue', unit: '', invertDelta: true },
    { label: 'Resting HR', value: latest.restingHeartRate, avgKey: 'restingHeartRate', color: 'red', unit: 'bpm', invertDelta: true },
    { label: 'Weight', value: latest.weight, avgKey: 'weight', color: 'green', unit: 'lb' },
  ];

  // Color map for Tailwind classes
  const colorMap: Record<string, { bg: string; text: string; label: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'text-indigo-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'text-purple-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'text-amber-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'text-blue-500' },
    red: { bg: 'bg-red-50', text: 'text-red-700', label: 'text-red-500' },
    green: { bg: 'bg-green-50', text: 'text-green-700', label: 'text-green-500' },
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      {tiles.map((tile) => {
        const colors = colorMap[tile.color];
        const avg = averages[tile.avgKey];
        const delta = tile.value != null && avg != null ? Math.round(tile.value - avg) : null;
        // For stress and HR, lower is better so invert the color
        const isGood = tile.invertDelta ? (delta != null && delta <= 0) : (delta != null && delta >= 0);

        return (
          <div key={tile.label} className={`${colors.bg} rounded-lg p-3 text-center`}>
            <div className={`text-2xl font-bold ${colors.text}`}>
              {tile.value != null ? tile.value : '—'}
              {tile.value != null && tile.unit && <span className="text-sm font-normal">{tile.unit}</span>}
            </div>
            <div className={`text-xs ${colors.label}`}>{tile.label}</div>
            {delta != null && (
              <div className={`text-xs mt-0.5 ${isGood ? 'text-green-600' : 'text-red-500'}`}>
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {delta > 0 ? '+' : ''}{delta} vs avg
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
