'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus, TrendingUp, Target, CheckCircle } from 'lucide-react';

interface TemporalSession {
  id: string;
  startTime: string;
  endTime?: string;
  duration: number;
  description: string;
  date: string;
}

interface TemporalTrackerProps {
  temporalTarget: number;
  temporalActual: number;
  onUpdateHours: (hours: number) => Promise<void>;
}

export function TemporalTracker({ temporalTarget, temporalActual, onUpdateHours }: TemporalTrackerProps) {
  const [isReporting, setIsReporting] = useState(false);
  const [reportHours, setReportHours] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [sessions, setSessions] = useState<TemporalSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTemporalSessions();
  }, []);

  const loadTemporalSessions = async () => {
    try {
      const response = await fetch('/api/temporal');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error loading temporal sessions:', error);
    }
  };

  const handleReportHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportHours.trim()) return;

    setIsLoading(true);
    try {
      const hours = parseFloat(reportHours);
      const response = await fetch('/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours,
          description: reportDescription.trim() || `${hours}h Temporal block completed`
        })
      });

      if (response.ok) {
        await onUpdateHours(hours);
        await loadTemporalSessions();
        setReportHours('');
        setReportDescription('');
        setIsReporting(false);
      }
    } catch (error) {
      console.error('Error reporting hours:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const progressPercentage = temporalTarget > 0 ? (temporalActual / temporalTarget) * 100 : 0;
  const remaining = Math.max(0, temporalTarget - temporalActual);

  const todaySessions = sessions.filter(session => 
    new Date(session.date).toDateString() === new Date().toDateString()
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Temporal Execution Tracker</h3>
        </div>
        <button
          onClick={() => setIsReporting(!isReporting)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Report Hours</span>
        </button>
      </div>

      {/* Progress Display */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-gray-600" />
            <span className="text-sm text-gray-600">Daily Target: {temporalTarget}h</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-gray-900">{temporalActual}h</span>
            <span className="text-gray-600"> / {temporalTarget}h</span>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${
              progressPercentage >= 100 ? 'bg-green-500' : 
              progressPercentage >= 75 ? 'bg-blue-500' : 
              progressPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, progressPercentage)}%` }}
          />
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">{progressPercentage.toFixed(1)}% complete</span>
          {remaining > 0 ? (
            <span className="text-red-600">{remaining}h remaining</span>
          ) : (
            <span className="text-green-600 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              Target exceeded!
            </span>
          )}
        </div>
      </div>

      {/* Report Hours Form */}
      {isReporting && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-md font-medium text-gray-900 mb-3">Report Temporal Hours</h4>
          <form onSubmit={handleReportHours} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hours Completed
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="12"
                value={reportHours}
                onChange={(e) => setReportHours(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 2.5"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Morning focus blocks - Nexus PR + TaskListAI"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading || !reportHours.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Updating...' : 'Add Hours'}
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

      {/* Today's Sessions */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2" />
          Today's Sessions ({todaySessions.length})
        </h4>
        
        {todaySessions.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No temporal sessions recorded yet today</p>
        ) : (
          <div className="space-y-2">
            {todaySessions.map((session, index) => (
              <div key={session.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{session.description}</div>
                  <div className="text-xs text-gray-500">
                    {session.startTime && new Date(session.startTime).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                    {session.endTime && ` - ${new Date(session.endTime).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-blue-600">{session.duration}h</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Report Buttons */}
      {!isReporting && (
        <div className="mt-4 flex space-x-2">
          {[0.5, 1, 1.5, 2, 2.5, 3].map(hours => (
            <button
              key={hours}
              onClick={() => {
                setReportHours(hours.toString());
                setIsReporting(true);
              }}
              className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              +{hours}h
            </button>
          ))}
        </div>
      )}
    </div>
  );
}