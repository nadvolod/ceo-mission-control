'use client';

import { DollarSign, TrendingUp, AlertTriangle, Shield } from 'lucide-react';

interface FinancialCommandCenterProps {
  cashPosition?: number;
  monthlyBurn?: number;
  pipelineTotal?: number;
  heloc?: number;
}

export function FinancialCommandCenter({ 
  cashPosition = 15000, // Estimated from context
  monthlyBurn = 7500,   // Estimated from context
  pipelineTotal = 87000, // From INITIATIVES.md
  heloc = 75000         // From context
}: FinancialCommandCenterProps) {
  
  const currentRunway = Math.floor(cashPosition / monthlyBurn * 10) / 10;
  const totalLiquidity = cashPosition + heloc;
  const maxRunway = Math.floor(totalLiquidity / monthlyBurn * 10) / 10;
  
  const runwayColor = currentRunway < 3 ? 'text-red-600' : currentRunway < 6 ? 'text-yellow-600' : 'text-green-600';
  const runwayBgColor = currentRunway < 3 ? 'bg-red-50' : currentRunway < 6 ? 'bg-yellow-50' : 'bg-green-50';

  const cards = [
    {
      title: 'Current Cash',
      value: `$${(cashPosition / 1000).toFixed(0)}K`,
      subValue: `${currentRunway} months runway`,
      icon: DollarSign,
      color: runwayColor,
      bgColor: runwayBgColor,
      urgent: currentRunway < 3
    },
    {
      title: 'HELOC Available',
      value: `$${(heloc / 1000).toFixed(0)}K`,
      subValue: `+${maxRunway - currentRunway} months potential`,
      icon: Shield,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      urgent: false
    },
    {
      title: 'Pipeline Value',
      value: `$${(pipelineTotal / 1000).toFixed(0)}K`,
      subValue: '+11.6 months if all close',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      urgent: false
    },
    {
      title: 'Monthly Burn',
      value: `$${(monthlyBurn / 1000).toFixed(1)}K`,
      subValue: 'Optimize to extend runway',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      urgent: false
    }
  ];

  const pipelineBreakdown = [
    { name: 'Devonshire HELOC', value: 75000, status: 'In Progress', priority: 'Critical' },
    { name: 'Artis WHO Contract', value: 12000, status: 'Closing', priority: 'High' },
    { name: 'Tricentis Video Course', value: 6500, status: 'Follow-up', priority: 'Medium' },
    { name: 'Tricentis Webinar', value: 2000, status: 'Follow-up', priority: 'Medium' },
    { name: 'Tony Robbins Pitch', value: 100000, status: 'Prep', priority: 'High' }
  ];

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`${card.bgColor} rounded-lg p-4 relative overflow-hidden`}>
              {card.urgent && (
                <div className="absolute top-0 right-0 w-0 h-0 border-l-[30px] border-l-transparent border-t-[30px] border-t-red-500"></div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.subValue}</p>
                </div>
                <Icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Runway Visualization */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Survival Timeline</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Current Position</span>
            <span className={`text-sm font-bold ${runwayColor}`}>{currentRunway} months</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full ${currentRunway < 3 ? 'bg-red-500' : currentRunway < 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min((currentRunway / 12) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>0 months</span>
            <span>6 months</span>
            <span>12 months</span>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">With HELOC</span>
              <span className="text-sm font-bold text-blue-600">{maxRunway} months</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min((maxRunway / 12) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Breakdown */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Pipeline</h3>
        <div className="space-y-3">
          {pipelineBreakdown.map((item) => (
            <div key={item.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm text-gray-500">{item.status}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                    item.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">${(item.value / 1000).toFixed(0)}K</div>
                <div className="text-xs text-gray-500">
                  +{Math.floor(item.value / monthlyBurn * 10) / 10}mo
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between font-bold text-gray-900">
            <span>Total Pipeline</span>
            <span>${(pipelineTotal / 1000).toFixed(0)}K</span>
          </div>
        </div>
      </div>
    </div>
  );
}