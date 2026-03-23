'use client';

import { Target, Users, Zap, TrendingUp, DollarSign } from 'lucide-react';

interface MissionTrackerProps {
  currentMRR?: number; // Monthly Recurring Revenue
  currentTeamSize?: number;
  targetMRR?: number;
  maxTeamSize?: number;
}

export function MissionTracker({ 
  currentMRR = 0, // Will need to get real data
  currentTeamSize = 1, // Assume Nikolay solo for now
  targetMRR = 1000000,
  maxTeamSize = 5 
}: MissionTrackerProps) {
  
  const revenueProgress = (currentMRR / targetMRR) * 100;
  const revenuePerPerson = currentTeamSize > 0 ? currentMRR / currentTeamSize : 0;
  const targetRevenuePerPerson = targetMRR / maxTeamSize; // $200K/month per person
  
  const monthsToTarget = currentMRR > 0 
    ? Math.ceil((targetMRR - currentMRR) / (currentMRR * 0.1)) // Assuming 10% monthly growth
    : Infinity;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6">
      {/* Mission Statement */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Mission Command</h2>
        <p className="text-lg text-purple-800 font-semibold">
          Build a 5-person company that makes $1M/month using AI tools
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Revenue Progress */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Monthly Revenue</span>
            </div>
            <span className="text-sm text-gray-500">{revenueProgress.toFixed(1)}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current</span>
              <span className="font-semibold">{formatCurrency(currentMRR)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getProgressColor(revenueProgress)}`}
                style={{ width: `${Math.min(revenueProgress, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Target</span>
              <span className="font-semibold">{formatCurrency(targetMRR)}</span>
            </div>
          </div>
        </div>

        {/* Team Size */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Team Size</span>
            </div>
            <span className="text-sm text-gray-500">{(currentTeamSize / maxTeamSize * 100).toFixed(0)}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current</span>
              <span className="font-semibold">{currentTeamSize} people</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${(currentTeamSize / maxTeamSize) * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Max</span>
              <span className="font-semibold">{maxTeamSize} people</span>
            </div>
          </div>
        </div>

        {/* Revenue per Person */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900">AI Leverage</span>
            </div>
            <span className="text-sm text-gray-500">
              {((revenuePerPerson / targetRevenuePerPerson) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current</span>
              <span className="font-semibold">{formatCurrency(revenuePerPerson)}/person</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getProgressColor((revenuePerPerson / targetRevenuePerPerson) * 100)}`}
                style={{ width: `${Math.min((revenuePerPerson / targetRevenuePerPerson) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Target</span>
              <span className="font-semibold">{formatCurrency(targetRevenuePerPerson)}/person</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Progress Summary */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Target className="h-4 w-4 mr-2 text-purple-600" />
            Progress Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Gap to Target</span>
              <span className="font-medium">{formatCurrency(targetMRR - currentMRR)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Growth Needed</span>
              <span className="font-medium">
                {currentMRR > 0 ? `${((targetMRR / currentMRR - 1) * 100).toFixed(0)}%` : '∞%'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time to Target</span>
              <span className="font-medium">
                {monthsToTarget === Infinity ? 'N/A' : `${monthsToTarget} months`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Available Hires</span>
              <span className="font-medium">{maxTeamSize - currentTeamSize} people</span>
            </div>
          </div>
        </div>

        {/* AI Leverage Assessment */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
            AI Leverage Status
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Required Efficiency</span>
              <span className="font-medium">40x Industry Average</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Tools</span>
              <span className="font-medium text-orange-600">Assessment Needed</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Automation %</span>
              <span className="font-medium text-orange-600">Unknown</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">AI ROI</span>
              <span className="font-medium text-orange-600">Unmeasured</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Status Alert */}
      {currentMRR === 0 && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-orange-600" />
            <span className="font-medium text-orange-900">Mission Data Required</span>
          </div>
          <p className="text-sm text-orange-800 mt-1">
            Current revenue, team size, and AI tools need to be tracked to measure progress toward the $1M/month goal.
          </p>
        </div>
      )}
    </div>
  );
}