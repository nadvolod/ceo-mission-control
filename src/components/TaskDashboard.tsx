'use client';

import { useState } from 'react';
import { Plus, Trash2, CheckCircle, Circle, Clock, ExternalLink, Filter } from 'lucide-react';
import type { AiTask, TaskStats } from '@/lib/types';

interface TaskDashboardProps {
  tasks: AiTask[];
  stats: TaskStats;
  onCreateTask: (data: { title: string; category?: string }) => Promise<void>;
  onUpdateTask: (id: number, data: { status?: string; title?: string }) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
  onRefresh: () => Promise<void>;
  taskListUrl: string;
}

const STATUS_CYCLE: Record<string, string> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
};

const CATEGORIES = [
  'Revenue',
  'Finance',
  'Temporal',
  'Housing',
  'Tax',
  'Health',
  'Admin',
  'Personal',
  'Other',
];

function PriorityBadge({ score }: { score: number }) {
  let bg = 'bg-gray-100 text-gray-700';
  if (score > 80) bg = 'bg-red-100 text-red-700';
  else if (score > 50) bg = 'bg-yellow-100 text-yellow-700';
  else if (score > 30) bg = 'bg-blue-100 text-blue-700';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg}`}>
      {score}
    </span>
  );
}

function StatusIcon({ status, onClick }: { status: string; onClick: () => void }) {
  const iconClass = 'w-5 h-5 cursor-pointer transition-colors';
  switch (status) {
    case 'done':
      return <CheckCircle className={`${iconClass} text-green-500 hover:text-green-700`} onClick={onClick} />;
    case 'doing':
      return <Clock className={`${iconClass} text-yellow-500 hover:text-yellow-700`} onClick={onClick} />;
    default:
      return <Circle className={`${iconClass} text-gray-400 hover:text-gray-600`} onClick={onClick} />;
  }
}

export function TaskDashboard({
  tasks,
  stats,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onRefresh,
  taskListUrl,
}: TaskDashboardProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateTask({
        title: newTitle.trim(),
        ...(newCategory ? { category: newCategory } : {}),
      });
      setNewTitle('');
      setNewCategory('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusCycle = async (task: AiTask) => {
    const nextStatus = STATUS_CYCLE[task.status] || 'todo';
    await onUpdateTask(task.id, { status: nextStatus });
  };

  const handleDelete = async (id: number) => {
    if (deletingId === id) {
      await onDeleteTask(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      // Auto-cancel confirm after 3 seconds
      setTimeout(() => setDeletingId(prev => (prev === id ? null : prev)), 3000);
    }
  };

  const filteredTasks = tasks
    .filter(t => statusFilter === 'all' || t.status === statusFilter)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const formatMoney = (value: number | null) => {
    if (value === null || value === undefined) return null;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            {stats.total} total
          </span>
          <span className="text-yellow-600">
            {stats.doing} active
          </span>
          <span className="text-green-600">
            {stats.doneToday} done today
          </span>
          {stats.overdue > 0 && (
            <span className="text-red-600">
              {stats.overdue} overdue
            </span>
          )}
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:text-blue-800 text-xs"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Quick-add form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Category</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!newTitle.trim() || isSubmitting}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {['all', 'todo', 'doing', 'done'].map(filter => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">
              {statusFilter === 'all'
                ? 'No tasks yet. Add one above or use the full task manager.'
                : `No ${statusFilter} tasks.`}
            </p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 group"
            >
              {/* Status icon */}
              <StatusIcon
                status={task.status}
                onClick={() => handleStatusCycle(task)}
              />

              {/* Priority badge */}
              <PriorityBadge score={task.priorityScore} />

              {/* Title */}
              <span
                className={`flex-1 text-sm ${
                  task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'
                }`}
              >
                {task.title}
              </span>

              {/* Due date */}
              {task.dueDate && (
                <span
                  className={`text-xs ${
                    isOverdue(task.dueDate) ? 'text-red-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {new Date(task.dueDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}

              {/* Category tag */}
              {task.category && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                  {task.category}
                </span>
              )}

              {/* Monetary value */}
              {task.monetaryValue !== null && task.monetaryValue !== undefined && (
                <span className="text-xs text-green-600 font-medium">
                  {formatMoney(task.monetaryValue)}
                </span>
              )}

              {/* Delete button */}
              <button
                onClick={() => handleDelete(task.id)}
                className={`p-1 rounded transition-colors ${
                  deletingId === task.id
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100'
                }`}
                title={deletingId === task.id ? 'Click again to confirm' : 'Delete task'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer link */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <a
          href={taskListUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          Open Full Task Manager
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
