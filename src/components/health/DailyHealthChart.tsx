'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CategoricalChartFunc } from 'recharts/types/chart/types';
import type { GarminDayMetrics, DailyHealthNote } from '@/lib/types';
import { DayDetailCard } from './DayDetailCard';

interface DailyHealthChartProps {
  metrics: GarminDayMetrics[];
  notes: Record<string, DailyHealthNote>;
  days: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  sleepScore: number | null;
  hrvStatus: number | null;
  bodyBatteryHigh: number | null;
  averageStressLevel: number | null;
  restingHeartRate: number | null;
  hasNote: boolean;
}

const METRIC_CONFIG = [
  {
    key: 'sleepScore',
    label: 'Sleep Score',
    stroke: '#6366f1',
    colorName: 'indigo',
    strokeDasharray: undefined,
    opacity: 1,
  },
  {
    key: 'hrvStatus',
    label: 'HRV',
    stroke: '#8b5cf6',
    colorName: 'purple',
    strokeDasharray: undefined,
    opacity: 1,
  },
  {
    key: 'bodyBatteryHigh',
    label: 'Body Battery',
    stroke: '#f59e0b',
    colorName: 'amber',
    strokeDasharray: undefined,
    opacity: 1,
  },
  {
    key: 'averageStressLevel',
    label: 'Avg Stress',
    stroke: '#10b981',
    colorName: 'emerald',
    strokeDasharray: undefined,
    opacity: 1,
  },
  {
    key: 'restingHeartRate',
    label: 'Resting HR',
    stroke: '#ef4444',
    colorName: 'red',
    strokeDasharray: '8 4',
    opacity: 0.7,
  },
] as const;

type MetricKey = (typeof METRIC_CONFIG)[number]['key'];

// Active pill classes per color name
const ACTIVE_CLASSES: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-700 font-medium',
  purple: 'bg-purple-100 text-purple-700 font-medium',
  amber: 'bg-amber-100 text-amber-700 font-medium',
  emerald: 'bg-emerald-100 text-emerald-700 font-medium',
  red: 'bg-red-100 text-red-700 font-medium',
};

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
}

function SleepScoreDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.hasNote) {
    return <circle cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#6366f1" strokeWidth={1.5} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="white" stroke="#6366f1" strokeWidth={1.5} />;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number | null;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadEntry[];
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const labelMap: Record<string, string> = {
    sleepScore: 'Sleep Score',
    hrvStatus: 'HRV',
    bodyBatteryHigh: 'Body Battery',
    averageStressLevel: 'Avg Stress',
    restingHeartRate: 'Resting HR',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {payload.map((entry) => {
        if (entry.value === null || entry.value === undefined) return null;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{labelMap[entry.dataKey] ?? entry.dataKey}:</span>
            <span className="font-medium text-gray-800">{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DailyHealthChart({ metrics, notes }: DailyHealthChartProps) {
  const [visibleLines, setVisibleLines] = useState<Set<MetricKey>>(
    new Set(METRIC_CONFIG.map((m) => m.key))
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const chartData = useMemo<ChartDataPoint[]>(
    () =>
      metrics.map((m) => ({
        date: m.date,
        displayDate: new Date(m.date + 'T12:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        sleepScore: m.sleepScore,
        hrvStatus: m.hrvStatus,
        bodyBatteryHigh: m.bodyBatteryHigh,
        averageStressLevel: m.averageStressLevel,
        restingHeartRate: m.restingHeartRate,
        hasNote: !!notes[m.date],
      })),
    [metrics, notes]
  );

  function toggleLine(key: MetricKey) {
    setVisibleLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const handleChartClick: CategoricalChartFunc = (nextState) => {
    const index = nextState?.activeTooltipIndex;
    if (index !== undefined && typeof index === 'number' && chartData[index]) {
      const clickedDate = chartData[index].date;
      setSelectedDay((prev) => (prev === clickedDate ? null : clickedDate));
    }
  };

  const selectedMetrics = selectedDay
    ? (metrics.find((m) => m.date === selectedDay) ?? null)
    : null;
  const selectedNote = selectedDay ? (notes[selectedDay] ?? null) : null;

  if (metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">No Garmin data yet</h3>
        <p className="text-xs text-gray-400 max-w-xs">
          Sync your Garmin data using the Python sync script to see health charts here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Toggle pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {METRIC_CONFIG.map((metric) => {
          const isVisible = visibleLines.has(metric.key);
          return (
            <button
              key={metric.key}
              onClick={() => toggleLine(metric.key)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                isVisible
                  ? ACTIVE_CLASSES[metric.colorName]
                  : 'bg-gray-100 text-gray-400 line-through'
              }`}
            >
              {metric.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={chartData}
          onClick={handleChartClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" fontSize={11} />
          <YAxis domain={[0, 100]} fontSize={11} />
          <Tooltip content={<CustomTooltip />} />

          {METRIC_CONFIG.map((metric) => {
            if (!visibleLines.has(metric.key)) return null;

            if (metric.key === 'sleepScore') {
              return (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.stroke}
                  strokeWidth={2}
                  dot={<SleepScoreDot />}
                  connectNulls
                  opacity={metric.opacity}
                />
              );
            }

            return (
              <Line
                key={metric.key}
                type="monotone"
                dataKey={metric.key}
                stroke={metric.stroke}
                strokeWidth={2}
                dot={false}
                connectNulls
                strokeDasharray={metric.strokeDasharray}
                opacity={metric.opacity}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Day detail card */}
      {selectedDay && (
        <DayDetailCard
          date={selectedDay}
          metrics={selectedMetrics}
          note={selectedNote}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
