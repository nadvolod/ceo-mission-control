export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Review' | 'Done';

export type MissionRelevance = 'Mission Critical' | 'Supporting' | 'Neutral' | 'Distraction';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  deadline?: string; // ISO date string
  createdAt: string;
  updatedAt: string;
  projectId?: string; // Links to Initiative or sub-project
  parentTaskId?: string; // For subtasks
  blockedReason?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  assignee?: string;
  missionRelevance?: MissionRelevance;
  monthlyRevenueImpact?: number;
  aiLeverageScore?: number; // 1-10 scale
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
  status: TaskStatus;
  deadline?: string;
  tasks: Task[]; // Sub-tasks for this initiative
  subInitiatives?: Initiative[]; // For mega-projects like Temporal
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  deadline?: string;
  initiatives: Initiative[];
  tasks: Task[];
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
  newTasks?: Task[];
}

export interface CashPosition {
  current: number;
  monthlyBurn: number;
  runway: number;
  pipelineTotal: number;
  heloc: number;
}

export interface ConversationExtraction {
  tasks: Task[];
  deadlines: { task: string; date: string; }[];
  statusUpdates: { taskId: string; status: TaskStatus; note?: string; }[];
  blockers: { taskId: string; reason: string; }[];
  financial?: { added: { id: string; amount: number; description: string; category: string }[]; message: string } | null;
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