'use client';

import { BarChart3, CheckCircle2, ClipboardList } from 'lucide-react';

export const TAB_IDS = ['dashboard', 'tasks', 'monthly-review'] as const;
export type TabId = (typeof TAB_IDS)[number];

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: 'monthly-review', label: 'Monthly Review', icon: <ClipboardList className="h-4 w-4" /> },
];

interface DashboardTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <div className="flex gap-2 mb-6">
      {TABS.map(({ id, label, icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => { if (!isActive) onTabChange(id); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
