import React from 'react';
import { Box, Text } from 'ink';
import type { WorkHistoryEntry } from '../modules/history-tracker.js';
import { THEME } from '../config.js';
import { formatElapsed } from '../modules/time-format.js';

interface HistoryPanelProps {
  history: WorkHistoryEntry[];
  visible: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDuration(entry: WorkHistoryEntry): string {
  if (!entry.completedAt) return '...';
  const ms = new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime();
  return formatElapsed(ms);
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, visible }) => {
  if (!visible || history.length === 0) return null;

  // Group by date
  const groups = new Map<string, WorkHistoryEntry[]>();
  for (const entry of history) {
    const date = formatDate(entry.startedAt);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(entry);
  }

  const cols = process.stdout.columns || 80;
  const taskWidth = Math.max(cols - 36, 20);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={THEME.border} paddingX={1}>
      <Box>
        <Text bold color={THEME.header}>
          작업 이력
        </Text>
        <Text color="gray"> ({history.length})</Text>
      </Box>

      {Array.from(groups.entries()).map(([date, entries]) => (
        <Box key={date} flexDirection="column">
          <Text color="gray" dimColor>
            {'─'.repeat(Math.min(cols - 4, 60))} {date}
          </Text>
          {entries.map((entry) => {
            const prefix = entry.type === 'wave' ? `W${entry.wave ?? '?'}` : '──';
            const icon =
              entry.status === 'completed' ? '✓' : entry.status === 'running' ? '●' : '✕';
            const iconColor =
              entry.status === 'completed'
                ? 'green'
                : entry.status === 'running'
                  ? 'yellow'
                  : 'red';
            const dur = getDuration(entry);
            const taskText = truncate(entry.task, taskWidth);
            const isRecent = Date.now() - new Date(entry.startedAt).getTime() < 3600000;

            return (
              <Box key={entry.id} gap={1}>
                <Text color="gray">{prefix.padEnd(3)}</Text>
                <Text color={iconColor}>{icon}</Text>
                <Text color={isRecent ? THEME.text : 'gray'} dimColor={!isRecent}>
                  {taskText}
                </Text>
                <Text color="gray">{dur.padStart(5)}</Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};
