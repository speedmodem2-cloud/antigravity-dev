import React from 'react';
import { Box, Text } from 'ink';
import type { AgentState, AgentStatus } from '../modules/status-tracker.js';

const STATUS_ICONS: Record<AgentStatus, string> = {
  running: '●',
  idle: '○',
  stuck: '▲',
  offline: '✕',
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: 'green',
  idle: 'gray',
  stuck: 'yellow',
  offline: 'red',
};

interface AgentPanelProps {
  agents: AgentState[];
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ agents }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          에이전트 상태
        </Text>
      </Box>
      {agents.length === 0 ? (
        <Text color="gray">활성 에이전트 없음</Text>
      ) : (
        agents.map((agent) => {
          const elapsed = Math.round((Date.now() - agent.lastActivity.getTime()) / 1000);
          return (
            <Box key={agent.name} gap={1}>
              <Text color={STATUS_COLORS[agent.status]}>{STATUS_ICONS[agent.status]}</Text>
              <Text bold>{agent.name.padEnd(16)}</Text>
              <Text color="gray">{agent.currentTask.padEnd(30)}</Text>
              <Text color={elapsed > 60 ? 'yellow' : 'gray'}>{elapsed}s ago</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
