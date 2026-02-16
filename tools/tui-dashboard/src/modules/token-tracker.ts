export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  timestamp: Date;
  sessionId: string;
}

export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalTokens: number;
  costEstimate: number;
  byModel: Map<string, { input: number; output: number; total: number; cost: number }>;
  bySession: Map<string, { input: number; output: number; total: number }>;
  history: TokenUsage[];
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4.6': { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
  'claude-sonnet-4.5': { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  'claude-haiku-4.5': { input: 0.8 / 1_000_000, output: 4.0 / 1_000_000 },
  'gemini-3-pro': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  default: { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
};

export class TokenTracker {
  private usages: TokenUsage[] = [];

  addUsage(usage: TokenUsage): void {
    this.usages.push(usage);
  }

  getSummary(): TokenSummary {
    const byModel = new Map<
      string,
      { input: number; output: number; total: number; cost: number }
    >();
    const bySession = new Map<string, { input: number; output: number; total: number }>();
    let totalInput = 0;
    let totalOutput = 0;
    let costEstimate = 0;

    for (const usage of this.usages) {
      totalInput += usage.inputTokens;
      totalOutput += usage.outputTokens;

      // 모델별 집계
      const modelEntry = byModel.get(usage.model) ?? { input: 0, output: 0, total: 0, cost: 0 };
      modelEntry.input += usage.inputTokens;
      modelEntry.output += usage.outputTokens;
      modelEntry.total += usage.totalTokens;

      const rates = MODEL_COSTS[usage.model] ?? MODEL_COSTS['default']!;
      const cost = usage.inputTokens * rates.input + usage.outputTokens * rates.output;
      modelEntry.cost += cost;
      costEstimate += cost;
      byModel.set(usage.model, modelEntry);

      // 세션별 집계
      const sessionEntry = bySession.get(usage.sessionId) ?? { input: 0, output: 0, total: 0 };
      sessionEntry.input += usage.inputTokens;
      sessionEntry.output += usage.outputTokens;
      sessionEntry.total += usage.totalTokens;
      bySession.set(usage.sessionId, sessionEntry);
    }

    return {
      totalInput,
      totalOutput,
      totalTokens: totalInput + totalOutput,
      costEstimate,
      byModel,
      bySession,
      history: this.usages.slice(-50),
    };
  }

  addDemoData(): void {
    const models = ['claude-opus-4.6', 'claude-sonnet-4.5', 'gemini-3-pro'];
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
      const model = models[i % models.length]!;
      this.addUsage({
        model,
        inputTokens: Math.floor(Math.random() * 5000) + 500,
        outputTokens: Math.floor(Math.random() * 2000) + 200,
        totalTokens: 0,
        timestamp: new Date(now - (20 - i) * 300_000),
        sessionId: `session-${Math.floor(i / 5) + 1}`,
      });
      // totalTokens 보정
      const last = this.usages[this.usages.length - 1]!;
      last.totalTokens = last.inputTokens + last.outputTokens;
    }
  }
}
