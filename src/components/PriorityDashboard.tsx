'use client';

import { Initiative } from '@/lib/types';

interface PriorityDashboardProps {
  initiatives: Initiative[];
}

export function PriorityDashboard({ initiatives }: PriorityDashboardProps) {
  const getScoreColor = (score: number, max: number = 5) => {
    const percentage = score / max;
    if (percentage >= 0.8) return 'text-green-600 font-semibold';
    if (percentage >= 0.6) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getTotalColor = (total: number) => {
    if (total >= 25) return 'bg-green-100 text-green-800 font-bold';
    if (total >= 20) return 'bg-yellow-100 text-yellow-800 font-semibold';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Portfolio Command Center</h2>
        <div className="text-sm text-gray-500">
          {initiatives.length} initiatives ranked
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-gray-900">#</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-900">Initiative</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-900">$</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-900">Strat</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-900">Urgent</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-900">Leverage</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-900">Time</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-900">Risk</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-900">Total</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-900">Next Move</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {initiatives.map((initiative) => (
              <tr key={initiative.rank} className="hover:bg-gray-50">
                <td className="px-3 py-4 font-medium text-gray-900">
                  {initiative.rank}
                </td>
                <td className="px-3 py-4">
                  <div className="font-medium text-gray-900">{initiative.name}</div>
                  {initiative.type && (
                    <div className="text-xs text-gray-500">{initiative.type}</div>
                  )}
                </td>
                <td className={`px-3 py-4 text-center ${getScoreColor(initiative.money)}`}>
                  {initiative.money}
                </td>
                <td className={`px-3 py-4 text-center ${getScoreColor(initiative.strategic)}`}>
                  {initiative.strategic}
                </td>
                <td className={`px-3 py-4 text-center ${getScoreColor(initiative.urgency)}`}>
                  {initiative.urgency}
                </td>
                <td className={`px-3 py-4 text-center ${getScoreColor(initiative.leverage)}`}>
                  {initiative.leverage}
                </td>
                <td className={`px-3 py-4 text-center ${getScoreColor(initiative.time)}`}>
                  {initiative.time}
                </td>
                <td className={`px-3 py-4 text-center ${getScoreColor(initiative.risk)}`}>
                  {initiative.risk}
                </td>
                <td className="px-3 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-sm ${getTotalColor(initiative.total)}`}>
                    {initiative.total}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm text-gray-700 max-w-xs truncate">
                  {initiative.nextMove}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Top 3 Focus Area */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-3">Executive Focus (Top 3)</h3>
        <div className="space-y-2">
          {initiatives.slice(0, 3).map((initiative, index) => (
            <div key={initiative.rank} className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-blue-900">{initiative.name}</div>
                <div className="text-sm text-blue-700">{initiative.nextMove}</div>
                {initiative.goal && (
                  <div className="text-xs text-blue-600 mt-1">{initiative.goal}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}