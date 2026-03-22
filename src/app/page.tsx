import { PriorityDashboard } from '@/components/PriorityDashboard';
import { FinancialCommandCenter } from '@/components/FinancialCommandCenter';
import { FocusOptimization } from '@/components/FocusOptimization';
import { readInitiatives, readDailyScorecard } from '@/lib/workspace-reader';

export default function HomePage() {
  const initiatives = readInitiatives();
  const scorecard = readDailyScorecard();

  if (!scorecard) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Cannot Load Workspace Data</h2>
            <p className="text-red-700">
              Unable to read DAILY_SCORECARD.md from workspace. 
              Make sure the file exists and the app has access to your OpenClaw workspace.
            </p>
            <div className="mt-4 text-sm text-red-600">
              <p>Expected path: /Users/nikolay/.openclaw/workspace/DAILY_SCORECARD.md</p>
              <p>Development mode: {process.env.NODE_ENV}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">CEO Mission Control</h1>
              <p className="text-gray-600 mt-1">Portfolio command center for {scorecard.date}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">Temporal Target</div>
                <div className="text-xl font-bold text-gray-900">
                  {scorecard.temporalActual || 0}/{scorecard.temporalTarget} hrs
                </div>
              </div>
              <div className="w-px h-8 bg-gray-300"></div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Active Initiatives</div>
                <div className="text-xl font-bold text-gray-900">{initiatives.length}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Top Row - Priority Dashboard */}
        <div className="mb-8">
          <PriorityDashboard initiatives={initiatives} />
        </div>

        {/* Second Row - Financial and Focus */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Financial Command Center</h2>
            <FinancialCommandCenter />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Focus Optimization</h2>
            <FocusOptimization scorecard={scorecard} />
          </div>
        </div>

        {/* Footer Stats */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{initiatives.slice(0, 3).reduce((sum, init) => sum + init.total, 0)}</div>
              <div className="text-sm text-gray-600">Top 3 Total Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">$195K</div>
              <div className="text-sm text-gray-600">Total Opportunity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{scorecard.focusBlocks.length}</div>
              <div className="text-sm text-gray-600">Focus Blocks Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round((scorecard.temporalActual || 0) / scorecard.temporalTarget * 100)}%
              </div>
              <div className="text-sm text-gray-600">Temporal Progress</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}