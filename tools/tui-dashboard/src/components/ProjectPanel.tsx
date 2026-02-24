import React from 'react';
import { Box, Text } from 'ink';
import { readFileSync, existsSync } from 'fs';
import { PROJECT_STATUS_ICON, PROJECT_STATUS_COLOR, THEME, ACTIVE_AGENTS_PATH } from '../config.js';

interface Project {
  name: string;
  status: string;
  path: string;
  stack?: string;
  startedAt?: string;
  completedAt?: string;
}

interface ProjectRegistry {
  version: string;
  lastUpdated: string;
  projects: Project[];
}

interface ActiveAgentsFile {
  project?: string;
  currentPhase?: number;
  waveTimings?: Record<string, { startedAt: string; completedAt?: string }>;
}

interface ProjectPanelProps {
  registryPath: string;
}

function getActiveProjectFromAgents(): string | undefined {
  try {
    if (existsSync(ACTIVE_AGENTS_PATH)) {
      const data: ActiveAgentsFile = JSON.parse(readFileSync(ACTIVE_AGENTS_PATH, 'utf-8'));
      return data.project ?? undefined;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function getCurrentWaveLabel(
  activeAgentsProject: string | undefined,
  registryProjects: Project[],
): string {
  if (!activeAgentsProject) return '';
  const inRegistry = registryProjects.find((p) => p.name === activeAgentsProject);
  if (inRegistry && inRegistry.status !== 'active') return '';
  try {
    if (existsSync(ACTIVE_AGENTS_PATH)) {
      const data: ActiveAgentsFile = JSON.parse(readFileSync(ACTIVE_AGENTS_PATH, 'utf-8'));
      const timings = data.waveTimings;
      if (!timings) return '';
      const activeWave = Object.entries(timings)
        .filter(([, t]) => t.startedAt && !t.completedAt)
        .map(([k]) => Number(k))
        .sort((a, b) => a - b)[0];
      if (activeWave !== undefined) return ` W${activeWave}`;
      const lastDone = Object.entries(timings)
        .filter(([, t]) => t.completedAt)
        .map(([k]) => Number(k))
        .sort((a, b) => b - a)[0];
      if (lastDone !== undefined) return ` W${lastDone}✓`;
    }
  } catch {
    /* ignore */
  }
  return '';
}

function daysSince(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({ registryPath }) => {
  let registry: ProjectRegistry = { version: '1.0', lastUpdated: '', projects: [] };

  if (existsSync(registryPath)) {
    try {
      registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as ProjectRegistry;
    } catch {
      // fallback
    }
  }

  const agentProject = getActiveProjectFromAgents();

  const allProjects = [...registry.projects];
  if (agentProject && !allProjects.find((p) => p.name === agentProject)) {
    allProjects.unshift({ name: agentProject, status: 'active', path: '' });
  } else if (agentProject) {
    const idx = allProjects.findIndex((p) => p.name === agentProject);
    if (idx !== -1) {
      const existing = allProjects[idx];
      if (existing && existing.status !== 'active') {
        allProjects[idx] = { ...existing, status: 'active' };
      }
    }
  }

  if (allProjects.length === 0) return null;

  const active = allProjects.filter((p) => p.status === 'active');
  const completed = allProjects.filter((p) => p.status === 'completed').slice(-2);
  const visible = [...completed, ...active];

  if (visible.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={THEME.border} paddingX={1}>
      <Text bold color={THEME.header}>
        프로젝트
      </Text>

      {visible.map((p) => {
        const waveLabel =
          p.status === 'active' ? getCurrentWaveLabel(agentProject, registry.projects) : '';
        const dateLabel =
          p.status === 'active' && p.startedAt
            ? daysSince(p.startedAt)
            : p.status === 'completed' && p.completedAt
              ? daysSince(p.completedAt)
              : '';

        return (
          <Box key={p.name} flexDirection="column">
            <Box gap={1}>
              <Text color={PROJECT_STATUS_COLOR[p.status] ?? 'gray'}>
                {PROJECT_STATUS_ICON[p.status] ?? '○'}
              </Text>
              <Text bold={p.status === 'active'}>{p.name}</Text>
              <Text color={PROJECT_STATUS_COLOR[p.status] ?? 'gray'}>{p.status}</Text>
              {waveLabel ? <Text color="cyan">{waveLabel}</Text> : null}
              {dateLabel ? <Text color="gray"> {dateLabel}</Text> : null}
            </Box>
            {p.status === 'active' && p.stack && (
              <Box marginLeft={3}>
                <Text color="gray" dimColor>
                  {p.stack}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
