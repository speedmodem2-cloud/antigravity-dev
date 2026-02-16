import { watch, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

export type AgentStatus = 'running' | 'idle' | 'stuck' | 'offline';

export interface AgentState {
  name: string;
  status: AgentStatus;
  lastActivity: Date;
  currentTask: string;
  logFile: string;
}

interface StatusTrackerOptions {
  logDir: string;
  stuckThresholdMs: number;
  onStuck?: (agent: AgentState) => void;
}

const DEFAULT_OPTIONS: StatusTrackerOptions = {
  logDir: join(process.env.LOCALAPPDATA ?? '', 'AntiGravity', 'logs'),
  stuckThresholdMs: 120_000, // 2분
};

export class StatusTracker {
  private agents: Map<string, AgentState> = new Map();
  private watchers: ReturnType<typeof watch>[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private options: StatusTrackerOptions;

  constructor(options?: Partial<StatusTrackerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start(): void {
    this.scanLogFiles();
    this.checkInterval = setInterval(() => this.checkStuckAgents(), 10_000);
  }

  stop(): void {
    this.watchers.forEach((w) => w.close());
    this.watchers = [];
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  private scanLogFiles(): void {
    const { logDir } = this.options;
    if (!existsSync(logDir)) {
      this.addDemoAgents();
      return;
    }

    try {
      const watcher = watch(logDir, (_event, filename) => {
        if (filename?.endsWith('.log')) {
          this.updateAgentFromLog(join(logDir, filename));
        }
      });
      this.watchers.push(watcher);
    } catch {
      this.addDemoAgents();
    }
  }

  private addDemoAgents(): void {
    const now = new Date();
    this.agents.set('main', {
      name: 'Main Agent',
      status: 'running',
      lastActivity: now,
      currentTask: 'PHASE 03 구현 중',
      logFile: 'demo',
    });
    this.agents.set('sub-1', {
      name: 'Sub Agent 1',
      status: 'idle',
      lastActivity: new Date(now.getTime() - 30_000),
      currentTask: '대기 중',
      logFile: 'demo',
    });
    this.agents.set('sub-2', {
      name: 'Sub Agent 2',
      status: 'idle',
      lastActivity: new Date(now.getTime() - 60_000),
      currentTask: '대기 중',
      logFile: 'demo',
    });
  }

  private updateAgentFromLog(logPath: string): void {
    try {
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const lastLine = lines[lines.length - 1] ?? '';
      const agentName = logPath.split(/[\\/]/).pop()?.replace('.log', '') ?? 'unknown';

      this.agents.set(agentName, {
        name: agentName,
        status: 'running',
        lastActivity: new Date(),
        currentTask: lastLine.slice(0, 50),
        logFile: logPath,
      });
    } catch {
      // 파일 접근 실패 시 무시
    }
  }

  private checkStuckAgents(): void {
    const now = Date.now();
    for (const agent of this.agents.values()) {
      const elapsed = now - agent.lastActivity.getTime();
      if (agent.status === 'running' && elapsed > this.options.stuckThresholdMs) {
        agent.status = 'stuck';
        this.options.onStuck?.(agent);
        this.sendNotification(agent);
      }
    }
  }

  private sendNotification(agent: AgentState): void {
    if (process.platform === 'win32') {
      const msg = `에이전트 "${agent.name}" 이(가) ${Math.round((Date.now() - agent.lastActivity.getTime()) / 1000)}초 동안 응답 없음`;
      exec(
        `powershell.exe -Command "New-BurntToastNotification -Text 'AG Dashboard', '${msg}'" 2>nul`,
      );
    }
  }
}
