// ai-task-list integration types
export interface AiTask {
  id: number;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done';
  priorityScore: number;
  priorityReason: string | null;
  monetaryValue: number | null;
  revenuePotential: number | null;
  urgency: number | null;
  strategicValue: number | null;
  dueDate: string | null;
  category: string | null;
  assignee: string | null;
  parentId: number | null;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  doing: number;
  doneToday: number;
  overdue: number;
}

export interface Initiative {
  id: string;
  rank: number;
  name: string;
  type: string;
  goal: string;
  money: number;
  strategic: number;
  urgency: number;
  leverage: number;
  time: number;
  risk: number;
  total: number;
  bottleneck: string;
  nextMove: string;
  payoff: string;
  confidence: string;
  deprioritize: string;
  status: string;
  deadline?: string;
  tasks: unknown[]; // Sub-tasks for this initiative
  subInitiatives?: Initiative[]; // For mega-projects like Temporal
}

export interface DailyScorecard {
  date: string;
  priorities: string[];
  temporalTarget: number;
  temporalActual?: number;
  focusBlocks: string[];
  majorMoneyMove: string;
  strategicMove: string;
  taxesMove: string;
  ignoreList: string[];
  biggestBlocker: string;
  wins: string[];
  misses: string[];
  openLoops: string[];
  moneyAdvanced: string;
  completedTasks?: string[];
  newTasks?: unknown[];
}

export interface CashPosition {
  current: number;
  monthlyBurn: number;
  runway: number;
  pipelineTotal: number;
  heloc: number;
}

// Focus Hours Tracking
export type FocusCategory =
  | 'Temporal'
  | 'Finance'
  | 'Revenue'
  | 'Housing'
  | 'Tax'
  | 'Personal'
  | 'Health'
  | 'Admin'
  | 'Learning'
  | 'Other';

export interface FocusSession {
  id: string;
  category: FocusCategory;
  hours: number;
  description: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
  source: 'manual' | 'conversational' | 'temporal-sync';
}

export interface DailyFocusMetrics {
  date: string;
  sessions: FocusSession[];
  totalHours: number;
  byCategory: Record<string, number>;
}

export interface FocusData {
  dailyMetrics: Record<string, DailyFocusMetrics>;
  lastUpdated: string;
}

export interface TemporalSession {
  id: string;
  startTime: string;
  endTime?: string;
  duration: number;
  description: string;
  date: string;
}

export interface TemporalData {
  sessions: TemporalSession[];
  dailyTotals: Record<string, number>;
}

// Task sync types — bidirectional sync between local OpenClaw and production dashboard

export interface LocalTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId?: string;
  tags?: string[];
  missionRelevance?: string;
  monthlyRevenueImpact?: number;
  estimatedHours?: number;
  deadline?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  aiLeverageScore?: number;
  timeLogged?: Array<{ date: string; minutes: number; note: string }>;
  cronJobId?: string;
  schedule?: string;
}

export interface SyncedTask {
  localId: string;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done';
  priority: string;
  category: string | null;
  tags: string[];
  dueDate: string | null;
  monetaryValue: number | null;
  missionRelevance: string | null;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
  source: 'local' | 'dashboard';
  extra: Record<string, unknown>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  merged: number;
  timestamp: string;
}
