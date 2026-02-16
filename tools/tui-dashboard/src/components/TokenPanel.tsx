import React from 'react';
import { Box, Text } from 'ink';
import type { TokenSummary } from '../modules/token-tracker.js';

interface TokenPanelProps {
  summary: TokenSummary;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function makeBar(value: number, max: number, width: number): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export const TokenPanel: React.FC<TokenPanelProps> = ({ summary }) => {
  const maxModelTokens = Math.max(...Array.from(summary.byModel.values()).map((m) => m.total), 1);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          토큰 사용량
        </Text>
      </Box>

      {/* 총 사용량 */}
      <Box gap={2} marginBottom={1}>
        <Box flexDirection="column">
          <Text color="gray">입력</Text>
          <Text bold color="green">
            {formatNumber(summary.totalInput)}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">출력</Text>
          <Text bold color="blue">
            {formatNumber(summary.totalOutput)}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">합계</Text>
          <Text bold color="white">
            {formatNumber(summary.totalTokens)}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">예상 비용</Text>
          <Text bold color="yellow">
            ${summary.costEstimate.toFixed(2)}
          </Text>
        </Box>
      </Box>

      {/* 모델별 */}
      <Text color="gray" dimColor>
        모델별 사용량:
      </Text>
      {Array.from(summary.byModel.entries()).map(([model, data]) => (
        <Box key={model} gap={1}>
          <Text>{model.padEnd(20)}</Text>
          <Text color="cyan">{makeBar(data.total, maxModelTokens, 15)}</Text>
          <Text color="gray">{formatNumber(data.total).padStart(6)}</Text>
          <Text color="yellow">${data.cost.toFixed(2)}</Text>
        </Box>
      ))}
    </Box>
  );
};
