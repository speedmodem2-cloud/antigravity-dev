import { existsSync, readFileSync, watchFile, unwatchFile } from 'fs';
import { modelCost, MODEL_COSTS } from '../config.js';

export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  timestamp: Date;
  sessionId: string;
}

export interface TokenDelta {
  model: string;
  inputDelta: number;
  outputDelta: number;
  totalDelta: number;
}

export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalTokens: number;
  costEstimate: number;
  byModel: Map<string, { input: number; output: number; total: number; cost: number }>;
  bySession: Map<string, { input: number; output: number; total: number }>;
  deltas: Map<string, TokenDelta>;
  history: TokenUsage[];
  isDemo: boolean;
}

export class TokenTracker {
  private usages: TokenUsage[] = [];
  private isDemo = true;
  private previousByModel: Map<string, number> = new Map();
  private currentDeltas: Map<string, TokenDelta> = new Map();
  private watchedPath: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private projectStartedAt: Date | null = null;
  private projectEndedAt: Date | null = null;

  addUsage(usage: TokenUsage): void {
    this.usages.push(usage);
  }

  setTimeWindow(startedAt?: string | null, endedAt?: string | null): void {
    this.projectStartedAt = startedAt ? new Date(startedAt) : null;
    this.projectEndedAt = endedAt ? new Date(endedAt) : null;
  }

  loadFromFile(filePath: string): { loaded: boolean; recordCount: number } {
    if (!existsSync(filePath)) {
      return { loaded: false, recordCount: 0 };
    }

    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      this.isDemo = false;
      const records: unknown[] = raw.records ?? raw.data ?? [];
      if (!Array.isArray(records) || records.length === 0) {
        this.usages = [];
        return { loaded: true, recordCount: 0 };
      }

      this.usages = records.map((rec: unknown) => {
        const r = rec as Record<string, unknown>;
        const inputTokens = (r['inputTokens'] ?? r['input_tokens'] ?? 0) as number;
        const outputTokens = (r['outputTokens'] ?? r['output_tokens'] ?? 0) as number;
        return {
          model: (r['model'] ?? 'unknown') as string,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          timestamp: new Date((r['timestamp'] ?? Date.now()) as string | number),
          sessionId: (r['session'] ?? r['sessionId'] ?? 'default') as string,
        };
      });

      this.isDemo = false;
      return { loaded: true, recordCount: this.usages.length };
    } catch {
      return { loaded: false, recordCount: 0 };
    }
  }

  watchFileForUpdates(filePath: string): void {
    if (this.watchedPath) {
      unwatchFile(this.watchedPath);
    }
    this.watchedPath = filePath;

    watchFile(filePath, { interval: 2_000 }, () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.loadFromFile(filePath);
      }, 500);
    });
  }

  stopWatching(): void {
    if (this.watchedPath) {
      unwatchFile(this.watchedPath);
      this.watchedPath = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  getSummary(): TokenSummary {
    // Filter by project time window
    let filtered = this.usages;
    if (this.projectStartedAt) {
      filtered = filtered.filter((u) => u.timestamp >= this.projectStartedAt!);
    }
    if (this.projectEndedAt) {
      filtered = filtered.filter((u) => u.timestamp <= this.projectEndedAt!);
    }

    const byModel = new Map<
      string,
      { input: number; output: number; total: number; cost: number }
    >();
    const bySession = new Map<string, { input: number; output: number; total: number }>();
    let totalInput = 0;
    let totalOutput = 0;
    let costEstimate = 0;

    for (const usage of filtered) {
      totalInput += usage.inputTokens;
      totalOutput += usage.outputTokens;

      const modelEntry = byModel.get(usage.model) ?? { input: 0, output: 0, total: 0, cost: 0 };
      modelEntry.input += usage.inputTokens;
      modelEntry.output += usage.outputTokens;
      modelEntry.total += usage.totalTokens;

      const rates = modelCost(usage.model);
      const cost = usage.inputTokens * rates.input + usage.outputTokens * rates.output;
      modelEntry.cost += cost;
      costEstimate += cost;
      byModel.set(usage.model, modelEntry);

      const sessionEntry = bySession.get(usage.sessionId) ?? { input: 0, output: 0, total: 0 };
      sessionEntry.input += usage.inputTokens;
      sessionEntry.output += usage.outputTokens;
      sessionEntry.total += usage.totalTokens;
      bySession.set(usage.sessionId, sessionEntry);
    }

    this.currentDeltas = new Map();
    for (const [model, data] of byModel) {
      const prev = this.previousByModel.get(model) ?? 0;
      const totalDelta = data.total - prev;
      if (totalDelta !== 0) {
        this.currentDeltas.set(model, {
          model,
          inputDelta: data.input - (this.previousByModel.get(`${model}:in`) ?? 0),
          outputDelta: data.output - (this.previousByModel.get(`${model}:out`) ?? 0),
          totalDelta,
        });
      }
    }

    for (const [model, data] of byModel) {
      this.previousByModel.set(model, data.total);
      this.previousByModel.set(`${model}:in`, data.input);
      this.previousByModel.set(`${model}:out`, data.output);
    }

    return {
      totalInput,
      totalOutput,
      totalTokens: totalInput + totalOutput,
      costEstimate,
      byModel,
      bySession,
      deltas: this.currentDeltas,
      history: filtered.slice(-50),
      isDemo: this.isDemo,
    };
  }

  addDemoData(): void {
    const models = Object.keys(MODEL_COSTS);
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
      const model = models[i % models.length]!;
      const inputTokens = Math.floor(Math.random() * 5000) + 500;
      const outputTokens = Math.floor(Math.random() * 2000) + 200;
      this.addUsage({
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        timestamp: new Date(now - (20 - i) * 300_000),
        sessionId: `session-${Math.floor(i / 5) + 1}`,
      });
    }
    this.isDemo = true;
  }
}
