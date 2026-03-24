import { FinancialTracker } from './financial-tracker';
import { FocusTracker } from './focus-tracker';
import { fetchTasks, createTask, updateTask } from './task-api';
import type { AiTask } from './types';

export class ChatSyncManager {
  private financialTracker: FinancialTracker;
  private focusTracker: FocusTracker;

  private constructor(financialTracker: FinancialTracker, focusTracker: FocusTracker) {
    this.financialTracker = financialTracker;
    this.focusTracker = focusTracker;
  }

  static async create(): Promise<ChatSyncManager> {
    const financialTracker = await FinancialTracker.create();
    const focusTracker = await FocusTracker.create();
    return new ChatSyncManager(financialTracker, focusTracker);
  }

  async syncChatUpdate(message: string): Promise<{ financial?: any; focusHours?: any; tasks?: any }> {
    console.log('Syncing chat update:', message);

    const financialResult = await this.financialTracker.processConversationalUpdate(message);
    const focusResult = await this.focusTracker.processConversationalUpdate(message);
    const taskResult = await this.syncTaskPatterns(message);

    return {
      financial: financialResult,
      focusHours: focusResult,
      tasks: taskResult
    };
  }

  private async syncTaskPatterns(message: string): Promise<{ updated: any[]; created: any[] }> {
    const updated: any[] = [];
    const created: any[] = [];

    // Fetch tasks once for all pattern matching
    const tasks = await fetchTasks();

    // Detect "Done: TASK_NAME" pattern
    const doneMatches = message.match(/Done\s*:?\s*([^.]+?)(?:\s*[-–]\s*(.+?))?(?:\.|$)/gi);
    if (doneMatches) {
      for (const match of doneMatches) {
        const taskTitle = match.replace(/^Done\s*:?\s*/i, '').split('-')[0].trim();
        const matched = this.findTaskInList(taskTitle, tasks);
        if (matched) {
          const result = await updateTask(matched.id, { status: 'done' });
          if (result) updated.push(result);
        }
      }
    }

    // Detect "In progress: TASK_NAME" or "Started: TASK_NAME" pattern
    const progressMatches = message.match(/(?:In progress|Started|Working on)\s*:?\s*([^.]+?)(?:\s*[-–]\s*(.+?))?(?:\.|$)/gi);
    if (progressMatches) {
      for (const match of progressMatches) {
        const taskTitle = match.replace(/^(?:In progress|Started|Working on)\s*:?\s*/i, '').split('-')[0].trim();
        const matched = this.findTaskInList(taskTitle, tasks);
        if (matched) {
          const result = await updateTask(matched.id, { status: 'doing' });
          if (result) updated.push(result);
        }
      }
    }

    return { updated, created };
  }

  private findTaskInList(search: string, tasks: AiTask[]): AiTask | null {
    try {
      const searchLower = search.toLowerCase().trim();

      // Exact match
      let match = tasks.find(t => t.title.toLowerCase() === searchLower);
      if (match) return match;

      // Partial match
      match = tasks.find(t => t.title.toLowerCase().includes(searchLower));
      if (match) return match;

      // Reverse partial
      match = tasks.find(t => {
        const words = t.title.toLowerCase().split(' ');
        return words.some(w => w.length > 2 && searchLower.includes(w));
      });
      if (match) return match;

      return null;
    } catch {
      return null;
    }
  }
}
