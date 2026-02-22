import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { AgentPanel } from './AgentPanel.js';
import { TokenPanel } from './TokenPanel.js';
import { ProjectPanel } from './ProjectPanel.js';
import { PhaseBar } from './PhaseBar.js';
import { LogPanel } from './LogPanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { LogTracker } from '../modules/log-tracker.js';
import type { LogEntry } from '../modules/log-tracker.js';
import { StatusTracker } from '../modules/status-tracker.js';
import { TokenTracker } from '../modules/token-tracker.js';
import { SessionTracker } from '../modules/session-tracker.js';
import { SubagentTracker } from '../modules/subagent-tracker.js';
import { HistoryTracker } from '../modules/history-tracker.js';
import type { WorkHistoryEntry } from '../modules/history-tracker.js';
import { getPhases } from '../modules/phase-tracker.js';
import {
  DEV_ROOT,
  PROJECTS_PATH,
  TOKEN_LOG_PATH,
  ACTIVE_AGENTS_PATH,
  VERSION,
  SOUND_ENABLED,
  THEME,
} from '../config.js';
import type { AgentState, WaveTiming, AgentEvent } from '../modules/status-tracker.js';
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
  const frozenSummaryRef = useRef<TokenSummary | null>(null);
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
  const [waveTimings, setWaveTimings] = useState<Record<string, WaveTiming>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clock, setClock] = useState(new Date());
  const [showCompletedWaves, setShowCompletedWaves] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [, setColumns] = useState(process.stdout.columns || 80);
  const [projectAlert, setProjectAlert] = useState<string | null>(null);
  const lastEventCountRef = useRef(0);
  const [workHistory, setWorkHistory] = useState<WorkHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useInput((input) => {
    if (input === 'q') exit();
    if (input === 'w') setShowCompletedWaves((prev) => !prev);
    if (input === 'h') setShowHistory((prev) => !prev);
    if (input === 'r') setClock(new Date()); // force re-render
  });

  useEffect(() => {
    const statusTracker = new StatusTracker();
    const tokenTracker = new TokenTracker();
    const sessionTracker = new SessionTracker();
    const subagentTracker = new SubagentTracker();
    const logTracker = new LogTracker();
    const historyTracker = new HistoryTracker();
    historyTracker.start();

    lastProjectRef.current = getActiveProjectName();
    statusTracker.start();
    subagentTracker.start();

    tokenTracker.loadFromFile(TOKEN_LOG_PATH);
    tokenTracker.watchFileForUpdates(TOKEN_LOG_PATH);

    // Apply initial time window
    const initialWindow = getProjectWindow();
    tokenTracker.setTimeWindow(initialWindow.startedAt, initialWindow.endedAt);

    const interval = setInterval(() => {
      // Detect project change → auto-reset
      const currentProject = getActiveProjectName();
      if (currentProject && currentProject !== lastProjectRef.current) {
        const prev = lastProjectRef.current;
        lastProjectRef.current = currentProject;
        resetProjectData(currentProject);
        tokenTracker.loadFromFile(TOKEN_LOG_PATH);
        setProjectAlert(`프로젝트 전환: ${prev ?? '없음'} → ${currentProject}`);
        setTimeout(() => setProjectAlert(null), 5000);
      }

      // Update time window from active-agents.json
      const win = getProjectWindow();
      tokenTracker.setTimeWindow(win.startedAt, win.endedAt);

      // Merge: StatusTracker (Wave agents) + SubagentTracker (ad-hoc Task calls)
      const waveAgents = statusTracker.getAgents();
      const waveRoles = new Set(waveAgents.map((a) => a.name));
      const adHocAgents = subagentTracker.getSubagents().filter((a) => !waveRoles.has(a.name));
      setAgents([...waveAgents, ...adHocAgents]);
      setWaveTimings({ ...statusTracker.getWaveTimings() });

      // Feed agents into work history
      const projName = currentProject ?? lastProjectRef.current ?? 'unknown';
      for (const a of waveAgents) {
        const waveNum =
          typeof a.phase === 'number' ? a.phase : parseInt(String(a.phase ?? '0'), 10) || 0;
        historyTracker.recordWaveAgent(
          projName,
          waveNum,
          a.name,
          a.model ?? '',
          a.currentTask || a.name,
        );
        if (a.status === 'idle' || a.isCompleted)
          historyTracker.completeWaveAgent(projName, waveNum, a.name);
      }
      for (const a of adHocAgents) {
        historyTracker.recordAdHocTask(projName, a.currentTask || a.name, a.model ?? '');
        if (a.status === 'idle' || a.isCompleted)
          historyTracker.completeAdHocTask(projName, a.currentTask || a.name);
      }
      setWorkHistory(historyTracker.getAllHistory());

      if (currentProject) {
        // Active project → normal update
        const newSummary = tokenTracker.getSummary();
        setTokenSummary(newSummary);
        frozenSummaryRef.current = newSummary; // save last value
      } else {
        // No active project → keep last frozen summary
        if (frozenSummaryRef.current) setTokenSummary(frozenSummaryRef.current);
      }

      setSession(sessionTracker.getSession());
      setLogs(logTracker.getRecentLogs());
      const newEvents = statusTracker.getRecentEvents(5);
      setAgentEvents(newEvents);
      // Sound alert for completion/error events
      if (SOUND_ENABLED && newEvents.length > lastEventCountRef.current) {
        const latest = newEvents[newEvents.length - 1];
        if (latest && (latest.toStatus === 'idle' || latest.toStatus === 'stuck')) {
          process.stdout.write('\x07'); // BEL
        }
      }
      lastEventCountRef.current = newEvents.length;
      const projPath = getActiveProjectPath();
      setPhases(getPhases(projPath));
      setIsWaveBased(getIsWaveBased());
      checkProjects();
      setClock(new Date());
    }, 2000);

    const initialProjPath = getActiveProjectPath();
    const initWave = statusTracker.getAgents();
    const initAdHoc = subagentTracker
      .getSubagents()
      .filter((a) => !new Set(initWave.map((w) => w.name)).has(a.name));
    setAgents([...initWave, ...initAdHoc]);
    setTokenSummary(tokenTracker.getSummary());
    setSession(sessionTracker.getSession());
    setPhases(getPhases(initialProjPath));
    setIsWaveBased(getIsWaveBased());
    checkProjects();

    return () => {
      clearInterval(interval);
      statusTracker.stop();
      subagentTracker.stop();
      tokenTracker.stopWatching();
      historyTracker.stop();
    };
  }, []);

  // Re-render on terminal resize
  useEffect(() => {
    const onResize = () => setColumns(process.stdout.columns || 80);
    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  function checkProjects() {
    try {
      // Show panel if registry has projects OR active-agents.json names a project
      const hasRegistry = existsSync(PROJECTS_PATH)
        ? (() => {
            const reg = JSON.parse(readFileSync(PROJECTS_PATH, 'utf-8'));
            return (reg.projects?.length ?? 0) > 0;
          })()
        : false;
      const hasAgentProject = existsSync(ACTIVE_AGENTS_PATH)
        ? (() => {
            const data = JSON.parse(readFileSync(ACTIVE_AGENTS_PATH, 'utf-8'));
            return typeof data.project === 'string' && data.project.length > 0;
          })()
        : false;
      setHasProjects(hasRegistry || hasAgentProject);
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

  function parseModelLabel(model: string | undefined): string {
    if (!model) return 'Sonnet';
    const name = model.includes('opus')
      ? 'Opus'
      : model.includes('sonnet')
        ? 'Sonnet'
        : model.includes('haiku')
          ? 'Haiku'
          : model.includes('gemini')
            ? 'Gemini'
            : model.replace('claude-', '').slice(0, 6);
    const m = model.match(/(\d+)[.-](\d+)/);
    const version = m ? `${m[1]}.${m[2]}` : '';
    return version ? `${name} ${version}` : name;
  }

  const modelLabel = parseModelLabel(session.model);
  const modelColor = session.model?.includes('opus')
    ? ('magenta' as const)
    : session.model?.includes('gemini')
      ? ('yellow' as const)
      : session.model?.includes('haiku')
        ? ('blue' as const)
        : ('cyan' as const);

  return (
    <Box flexDirection="column" paddingX={1}>
      {projectAlert && (
        <Box backgroundColor="yellow" paddingX={1}>
          <Text color="black" bold>
            {projectAlert}
          </Text>
        </Box>
      )}
      <Box justifyContent="space-between">
        <Box gap={1}>
          <Text bold color={THEME.header}>
            ◆ AG Dev
          </Text>
          <Text color="gray">v{VERSION}</Text>
          <Text bold color={modelColor}>
            {modelLabel}
          </Text>
        </Box>
        <Text color="gray">{timeStr} | h w r q</Text>
      </Box>

      <AgentPanel
        agents={agents}
        session={session}
        waveTimings={waveTimings}
        tokenSummary={tokenSummary}
        showCompletedWaves={showCompletedWaves}
        agentEvents={agentEvents}
      />
      <LogPanel logs={logs} />
      <TokenPanel summary={tokenSummary} />
      {hasProjects && <ProjectPanel registryPath={PROJECTS_PATH} />}
      <PhaseBar phases={phases} isWaveBased={isWaveBased} />
      <HistoryPanel history={workHistory} visible={showHistory} />
    </Box>
  );
};
