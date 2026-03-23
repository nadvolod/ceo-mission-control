import { Task, Initiative } from './types';

export type MissionRelevance = 'Mission Critical' | 'Supporting' | 'Neutral' | 'Distraction';

export interface MissionEvaluation {
  relevance: MissionRelevance;
  reasoning: string;
  monthlyRevenueImpact?: number;
  aiLeverageScore?: number; // 1-10 scale
  teamScalingImpact?: 'Positive' | 'Neutral' | 'Negative';
}

export class MissionEvaluator {
  private static readonly MISSION_TARGET = 1000000; // $1M/month
  private static readonly MAX_TEAM_SIZE = 5;

  static evaluateTask(task: Task): MissionEvaluation {
    const title = task.title.toLowerCase();
    const description = task.description?.toLowerCase() || '';
    const project = task.projectId?.toLowerCase() || '';

    // Mission Critical - Directly advances $1M/month goal
    if (this.isMissionCritical(title, description, project)) {
      return {
        relevance: 'Mission Critical',
        reasoning: 'Directly advances revenue, AI leverage, or core business capabilities',
        monthlyRevenueImpact: this.estimateRevenueImpact(task),
        aiLeverageScore: this.assessAILeverage(task),
        teamScalingImpact: this.assessTeamScaling(task)
      };
    }

    // Supporting - Enables mission progress
    if (this.isSupporting(title, description, project)) {
      return {
        relevance: 'Supporting',
        reasoning: 'Enables mission progress but not directly revenue-generating',
        teamScalingImpact: this.assessTeamScaling(task)
      };
    }

    // Potential Distraction - Doesn't advance mission
    if (this.isPotentialDistraction(title, description, project)) {
      return {
        relevance: 'Distraction',
        reasoning: 'May consume resources without advancing $1M/month goal',
        teamScalingImpact: 'Negative'
      };
    }

    return {
      relevance: 'Neutral',
      reasoning: 'Impact on mission unclear - needs evaluation',
    };
  }

  static evaluateInitiative(initiative: Initiative): MissionEvaluation {
    const name = initiative.name.toLowerCase();
    const goal = initiative.goal?.toLowerCase() || '';

    // Check for direct revenue initiatives
    if (name.includes('temporal') || goal.includes('revenue')) {
      return {
        relevance: 'Mission Critical',
        reasoning: 'Core revenue stream toward $1M/month target',
        monthlyRevenueImpact: this.extractRevenueFromGoal(initiative.goal),
        aiLeverageScore: 8 // Temporal likely involves tech/AI
      };
    }

    // Financial infrastructure
    if (name.includes('heloc') || name.includes('finance') || goal.includes('cash')) {
      return {
        relevance: 'Supporting',
        reasoning: 'Financial infrastructure enables mission execution',
        teamScalingImpact: 'Positive'
      };
    }

    return {
      relevance: 'Neutral',
      reasoning: 'Needs evaluation against $1M/month goal'
    };
  }

  private static isMissionCritical(title: string, description: string, project: string): boolean {
    const criticalKeywords = [
      'temporal', 'revenue', 'client', 'ai', 'automation', 'scale', 'leverage',
      'product', 'sales', 'growth', 'money', 'business', 'profit'
    ];
    
    const content = `${title} ${description} ${project}`;
    return criticalKeywords.some(keyword => content.includes(keyword));
  }

  private static isSupporting(title: string, description: string, project: string): boolean {
    const supportingKeywords = [
      'infrastructure', 'system', 'process', 'legal', 'finance', 'tax',
      'admin', 'setup', 'planning', 'organization'
    ];
    
    const content = `${title} ${description} ${project}`;
    return supportingKeywords.some(keyword => content.includes(keyword));
  }

  private static isPotentialDistraction(title: string, description: string, project: string): boolean {
    const distractionKeywords = [
      'personal', 'entertainment', 'social', 'hobby', 'optional',
      'nice to have', 'someday', 'exploration'
    ];
    
    const content = `${title} ${description} ${project}`;
    return distractionKeywords.some(keyword => content.includes(keyword));
  }

  private static estimateRevenueImpact(task: Task): number {
    const title = task.title.toLowerCase();
    
    // Pattern matching for revenue amounts
    const dollarMatch = title.match(/\$(\d+)k?/);
    if (dollarMatch) {
      const amount = parseInt(dollarMatch[1]);
      return title.includes('k') ? amount * 1000 : amount;
    }

    // Project-based estimates
    if (task.projectId?.toLowerCase().includes('temporal')) return 10000; // $10K/month
    if (title.includes('client') || title.includes('revenue')) return 5000;
    
    return 0;
  }

  private static assessAILeverage(task: Task): number {
    const title = task.title.toLowerCase();
    const description = task.description?.toLowerCase() || '';
    const content = `${title} ${description}`;

    if (content.includes('ai') || content.includes('automation')) return 9;
    if (content.includes('system') || content.includes('process')) return 7;
    if (content.includes('manual') || content.includes('personal')) return 2;
    
    return 5; // Neutral
  }

  private static assessTeamScaling(task: Task): 'Positive' | 'Neutral' | 'Negative' {
    const title = task.title.toLowerCase();
    const description = task.description?.toLowerCase() || '';
    const content = `${title} ${description}`;

    if (content.includes('automation') || content.includes('system') || content.includes('process')) {
      return 'Positive'; // Reduces need for additional team members
    }
    
    if (content.includes('manual') || content.includes('personal')) {
      return 'Negative'; // Requires more people
    }

    return 'Neutral';
  }

  private static extractRevenueFromGoal(goal?: string): number {
    if (!goal) return 0;
    
    const dollarMatch = goal.match(/\$(\d+(?:,\d{3})*)/);
    if (dollarMatch) {
      return parseInt(dollarMatch[1].replace(/,/g, ''));
    }
    
    return 0;
  }

  // Strategic questions for any new opportunity
  static getMissionQuestions(): string[] {
    return [
      'Does this directly increase monthly revenue?',
      'Does this leverage AI to multiply output per person?',
      'Can this scale without adding more people?',
      'Is this the highest ROI use of time toward $1M/month?',
      'Does this build reusable systems vs. one-off work?',
      'Will this still matter when we hit $1M/month?'
    ];
  }

  // Get current mission gaps that need addressing
  static getMissionGaps(currentMRR: number, teamSize: number): string[] {
    const gaps: string[] = [];
    
    if (currentMRR < 100000) {
      gaps.push('Need to establish first $100K MRR milestone');
    }
    
    if (currentMRR < 500000) {
      gaps.push('Need AI automation systems for scale without team growth');
    }
    
    if (teamSize === 1) {
      gaps.push('Need to identify first strategic hire');
    }
    
    gaps.push('Need real-time revenue and AI leverage tracking');
    gaps.push('Need systematic evaluation of all opportunities against mission');
    
    return gaps;
  }
}