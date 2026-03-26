'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard rendering error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-xl font-bold text-red-800 mb-4">Dashboard Error</h2>
        <p className="text-gray-700 mb-4">
          Something went wrong while rendering the dashboard.
        </p>
        <details className="mb-6 bg-red-50 border border-red-200 rounded p-3">
          <summary className="text-sm font-medium text-red-700 cursor-pointer">
            Error details
          </summary>
          <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
          {error.digest && (
            <p className="mt-2 text-xs text-red-500">Digest: {error.digest}</p>
          )}
        </details>
        <button
          onClick={reset}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
