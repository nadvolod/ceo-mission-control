import { Task, TaskStatus, Initiative, ConversationExtraction } from './types';
import { MissionEvaluator } from './mission-evaluator';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_PATH, ensureWorkspaceReady } from './workspace-path';

const TASKS_FILE = join(WORKSPACE_PATH, 'tasks.json');

export class TaskManager {
  private tasks: Task[] = [];
  private initiatives: Initiative[] = [];

  constructor() {
    ensureWorkspaceReady();
    this.loadTasks();
  }

  private loadTasks(): void {
    try {
      if (existsSync(TASKS_FILE)) {
        const data = JSON.parse(readFileSync(TASKS_FILE, 'utf8'));
        this.tasks = data.tasks || [];
        this.initiatives = data.initiatives || [];
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private saveTasks(): void {
    try {
      writeFileSync(TASKS_FILE, JSON.stringify({
        tasks: this.tasks,
        initiatives: this.initiatives,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  createTask(taskData: Partial<Task>): Task {
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: taskData.title || 'Untitled Task',
      description: taskData.description,
      status: taskData.status || 'Not Started',
      priority: taskData.priority || 'Medium',
      deadline: taskData.deadline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: taskData.projectId,
      parentTaskId: taskData.parentTaskId,
      blockedReason: taskData.blockedReason,
      estimatedHours: taskData.estimatedHours,
      actualHours: taskData.actualHours,
      tags: taskData.tags || [],
      assignee: taskData.assignee
    };

    // Auto-evaluate mission relevance
    const missionEval = MissionEvaluator.evaluateTask(task);
    task.missionRelevance = missionEval.relevance;
    task.monthlyRevenueImpact = missionEval.monthlyRevenueImpact;
    task.aiLeverageScore = missionEval.aiLeverageScore;

    this.tasks.push(task);
    this.saveTasks();
    return task;
  }

  updateTask(taskId: string, updates: Partial<Task>): Task | null {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return null;

    this.tasks[taskIndex] = {
      ...this.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveTasks();
    return this.tasks[taskIndex];
  }

  updateTaskStatus(taskId: string, status: TaskStatus, note?: string): Task | null {
    const updates: Partial<Task> = { status };
    if (status === 'Blocked' && note) {
      updates.blockedReason = note;
    }
    return this.updateTask(taskId, updates);
  }

  getTasks(): Task[] {
    return this.tasks;
  }

  getTasksByProject(projectId: string): Task[] {
    return this.tasks.filter(t => t.projectId === projectId);
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.tasks.filter(t => t.status === status);
  }

  getUpcomingDeadlines(days: number = 7): Task[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.tasks
      .filter(t => t.deadline && new Date(t.deadline) <= cutoff && t.status !== 'Done')
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  }

  getTasksWithStatus(includeCompleted: boolean = false): { overdue: Task[]; upcoming: Task[]; active: Task[]; blocked: Task[]; completed?: Task[] } {
    const now = new Date();
    const upcoming = new Date();
    upcoming.setDate(upcoming.getDate() + 7);

    const overdue = this.tasks.filter(t => 
      t.deadline && new Date(t.deadline) < now && t.status !== 'Done'
    );

    const upcomingTasks = this.tasks.filter(t => 
      t.deadline && 
      new Date(t.deadline) >= now && 
      new Date(t.deadline) <= upcoming && 
      t.status !== 'Done'
    );

    const active = this.tasks.filter(t => 
      t.status === 'In Progress' && !overdue.includes(t) && !upcomingTasks.includes(t)
    );

    const blocked = this.tasks.filter(t => t.status === 'Blocked');

    const result: any = { overdue, upcoming: upcomingTasks, active, blocked };
    
    if (includeCompleted) {
      result.completed = this.tasks.filter(t => t.status === 'Done');
    }

    return result;
  }

  // Natural Language Processing for extracting tasks from conversation
  extractFromConversation(text: string): ConversationExtraction {
    const tasks: Task[] = [];
    const deadlines: { task: string; date: string; }[] = [];
    const statusUpdates: { taskId: string; status: TaskStatus; note?: string; }[] = [];
    const blockers: { taskId: string; reason: string; }[] = [];

    // Pattern matching for task extraction
    const taskPatterns = [
      /need to (.+?)(?:\.|$)/gi,
      /should (.+?)(?:\.|$)/gi,
      /must (.+?)(?:\.|$)/gi,
      /have to (.+?)(?:\.|$)/gi,
      /(?:action|task|todo):\s*(.+?)(?:\.|$)/gi
    ];

    // Pattern matching for deadlines
    const deadlinePatterns = [
      /(.+?)\s+(?:by|due|deadline)\s+([A-Z][a-z]+ \d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}\/?\d{0,4}|\d{1,2}-\d{1,2}-?\d{0,4})/gi,
      /([A-Z][a-z]+ \d{1,2}(?:st|nd|rd|th)?)\s+deadline/gi
    ];

    // Pattern matching for status updates
    const statusPatterns = [
      /(?:blocked on|stuck on)\s+(.+?)(?:\s+[-–]|$)/gi,
      /completed?\s+(.+?)(?:\.|$)/gi,
      /finished\s+(.+?)(?:\.|$)/gi,
      /started\s+(.+?)(?:\.|$)/gi,
      /working on\s+(.+?)(?:\.|$)/gi
    ];

    // Extract tasks
    taskPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const title = match[1].trim();
        if (title.length > 3 && !title.includes('?')) {
          tasks.push(this.createTask({
            title,
            priority: this.inferPriority(text, title),
            tags: ['extracted']
          }));
        }
      }
    });

    // Extract deadlines
    deadlinePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        deadlines.push({
          task: match[1]?.trim() || match[0].trim(),
          date: this.parseDate(match[2] || match[1])
        });
      }
    });

    return { tasks, deadlines, statusUpdates, blockers };
  }

  private inferPriority(context: string, task: string): 'Critical' | 'High' | 'Medium' | 'Low' {
    const criticalWords = ['urgent', 'critical', 'asap', 'immediately', 'emergency'];
    const highWords = ['important', 'priority', 'soon', 'deadline'];
    
    const combined = `${context} ${task}`.toLowerCase();
    
    if (criticalWords.some(word => combined.includes(word))) return 'Critical';
    if (highWords.some(word => combined.includes(word))) return 'High';
    return 'Medium';
  }

  private parseDate(dateStr: string): string {
    try {
      // Handle "April 15", "Apr 15", etc.
      if (dateStr.match(/[A-Za-z]+ \d{1,2}/)) {
        const currentYear = new Date().getFullYear();
        return new Date(`${dateStr}, ${currentYear}`).toISOString().split('T')[0];
      }
      
      // Handle MM/DD or MM/DD/YY formats
      if (dateStr.match(/\d{1,2}\/\d{1,2}/)) {
        const currentYear = new Date().getFullYear();
        const [month, day, year] = dateStr.split('/');
        const fullYear = year ? (parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year)) : currentYear;
        return new Date(`${month}/${day}/${fullYear}`).toISOString().split('T')[0];
      }

      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  // Process natural language task updates
  processNaturalLanguageUpdate(text: string): { updated: Task[]; created: Task[]; } {
    const updated: Task[] = [];
    const created: Task[] = [];

    // Extract new tasks and updates from conversation
    const extraction = this.extractFromConversation(text);
    
    // Create new tasks
    extraction.tasks.forEach(taskData => {
      const task = this.createTask(taskData);
      created.push(task);
    });

    // Apply deadline updates
    extraction.deadlines.forEach(deadline => {
      const matchingTasks = this.tasks.filter(t => 
        t.title.toLowerCase().includes(deadline.task.toLowerCase()) ||
        deadline.task.toLowerCase().includes(t.title.toLowerCase())
      );
      
      matchingTasks.forEach(task => {
        const updatedTask = this.updateTask(task.id, { deadline: deadline.date });
        if (updatedTask) updated.push(updatedTask);
      });
    });

    return { updated, created };
  }

  // Initialize with current context from INITIATIVES.md
  seedFromInitiatives(initiatives: any[]): void {
    // First, load sample tasks if no tasks exist
    if (this.tasks.length === 0) {
      this.seedSampleTasks();
    }

    // Then add tasks for initiatives that don't have them
    initiatives.forEach(init => {
      if (!this.tasks.some(t => t.projectId === init.name)) {
        this.createTask({
          title: init.nextMove || `Complete ${init.name}`,
          description: init.goal,
          priority: init.urgency >= 4 ? 'Critical' : init.urgency >= 3 ? 'High' : 'Medium',
          projectId: init.name,
          status: 'Not Started',
          tags: ['initiative']
        });
      }
    });
  }

  // Load sample tasks for initial setup
  seedSampleTasks(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sampleTasks } = require('./sample-tasks');
    sampleTasks.forEach((taskData: Partial<Task>) => {
      this.createTask(taskData);
    });
  }
}