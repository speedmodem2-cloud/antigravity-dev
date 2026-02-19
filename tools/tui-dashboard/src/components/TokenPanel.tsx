import React from 'react';
import { Box, Text } from 'ink';
import { shortModel, SHORT_MODEL, modelCost } from '../config.js';
import type { TokenSummary, TokenUsage } from '../modules/token-tracker.js';

interface TokenPanelProps {
  summary: TokenSummary;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

function makeBar(value: number, max: number, width: number): string {
  if (max <= 0 || width <= 0) return '░'.repeat(width);
  const filled = Math.min(Math.round((value / max) * width), width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** Render a two-tone bar: input=█ output=▓ */
function makeSplitBar(input: number, output: number, max: number, width: number): string {
  if (max <= 0 || width <= 0) return '░'.repeat(width);
  const total = input + output;
  const totalFilled = Math.min(Math.round((total / max) * width), width);
  const inputFilled = Math.min(Math.round((input / max) * width), totalFilled);
  const outputFilled = totalFilled - inputFilled;
  return '█'.repeat(inputFilled) + '▓'.repeat(outputFilled) + '░'.repeat(width - totalFilled);
}

/** Return model color: magenta for Opus, cyan for Sonnet/others */
function modelColor(model: string): string {
  const name = (SHORT_MODEL[model] ?? model).toLowerCase();
  if (name.startsWith('opus')) return 'magenta';
  if (name.startsWith('son')) return 'cyan';
  if (name.startsWith('hai')) return 'blue';
  if (name.startsWith('gem')) return 'green';
  return 'cyan';
}

/** Build 12-bucket (10-min each = last 2h) cost sparkline from usage history */
function makeCostSparkline(history: TokenUsage[]): {
  line: string;
  peakCost: number;
  hasCost: boolean;
} {
  const BUCKETS = 12;
  const BUCKET_MS = 10 * 60_000; // 10 minutes
  const now = Date.now();
  const startMs = now - BUCKETS * BUCKET_MS;

  const buckets = new Array<number>(BUCKETS).fill(0);
  for (const u of history) {
    const t = u.timestamp.getTime();
    if (t < startMs) continue;
    const idx = Math.min(BUCKETS - 1, Math.floor((t - startMs) / BUCKET_MS));
    const rates = modelCost(u.model);
    buckets[idx]! += u.inputTokens * rates.input + u.outputTokens * rates.output;
  }

  const peakCost = Math.max(...buckets);
  const hasCost = peakCost > 0;
  const BLOCKS = ' ▁▂▃▄▅▆▇█';
  const line = buckets
    .map((c) => BLOCKS[peakCost > 0 ? Math.min(8, Math.round((c / peakCost) * 8)) : 0])
    .join('');
  return { line, peakCost, hasCost };
}

/** Return label width padded for alignment */
const LABEL_WIDTH = 7;
const COUNT_WIDTH = 8; // " 167k"
const DETAIL_WIDTH = 20; // " (in:95k out:72k)"

export const TokenPanel: React.FC<TokenPanelProps> = ({ summary }) => {
  const maxModelTokens = Math.max(...Array.from(summary.byModel.values()).map((m) => m.total), 1);

  const cols = process.stdout.columns || 80;
  const BAR_WIDTH = cols < 55 ? 12 : 20;
  const DIVIDER_WIDTH = Math.min(
    cols - 4,
    LABEL_WIDTH + BAR_WIDTH + COUNT_WIDTH + DETAIL_WIDTH + 4,
  );

  const { line: sparkline, peakCost, hasCost } = makeCostSparkline(summary.history);

  // Top 6 sessions by total tokens for the mini list
  const topSessions = Array.from(summary.bySession.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  const maxSessionTokens = topSessions.length > 0 ? topSessions[0]![1].total : 1;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      {/* Header */}
      <Box gap={2}>
        <Text bold color="yellow">
          토큰 사용량
        </Text>
        <Text>
          <Text bold>{formatNumber(summary.totalTokens)}</Text>
          <Text color="gray">
            {' '}
            (in:{formatNumber(summary.totalInput)} out:{formatNumber(summary.totalOutput)})
          </Text>
        </Text>
        <Text color="yellow" bold>
          ${summary.costEstimate.toFixed(2)}
        </Text>
        {summary.isDemo && (
          <Text color="red" dimColor>
            [DEMO]
          </Text>
        )}
      </Box>

      {/* Divider */}
      <Text color="gray">{'─'.repeat(DIVIDER_WIDTH)}</Text>

      {/* Model bars */}
      {Array.from(summary.byModel.entries()).map(([model, data]) => {
        const delta = summary.deltas.get(model);
        const deltaStr = delta && delta.totalDelta > 0 ? ` +${formatNumber(delta.totalDelta)}` : '';
        const modelName = shortModel(model);
        const color = modelColor(model);
        const bar = makeSplitBar(data.input, data.output, maxModelTokens, BAR_WIDTH);

        return (
          <Box key={model} gap={1}>
            <Text dimColor>{modelName.padEnd(LABEL_WIDTH)}</Text>
            <Text color={color}>{bar}</Text>
            <Text bold>{formatNumber(data.total).padStart(5)}</Text>
            <Text color="gray">
              {' '}
              (in:{formatNumber(data.input)} out:{formatNumber(data.output)})
            </Text>
            {deltaStr ? <Text color="green">{deltaStr}</Text> : null}
            <Text color="yellow"> ${data.cost.toFixed(2)}</Text>
          </Box>
        );
      })}

      {/* Cost sparkline (last 2h, 10-min buckets) */}
      {hasCost && (
        <Box gap={1} marginTop={0}>
          <Text color="gray" dimColor>
            비용 2h
          </Text>
          <Text color="yellow">{sparkline}</Text>
          <Text color="gray" dimColor>
            peak ${peakCost.toFixed(3)}/10m
          </Text>
        </Box>
      )}

      {/* Divider */}
      <Text color="gray">{'─'.repeat(DIVIDER_WIDTH)}</Text>
      <Box gap={1}>
        <Text dimColor>{'Total'.padEnd(LABEL_WIDTH)}</Text>
        <Text bold>{formatNumber(summary.totalTokens)}</Text>
        <Text color="gray"> tokens</Text>
      </Box>

      {/* Agent session mini list */}
      {topSessions.length > 0 && (
        <>
          <Text> </Text>
          <Text bold color="gray">
            에이전트 세션
          </Text>
          {topSessions.map(([sessionId, data]) => {
            const miniBar = makeBar(data.total, maxSessionTokens, 10);
            return (
              <Box key={sessionId} gap={1}>
                <Text dimColor>{'  ' + sessionId.slice(0, 14).padEnd(14)}</Text>
                <Text>{formatNumber(data.total).padStart(5)}</Text>
                <Text color="magenta">{miniBar}</Text>
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
};
