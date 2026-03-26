import { FinancialTracker } from './financial-tracker';
import { FocusTracker } from './focus-tracker';
import { fetchTasks, createTask, updateTask } from './task-api';
import { updateScorecardField } from './workspace-reader';
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

  async syncChatUpdate(message: string): Promise<{ financial?: any; focusHours?: any; tasks?: any; scorecard?: any }> {
    console.log('Syncing chat update:', message);

    const financialResult = await this.financialTracker.processConversationalUpdate(message);
    const focusResult = await this.focusTracker.processConversationalUpdate(message);
    const taskResult = await this.syncTaskPatterns(message);
    const scorecardResult = await this.syncScorecardPatterns(message);

    return {
      financial: financialResult,
      focusHours: focusResult,
      tasks: taskResult,
      scorecard: scorecardResult,
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

  private async syncScorecardPatterns(message: string): Promise<{ updated: string[] }> {
    const updated: string[] = [];

    // "top 3: X, Y, Z" or "priorities: X, Y, Z" or "today's priorities: X, Y, Z"
    const priorityMatch = message.match(/(?:top\s*3|priorities|today'?s\s*priorities)\s*:\s*(.+)/i);
    if (priorityMatch) {
      const items = priorityMatch[1].split(/,|\n/).map(s => s.trim()).filter(Boolean);
      if (items.length > 0) {
        await updateScorecardField('priorities', items);
        updated.push('priorities');
        console.log('Scorecard updated: priorities →', items);
      }
    }

    // "biggest blocker: ..." or "blocker: ..."
    const blockerMatch = message.match(/(?:biggest\s*)?blocker\s*:\s*(.+?)(?:\.|$)/i);
    if (blockerMatch) {
      await updateScorecardField('biggestBlocker', blockerMatch[1].trim());
      updated.push('biggestBlocker');
      console.log('Scorecard updated: biggestBlocker →', blockerMatch[1].trim());
    }

    // "money move: ..." or "major money move: ..."
    const moneyMoveMatch = message.match(/(?:major\s*)?money\s*move\s*:\s*(.+?)(?:\.|$)/i);
    if (moneyMoveMatch) {
      await updateScorecardField('majorMoneyMove', moneyMoveMatch[1].trim());
      updated.push('majorMoneyMove');
      console.log('Scorecard updated: majorMoneyMove →', moneyMoveMatch[1].trim());
    }

    // "strategic move: ..."
    const strategicMatch = message.match(/strategic\s*move\s*:\s*(.+?)(?:\.|$)/i);
    if (strategicMatch) {
      await updateScorecardField('strategicMove', strategicMatch[1].trim());
      updated.push('strategicMove');
      console.log('Scorecard updated: strategicMove →', strategicMatch[1].trim());
    }

    // "focus blocks: 2h Temporal, 1h Finance, ..."
    const blocksMatch = message.match(/focus\s*blocks?\s*:\s*(.+)/i);
    if (blocksMatch) {
      const blocks = blocksMatch[1].split(/,|\n/).map(s => s.trim()).filter(Boolean);
      if (blocks.length > 0) {
        await updateScorecardField('focusBlocks', blocks);
        updated.push('focusBlocks');
        console.log('Scorecard updated: focusBlocks →', blocks);
      }
    }

    return { updated };
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
