/* eslint-disable no-console */
/**
 * Phase State Manager
 * CLI: tsx src/index.ts <command> [args]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_ROOT = resolve(__dirname, '../../..');
const STATE_PATH = resolve(DEV_ROOT, 'logs/phase-state.json');
const PROJECTS_PATH = resolve(DEV_ROOT, 'system/projects.json');

interface PhaseState {
  project: string;
  currentPhase: number;
  completedPhases: number[];
  updatedAt: string;
}

const PHASE_NAMES: Record<number, string> = {
  0: 'Pre-check',
  1: 'Design',
  2: 'Assets',
  3: 'Implementation',
  4: 'Review',
  5: 'Test',
  6: 'Documentation',
  7: 'Deploy',
};

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function load(): PhaseState | null {
  if (!existsSync(STATE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as PhaseState;
  } catch {
    return null;
  }
}

function requireState(): PhaseState {
  const state = load();
  if (!state) {
    console.error('No active project. Run: init <project>');
    process.exit(1);
  }
  return state;
}

function save(state: PhaseState): void {
  state.updatedAt = new Date().toISOString();
  ensureDir(STATE_PATH);
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
  console.log(`[phase] Saved → Phase ${state.currentPhase} (${PHASE_NAMES[state.currentPhase]})`);
}

function updateProjectsJson(project: string, status: 'active' | 'completed'): void {
  let data: { projects: Array<Record<string, string>> } = { projects: [] };
  if (existsSync(PROJECTS_PATH)) {
    try {
      data = JSON.parse(readFileSync(PROJECTS_PATH, 'utf-8'));
    } catch {
      /* use default */
    }
  }

  const today = new Date().toISOString().split('T')[0] ?? '';
  const existing = data.projects.find((p) => p.name === project);
  if (existing) {
    existing.status = status;
    if (status === 'completed') existing.completedAt = today;
  } else {
    data.projects.push({
      name: project,
      status,
      path: `workspace/${project}`,
      startedAt: today,
    });
  }

  ensureDir(PROJECTS_PATH);
  writeFileSync(PROJECTS_PATH, JSON.stringify(data, null, 2) + '\n');
}

// --- Commands ---

function init(project: string): void {
  const state: PhaseState = {
    project,
    currentPhase: 0,
    completedPhases: [],
    updatedAt: '',
  };
  save(state);
  updateProjectsJson(project, 'active');
  console.log(`[phase] Project "${project}" initialized`);
}

function advance(): void {
  const state = requireState();

  if (!state.completedPhases.includes(state.currentPhase)) {
    state.completedPhases.push(state.currentPhase);
    state.completedPhases.sort((a, b) => a - b);
  }

  if (state.currentPhase >= 7) {
    save(state);
    updateProjectsJson(state.project, 'completed');
    console.log(`[phase] Project "${state.project}" completed!`);
    return;
  }

  state.currentPhase++;
  save(state);
}

function complete(phase: number): void {
  const state = requireState();
  if (phase < 0 || phase > 7) {
    console.error('Phase must be 0-7.');
    return;
  }

  if (!state.completedPhases.includes(phase)) {
    state.completedPhases.push(phase);
    state.completedPhases.sort((a, b) => a - b);
  }
  save(state);
}

function skip(phase: number): void {
  const state = requireState();

  console.warn(
    `WARNING: Skipping Phase ${phase} (${PHASE_NAMES[phase]}). User confirmation required.`,
  );

  if (!state.completedPhases.includes(phase)) {
    state.completedPhases.push(phase);
    state.completedPhases.sort((a, b) => a - b);
  }
  if (state.currentPhase === phase) {
    state.currentPhase = Math.min(phase + 1, 7);
  }
  save(state);
}

function status(): void {
  const state = load();
  if (!state) {
    console.log('No active project.');
    return;
  }

  console.log(`Project: ${state.project}  |  Updated: ${state.updatedAt}\n`);
  for (let i = 0; i <= 7; i++) {
    const marker = state.completedPhases.includes(i)
      ? 'done'
      : i === state.currentPhase
        ? ' >> '
        : '    ';
    console.log(`  [${marker}] ${i}: ${PHASE_NAMES[i]}`);
  }
}

function reset(): void {
  const empty: PhaseState = { project: '', currentPhase: 0, completedPhases: [], updatedAt: '' };
  save(empty);
  console.log('[phase] Reset complete.');
}

// --- CLI ---

const [cmd, arg] = [process.argv[2], process.argv[3]];

switch (cmd) {
  case 'init':
    init(arg ?? 'unnamed');
    break;
  case 'advance':
    advance();
    break;
  case 'complete':
    complete(parseInt(arg ?? '-1', 10));
    break;
  case 'skip':
    skip(parseInt(arg ?? '-1', 10));
    break;
  case 'status':
    status();
    break;
  case 'reset':
    reset();
    break;
  default:
    console.log(`Phase Manager
  init <project>   New project (Phase 0)
  advance          Next phase
  complete <n>     Mark phase n done
  skip <n>         Skip phase (warns)
  status           Show state
  reset            Clear`);
}
