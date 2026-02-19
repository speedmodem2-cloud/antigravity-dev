import React, { useState, useEffect, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { formatElapsed } from '../modules/time-format.js';
import { shortModel, STATUS_ICON, STATUS_COLOR, THEME } from '../config.js';
import type { AgentState, WaveTiming, AgentEvent } from '../modules/status-tracker.js';
import type { AgentStatus } from '../config.js';
import type { SessionInfo } from '../modules/session-tracker.js';
import type { TokenSummary } from '../modules/token-tracker.js';

/* ── CJK-aware width helpers ── */

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3040 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0x20000 && code <= 0x2ffff)
  );
}

function dw(str: string): number {
  let w = 0;
  for (const ch of str) w += isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
  return w;
}

function sliceW(str: string, max: number): string {
  let w = 0;
  let i = 0;
  for (const ch of str) {
    const cw = isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
    if (w + cw > max) break;
    w += cw;
    i++;
  }
  return str.slice(0, i);
}

function padW(str: string, target: number): string {
  const gap = target - dw(str);
  return gap > 0 ? str + ' '.repeat(gap) : str;
}

/* ── Layout helpers ── */

function getLayout() {
  const cols = process.stdout.columns || 80;
  // reserved: border(2) + paddingX(2) + icon(1) + space(1) + elapsed(4) = 10
  const available = Math.max(20, cols - 10);
  const nameW = cols < 55 ? 9 : 13;
  const modelW = 4;
  const extraW = cols < 55 ? 0 : 4;
  const taskW = Math.max(10, available - nameW - modelW - extraW - 4);
  const sepW = Math.max(5, cols - 6);
  return { nameW, modelW, extraW, taskW, sepW, cols };
}

/* ── Component ── */

interface AgentPanelProps {
  agents: AgentState[];
  session: SessionInfo;
  waveTimings?: Record<string, WaveTiming>;
  tokenSummary?: TokenSummary;
  showCompletedWaves?: boolean;
  agentEvents?: AgentEvent[];
}

function renderRow(
  icon: ReactNode,
  name: string,
  model: string,
  task: string,
  extra: string,
  elapsed: string,
  elapsedColor: string,
  isActive: boolean,
): ReactNode {
  const { nameW, modelW, extraW, taskW } = getLayout();
  const nameCol = padW(sliceW(name, nameW), nameW + 1);
  const modelCol = padW(sliceW(model, modelW), modelW + 1);
  const taskCol = padW(sliceW(task, taskW), taskW);
  const extraCol = extraW > 0 ? (extra ? padW(extra, extraW) : ' '.repeat(extraW)) + ' ' : '';

  return (
    <Box>
      {icon}
      <Text bold={isActive} color={isActive ? 'green' : undefined}>
        {' ' + nameCol}
      </Text>
      <Text color="gray">{modelCol}</Text>
      <Text color={isActive ? 'white' : 'gray'} bold={isActive}>
        {taskCol}
      </Text>
      <Text color="gray">{extraCol}</Text>
      <Text color={elapsedColor}>{elapsed}</Text>
    </Box>
  );
}

function renderAgentRow(agent: AgentState, dots: string): ReactNode {
  const { nameW, modelW, extraW, taskW } = getLayout();
  const elapsedMs = Date.now() - agent.lastActivity.getTime();
  const isPending = agent.status === 'pending';
  const isOffline = agent.status === 'offline';
  const isRunning = agent.status === 'running';
  const isCompleted = agent.isCompleted === true || (agent.status === 'idle' && !isRunning);
  const modelShort = shortModel(agent.model);
  const isError = agent.status === 'stuck';
  const taskDisplay =
    isError && agent.errorMessage
      ? `⚠ ${agent.errorMessage}`
      : isRunning
        ? `${agent.currentTask}${dots}`
        : agent.currentTask;
  const timeDisplay = isPending
    ? 'wait'
    : isOffline
      ? '-'
      : isRunning
        ? formatElapsed(elapsedMs)
        : 'done';
  const timeColor = 'yellow';

  const isRecentChange = agent.changedAt ? Date.now() - agent.changedAt.getTime() < 2000 : false;
  let flashBg: string | undefined;
  if (isRecentChange) {
    if (agent.isNew) flashBg = 'yellow';
    else if (agent.status === 'idle') flashBg = 'green';
    else if (agent.status === 'stuck') flashBg = 'red';
    else if (agent.status === 'running') flashBg = 'yellow';
  }

  const icon = isRunning ? (
    <Text color="green">
      <Spinner type="dots" />
    </Text>
  ) : isPending ? (
    <Text color="gray" dimColor>
      {'◌'}
    </Text>
  ) : isCompleted ? (
    <Text color="gray" dimColor>
      {'✓'}
    </Text>
  ) : (
    <Text color={STATUS_COLOR[agent.status as AgentStatus]} dimColor={isOffline}>
      {STATUS_ICON[agent.status as AgentStatus]}
    </Text>
  );

  const nameCol = padW(sliceW(agent.name, nameW), nameW + 1);
  const modelCol = padW(sliceW(modelShort, modelW), modelW + 1);
  const taskCol = padW(sliceW(taskDisplay, taskW), taskW);

  const dim = isPending || isCompleted;

  return (
    <Box key={agent.role} backgroundColor={flashBg}>
      {icon}
      <Text bold={isRunning} color={isRunning ? 'green' : dim ? 'gray' : undefined} dimColor={dim}>
        {' ' + nameCol}
      </Text>
      <Text color="gray" dimColor={dim}>
        {modelCol}
      </Text>
      <Text color={isError ? 'red' : isRunning ? 'white' : 'gray'} dimColor={dim} bold={isError}>
        {taskCol}
      </Text>
      {agent.todoTotal !== null && agent.todoTotal !== undefined && agent.todoTotal > 0 && (
        <Text color={agent.todoCompleted === agent.todoTotal ? 'green' : 'cyan'} dimColor={dim}>
          {` ${agent.todoCompleted ?? 0}/${agent.todoTotal}`}
        </Text>
      )}
      {extraW > 0 && <Text color="gray">{'    '}</Text>}
      <Text color={dim ? 'gray' : timeColor} dimColor={dim}>
        {timeDisplay}
      </Text>
    </Box>
  );
}

function formatTokenK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

function getWaveCost(
  timing: WaveTiming | undefined,
  tokenSummary: TokenSummary | undefined,
): { tokens: number; cost: number } | null {
  if (!timing?.startedAt || !tokenSummary) return null;
  const start = new Date(timing.startedAt).getTime();
  const end = timing.completedAt ? new Date(timing.completedAt).getTime() : Date.now();
  let tokens = 0;
  let cost = 0;
  for (const u of tokenSummary.history) {
    const t = u.timestamp.getTime();
    if (t >= start && t <= end) {
      tokens += u.totalTokens;
      const rates = tokenSummary.byModel.get(u.model);
      if (rates && rates.total > 0) {
        cost += (rates.cost / rates.total) * u.totalTokens;
      }
    }
  }
  return tokens > 0 ? { tokens, cost } : null;
}

const EVENT_ICON: Record<string, string> = {
  new: '◆',
  running: '▶',
  idle: '✓',
  stuck: '✕',
  pending: '◌',
  offline: '○',
};

export const AgentPanel: React.FC<AgentPanelProps> = ({
  agents,
  session,
  waveTimings = {},
  tokenSummary,
  showCompletedWaves = false,
  agentEvents = [],
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((p) => (p + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  const dots = (['', '.', '..', '...'] as const)[tick as 0 | 1 | 2 | 3];
  const { sepW } = getLayout();

  const tagPrefix = session.phaseTag ? `${session.phaseTag} ` : '';
  const taskBase = session.currentTask !== '-' ? session.currentTask : 'No active task';
  const sessionTask = session.active ? `${tagPrefix}${taskBase}${dots}` : `${tagPrefix}${taskBase}`;
  const sessionProgress =
    session.totalCount > 0 ? `${session.completedCount}/${session.totalCount}` : '';
  const sessionActivityMs = session.lastActivity.getTime();
  const sessionElapsed =
    sessionActivityMs <= 0 ? '-' : formatElapsed(Date.now() - sessionActivityMs);

  const anyRunning = agents.some((a) => a.status === 'running');
  const hasAnyAgents = agents.length > 0;

  const sessionIcon = session.active ? (
    <Text color="green">
      <Spinner type="dots" />
    </Text>
  ) : anyRunning ? (
    <Text color="cyan">
      <Spinner type="dots" />
    </Text>
  ) : (
    <Text color="gray">{hasAnyAgents || session.totalCount > 0 ? '○' : '✕'}</Text>
  );

  const sortedAgents = [...agents].sort((a, b) => {
    const na = a.phase !== null && a.phase !== undefined ? parseFloat(String(a.phase)) : Infinity;
    const nb = b.phase !== null && b.phase !== undefined ? parseFloat(String(b.phase)) : Infinity;
    return na - nb;
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={THEME.border} paddingX={1}>
      <Text bold color={THEME.header}>
        에이전트
      </Text>
      {renderRow(
        sessionIcon,
        'Claude',
        shortModel(session.model ?? 'claude-sonnet-4-6'),
        sessionTask,
        sessionProgress,
        sessionElapsed,
        'yellow',
        session.active,
      )}
      {agents.length > 0 && (
        <Text color="gray" dimColor>
          {'─'.repeat(sepW)}
        </Text>
      )}
      {(() => {
        // Pre-compute wave stats
        const waveStats = new Map<string, { total: number; completed: number }>();
        for (const agent of sortedAgents) {
          const wk = agent.phase !== null && agent.phase !== undefined ? String(agent.phase) : '';
          if (!wk) continue;
          const stat = waveStats.get(wk) ?? { total: 0, completed: 0 };
          stat.total++;
          if (agent.isCompleted || agent.status === 'idle') stat.completed++;
          waveStats.set(wk, stat);
        }

        const rows: React.ReactNode[] = [];
        let lastPhase: string | undefined;
        for (const agent of sortedAgents) {
          const waveKey =
            agent.phase !== null && agent.phase !== undefined ? `W${agent.phase}` : '';
          if (waveKey && waveKey !== lastPhase) {
            const phaseKey = String(agent.phase);
            const timing = waveTimings[phaseKey];
            const stat = waveStats.get(phaseKey);
            let timeStr = '';
            let timeColor = 'gray';
            if (timing?.startedAt) {
              const startMs = new Date(timing.startedAt).getTime();
              if (timing.completedAt) {
                const dur = new Date(timing.completedAt).getTime() - startMs;
                timeStr = ` ✓ ${formatElapsed(dur)}`;
                timeColor = 'green';
              } else {
                timeStr = ` ${formatElapsed(Date.now() - startMs)}`;
                timeColor = 'yellow';
              }
            }

            // Progress bar
            let progressStr = '';
            let progressColor: 'green' | 'yellow' | 'gray' = 'gray';
            if (stat && stat.total > 0) {
              const filled = Math.round((stat.completed / stat.total) * 4);
              const empty = 4 - filled;
              progressStr =
                ' ' + '█'.repeat(filled) + '░'.repeat(empty) + ` ${stat.completed}/${stat.total}`;
              progressColor = stat.completed === stat.total ? 'green' : 'yellow';
            }

            // Wave cost
            const waveCost = getWaveCost(timing, tokenSummary);
            const costStr = waveCost
              ? ` ${formatTokenK(waveCost.tokens)} $${waveCost.cost.toFixed(2)}`
              : '';

            const label = '─── ' + waveKey + (timeStr || '') + (progressStr || '') + costStr + ' ';
            const labelLen = label.length + 1;
            rows.push(
              <Box key={`sep-${waveKey}`}>
                <Text color="gray" dimColor>
                  {'─── ' + waveKey}
                </Text>
                {timeStr ? <Text color={timeColor as 'green' | 'yellow'}>{timeStr}</Text> : null}
                {progressStr ? (
                  <Text color={progressColor}>{progressStr}</Text>
                ) : (
                  <Text color="gray" dimColor>
                    {' '}
                  </Text>
                )}
                {costStr ? <Text color="yellow">{costStr + ' '}</Text> : <Text> </Text>}
                <Text color="gray" dimColor>
                  {'─'.repeat(Math.max(2, sepW - labelLen))}
                </Text>
              </Box>,
            );
            lastPhase = waveKey;
          }
          // Hide agent rows for completed waves (auto-collapse, toggle with 'w')
          const agentPhaseKey =
            agent.phase !== null && agent.phase !== undefined ? String(agent.phase) : '';
          const agentWaveStat = agentPhaseKey ? waveStats.get(agentPhaseKey) : undefined;
          const waveFullyDone = agentWaveStat
            ? agentWaveStat.completed === agentWaveStat.total && agentWaveStat.total > 0
            : false;
          if (!waveFullyDone || showCompletedWaves) {
            rows.push(
              <React.Fragment key={`agent-${agent.role}`}>
                {renderAgentRow(agent, dots)}
              </React.Fragment>,
            );
          }
        }
        return rows;
      })()}
      {agentEvents.length > 0 && (
        <>
          <Text color="gray" dimColor>
            {'─'.repeat(sepW)}
          </Text>
          {agentEvents.map((ev, i) => {
            const timeStr = ev.timestamp.toLocaleTimeString('ko-KR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const icon = EVENT_ICON[ev.toStatus] ?? '·';
            const color =
              ev.toStatus === 'running'
                ? 'green'
                : ev.toStatus === 'idle'
                  ? 'gray'
                  : ev.toStatus === 'stuck'
                    ? 'red'
                    : 'gray';
            return (
              <Box key={`ev-${i}`}>
                <Text color="gray" dimColor>
                  {timeStr}{' '}
                </Text>
                <Text color={color}>{icon} </Text>
                <Text color={color}>{ev.agentName.slice(0, 20)}</Text>
                <Text color="gray" dimColor>
                  {' '}
                  {ev.fromStatus}→{ev.toStatus}
                </Text>
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
};
