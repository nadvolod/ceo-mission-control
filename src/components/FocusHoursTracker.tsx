'use client';

import { useState } from 'react';
import { Clock, Plus, TrendingUp, TrendingDown, Target, BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import type { FocusCategory, FocusSession, DailyFocusMetrics } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  Temporal: '#3B82F6',
  Finance: '#10B981',
  Revenue: '#8B5CF6',
  Housing: '#F59E0B',
  Tax: '#EF4444',
  Personal: '#EC4899',
  Health: '#14B8A6',
  Admin: '#6B7280',
  Learning: '#F97316',
  Other: '#A3A3A3',
};

const ALL_CATEGORIES: FocusCategory[] = [
  'Temporal', 'Finance', 'Revenue', 'Housing',
  'Tax', 'Personal', 'Health', 'Admin', 'Learning', 'Other'
];

interface FocusHoursTrackerProps {
  todaysMetrics: DailyFocusMetrics;
  weeklyTotals: Record<string, number>;
  weekOverWeek: {
    currentTotal: number;
    previousTotal: number;
    absoluteChange: number;
    percentageChange: number;
    byCategoryChange: Record<string, { current: number; previous: number; change: number }>;
  };
  dailyTrend: Array<{ date: string; totalHours: number; byCategory: Record<string, number> }>;
  rollingAverage: Array<{ date: string; average: number }>;
  categoryDistribution: Record<string, number>;
  recentSessions: FocusSession[];
  temporalTarget?: number;
  temporalActual?: number;
  onAddSession: (category: FocusCategory, hours: number, description: string) => Promise<void>;
}

type TabId = 'daily' | 'weekly' | 'trends';

export function FocusHoursTracker({
  todaysMetrics,
  weeklyTotals,
  weekOverWeek,
  dailyTrend,
  rollingAverage,
  categoryDistribution,
  recentSessions,
  temporalTarget = 0,
  temporalActual = 0,
  onAddSession
}: FocusHoursTrackerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('daily');
  const [isReporting, setIsReporting] = useState(false);
  const [reportCategory, setReportCategory] = useState<FocusCategory>('Temporal');
  const [reportHours, setReportHours] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportHours.trim()) return;

    setIsLoading(true);
    try {
      await onAddSession(reportCategory, parseFloat(reportHours), reportDescription.trim());
      setReportHours('');
      setReportDescription('');
      setIsReporting(false);
    } catch (error) {
      console.error('Error reporting focus hours:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReport = (hours: number, category: FocusCategory) => {
    setReportHours(hours.toString());
    setReportCategory(category);
    setIsReporting(true);
  };

  // Prepare stacked bar chart data — flatten byCategory into top-level keys
  const barChartData = dailyTrend.slice(-14).map(day => {
    const entry: Record<string, string | number> = {
      date: day.date,
      totalHours: day.totalHours
    };
    for (const cat of ALL_CATEGORIES) {
      entry[cat] = day.byCategory[cat] || 0;
    }
    return entry;
  });

  // Active categories (those with data in the last 14 days)
  const activeCategories = ALL_CATEGORIES.filter(cat =>
    barChartData.some(d => (d[cat] as number) > 0)
  );

  // Pie chart data
  const pieData = Object.entries(categoryDistribution)
    .filter(([, hours]) => hours > 0)
    .map(([category, hours]) => ({ category, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours);

  // Top category today
  const topCategory = Object.entries(todaysMetrics.byCategory)
    .sort(([, a], [, b]) => b - a)[0];

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'daily', label: 'Daily', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'weekly', label: 'Weekly', icon: <PieChartIcon className="h-4 w-4" /> },
    { id: 'trends', label: 'Trends', icon: <Activity className="h-4 w-4" /> },
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Clock className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Focus Hours Dashboard</h3>
          </div>
          <button
            onClick={() => setIsReporting(!isReporting)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Log Focus Time</span>
          </button>
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{todaysMetrics.totalHours}h</div>
            <div className="text-xs text-gray-500">Today's Focus</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {temporalActual}/{temporalTarget}h
            </div>
            <div className="text-xs text-gray-500">Temporal Target</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {topCategory ? topCategory[0] : '--'}
            </div>
            <div className="text-xs text-gray-500">
              {topCategory ? `${topCategory[1]}h` : 'No sessions'}
            </div>
          </div>
        </div>
      </div>

      {/* Report Form */}
      {isReporting && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h4 className="text-md font-medium text-gray-900 mb-3">Log Focus Time</h4>
          <form onSubmit={handleReportSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="focus-category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="focus-category"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value as FocusCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="focus-hours" className="block text-sm font-medium text-gray-700 mb-1">
                  Hours
                </label>
                <input
                  id="focus-hours"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="24"
                  value={reportHours}
                  onChange={(e) => setReportHours(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2.5"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="focus-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                id="focus-description"
                type="text"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Morning client delivery sprint"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading || !reportHours.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Logging...' : 'Log Hours'}
              </button>
              <button
                type="button"
                onClick={() => setIsReporting(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Report Buttons */}
      {!isReporting && (
        <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap gap-2">
          {[
            { hours: 0.5, cat: 'Temporal' as FocusCategory },
            { hours: 1, cat: 'Temporal' as FocusCategory },
            { hours: 2, cat: 'Temporal' as FocusCategory },
            { hours: 1, cat: 'Finance' as FocusCategory },
            { hours: 1, cat: 'Revenue' as FocusCategory },
            { hours: 1, cat: 'Tax' as FocusCategory },
          ].map(({ hours, cat }) => (
            <button
              key={`${cat}-${hours}`}
              onClick={() => handleQuickReport(hours, cat)}
              className="px-3 py-1 text-xs rounded-lg transition-colors"
              style={{
                backgroundColor: `${CATEGORY_COLORS[cat]}15`,
                color: CATEGORY_COLORS[cat],
                border: `1px solid ${CATEGORY_COLORS[cat]}30`
              }}
            >
              +{hours}h {cat}
            </button>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Daily Tab */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Stacked Bar Chart */}
            {barChartData.some(d => (d.totalHours as number) > 0) ? (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Daily Focus Hours (Last 14 Days)</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                    <YAxis fontSize={11} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value, name) => [`${value}h`, String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {activeCategories.map(cat => (
                      <Bar key={cat} dataKey={cat} stackId="hours" fill={CATEGORY_COLORS[cat]} name={cat} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No focus hours logged yet</p>
                <p className="text-xs mt-1">Log your first session to see charts here</p>
              </div>
            )}

            {/* Today's Sessions */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Today's Sessions ({todaysMetrics.sessions.length})
              </h4>
              {todaysMetrics.sessions.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No focus sessions recorded today</p>
              ) : (
                <div className="space-y-2">
                  {todaysMetrics.sessions.map(session => (
                    <div key={session.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[session.category] || CATEGORY_COLORS.Other }}
                        />
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{session.description}</div>
                          <div className="text-xs text-gray-500">
                            {session.category} &middot; {new Date(session.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-sm" style={{ color: CATEGORY_COLORS[session.category] }}>
                        {session.hours}h
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weekly Tab */}
        {activeTab === 'weekly' && (
          <div className="space-y-6">
            {/* Week-over-Week Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">{weekOverWeek.currentTotal.toFixed(1)}h</div>
                <div className="text-xs text-gray-500">This Week</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-600">{weekOverWeek.previousTotal.toFixed(1)}h</div>
                <div className="text-xs text-gray-500">Last Week</div>
              </div>
              <div className={`text-center p-3 rounded-lg ${
                weekOverWeek.absoluteChange >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className={`text-xl font-bold flex items-center justify-center ${
                  weekOverWeek.absoluteChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {weekOverWeek.absoluteChange >= 0 ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {weekOverWeek.percentageChange > 0 ? '+' : ''}
                  {weekOverWeek.previousTotal > 0 ? `${weekOverWeek.percentageChange.toFixed(0)}%` : (
                    weekOverWeek.currentTotal > 0 ? 'New' : '0%'
                  )}
                </div>
                <div className="text-xs text-gray-500">Growth</div>
              </div>
            </div>

            {/* Pie Chart */}
            {pieData.length > 0 ? (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Category Distribution (Last 7 Days)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="hours"
                      nameKey="category"
                      innerRadius={50}
                      outerRadius={90}
                      label={({ name, value }) => `${name}: ${value}h`}
                      labelLine={{ strokeWidth: 1 }}
                      fontSize={11}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Other} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}h`, 'Hours']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <PieChartIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No data for category distribution</p>
              </div>
            )}

            {/* Category Breakdown Table */}
            {Object.keys(weeklyTotals).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">This Week by Category</h4>
                <div className="space-y-2">
                  {Object.entries(weeklyTotals)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, hours]) => {
                      const change = weekOverWeek.byCategoryChange[category];
                      return (
                        <div key={category} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[category] || CATEGORY_COLORS.Other }}
                            />
                            <span className="text-sm font-medium text-gray-700">{category}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-semibold text-gray-900">{hours.toFixed(1)}h</span>
                            {change && change.change !== 0 && (
                              <span className={`text-xs ${change.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {change.change > 0 ? '+' : ''}{change.change.toFixed(1)}h
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {rollingAverage.some(d => d.average > 0) ? (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">7-Day Rolling Average (Last 30 Days)</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={rollingAverage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                    <YAxis fontSize={11} label={{ value: 'Hours/day', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value) => [`${value}h`, '7-day avg']}
                    />
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                      name="7-day Average"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Not enough data for trends yet</p>
                <p className="text-xs mt-1">Log focus hours over several days to see rolling averages</p>
              </div>
            )}

            {/* Weekly Growth Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Weekly Growth Target</h4>
              <p className="text-xs text-gray-500">
                Push for more focus hours each week. Current week: {weekOverWeek.currentTotal.toFixed(1)}h
                {weekOverWeek.previousTotal > 0 && (
                  <> vs last week: {weekOverWeek.previousTotal.toFixed(1)}h
                    ({weekOverWeek.absoluteChange >= 0 ? '+' : ''}{weekOverWeek.absoluteChange.toFixed(1)}h)
                  </>
                )}
              </p>
              {/* Progress bar for week-over-week */}
              {weekOverWeek.previousTotal > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        weekOverWeek.currentTotal >= weekOverWeek.previousTotal ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (weekOverWeek.currentTotal / weekOverWeek.previousTotal) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0h</span>
                    <span>Last week: {weekOverWeek.previousTotal.toFixed(1)}h</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
