'use client';

import { useRef, useState, useCallback, ReactNode } from 'react';
import type { FinancialEntry } from '@/lib/financial-tracker';

interface MoneyMovePopoverProps {
  entries: FinancialEntry[];
  children: ReactNode;
}

const CATEGORY_DOT: Record<FinancialEntry['category'], string> = {
  moved: 'bg-blue-500',
  generated: 'bg-emerald-500',
  cut: 'bg-purple-500',
};

export function MoneyMovePopover({ entries, children }: MoneyMovePopoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }, []);

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-20 w-56 p-2 bg-white border border-gray-200 rounded-lg shadow-lg text-left"
        >
          {sorted.length === 0 ? (
            <div className="text-xs text-gray-500 italic">No moves logged</div>
          ) : (
            <ul className="space-y-1">
              {sorted.map(e => (
                <li key={e.id} className="flex items-center text-xs text-gray-700 gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[e.category]}`} />
                  <span className="truncate flex-1">{e.description}</span>
                  <span className="font-semibold text-gray-900">
                    ${e.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
