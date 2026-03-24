import { TaskManager } from './task-manager';
import { FinancialTracker } from './financial-tracker';
import { FocusTracker } from './focus-tracker';

export class ChatSyncManager {
  private taskManager: TaskManager;
  private financialTracker: FinancialTracker;
  private focusTracker: FocusTracker;

  private constructor(taskManager: TaskManager, financialTracker: FinancialTracker, focusTracker: FocusTracker) {
    this.taskManager = taskManager;
    this.financialTracker = financialTracker;
    this.focusTracker = focusTracker;
  }

  static async create(): Promise<ChatSyncManager> {
    const taskManager = await TaskManager.create();
    const financialTracker = await FinancialTracker.create();
    const focusTracker = await FocusTracker.create();
    return new ChatSyncManager(taskManager, financialTracker, focusTracker);
  }

  // Process conversational updates from main chat and sync to Mission Control
  async syncChatUpdate(message: string): Promise<{ updated: any[]; created: any[]; financial?: any; focusHours?: any }> {
    console.log('Syncing chat update:', message);

    // Process financial metrics first
    const financialResult = await this.financialTracker.processConversationalUpdate(message);

    // Process focus hours
    const focusResult = await this.focusTracker.processConversationalUpdate(message);

    const updates: any[] = [];
    const tasks = this.taskManager.getTasks();

    // Check for "Done: TASK_NAME" pattern
    const doneMatches = message.match(/Done\s*:?\s*([^.]+?)(?:\s*[-–]\s*(.+?))?(?:\.|$)/gi);
    if (doneMatches) {
      for (const match of doneMatches) {
        const taskTitle = match.replace(/^Done\s*:?\s*/i, '').split('-')[0].trim();
        console.log('Looking for completed task:', taskTitle);

        const matchingTask = this.findTaskByTitle(taskTitle);
        if (matchingTask) {
          const updatedTask = await this.taskManager.updateTaskStatus(matchingTask.id, 'Done');
          if (updatedTask) {
            updates.push(updatedTask);
            console.log('Updated task to Done:', updatedTask.title);
          }
        } else {
          console.log('No matching task found for:', taskTitle);
        }
      }
    }

    // Check for "In progress: TASK_NAME" pattern
    const progressMatches = message.match(/In progress\s*:?\s*([^.]+?)(?:\s*[-–]\s*(.+?))?(?:\.|$)/gi);
    if (progressMatches) {
      for (const match of progressMatches) {
        const taskTitle = match.replace(/^In progress\s*:?\s*/i, '').split('-')[0].trim();
        console.log('Looking for in-progress task:', taskTitle);

        const matchingTask = this.findTaskByTitle(taskTitle);
        if (matchingTask) {
          const updatedTask = await this.taskManager.updateTaskStatus(matchingTask.id, 'In Progress');
          if (updatedTask) {
            updates.push(updatedTask);
            console.log('Updated task to In Progress:', updatedTask.title);
          }
        } else {
          console.log('No matching task found for:', taskTitle);
        }
      }
    }

    // Extract any new tasks mentioned
    const created = await this.taskManager.processNaturalLanguageUpdate(message);

    return {
      updated: updates,
      created: created.created,
      financial: financialResult,
      focusHours: focusResult
    };
  }

  // Enhanced task matching with fuzzy logic
  private findTaskByTitle(title: string): any | null {
    const tasks = this.taskManager.getTasks();
    const titleLower = title.toLowerCase().trim();

    console.log('Searching for task:', titleLower);
    console.log('Available tasks:', tasks.map(t => t.title));

    // Try exact match first
    let match = tasks.find(t => t.title.toLowerCase() === titleLower);
    if (match) {
      console.log('Exact match found:', match.title);
      return match;
    }

    // Try partial match (task title contains search term)
    match = tasks.find(t => t.title.toLowerCase().includes(titleLower));
    if (match) {
      console.log('Partial match found:', match.title);
      return match;
    }

    // Try reverse partial match (search term contains task title words)
    match = tasks.find(t => {
      const taskWords = t.title.toLowerCase().split(' ');
      return taskWords.some(word => word.length > 2 && titleLower.includes(word));
    });
    if (match) {
      console.log('Reverse partial match found:', match.title);
      return match;
    }

    // Try keyword matching with common abbreviations
    const searchKeywords = titleLower.split(' ').filter(w => w.length > 2);
    match = tasks.find(t => {
      const taskKeywords = t.title.toLowerCase().split(' ').filter(w => w.length > 2);
      const commonWords = searchKeywords.filter(sk =>
        taskKeywords.some(tk => tk.includes(sk) || sk.includes(tk))
      );
      return commonWords.length >= Math.min(2, searchKeywords.length);
    });

    if (match) {
      console.log('Keyword match found:', match.title);
      return match;
    }

    // Try project-based matching for common terms
    const projectMatches = {
      'failed payment': tasks.filter(t => t.projectId?.toLowerCase().includes('finance') && t.title.toLowerCase().includes('payment')),
      'loan depot': tasks.filter(t => t.title.toLowerCase().includes('loan depot')),
      'pennymac': tasks.filter(t => t.title.toLowerCase().includes('pennymac')),
      'artis': tasks.filter(t => t.title.toLowerCase().includes('artis')),
      'temporal': tasks.filter(t => t.projectId?.toLowerCase().includes('temporal')),
      'taxes': tasks.filter(t => t.projectId?.toLowerCase().includes('tax')),
      'heloc': tasks.filter(t => t.projectId?.toLowerCase().includes('heloc'))
    };

    for (const [key, matchingTasks] of Object.entries(projectMatches)) {
      if (titleLower.includes(key) && matchingTasks.length > 0) {
        console.log(`Project match found for "${key}":`, matchingTasks[0].title);
        return matchingTasks[0];
      }
    }

    console.log('No match found for:', titleLower);
    return null;
  }
}