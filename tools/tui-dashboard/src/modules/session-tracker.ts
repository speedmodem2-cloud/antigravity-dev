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
}

const CLAUDE_DIR = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.claude');
const TODOS_DIR = join(CLAUDE_DIR, 'todos');

function extractPhaseTag(content: string): string {
  // "Phase 3: TASK 10-12 (레이아웃+히어로+파티클)" → "P3:TASK 10-12"
  const m = content.match(/Phase\s*(\d+)(?::\s*TASK\s*([\d-]+))?/i);
  if (m) {
    const phase = `P${m[1]}`;
    return m[2] ? `${phase}:T${m[2]}` : phase;
  }
  // "Phase 4-5: 리뷰 + 테스트" → "P4-5"
  const m2 = content.match(/Phase\s*([\d-]+)/i);
  if (m2) return `P${m2[1]}`;
  return '';
}

export class SessionTracker {
  private activeThresholdMs = 300_000;

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

    if (!existsSync(TODOS_DIR)) return empty;

    try {
      const files = readdirSync(TODOS_DIR).filter((f: string) => f.endsWith('.json'));
      if (files.length === 0) return empty;

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

      if (!latest) return empty;

      const todos: SessionTodo[] = JSON.parse(readFileSync(latest, 'utf-8'));
      if (!Array.isArray(todos)) return empty;

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
      return empty;
    }
  }
}
