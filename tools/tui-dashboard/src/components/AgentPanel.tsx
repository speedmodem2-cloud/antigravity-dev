import React, { useState, useEffect, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { formatElapsed } from '../modules/time-format.js';
import { shortModel, STATUS_ICON, STATUS_COLOR } from '../config.js';
import type { AgentState, WaveTiming } from '../modules/status-tracker.js';
import type { AgentStatus } from '../config.js';
import type { SessionInfo } from '../modules/session-tracker.js';

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
  const taskDisplay = isRunning ? `${agent.currentTask}${dots}` : agent.currentTask;
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
      <Text color={isRunning ? 'white' : 'gray'} dimColor={dim}>
        {taskCol}
      </Text>
      {extraW > 0 && <Text color="gray">{'    '}</Text>}
      <Text color={dim ? 'gray' : timeColor} dimColor={dim}>
        {timeDisplay}
      </Text>
    </Box>
  );
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ agents, session, waveTimings = {} }) => {
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
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text bold color="magenta">
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
        const rows: React.ReactNode[] = [];
        let lastPhase: string | undefined;
        for (const agent of sortedAgents) {
          const waveKey =
            agent.phase !== null && agent.phase !== undefined ? `W${agent.phase}` : '';
          if (waveKey && waveKey !== lastPhase) {
            const phaseKey = String(agent.phase);
            const timing = waveTimings[phaseKey];
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
            const label = '─── ' + waveKey + (timeStr ? timeStr + ' ' : ' ');
            const labelLen = label.length + 1;
            rows.push(
              <Box key={`sep-${waveKey}`}>
                <Text color="gray" dimColor>
                  {'─── ' + waveKey}
                </Text>
                {timeStr ? (
                  <Text color={timeColor as 'green' | 'yellow'}>{timeStr + ' '}</Text>
                ) : (
                  <Text color="gray" dimColor>
                    {' '}
                  </Text>
                )}
                <Text color="gray" dimColor>
                  {'─'.repeat(Math.max(2, sepW - labelLen))}
                </Text>
              </Box>,
            );
            lastPhase = waveKey;
          }
          rows.push(
            <React.Fragment key={`agent-${agent.role}-${agent.name}`}>
              {renderAgentRow(agent, dots)}
            </React.Fragment>,
          );
        }
        return rows;
      })()}
    </Box>
  );
};
