'use client';

import { Task, TaskStatus, Initiative, MissionRelevance } from '@/lib/types';
import { Clock, AlertTriangle, CheckCircle, XCircle, Pause, Play, Calendar, Target, Zap, DollarSign } from 'lucide-react';
import { useState } from 'react';

interface TaskCommandCenterProps {
  initiatives: Initiative[];
  tasks: Task[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

export function TaskCommandCenter({ initiatives, tasks, onTaskUpdate }: TaskCommandCenterProps) {
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'Done': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'In Progress': return <Play className="h-4 w-4 text-blue-600" />;
      case 'Blocked': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Review': return <Pause className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Done': return 'bg-green-100 text-green-800 border-green-200';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Blocked': return 'bg-red-100 text-red-800 border-red-200';
      case 'Review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-500';
      case 'Medium': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getUrgencyLevel = (deadline?: string) => {
    if (!deadline) return null;
    const now = new Date();
    const due = new Date(deadline);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { level: 'overdue', color: 'text-red-600 bg-red-50', text: `${Math.abs(daysUntil)} days overdue` };
    if (daysUntil === 0) return { level: 'today', color: 'text-red-600 bg-red-50', text: 'Due today' };
    if (daysUntil <= 3) return { level: 'urgent', color: 'text-red-600 bg-red-50', text: `${daysUntil} days left` };
    if (daysUntil <= 7) return { level: 'soon', color: 'text-orange-600 bg-orange-50', text: `${daysUntil} days left` };
    return { level: 'future', color: 'text-gray-600', text: `${daysUntil} days left` };
  };

  // Removed duplicate function - using the one at bottom of file

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: new Date(dateStr).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Group tasks by project/initiative
  const groupedTasks = tasks.reduce((acc, task) => {
    const projectKey = task.projectId || 'unassigned';
    if (!acc[projectKey]) acc[projectKey] = [];
    acc[projectKey].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Add Temporal as mega-project
  const temporalTasks = groupedTasks['Temporal'] || [];
  
  // Filter tasks based on selected project
  const filteredTasks = selectedProject === 'all' ? tasks : (groupedTasks[selectedProject] || []);

  // Separate by status for better organization
  const tasksByStatus = {
    overdue: filteredTasks.filter(t => t.deadline && getUrgencyLevel(t.deadline)?.level === 'overdue'),
    urgent: filteredTasks.filter(t => t.deadline && ['today', 'urgent'].includes(getUrgencyLevel(t.deadline)?.level || '')),
    active: filteredTasks.filter(t => t.status === 'In Progress'),
    blocked: filteredTasks.filter(t => t.status === 'Blocked'),
    pending: filteredTasks.filter(t => t.status === 'Not Started' && !getUrgencyLevel(t.deadline)),
    review: filteredTasks.filter(t => t.status === 'Review')
  };

  return (
    <div className="space-y-6">
      {/* Project Filter & Stats */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Task Command Center</h2>
          <div className="flex items-center space-x-4">
            <select 
              value={selectedProject} 
              onChange={(e) => setSelectedProject(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Projects</option>
              {Object.keys(groupedTasks).map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
            <div className="text-sm text-gray-500">
              {filteredTasks.length} total tasks
            </div>
          </div>
        </div>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{tasksByStatus.overdue.length}</div>
            <div className="text-xs text-red-800">Overdue</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{tasksByStatus.urgent.length}</div>
            <div className="text-xs text-orange-800">Urgent</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{tasksByStatus.active.length}</div>
            <div className="text-xs text-blue-800">Active</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{tasksByStatus.blocked.length}</div>
            <div className="text-xs text-red-800">Blocked</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{tasksByStatus.review.length}</div>
            <div className="text-xs text-yellow-800">Review</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-600">{tasksByStatus.pending.length}</div>
            <div className="text-xs text-gray-800">Pending</div>
          </div>
        </div>
      </div>

      {/* Temporal Mega-Project (if selected or viewing all) */}
      {(selectedProject === 'all' || selectedProject === 'Temporal') && temporalTasks.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <div className="w-4 h-4 bg-blue-600 rounded mr-3"></div>
              Temporal ($10K/month protection)
            </h3>
            <div className="text-sm text-gray-600">
              {temporalTasks.filter(t => t.status !== 'Done').length} active tasks
            </div>
          </div>
          <div className="space-y-2">
            {temporalTasks.map((task) => (
              <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* Critical Tasks (Overdue + Urgent) */}
      {(tasksByStatus.overdue.length > 0 || tasksByStatus.urgent.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Critical Attention Required
          </h3>
          <div className="space-y-2">
            {[...tasksByStatus.overdue, ...tasksByStatus.urgent].map((task) => (
              <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {tasksByStatus.active.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">In Progress</h3>
          <div className="space-y-2">
            {tasksByStatus.active.map((task) => (
              <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* Blocked Tasks */}
      {tasksByStatus.blocked.length > 0 && (
        <div className="bg-red-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            Blocked Tasks
          </h3>
          <div className="space-y-2">
            {tasksByStatus.blocked.map((task) => (
              <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} showBlocker />
            ))}
          </div>
        </div>
      )}

      {/* All Other Tasks */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Tasks</h3>
        <div className="space-y-2">
          {filteredTasks
            .filter(task => !tasksByStatus.overdue.includes(task) && !tasksByStatus.urgent.includes(task))
            .map((task) => (
            <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onUpdate?: (taskId: string, updates: Partial<Task>) => void;
  showBlocker?: boolean;
}

function TaskRow({ task, onUpdate, showBlocker }: TaskRowProps) {
  const urgency = getUrgencyLevel(task.deadline);
  const missionInfo = getMissionRelevanceInfo(task.missionRelevance);
  
  const handleStatusChange = (newStatus: TaskStatus) => {
    onUpdate?.(task.id, { status: newStatus });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-center space-x-3 flex-1">
        {/* Mission relevance indicator */}
        <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs border ${missionInfo.color}`}>
          {missionInfo.icon}
          <span>{missionInfo.label}</span>
        </div>
        
        {/* Priority indicator */}
        <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
        
        {/* Status icon */}
        {getStatusIcon(task.status)}
        
        {/* Task details */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{task.title}</div>
          {task.description && (
            <div className="text-sm text-gray-500 truncate">{task.description}</div>
          )}
          
          {/* Mission metrics */}
          <div className="flex items-center space-x-3 mt-1">
            {task.monthlyRevenueImpact && task.monthlyRevenueImpact > 0 && (
              <div className="flex items-center space-x-1 text-xs text-green-600">
                <DollarSign className="h-3 w-3" />
                <span>{formatCurrency(task.monthlyRevenueImpact)}/mo</span>
              </div>
            )}
            {task.aiLeverageScore && task.aiLeverageScore > 5 && (
              <div className="flex items-center space-x-1 text-xs text-purple-600">
                <Zap className="h-3 w-3" />
                <span>AI: {task.aiLeverageScore}/10</span>
              </div>
            )}
            {task.projectId && (
              <div className="text-xs text-gray-400">{task.projectId}</div>
            )}
          </div>
          
          {showBlocker && task.blockedReason && (
            <div className="text-sm text-red-600 mt-1">🚧 {task.blockedReason}</div>
          )}
        </div>
        
        {/* Deadline */}
        {task.deadline && (
          <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${urgency?.color || 'text-gray-600'}`}>
            <Calendar className="h-3 w-3" />
            <span>{formatDate(task.deadline)}</span>
            {urgency && <span>({urgency.text})</span>}
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(task.status)}`}>
        {task.status}
      </div>
    </div>
  );
}

// Helper functions (moved to component level to access within component)
function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case 'Done': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'In Progress': return <Play className="h-4 w-4 text-blue-600" />;
    case 'Blocked': return <XCircle className="h-4 w-4 text-red-600" />;
    case 'Review': return <Pause className="h-4 w-4 text-yellow-600" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getMissionRelevanceInfo(relevance?: MissionRelevance) {
  switch (relevance) {
    case 'Mission Critical':
      return { 
        icon: <Target className="h-3 w-3 text-purple-600" />, 
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        label: 'Mission'
      };
    case 'Supporting':
      return { 
        icon: <Zap className="h-3 w-3 text-blue-600" />, 
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        label: 'Supporting'
      };
    case 'Distraction':
      return { 
        icon: <AlertTriangle className="h-3 w-3 text-red-600" />, 
        color: 'bg-red-100 text-red-800 border-red-200',
        label: 'Distraction'
      };
    default:
      return { 
        icon: <Clock className="h-3 w-3 text-gray-500" />, 
        color: 'bg-gray-100 text-gray-600 border-gray-200',
        label: 'Neutral'
      };
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'Critical': return 'bg-red-500';
    case 'High': return 'bg-orange-500';
    case 'Medium': return 'bg-yellow-500';
    default: return 'bg-gray-400';
  }
}

function getStatusColor(status: TaskStatus) {
  switch (status) {
    case 'Done': return 'bg-green-100 text-green-800 border-green-200';
    case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Blocked': return 'bg-red-100 text-red-800 border-red-200';
    case 'Review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getUrgencyLevel(deadline?: string) {
  if (!deadline) return null;
  const now = new Date();
  const due = new Date(deadline);
  const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return { level: 'overdue', color: 'text-red-600 bg-red-50', text: `${Math.abs(daysUntil)} days overdue` };
  if (daysUntil === 0) return { level: 'today', color: 'text-red-600 bg-red-50', text: 'Due today' };
  if (daysUntil <= 3) return { level: 'urgent', color: 'text-red-600 bg-red-50', text: `${daysUntil} days left` };
  if (daysUntil <= 7) return { level: 'soon', color: 'text-orange-600 bg-orange-50', text: `${daysUntil} days left` };
  return { level: 'future', color: 'text-gray-600', text: `${daysUntil} days left` };
}