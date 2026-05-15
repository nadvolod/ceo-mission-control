'use client';

import { useState, useMemo } from 'react';
import type { ThreeToThriveEntry } from '@/lib/types';
import { ChevronDown, ChevronUp, Flame, CheckCircle, Clock } from 'lucide-react';

interface ThreeToThriveProps {
  todaysEntry: ThreeToThriveEntry;
  history: ThreeToThriveEntry[];
  onSaveAnswer: (date: string, question: string, answer: string) => Promise<void>;
}

export function ThreeToThrive({ todaysEntry, history, onSaveAnswer }: ThreeToThriveProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const a of todaysEntry.answers) {
      map[a.question] = a.answer;
    }
    return map;
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const a of todaysEntry.answers) {
      if (a.answer.trim().length > 0) map[a.question] = true;
    }
    return map;
  });
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep answers in sync when todaysEntry changes (e.g. after reload)
  useMemo(() => {
    const map: Record<string, string> = {};
    const savedMap: Record<string, boolean> = {};
    for (const a of todaysEntry.answers) {
      map[a.question] = a.answer;
      if (a.answer.trim().length > 0) savedMap[a.question] = true;
    }
    setAnswers(map);
    setSaved(savedMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysEntry.date]);

  const allAnswered = todaysEntry.questions.every(
    q => (answers[q] ?? '').trim().length > 0
  );

  async function handleSave(question: string) {
    const answer = answers[question] ?? '';
    setSaving(prev => ({ ...prev, [question]: true }));
    setError(null);
    try {
      await onSaveAnswer(todaysEntry.date, question, answer);
      setSaved(prev => ({ ...prev, [question]: true }));
    } catch {
      setError('Failed to save answer. Please try again.');
    } finally {
      setSaving(prev => ({ ...prev, [question]: false }));
    }
  }

  // History entries excluding today (already shown above)
  const historyWithoutToday = history.filter(e => e.date !== todaysEntry.date);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Flame className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Three to Thrive</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Daily focus questions — {todaysEntry.date}
            </p>
          </div>
          {allAnswered && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-full text-green-700 text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              Complete
            </div>
          )}
          {!allAnswered && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 rounded-full text-amber-700 text-sm font-medium">
              <Clock className="h-4 w-4" />
              {todaysEntry.answers.filter(a => a.answer.trim().length > 0).length}/3 answered
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="divide-y divide-gray-100">
        {todaysEntry.questions.map((question, idx) => {
          const isSaving = saving[question] ?? false;
          const isSaved = saved[question] ?? false;
          const currentAnswer = answers[question] ?? '';
          const isEdited = currentAnswer !== (todaysEntry.answers.find(a => a.question === question)?.answer ?? '');

          return (
            <div key={idx} className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                  ${idx < 2 ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{question}</p>
                  {idx === 2 && (
                    <span className="inline-block mt-1 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">
                      Daily random
                    </span>
                  )}
                </div>
                {isSaved && !isEdited && (
                  <CheckCircle className="flex-shrink-0 h-5 w-5 text-green-500 mt-0.5" />
                )}
              </div>

              <div className="ml-10">
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800
                    placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
                    resize-none transition"
                  rows={3}
                  placeholder="Write your answer here…"
                  value={currentAnswer}
                  onChange={e => {
                    setAnswers(prev => ({ ...prev, [question]: e.target.value }));
                    setSaved(prev => ({ ...prev, [question]: false }));
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">
                    {currentAnswer.length > 0 ? `${currentAnswer.length} chars` : ''}
                  </span>
                  <button
                    onClick={() => handleSave(question)}
                    disabled={isSaving || currentAnswer.trim().length === 0}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-orange-500 text-white
                      hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {isSaving ? 'Saving…' : isSaved && !isEdited ? 'Saved ✓' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mx-6 mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* History toggle */}
      {historyWithoutToday.length > 0 && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-6 py-3 text-sm text-gray-600
              hover:bg-gray-50 transition"
          >
            <span className="font-medium">Answer History ({historyWithoutToday.length} past days)</span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showHistory && (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {historyWithoutToday.map(entry => (
                <div key={entry.date} className="px-6 py-4 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                    {entry.date}
                  </p>
                  <div className="space-y-3">
                    {entry.questions.map((q, qi) => {
                      const ans = entry.answers.find(a => a.question === q);
                      return (
                        <div key={qi}>
                          <p className="text-xs font-medium text-gray-700">{q}</p>
                          {ans?.answer ? (
                            <p className="mt-0.5 text-sm text-gray-600 whitespace-pre-wrap">{ans.answer}</p>
                          ) : (
                            <p className="mt-0.5 text-xs text-gray-400 italic">No answer recorded</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
