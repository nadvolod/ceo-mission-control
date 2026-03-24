'use client';

import { useState } from 'react';
import { MessageSquare, Send, Brain, CheckCircle } from 'lucide-react';
import { Task, ConversationExtraction } from '@/lib/types';

interface ConversationTaskInputProps {
  onProcessMessage: (message: string) => Promise<{ tasks: Task[]; extraction: ConversationExtraction; }>;
  className?: string;
}

export function ConversationTaskInput({ onProcessMessage, className = '' }: ConversationTaskInputProps) {
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ tasks: Task[]; extraction: ConversationExtraction; } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await onProcessMessage(message);
      setLastResult(result);
      setMessage('');
    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const examples = [
    "Need to call Loan Depot by Friday about the failed payment",
    "Blocked on HELOC - bank needs additional docs",
    "Completed the Temporal client delivery, took 3 hours",
    "Started working on taxes - deadline April 15",
    "Logged 2h on Temporal client delivery",
    "Focused 1.5 hours on tax preparation"
  ];

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <MessageSquare className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Natural Language Task Updates</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Tell me what you're working on, deadlines, blockers, or completed tasks
        </p>
      </div>

      {/* Input Form */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., 'Need to call Loan Depot by Friday' or 'Blocked on HELOC - bank needs docs' or 'Completed the client presentation'"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!message.trim() || isProcessing}
              className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <Brain className="h-4 w-4 animate-pulse" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Quick Examples */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Try these examples:</p>
            <div className="grid grid-cols-1 gap-2">
              {examples.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setMessage(example)}
                  className="text-left px-3 py-2 text-xs text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>

      {/* Processing Result */}
      {lastResult && (
        <div className="p-4 border-t border-gray-200 bg-green-50">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Processed Successfully</span>
          </div>
          
          <div className="space-y-2 text-xs">
            {lastResult.tasks.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Created {lastResult.tasks.length} task(s):</span>
                <ul className="ml-2 space-y-1">
                  {lastResult.tasks.map((task, index) => (
                    <li key={index} className="text-gray-600">
                      • {task.title} {task.deadline && `(due: ${new Date(task.deadline).toLocaleDateString()})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {lastResult.extraction.deadlines.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Found {lastResult.extraction.deadlines.length} deadline(s):</span>
                <ul className="ml-2 space-y-1">
                  {lastResult.extraction.deadlines.map((deadline, index) => (
                    <li key={index} className="text-gray-600">
                      • {deadline.task} → {deadline.date}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {lastResult.extraction.statusUpdates.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Updated {lastResult.extraction.statusUpdates.length} task(s)</span>
              </div>
            )}

            {lastResult.extraction.focusHours && lastResult.extraction.focusHours.added.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Logged {lastResult.extraction.focusHours.added.length} focus session(s):</span>
                <ul className="ml-2 space-y-1">
                  {lastResult.extraction.focusHours.added.map((session, index) => (
                    <li key={index} className="text-gray-600">
                      • {session.hours}h {session.category} — {session.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Usage Tips */}
      <div className="p-4 bg-gray-50 rounded-b-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Pro Tips:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Use deadline words: "by Friday", "due April 15", "deadline March 30"</li>
          <li>• Status updates: "completed", "finished", "started", "working on", "blocked on"</li>
          <li>• Priority words: "urgent", "critical", "important" (auto-sets priority)</li>
          <li>• Project linking: Mention "Temporal", "HELOC", "taxes" to auto-categorize</li>
          <li>• Focus tracking: "logged 2h on Temporal", "spent 1h on taxes", "deep work 3h: Revenue"</li>
        </ul>
      </div>
    </div>
  );
}