import React from 'react';
import { Box, Text } from 'ink';
import { readFileSync, existsSync } from 'fs';

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
      // 파싱 실패 시 기본값 사용
    }
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          프로젝트
        </Text>
        <Text color="gray"> (v{registry.version})</Text>
      </Box>

      {registry.projects.length === 0 ? (
        <Text color="gray">등록된 프로젝트 없음. workspace/에 프로젝트를 생성하세요.</Text>
      ) : (
        registry.projects.map((p) => (
          <Box key={p.name} gap={1}>
            <Text bold>{p.name.padEnd(20)}</Text>
            <Text color="gray">{p.status}</Text>
          </Box>
        ))
      )}
    </Box>
  );
};
