import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PHASE_STATE_PATH, DEFAULT_PHASE_NAMES } from '../config.js';

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

function getPhaseName(names: string[] | Record<string, string> | undefined, index: number): string {
  if (!names) return DEFAULT_PHASE_NAMES[index] ?? `Phase ${index}`;
  if (Array.isArray(names)) return names[index] ?? `Phase ${index}`;
  return names[String(index)] ?? DEFAULT_PHASE_NAMES[index] ?? `Phase ${index}`;
}

export function getPhases(projectPath?: string): PhaseInfo[] {
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
