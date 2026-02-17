/* eslint-disable no-console */
/**
 * 토큰 모니터 MCP 서버
 * 토큰 사용량 기록, 조회, 비용 분석
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../../logs/tokens');
const DATA_PATH = resolve(DATA_DIR, 'usage.json');

interface TokenRecord {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  session?: string;
  task?: string;
}

interface TokenData {
  records: TokenRecord[];
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4.6': { input: 0.015, output: 0.075 },
  'claude-sonnet-4.5': { input: 0.003, output: 0.015 },
  'claude-haiku-4.5': { input: 0.0008, output: 0.004 },
  'gemini-3-pro': { input: 0.00125, output: 0.005 },
  'gemini-3-flash': { input: 0.0001, output: 0.0004 },
};

function loadData(): TokenData {
  if (!existsSync(DATA_PATH)) return { records: [] };
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
}

function saveData(data: TokenData): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function calcCost(model: string, input: number, output: number): number {
  const rates = MODEL_COSTS[model] ?? { input: 0.003, output: 0.015 };
  return (input / 1000) * rates.input + (output / 1000) * rates.output;
}

const server = new Server(
  { name: 'token-monitor', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'record_usage',
      description: '토큰 사용량 기록',
      inputSchema: {
        type: 'object' as const,
        properties: {
          model: { type: 'string' },
          inputTokens: { type: 'number' },
          outputTokens: { type: 'number' },
          session: { type: 'string' },
          task: { type: 'string' },
        },
        required: ['model', 'inputTokens', 'outputTokens'],
      },
    },
    {
      name: 'get_summary',
      description: '토큰 사용량 요약 (일별/모델별)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD (미지정 시 오늘)' },
          model: { type: 'string', description: '특정 모델 필터' },
        },
      },
    },
    {
      name: 'get_cost_report',
      description: '비용 분석 리포트',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', description: '최근 N일 (기본 7)' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params;
  const data = loadData();

  switch (name) {
    case 'record_usage': {
      const model = args?.model as string;
      const inputTokens = args?.inputTokens as number;
      const outputTokens = args?.outputTokens as number;
      const cost = calcCost(model, inputTokens, outputTokens);

      const record: TokenRecord = {
        timestamp: new Date().toISOString(),
        model,
        inputTokens,
        outputTokens,
        cost,
        session: args?.session as string | undefined,
        task: args?.task as string | undefined,
      };

      data.records.push(record);
      saveData(data);
      return {
        content: [
          {
            type: 'text' as const,
            text: `기록 완료: ${model} | in:${inputTokens} out:${outputTokens} | $${cost.toFixed(4)}`,
          },
        ],
      };
    }

    case 'get_summary': {
      const targetDate = (args?.date as string) ?? new Date().toISOString().split('T')[0];
      const modelFilter = args?.model as string | undefined;

      let filtered = data.records.filter((r) => r.timestamp.startsWith(targetDate));
      if (modelFilter) filtered = filtered.filter((r) => r.model === modelFilter);

      const totalInput = filtered.reduce((s, r) => s + r.inputTokens, 0);
      const totalOutput = filtered.reduce((s, r) => s + r.outputTokens, 0);
      const totalCost = filtered.reduce((s, r) => s + r.cost, 0);

      const summary = {
        date: targetDate,
        calls: filtered.length,
        totalInput,
        totalOutput,
        totalCost: `$${totalCost.toFixed(4)}`,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
      };
    }

    case 'get_cost_report': {
      const days = (args?.days as number) ?? 7;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString();

      const filtered = data.records.filter((r) => r.timestamp >= sinceStr);

      const byModel = new Map<
        string,
        { input: number; output: number; cost: number; calls: number }
      >();
      for (const r of filtered) {
        const existing = byModel.get(r.model) ?? { input: 0, output: 0, cost: 0, calls: 0 };
        existing.input += r.inputTokens;
        existing.output += r.outputTokens;
        existing.cost += r.cost;
        existing.calls += 1;
        byModel.set(r.model, existing);
      }

      const report = {
        period: `최근 ${days}일`,
        totalCalls: filtered.length,
        totalCost: `$${filtered.reduce((s, r) => s + r.cost, 0).toFixed(4)}`,
        byModel: Object.fromEntries(
          [...byModel.entries()].map(([model, stats]) => [
            model,
            { ...stats, cost: `$${stats.cost.toFixed(4)}` },
          ]),
        ),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }],
      };
    }

    default:
      return {
        content: [{ type: 'text' as const, text: `알 수 없는 도구: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Token Monitor MCP 서버 시작');
}

main().catch(console.error);
