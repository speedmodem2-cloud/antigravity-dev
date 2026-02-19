import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { AgentPanel } from './AgentPanel.js';
import { TokenPanel } from './TokenPanel.js';
import { ProjectPanel } from './ProjectPanel.js';
import { PhaseBar } from './PhaseBar.js';
import { StatusTracker } from '../modules/status-tracker.js';
import { TokenTracker } from '../modules/token-tracker.js';
import { SessionTracker } from '../modules/session-tracker.js';
import { getPhases } from '../modules/phase-tracker.js';
import { DEV_ROOT, PROJECTS_PATH, TOKEN_LOG_PATH, ACTIVE_AGENTS_PATH, VERSION } from '../config.js';
import type { AgentState } from '../modules/status-tracker.js';
import type { TokenSummary } from '../modules/token-tracker.js';
import type { PhaseInfo } from '../modules/phase-tracker.js';
import type { SessionInfo } from '../modules/session-tracker.js';

function getActiveProjectName(): string | undefined {
  try {
    if (existsSync(PROJECTS_PATH)) {
      const reg = JSON.parse(readFileSync(PROJECTS_PATH, 'utf-8'));
      const active = reg.projects?.find((p: { status: string }) => p.status === 'active');
      return active?.name;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function getIsWaveBased(): boolean {
  try {
    if (existsSync(ACTIVE_AGENTS_PATH)) {
      const data = JSON.parse(readFileSync(ACTIVE_AGENTS_PATH, 'utf-8'));
      return Array.isArray(data.roster) && data.roster.length > 0;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function getProjectWindow(): { startedAt?: string; endedAt?: string } {
  try {
    if (existsSync(ACTIVE_AGENTS_PATH)) {
      const data = JSON.parse(readFileSync(ACTIVE_AGENTS_PATH, 'utf-8'));
      return {
        startedAt: data.projectStartedAt ?? undefined,
        endedAt: data.projectEndedAt ?? undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function resetProjectData(projectName: string): void {
  try {
    writeFileSync(TOKEN_LOG_PATH, JSON.stringify({ records: [] }, null, 2) + '\n');
  } catch {
    /* ignore */
  }
  try {
    writeFileSync(
      ACTIVE_AGENTS_PATH,
      JSON.stringify(
        {
          project: projectName,
          agents: [],
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + '\n',
    );
  } catch {
    /* ignore */
  }
}

export const Dashboard: React.FC = () => {
  const { exit } = useApp();
  const lastProjectRef = useRef<string | undefined>(undefined);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary>({
    totalInput: 0,
    totalOutput: 0,
    totalTokens: 0,
    costEstimate: 0,
    byModel: new Map(),
    bySession: new Map(),
    deltas: new Map(),
    history: [],
    isDemo: true,
  });
  const [frozenSummary, setFrozenSummary] = useState<TokenSummary | null>(null);
  const [phases, setPhases] = useState<PhaseInfo[]>([]);
  const [session, setSession] = useState<SessionInfo>({
    active: false,
    lastActivity: new Date(0),
    currentTask: '-',
    phaseTag: '',
    todos: [],
    completedCount: 0,
    totalCount: 0,
    sessionId: '',
  });
  const [hasProjects, setHasProjects] = useState(false);
  const [isWaveBased, setIsWaveBased] = useState(false);
  const [clock, setClock] = useState(new Date());

  useInput((input) => {
    if (input === 'q') exit();
  });

  useEffect(() => {
    const statusTracker = new StatusTracker();
    const tokenTracker = new TokenTracker();
    const sessionTracker = new SessionTracker();

    lastProjectRef.current = getActiveProjectName();
    statusTracker.start();

    tokenTracker.loadFromFile(TOKEN_LOG_PATH);
    tokenTracker.watchFileForUpdates(TOKEN_LOG_PATH);

    // Apply initial time window
    const initialWindow = getProjectWindow();
    tokenTracker.setTimeWindow(initialWindow.startedAt, initialWindow.endedAt);

    const interval = setInterval(() => {
      // Detect project change → auto-reset
      const currentProject = getActiveProjectName();
      if (currentProject && currentProject !== lastProjectRef.current) {
        lastProjectRef.current = currentProject;
        resetProjectData(currentProject);
        tokenTracker.loadFromFile(TOKEN_LOG_PATH);
      }

      // Update time window from active-agents.json
      const win = getProjectWindow();
      tokenTracker.setTimeWindow(win.startedAt, win.endedAt);

      setAgents([...statusTracker.getAgents()]);

      if (currentProject) {
        // Active project → normal update
        const newSummary = tokenTracker.getSummary();
        setTokenSummary(newSummary);
        setFrozenSummary(newSummary); // save last value
      } else {
        // No active project → keep last frozen summary
        if (frozenSummary) setTokenSummary(frozenSummary);
      }

      setSession(sessionTracker.getSession());
      const projPath = getActiveProjectPath();
      setPhases(getPhases(projPath));
      setIsWaveBased(getIsWaveBased());
      checkProjects();
      setClock(new Date());
    }, 2000);

    const initialProjPath = getActiveProjectPath();
    setAgents([...statusTracker.getAgents()]);
    setTokenSummary(tokenTracker.getSummary());
    setSession(sessionTracker.getSession());
    setPhases(getPhases(initialProjPath));
    setIsWaveBased(getIsWaveBased());
    checkProjects();

    return () => {
      clearInterval(interval);
      statusTracker.stop();
      tokenTracker.stopWatching();
    };
  }, []);

  function checkProjects() {
    try {
      if (existsSync(PROJECTS_PATH)) {
        const reg = JSON.parse(readFileSync(PROJECTS_PATH, 'utf-8'));
        setHasProjects(reg.projects?.length > 0);
      } else {
        setHasProjects(false);
      }
    } catch {
      setHasProjects(false);
    }
  }

  function getActiveProjectPath(): string | undefined {
    try {
      if (existsSync(PROJECTS_PATH)) {
        const reg = JSON.parse(readFileSync(PROJECTS_PATH, 'utf-8'));
        const active = reg.projects?.find(
          (p: { status: string; path: string }) => p.status === 'active',
        );
        if (active?.path) {
          return `${DEV_ROOT}/${active.path}`.replace(/\\/g, '/');
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  const timeStr = clock.toLocaleTimeString('ko-KR', { hour12: false });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="magenta">
          ◆ AG Dev Dashboard <Text color="gray">v{VERSION}</Text>
        </Text>
        <Text color="gray">{timeStr} | q: exit</Text>
      </Box>

      <AgentPanel agents={agents} session={session} />
      <TokenPanel summary={tokenSummary} />
      {hasProjects && <ProjectPanel registryPath={PROJECTS_PATH} />}
      <PhaseBar phases={phases} isWaveBased={isWaveBased} />
    </Box>
  );
};
