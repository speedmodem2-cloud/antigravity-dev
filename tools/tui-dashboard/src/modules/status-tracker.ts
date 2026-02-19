import { readFileSync, existsSync } from 'fs';
import { ACTIVE_AGENTS_PATH } from '../config.js';
import type { AgentStatus } from '../config.js';

export type { AgentStatus };

export interface AgentState {
  name: string;
  role: string;
  model: string;
  status: AgentStatus;
  lastActivity: Date;
  currentTask: string;
  logFile: string;
  phase?: number | string;
  isCompleted?: boolean;
  changedAt?: Date;
  isNew?: boolean;
}

interface RosterEntry {
  name: string;
  model: string;
  task: string;
  phase: number | string;
  status?: 'pending' | 'running' | 'completed' | 'error';
}

interface ActiveAgentEntry {
  name: string;
  model: string;
  task: string;
  status: 'running' | 'idle' | 'completed' | 'error' | 'pending';
}

interface ActiveAgentsFile {
  project: string;
  currentPhase?: number;
  roster?: RosterEntry[];
  agents: ActiveAgentEntry[];
  updatedAt?: string;
}

export class StatusTracker {
  private agents: Map<string, AgentState> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastContent = '';

  start(): void {
    this.loadActiveAgents();
    // Poll every 2s instead of relying on fs.watch (unreliable on Windows)
    this.pollInterval = setInterval(() => this.loadActiveAgents(), 2_000);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  private loadActiveAgents(): void {
    if (!existsSync(ACTIVE_AGENTS_PATH)) {
      if (this.agents.size > 0) this.agents.clear();
      this.lastContent = '';
      return;
    }

    try {
      const raw = readFileSync(ACTIVE_AGENTS_PATH, 'utf-8');
      // Skip parse if content unchanged
      if (raw === this.lastContent) return;
      this.lastContent = raw;

      const data: ActiveAgentsFile = JSON.parse(raw);
      const current = new Set<string>();
      const now = new Date();

      // Step 1: process data.agents (active agents take priority)
      for (const entry of data.agents ?? []) {
        const id = entry.name;
        current.add(id);

        const status: AgentStatus =
          entry.status === 'running' ? 'running' : entry.status === 'error' ? 'stuck' : 'idle';

        const existing = this.agents.get(id);
        if (existing) {
          existing.model = entry.model;
          existing.currentTask = entry.task;
          // If transitioning from running → completed, stamp lastActivity
          if (existing.status === 'running' && status !== 'running') {
            existing.lastActivity = now;
          } else if (status === 'running') {
            existing.lastActivity = now;
          }
          if (existing.status !== status) {
            existing.changedAt = now;
          }
          existing.status = status;
          existing.isNew = false;
          existing.isCompleted = false;
        } else {
          this.agents.set(id, {
            name: entry.name,
            role: id,
            model: entry.model,
            status,
            lastActivity: now,
            currentTask: entry.task,
            logFile: '',
            changedAt: now,
            isNew: true,
            isCompleted: false,
          });
        }
      }

      // Step 2: process roster — agents not yet in current set
      const rosterList = data.roster ?? [];
      for (const r of rosterList) {
        const id = r.name;
        if (current.has(id)) continue; // active agent takes priority

        const rosterStatus: AgentStatus =
          r.status === 'running' ? 'running' : r.status === 'completed' ? 'idle' : 'pending';

        const isCompleted = r.status === 'completed';

        const existing = this.agents.get(id);
        if (existing) {
          // Update phase/completed from roster if not overridden by active
          existing.phase = r.phase;
          existing.isCompleted = isCompleted;
          if (existing.status !== rosterStatus) {
            existing.status = rosterStatus;
            existing.changedAt = now;
          }
        } else {
          this.agents.set(id, {
            name: r.name,
            role: id,
            model: r.model,
            status: rosterStatus,
            lastActivity: now,
            currentTask: r.task,
            logFile: '',
            phase: r.phase,
            isCompleted,
            changedAt: now,
            isNew: false,
          });
        }
      }

      // Step 3: remove agents not in current (active) or roster
      const rosterNames = new Set(rosterList.map((r) => r.name));
      for (const key of this.agents.keys()) {
        if (!current.has(key) && !rosterNames.has(key)) {
          this.agents.delete(key);
        }
      }
    } catch {
      // ignore parse errors
    }
  }
}
