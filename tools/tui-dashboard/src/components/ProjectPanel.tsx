import React from 'react';
import { Box, Text } from 'ink';
import { readFileSync, existsSync } from 'fs';
import { PROJECT_STATUS_ICON, PROJECT_STATUS_COLOR } from '../config.js';

interface Project {
  name: string;
  status: string;
  path: string;
}

interface ProjectRegistry {
  version: string;
  lastUpdated: string;
  projects: Project[];
}

interface ProjectPanelProps {
  registryPath: string;
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

  if (registry.projects.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text bold color="magenta">
        프로젝트
      </Text>

      {registry.projects.map((p) => (
        <Box key={p.name} gap={1}>
          <Text color={PROJECT_STATUS_COLOR[p.status] ?? 'gray'}>
            {PROJECT_STATUS_ICON[p.status] ?? '○'}
          </Text>
          <Text bold={p.status === 'active'}>{p.name.padEnd(14)}</Text>
          <Text color={PROJECT_STATUS_COLOR[p.status] ?? 'gray'}>{p.status.padEnd(10)}</Text>
          <Text color="gray" dimColor>
            {p.path}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
