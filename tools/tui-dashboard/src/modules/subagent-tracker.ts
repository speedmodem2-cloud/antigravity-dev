import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import type { AgentState } from './status-tracker.js';

const CLAUDE_DIR = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.claude');
const PROJECTS_CLAUDE_DIR = join(CLAUDE_DIR, 'projects');

interface TaskCall {
  toolUseId: string;
  description: string;
  model: string;
  subagentType: string;
  startedAt: Date;
  completed: boolean;
  completedAt?: Date;
}

export class SubagentTracker {
  private tasks: Map<string, TaskCall> = new Map();
  private lastFileSize = 0;
  private lastFilePath = '';
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.scan();
    this.pollInterval = setInterval(() => this.scan(), 2_000);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getSubagents(): AgentState[] {
    const now = new Date();
    const result: AgentState[] = [];

    for (const task of this.tasks.values()) {
      // Only show tasks from last 10 minutes (cleanup stale)
      const age = now.getTime() - task.startedAt.getTime();
      if (age > 600_000 && task.completed) continue;

      const status = task.completed ? 'idle' : 'running';
      result.push({
        name: task.description.slice(0, 30),
        role: `subagent-${task.toolUseId}`,
        model: normalizeModel(task.model),
        status,
        lastActivity: task.completed ? (task.completedAt ?? now) : now,
        currentTask: task.description,
        logFile: '',
        isCompleted: task.completed,
        changedAt: task.completed ? task.completedAt : task.startedAt,
        isNew: false,
      });
    }

    return result;
  }

  private scan(): void {
    const latestFile = findLatestJsonl();
    if (!latestFile) return;

    try {
      const stat = statSync(latestFile);
      if (latestFile === this.lastFilePath && stat.size === this.lastFileSize) return;

      // If file changed, read only new content
      const content = readFileSync(latestFile, 'utf-8');
      const lines = content.split('\n');

      // Reset if different file
      if (latestFile !== this.lastFilePath) {
        this.tasks.clear();
        this.lastFilePath = latestFile;
      }

      this.lastFileSize = stat.size;
      this.parseLines(lines);
    } catch {
      // ignore
    }
  }

  private parseLines(lines: string[]): void {
    const pendingToolUseIds = new Set<string>();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        this.processEntry(obj, pendingToolUseIds);
      } catch {
        // skip malformed lines
      }
    }
  }

  private processEntry(obj: Record<string, unknown>, _pending: Set<string>): void {
    // Detect Task tool_use in assistant messages
    const msg = obj.message as Record<string, unknown> | undefined;
    if (!msg) return;

    const content = msg.content as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      // Task tool_use call
      if (block.type === 'tool_use' && block.name === 'Task') {
        const input = block.input as Record<string, unknown> | undefined;
        if (!input) continue;

        const id = block.id as string;
        const description = (input.description as string) ?? 'Subagent';
        const model = (input.model as string) ?? (input.subagent_type as string) ?? 'sonnet';
        const subagentType = (input.subagent_type as string) ?? 'general';

        if (!this.tasks.has(id)) {
          this.tasks.set(id, {
            toolUseId: id,
            description,
            model,
            subagentType,
            startedAt: new Date((obj.timestamp as string) ?? Date.now()),
            completed: false,
          });
        }
      }

      // Task tool_result (completion)
      if (block.type === 'tool_result') {
        const toolUseId = block.tool_use_id as string;
        if (toolUseId && this.tasks.has(toolUseId)) {
          const task = this.tasks.get(toolUseId)!;
          task.completed = true;
          task.completedAt = new Date((obj.timestamp as string) ?? Date.now());
        }
      }
    }

    // Also check top-level tool_result in user messages (Claude Code sends results this way)
    if (obj.type === 'user' && msg.role === 'user') {
      const userContent = msg.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(userContent)) return;

      for (const block of userContent) {
        if (block.type === 'tool_result') {
          const toolUseId = block.tool_use_id as string;
          if (toolUseId && this.tasks.has(toolUseId)) {
            const task = this.tasks.get(toolUseId)!;
            task.completed = true;
            task.completedAt = new Date((obj.timestamp as string) ?? Date.now());
          }
        }
      }
    }
  }
}

function normalizeModel(model: string): string {
  if (model === 'opus') return 'claude-opus-4-6';
  if (model === 'sonnet') return 'claude-sonnet-4-5';
  if (model === 'haiku') return 'claude-haiku-4-5';
  return model;
}

function findLatestJsonl(): string | null {
  if (!existsSync(PROJECTS_CLAUDE_DIR)) return null;

  let latestFile = '';
  let latestMtime = 0;

  try {
    const projectDirs = readdirSync(PROJECTS_CLAUDE_DIR);
    for (const dir of projectDirs) {
      const dirPath = join(PROJECTS_CLAUDE_DIR, dir);
      try {
        const stat = statSync(dirPath);
        if (!stat.isDirectory()) {
          if (dir.endsWith('.jsonl') && stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestFile = dirPath;
          }
          continue;
        }
        const files = readdirSync(dirPath).filter((f: string) => f.endsWith('.jsonl'));
        for (const f of files) {
          const fp = join(dirPath, f);
          const ms = statSync(fp).mtimeMs;
          if (ms > latestMtime) {
            latestMtime = ms;
            latestFile = fp;
          }
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    return null;
  }

  return latestFile || null;
}
