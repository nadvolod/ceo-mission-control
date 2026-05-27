'use client';

import type { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: ReactNode;
  subLabel?: ReactNode;
  valueColor?: string;
  testId?: string;
}

export function MetricCard({
  title,
  value,
  subLabel,
  valueColor = 'text-gray-900',
  testId,
}: MetricCardProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg p-2.5 sm:p-3 bg-white shadow-sm border border-gray-100 flex flex-col justify-between min-w-0"
    >
      <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
        {title}
      </p>
      <p className={`text-lg sm:text-xl font-bold ${valueColor} truncate leading-tight mt-0.5`}>
        {value}
      </p>
      {subLabel && (
        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{subLabel}</p>
      )}
    </div>
  );
}
