import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../modules/log-tracker.js';

interface LogPanelProps {
  logs: LogEntry[];
}

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

function sliceW(str: string, max: number): string {
  let w = 0;
  let i = 0;
  for (const ch of str) {
    const cw = isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
    if (w + cw > max) break;
    w += cw;
    i++;
  }
  const sliced = str.slice(0, i);
  return sliced.length < str.length ? sliced + '…' : sliced;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const cols = process.stdout.columns || 60;
  // icon(2) + space(1) + tool(10) + space(1) + padding(4) = 18
  const summaryMax = Math.max(15, cols - 18);

  if (logs.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray">─── 활동 로그</Text>
        <Text color="gray"> (활동 없음)</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">─── 활동 로그</Text>
      {logs.map((entry, i) => (
        <Box key={i}>
          <Text color="gray"> </Text>
          <Text>{entry.icon} </Text>
          <Text color="cyan" bold>
            {entry.tool.padEnd(8)}
          </Text>
          <Text color="white">{sliceW(entry.summary, summaryMax)}</Text>
        </Box>
      ))}
    </Box>
  );
};
