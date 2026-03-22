'use client';

import { Clock, Target, Zap, AlertCircle } from 'lucide-react';
import { DailyScorecard } from '@/lib/types';

interface FocusOptimizationProps {
  scorecard: DailyScorecard;
}

export function FocusOptimization({ scorecard }: FocusOptimizationProps) {
  const temporalProgress = scorecard.temporalActual 
    ? (scorecard.temporalActual / scorecard.temporalTarget) * 100 
    : 0;
    
  const isOnTrack = temporalProgress >= 80;
  const progressColor = temporalProgress >= 100 ? 'bg-green-500' : 
                       temporalProgress >= 80 ? 'bg-yellow-500' : 'bg-red-500';

  const focusMetrics = [
    {
      title: 'Temporal Hours',
      value: `${scorecard.temporalActual || 0}/${scorecard.temporalTarget}`,
      percentage: temporalProgress,
      icon: Clock,
      color: isOnTrack ? 'text-green-600' : 'text-red-600',
      bgColor: isOnTrack ? 'bg-green-50' : 'bg-red-50'
    },
    {
      title: 'Focus Blocks',
      value: `${scorecard.focusBlocks.length}`,
      percentage: 100, // Always show full since it's scheduled
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Energy Level',
      value: 'High', // Could be dynamic based on time/data
      percentage: 85,
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Focus Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {focusMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className={`${metric.bgColor} rounded-lg p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${metric.color}`} />
              </div>
              {metric.title === 'Temporal Hours' && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(metric.percentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${progressColor}`}
                      style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2 text-blue-600" />
          Today's Focus Blocks
        </h3>
        <div className="space-y-3">
          {scorecard.focusBlocks.length > 0 ? (
            scorecard.focusBlocks.map((block, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{block}</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No focus blocks scheduled</p>
          )}
        </div>
      </div>

      {/* Today's Priorities */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Top 3</h3>
        <div className="space-y-3">
          {scorecard.priorities.map((priority, index) => (
            <div key={index} className="flex items-start p-3 border border-gray-200 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                {index + 1}
              </span>
              <p className="text-sm text-gray-900 flex-1">{priority}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Blockers & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Biggest Blocker */}
        {scorecard.biggestBlocker && (
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <h4 className="font-semibold text-red-900">Biggest Blocker</h4>
            </div>
            <p className="text-sm text-red-800">{scorecard.biggestBlocker}</p>
          </div>
        )}

        {/* Ignore List */}
        {scorecard.ignoreList.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">What to Ignore Today</h4>
            <ul className="space-y-1">
              {scorecard.ignoreList.map((item, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Major Moves Today */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Critical Moves Today</h3>
        <div className="space-y-4">
          {scorecard.majorMoneyMove && (
            <div className="border-l-4 border-green-500 bg-green-50 p-4">
              <h4 className="font-medium text-green-900">💰 Major Money Move</h4>
              <p className="text-sm text-green-800 mt-1">{scorecard.majorMoneyMove}</p>
            </div>
          )}
          {scorecard.strategicMove && (
            <div className="border-l-4 border-blue-500 bg-blue-50 p-4">
              <h4 className="font-medium text-blue-900">🎯 Strategic Move</h4>
              <p className="text-sm text-blue-800 mt-1">{scorecard.strategicMove}</p>
            </div>
          )}
          {scorecard.taxesMove && (
            <div className="border-l-4 border-orange-500 bg-orange-50 p-4">
              <h4 className="font-medium text-orange-900">📋 Risk Reduction</h4>
              <p className="text-sm text-orange-800 mt-1">{scorecard.taxesMove}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}