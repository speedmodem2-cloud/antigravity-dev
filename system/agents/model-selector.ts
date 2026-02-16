/**
 * 모델 선택 로직
 * 태스크 유형/복잡도에 따라 최적 모델을 자동 선택
 */

export type ModelTier = 'top' | 'high' | 'mid' | 'low';

export interface ModelConfig {
  id: string;
  tier: ModelTier;
  costPer1kInput: number;
  costPer1kOutput: number;
  maxContext: number;
  strengths: string[];
}

export const MODELS: Record<string, ModelConfig> = {
  'claude-opus-4.6': {
    id: 'claude-opus-4.6',
    tier: 'top',
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    maxContext: 200000,
    strengths: ['architecture', 'reasoning', 'multi-file', 'refactoring'],
  },
  'gemini-3-pro': {
    id: 'gemini-3-pro',
    tier: 'high',
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
    maxContext: 1000000,
    strengths: ['coding', 'review', 'long-context', 'fast'],
  },
  'claude-sonnet-4.5': {
    id: 'claude-sonnet-4.5',
    tier: 'high',
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    maxContext: 200000,
    strengths: ['coding', 'testing', 'implementation'],
  },
  'claude-haiku-4.5': {
    id: 'claude-haiku-4.5',
    tier: 'mid',
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    maxContext: 200000,
    strengths: ['docs', 'simple-tasks', 'formatting'],
  },
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    tier: 'mid',
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
    maxContext: 1000000,
    strengths: ['parsing', 'simple-tasks', 'fast', 'cheap'],
  },
};

export type TaskType =
  | 'architecture'
  | 'implementation'
  | 'review'
  | 'testing'
  | 'documentation'
  | 'refactoring'
  | 'debugging'
  | 'parsing'
  | 'formatting';

export type TaskComplexity = 'high' | 'medium' | 'low';

interface TaskProfile {
  type: TaskType;
  complexity: TaskComplexity;
  estimatedTokens?: number;
  requiresLongContext?: boolean;
}

const TASK_TO_TIER: Record<TaskType, Record<TaskComplexity, ModelTier>> = {
  architecture: { high: 'top', medium: 'top', low: 'high' },
  implementation: { high: 'top', medium: 'high', low: 'high' },
  review: { high: 'top', medium: 'high', low: 'mid' },
  testing: { high: 'high', medium: 'high', low: 'mid' },
  documentation: { high: 'high', medium: 'mid', low: 'mid' },
  refactoring: { high: 'top', medium: 'high', low: 'high' },
  debugging: { high: 'top', medium: 'high', low: 'high' },
  parsing: { high: 'mid', medium: 'low', low: 'low' },
  formatting: { high: 'mid', medium: 'low', low: 'low' },
};

/**
 * 태스크 프로필에 따라 최적 모델 선택
 */
export function selectModel(task: TaskProfile): ModelConfig {
  const targetTier = TASK_TO_TIER[task.type][task.complexity];
  const candidates = Object.values(MODELS).filter((m) => m.tier === targetTier);

  if (task.requiresLongContext) {
    const longCtx = candidates.find((m) => m.maxContext >= 500000);
    if (longCtx) return longCtx;
  }

  // 같은 티어 내에서 비용이 낮은 모델 우선
  candidates.sort((a, b) => a.costPer1kInput - b.costPer1kInput);
  return candidates[0] ?? Object.values(MODELS)[0];
}

/**
 * 에이전트 ID로 기본 모델 반환
 */
export function getAgentModel(agentId: string): ModelConfig {
  const agentDefaults: Record<string, TaskProfile> = {
    architect: { type: 'architecture', complexity: 'high' },
    developer: { type: 'implementation', complexity: 'medium' },
    reviewer: { type: 'review', complexity: 'medium' },
    documenter: { type: 'documentation', complexity: 'low' },
    tester: { type: 'testing', complexity: 'medium' },
  };

  const profile = agentDefaults[agentId];
  if (!profile) return MODELS['claude-sonnet-4.5'];
  return selectModel(profile);
}
