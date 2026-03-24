import { Task, TaskStatus, Initiative, ConversationExtraction } from './types';
import { MissionEvaluator } from './mission-evaluator';
import { loadJSON, saveJSON } from './storage';

export class TaskManager {
  private tasks: Task[] = [];
  private initiatives: Initiative[] = [];

  private constructor() {}

  static async create(): Promise<TaskManager> {
    const manager = new TaskManager();
    await manager.loadTasks();
    return manager;
  }

  private async loadTasks(): Promise<void> {
    try {
      const data = await loadJSON('tasks.json', { tasks: [], initiatives: [] });
      this.tasks = data.tasks || [];
      this.initiatives = data.initiatives || [];
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private async saveTasks(): Promise<void> {
    try {
      await saveJSON('tasks.json', {
        tasks: this.tasks,
        initiatives: this.initiatives,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  async createTask(taskData: Partial<Task>): Promise<Task> {
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
    await this.saveTasks();
    return task;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return null;

    this.tasks[taskIndex] = {
      ...this.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.saveTasks();
    return this.tasks[taskIndex];
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, note?: string): Promise<Task | null> {
    const updates: Partial<Task> = { status };
    if (status === 'Blocked' && note) {
      updates.blockedReason = note;
    }
    return await this.updateTask(taskId, updates);
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
          tasks.push({
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title,
            priority: this.inferPriority(text, title),
            tags: ['extracted'],
            status: 'Not Started',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Task);
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
  async processNaturalLanguageUpdate(text: string): Promise<{ updated: Task[]; created: Task[]; }> {
    const updated: Task[] = [];
    const created: Task[] = [];

    // Extract new tasks and updates from conversation
    const extraction = this.extractFromConversation(text);

    // Create new tasks
    for (const taskData of extraction.tasks) {
      const task = await this.createTask(taskData);
      created.push(task);
    }

    // Apply deadline updates
    for (const deadline of extraction.deadlines) {
      const matchingTasks = this.tasks.filter(t =>
        t.title.toLowerCase().includes(deadline.task.toLowerCase()) ||
        deadline.task.toLowerCase().includes(t.title.toLowerCase())
      );

      for (const task of matchingTasks) {
        const updatedTask = await this.updateTask(task.id, { deadline: deadline.date });
        if (updatedTask) updated.push(updatedTask);
      }
    }

    return { updated, created };
  }

  // Initialize with current context from INITIATIVES.md
  async seedFromInitiatives(initiatives: any[]): Promise<void> {
    // First, load sample tasks if no tasks exist
    if (this.tasks.length === 0) {
      await this.seedSampleTasks();
    }

    // Then add tasks for initiatives that don't have them
    for (const init of initiatives) {
      if (!this.tasks.some(t => t.projectId === init.name)) {
        await this.createTask({
          title: init.nextMove || `Complete ${init.name}`,
          description: init.goal,
          priority: init.urgency >= 4 ? 'Critical' : init.urgency >= 3 ? 'High' : 'Medium',
          projectId: init.name,
          status: 'Not Started',
          tags: ['initiative']
        });
      }
    }
  }

  // Load sample tasks for initial setup
  async seedSampleTasks(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sampleTasks } = require('./sample-tasks');
    for (const taskData of sampleTasks) {
      await this.createTask(taskData);
    }
  }
}