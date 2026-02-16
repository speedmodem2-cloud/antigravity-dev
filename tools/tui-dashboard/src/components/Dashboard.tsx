import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { AgentPanel } from './AgentPanel.js';
import { TokenPanel } from './TokenPanel.js';
import { ProjectPanel } from './ProjectPanel.js';
import { StatusTracker } from '../modules/status-tracker.js';
import { TokenTracker } from '../modules/token-tracker.js';
import type { AgentState } from '../modules/status-tracker.js';
import type { TokenSummary } from '../modules/token-tracker.js';

const DEV_ROOT = process.env.DEV_ROOT ?? 'C:\\Dev';

export const Dashboard: React.FC = () => {
  const { exit } = useApp();
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary>({
    totalInput: 0,
    totalOutput: 0,
    totalTokens: 0,
    costEstimate: 0,
    byModel: new Map(),
    bySession: new Map(),
    history: [],
  });
  const [clock, setClock] = useState(new Date());

  useInput((input) => {
    if (input === 'q') exit();
  });

  useEffect(() => {
    const statusTracker = new StatusTracker();
    const tokenTracker = new TokenTracker();

    statusTracker.start();
    tokenTracker.addDemoData();

    const interval = setInterval(() => {
      setAgents([...statusTracker.getAgents()]);
      setTokenSummary(tokenTracker.getSummary());
      setClock(new Date());
    }, 2000);

    // 초기 데이터 즉시 로드
    setAgents([...statusTracker.getAgents()]);
    setTokenSummary(tokenTracker.getSummary());

    return () => {
      clearInterval(interval);
      statusTracker.stop();
    };
  }, []);

  const timeStr = clock.toLocaleTimeString('ko-KR', { hour12: false });

  return (
    <Box flexDirection="column" padding={1}>
      {/* 헤더 */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="magenta">
          ◆ AG Dev Dashboard
        </Text>
        <Text color="gray">{timeStr} | q: 종료</Text>
      </Box>

      {/* 상단: 에이전트 + 프로젝트 */}
      <Box gap={1} marginBottom={1}>
        <Box width="60%">
          <AgentPanel agents={agents} />
        </Box>
        <Box width="40%">
          <ProjectPanel registryPath={`${DEV_ROOT}\\system\\projects.json`} />
        </Box>
      </Box>

      {/* 하단: 토큰 */}
      <TokenPanel summary={tokenSummary} />

      {/* 푸터 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          PHASE 01 ✓ | PHASE 02 ✓ | PHASE 03 진행 중 | DEV_ROOT: {DEV_ROOT}
        </Text>
      </Box>
    </Box>
  );
};
