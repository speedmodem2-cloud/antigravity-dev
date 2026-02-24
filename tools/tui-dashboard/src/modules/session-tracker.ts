import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

export interface SessionTodo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

export interface SessionInfo {
  active: boolean;
  lastActivity: Date;
  currentTask: string;
  phaseTag: string;
  todos: SessionTodo[];
  completedCount: number;
  totalCount: number;
  sessionId: string;
  model?: string;
}

const CLAUDE_DIR = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.claude');
const TODOS_DIR = join(CLAUDE_DIR, 'todos');
const PROJECTS_CLAUDE_DIR = join(CLAUDE_DIR, 'projects');

function detectSessionModel(): string {
  try {
    if (!existsSync(PROJECTS_CLAUDE_DIR)) return '';
    let latestFile = '';
    let latestMtime = 0;
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
    if (!latestFile) return '';
    const content = readFileSync(latestFile, 'utf-8');
    const lines = content.split('\n').reverse();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const model = obj?.message?.model as string | undefined;
        if (model && typeof model === 'string' && model.startsWith('claude-')) return model;
      } catch {
        /* skip */
      }
    }
    return '';
  } catch {
    return '';
  }
}

/** Check JSONL modification time as activity signal (works even without TodoWrite) */
function getJsonlActivity(): { mtime: number; sessionId: string } | null {
  try {
    if (!existsSync(PROJECTS_CLAUDE_DIR)) return null;
    let latestFile = '';
    let latestMtime = 0;
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
    if (!latestFile || latestMtime === 0) return null;
    const fileName = latestFile.split(/[\\/]/).pop() ?? '';
    const sessionId = fileName.replace('.jsonl', '').slice(0, 8);
    return { mtime: latestMtime, sessionId };
  } catch {
    return null;
  }
}

function extractPhaseTag(content: string): string {
  const m = content.match(/Phase\s*(\d+)(?::\s*TASK\s*([\d-]+))?/i);
  if (m) {
    const phase = `P${m[1]}`;
    return m[2] ? `${phase}:T${m[2]}` : phase;
  }
  const m2 = content.match(/Phase\s*([\d-]+)/i);
  if (m2) return `P${m2[1]}`;
  return '';
}

export class SessionTracker {
  private activeThresholdMs = 300_000; // 5 min for todo-based
  private jsonlActiveThresholdMs = 120_000; // 2 min for JSONL-based

  getSession(): SessionInfo {
    const empty: SessionInfo = {
      active: false,
      lastActivity: new Date(0),
      currentTask: '-',
      phaseTag: '',
      todos: [],
      completedCount: 0,
      totalCount: 0,
      sessionId: '',
    };

    // Primary: todo-based tracking
    const todoResult = this.getFromTodos();

    // Secondary: JSONL activity (works even without TodoWrite)
    const jsonlActivity = getJsonlActivity();
    const jsonlIsActive = jsonlActivity
      ? Date.now() - jsonlActivity.mtime < this.jsonlActiveThresholdMs
      : false;

    // If todo data exists, use it but supplement with JSONL activity
    if (todoResult && todoResult.totalCount > 0) {
      if (!todoResult.active && jsonlIsActive) {
        todoResult.active = true;
        todoResult.lastActivity = new Date(jsonlActivity!.mtime);
      }
      todoResult.model = detectSessionModel();
      return todoResult;
    }

    // Fallback: no todos, but JSONL shows active
    if (jsonlIsActive && jsonlActivity) {
      return {
        active: true,
        lastActivity: new Date(jsonlActivity.mtime),
        currentTask: 'Working...',
        phaseTag: '',
        todos: [],
        completedCount: 0,
        totalCount: 0,
        sessionId: jsonlActivity.sessionId,
        model: detectSessionModel(),
      };
    }

    // JSONL exists but not active — show IDLE with session info
    if (jsonlActivity && Date.now() - jsonlActivity.mtime < this.activeThresholdMs) {
      return {
        active: false,
        lastActivity: new Date(jsonlActivity.mtime),
        currentTask: '-',
        phaseTag: '',
        todos: [],
        completedCount: 0,
        totalCount: 0,
        sessionId: jsonlActivity.sessionId,
        model: detectSessionModel(),
      };
    }

    return { ...empty, model: detectSessionModel() };
  }

  private getFromTodos(): SessionInfo | null {
    if (!existsSync(TODOS_DIR)) return null;

    try {
      const files = readdirSync(TODOS_DIR).filter((f: string) => f.endsWith('.json'));
      if (files.length === 0) return null;

      let latest = '';
      let latestMtime = 0;
      for (const file of files) {
        const fullPath = join(TODOS_DIR, file);
        const mtime = statSync(fullPath).mtimeMs;
        if (mtime > latestMtime) {
          latestMtime = mtime;
          latest = fullPath;
        }
      }

      if (!latest) return null;

      const todos: SessionTodo[] = JSON.parse(readFileSync(latest, 'utf-8'));
      if (!Array.isArray(todos)) return null;

      const lastActivity = new Date(latestMtime);
      const isActive = Date.now() - latestMtime < this.activeThresholdMs;

      const inProgress = todos.find((t) => t.status === 'in_progress');
      const hasWork = inProgress !== undefined;
      const completedCount = todos.filter((t) => t.status === 'completed').length;
      const phaseTag = inProgress ? extractPhaseTag(inProgress.content) : '';

      const fileName = latest.split(/[\\/]/).pop() ?? '';
      const sessionId = fileName.split('-agent-')[0]?.slice(0, 8) ?? '';

      return {
        active: isActive && hasWork,
        lastActivity,
        currentTask: inProgress?.activeForm ?? inProgress?.content ?? '-',
        phaseTag,
        todos,
        completedCount,
        totalCount: todos.length,
        sessionId,
      };
    } catch {
      return null;
    }
  }
}
