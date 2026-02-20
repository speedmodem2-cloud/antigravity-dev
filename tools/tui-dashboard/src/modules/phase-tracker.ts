import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PHASE_STATE_PATH, ACTIVE_AGENTS_PATH, DEFAULT_PHASE_NAMES } from '../config.js';

export interface PhaseInfo {
  number: number;
  name: string;
  status: 'done' | 'active' | 'pending';
}

interface PhaseStateFile {
  currentPhase: number;
  completedPhases: number[];
  totalPhases?: number;
  phaseNames?: string[] | Record<string, string>;
}

interface WaveTiming {
  startedAt: string;
  completedAt?: string;
}

interface ActiveAgentsFile {
  project?: string;
  currentPhase?: number;
  waveTimings?: Record<string, WaveTiming>;
  roster?: Array<{ wave?: number; status?: string }>;
}

function getPhaseName(names: string[] | Record<string, string> | undefined, index: number): string {
  if (!names) return DEFAULT_PHASE_NAMES[index] ?? `Phase ${index}`;
  if (Array.isArray(names)) return names[index] ?? `Phase ${index}`;
  return names[String(index)] ?? DEFAULT_PHASE_NAMES[index] ?? `Phase ${index}`;
}

/**
 * Derive phase info from active-agents.json waveTimings.
 * A wave is "done" if completedAt is set, "active" if startedAt is set but no completedAt.
 */
function getPhasesFromActiveAgents(
  phaseNames?: string[] | Record<string, string>,
): PhaseInfo[] | null {
  if (!existsSync(ACTIVE_AGENTS_PATH)) return null;
  try {
    const data: ActiveAgentsFile = JSON.parse(readFileSync(ACTIVE_AGENTS_PATH, 'utf-8'));
    const timings = data.waveTimings;
    if (!timings || Object.keys(timings).length === 0) return null;

    const waveNums = Object.keys(timings)
      .map(Number)
      .sort((a, b) => a - b);
    const maxWave = Math.max(...waveNums);

    // Determine total waves: from phase-state or at least up to maxWave
    let totalWaves = maxWave;
    if (existsSync(PHASE_STATE_PATH)) {
      try {
        const ps: PhaseStateFile = JSON.parse(readFileSync(PHASE_STATE_PATH, 'utf-8'));
        if (ps.totalPhases && ps.totalPhases > totalWaves) totalWaves = ps.totalPhases;
        if (!phaseNames) phaseNames = ps.phaseNames;
      } catch {
        /* ignore */
      }
    }

    const phases: PhaseInfo[] = [];
    for (let i = 1; i <= totalWaves; i++) {
      const timing = timings[String(i)];
      let status: PhaseInfo['status'] = 'pending';
      if (timing?.completedAt) {
        status = 'done';
      } else if (timing?.startedAt) {
        status = 'active';
      }
      phases.push({
        number: i,
        name: getPhaseName(phaseNames, i - 1), // phaseNames is 0-indexed
        status,
      });
    }
    return phases.length > 0 ? phases : null;
  } catch {
    return null;
  }
}

export function getPhases(projectPath?: string): PhaseInfo[] {
  // Priority 1: wave-based phases from active-agents.json waveTimings
  const wavePhases = getPhasesFromActiveAgents();
  if (wavePhases) return wavePhases;

  // Priority 2: phase-state.json
  if (existsSync(PHASE_STATE_PATH)) {
    try {
      const state = JSON.parse(readFileSync(PHASE_STATE_PATH, 'utf-8')) as PhaseStateFile;
      const maxPhase = Math.max(
        state.totalPhases ?? 7,
        state.currentPhase,
        ...state.completedPhases,
      );
      const phases: PhaseInfo[] = [];
      for (let i = 0; i <= maxPhase; i++) {
        let status: PhaseInfo['status'] = 'pending';
        if (state.completedPhases.includes(i)) status = 'done';
        else if (i === state.currentPhase) status = 'active';
        phases.push({ number: i, name: getPhaseName(state.phaseNames, i), status });
      }
      return phases;
    } catch {
      // fallthrough
    }
  }

  // Priority 3: artifact-based detection from project path
  if (projectPath && existsSync(projectPath)) {
    const artifacts: Record<number, string[]> = {
      0: [],
      1: ['INSTRUCTIONS.md'],
      2: ['src/assets'],
      3: ['src'],
      4: ['REVIEW.md'],
      5: ['vitest.config.ts', 'tests'],
      6: ['README.md'],
      7: ['dist'],
    };

    let lastCompleted = -1;
    for (let i = 0; i <= 7; i++) {
      const files = artifacts[i] ?? [];
      const allExist = files.length === 0 || files.some((f) => existsSync(join(projectPath, f)));
      if (allExist && files.length > 0) lastCompleted = i;
    }

    const phases: PhaseInfo[] = [];
    for (let i = 0; i <= 7; i++) {
      let status: PhaseInfo['status'] = 'pending';
      if (i <= lastCompleted) status = 'done';
      else if (i === lastCompleted + 1) status = 'active';
      phases.push({ number: i, name: DEFAULT_PHASE_NAMES[i] ?? `Phase ${i}`, status });
    }
    return phases;
  }

  return [];
}
