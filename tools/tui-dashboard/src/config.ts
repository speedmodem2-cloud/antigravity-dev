import { readFileSync, existsSync as fsExistsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/* ── Paths ── */

export const DEV_ROOT = process.env.DEV_ROOT ?? 'C:\\Dev';
export const PROJECTS_PATH = join(DEV_ROOT, 'system', 'projects.json');
export const TOKEN_LOG_PATH = join(DEV_ROOT, 'logs', 'tokens', 'usage.json');
export const PHASE_STATE_PATH = join(DEV_ROOT, 'logs', 'phase-state.json');
export const AGENT_DEFS_DIR = join(DEV_ROOT, 'system', 'agents', 'definitions');
export const AGENT_LOG_DIR = join(process.env.LOCALAPPDATA ?? '', 'AntiGravity', 'logs');
export const ACTIVE_AGENTS_PATH = join(DEV_ROOT, 'logs', 'active-agents.json');

/* ── Version (from package.json) ── */

let _version = '0.0.0';
try {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  _version = pkg.version ?? _version;
} catch {
  // fallback
}
export const VERSION = _version;

/* ── Model display names ── */

export const SHORT_MODEL: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-opus-4.6': 'Opus',
  'claude-sonnet-4-6': 'Son',
  'claude-sonnet-4.6': 'Son',
  'claude-sonnet-4-5': 'Son',
  'claude-sonnet-4.5': 'Son',
  'claude-haiku-4-5': 'Hai',
  'claude-haiku-4.5': 'Hai',
  'gemini-3-pro': 'Gem',
};

export function shortModel(model: string): string {
  return (
    SHORT_MODEL[model] ??
    model
      .replace(/^claude-/, '')
      .replace(/^gemini-/, '')
      .slice(0, 4)
  );
}

/* ── Model costs ($/token) ── */

export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0 / 1e6, output: 75.0 / 1e6 },
  'claude-opus-4.6': { input: 15.0 / 1e6, output: 75.0 / 1e6 },
  'claude-sonnet-4-6': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-sonnet-4.6': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-sonnet-4-5': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-sonnet-4.5': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-haiku-4-5': { input: 0.8 / 1e6, output: 4.0 / 1e6 },
  'claude-haiku-4.5': { input: 0.8 / 1e6, output: 4.0 / 1e6 },
  'gemini-3-pro': { input: 1.25 / 1e6, output: 10.0 / 1e6 },
};

export function modelCost(model: string): { input: number; output: number } {
  return MODEL_COSTS[model] ?? { input: 3.0 / 1e6, output: 15.0 / 1e6 };
}

/* ── Status display ── */

export type AgentStatus = 'running' | 'idle' | 'stuck' | 'offline' | 'pending';

export const STATUS_ICON: Record<AgentStatus, string> = {
  running: '●',
  idle: '○',
  stuck: '▲',
  offline: '✕',
  pending: '◌',
};

export const STATUS_COLOR: Record<AgentStatus, string> = {
  running: 'green',
  idle: 'gray',
  stuck: 'yellow',
  offline: 'red',
  pending: 'gray',
};

export const PROJECT_STATUS_ICON: Record<string, string> = {
  active: '●',
  planning: '◐',
  paused: '◑',
  completed: '✓',
};

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  active: 'green',
  planning: 'cyan',
  paused: 'yellow',
  completed: 'gray',
};

/* ── Phase names (fallback) ── */

export const DEFAULT_PHASE_NAMES: Record<number, string> = {
  0: '사전점검',
  1: '설계',
  2: '에셋',
  3: '구현',
  4: '리뷰',
  5: '테스트',
  6: '문서화',
  7: '배포',
};

/* ── Theme ── */

export interface Theme {
  name: string;
  accent: string;
  border: string;
  header: string;
  running: string;
  success: string;
  warning: string;
  error: string;
  muted: string;
  text: string;
}

const DARK_THEME: Theme = {
  name: 'dark',
  accent: 'magenta',
  border: 'magenta',
  header: 'magenta',
  running: 'green',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  muted: 'gray',
  text: 'white',
};

const LIGHT_THEME: Theme = {
  name: 'light',
  accent: 'blue',
  border: 'blue',
  header: 'blue',
  running: 'green',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  muted: 'gray',
  text: 'black',
};

const THEMES: Record<string, Theme> = { dark: DARK_THEME, light: LIGHT_THEME };

function loadUserConfig(): { theme?: string; sound?: boolean } {
  try {
    const configPath = join(DEV_ROOT, 'tools', 'tui-dashboard', 'tui-config.json');
    if (fsExistsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch {
    /* ignore */
  }
  return {};
}

const userConfig = loadUserConfig();

export const THEME: Theme = THEMES[userConfig.theme ?? 'dark'] ?? DARK_THEME;
export const SOUND_ENABLED: boolean = userConfig.sound ?? false;
