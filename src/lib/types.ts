export interface Initiative {
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
}

export interface CashPosition {
  current: number;
  monthlyBurn: number;
  runway: number;
  pipelineTotal: number;
  heloc: number;
}