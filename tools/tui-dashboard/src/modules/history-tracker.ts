import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { WORK_HISTORY_PATH } from '../config.js';

export interface WorkHistoryEntry {
  id: string;
  project: string;
  type: 'wave' | 'adhoc';
  wave?: number;
  agentName: string;
  agentModel: string;
  task: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
}

interface WorkHistoryFile {
  version: 1;
  entries: WorkHistoryEntry[];
  lastCleanup?: string;
}

const ADHOC_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const WAVE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_ENTRIES = 1000;
const SAVE_DEBOUNCE_MS = 5000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class HistoryTracker {
  private entries: WorkHistoryEntry[] = [];
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private lastCleanup?: string;
  private knownIds = new Set<string>();

  start(): void {
    this.loadFromFile();
    this.autoCleanup();
    this.cleanupTimer = setInterval(() => this.autoCleanup(), CLEANUP_INTERVAL_MS);
  }

  stop(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.dirty) this.saveNow();
  }

  private loadFromFile(): void {
    try {
      if (!existsSync(WORK_HISTORY_PATH)) {
        this.entries = [];
        return;
      }
      const raw = JSON.parse(readFileSync(WORK_HISTORY_PATH, 'utf-8')) as WorkHistoryFile;
      this.entries = raw.entries ?? [];
      this.lastCleanup = raw.lastCleanup;
      this.knownIds = new Set(this.entries.map((e) => e.id));
    } catch {
      // Corrupted file — backup and start fresh
      try {
        copyFileSync(WORK_HISTORY_PATH, WORK_HISTORY_PATH + '.bak');
      } catch {
        /* ignore */
      }
      this.entries = [];
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveNow();
      this.saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
  }

  private saveNow(): void {
    try {
      const data: WorkHistoryFile = {
        version: 1,
        entries: this.entries,
        lastCleanup: this.lastCleanup,
      };
      writeFileSync(WORK_HISTORY_PATH, JSON.stringify(data, null, 2) + '\n');
      this.dirty = false;
    } catch {
      /* ignore write errors */
    }
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // --- Record methods ---

  recordWaveAgent(
    project: string,
    wave: number,
    agentName: string,
    model: string,
    task: string,
  ): void {
    const existingId = `wave-${project}-${wave}-${agentName}`;
    if (this.knownIds.has(existingId)) {
      // Update existing entry status
      const entry = this.entries.find((e) => e.id === existingId);
      if (entry && entry.status !== 'completed') {
        entry.status = 'running';
        this.scheduleSave();
      }
      return;
    }

    this.entries.push({
      id: existingId,
      project,
      type: 'wave',
      wave,
      agentName,
      agentModel: model,
      task,
      startedAt: new Date().toISOString(),
      status: 'running',
    });
    this.knownIds.add(existingId);
    this.scheduleSave();
  }

  completeWaveAgent(project: string, wave: number, agentName: string): void {
    const id = `wave-${project}-${wave}-${agentName}`;
    const entry = this.entries.find((e) => e.id === id);
    if (entry && entry.status !== 'completed') {
      entry.status = 'completed';
      entry.completedAt = new Date().toISOString();
      this.scheduleSave();
    }
  }

  recordAdHocTask(project: string, task: string, model: string, sessionId?: string): void {
    // Deduplicate by task content within same project
    const existingId = `adhoc-${project}-${task.slice(0, 60).replace(/\s+/g, '-')}`;
    if (this.knownIds.has(existingId)) {
      const entry = this.entries.find((e) => e.id === existingId);
      if (entry && entry.status === 'running') return; // already tracking
      if (entry && entry.status === 'completed') return; // already done
    }

    this.entries.push({
      id: existingId,
      project,
      type: 'adhoc',
      agentName: sessionId ?? 'session',
      agentModel: model,
      task,
      startedAt: new Date().toISOString(),
      status: 'running',
    });
    this.knownIds.add(existingId);
    this.scheduleSave();
  }

  completeAdHocTask(project: string, task: string): void {
    const id = `adhoc-${project}-${task.slice(0, 60).replace(/\s+/g, '-')}`;
    const entry = this.entries.find((e) => e.id === id);
    if (entry && entry.status !== 'completed') {
      entry.status = 'completed';
      entry.completedAt = new Date().toISOString();
      this.scheduleSave();
    }
  }

  // Mark all running adhoc tasks as completed for a project
  completeAllRunning(project: string): void {
    let changed = false;
    for (const entry of this.entries) {
      if (entry.project === project && entry.status === 'running') {
        entry.status = 'completed';
        entry.completedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
  }

  // --- Query methods ---

  getHistoryForProject(project: string, limit = 20): WorkHistoryEntry[] {
    return this.entries
      .filter((e) => e.project === project)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  getAllHistory(limit = 50): WorkHistoryEntry[] {
    return this.entries
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  hasEntry(id: string): boolean {
    return this.knownIds.has(id);
  }

  // --- Cleanup ---

  private autoCleanup(): void {
    const now = Date.now();

    // Skip if cleaned up less than 24h ago
    if (this.lastCleanup) {
      const elapsed = now - new Date(this.lastCleanup).getTime();
      if (elapsed < CLEANUP_INTERVAL_MS) return;
    }

    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => {
      if (entry.status === 'running') return true; // keep running
      if (!entry.completedAt) return true;
      const age = now - new Date(entry.completedAt).getTime();
      return entry.type === 'wave' ? age < WAVE_RETENTION_MS : age < ADHOC_RETENTION_MS;
    });

    // Enforce max entries
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }

    this.knownIds = new Set(this.entries.map((e) => e.id));
    this.lastCleanup = new Date().toISOString();

    if (this.entries.length !== before) {
      this.saveNow();
    }
  }
}
