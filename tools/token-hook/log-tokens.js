#!/usr/bin/env node
/* eslint-disable */
// Claude Code Stop hook: JSONL에서 토큰 사용량 파싱 → usage.json 기록
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';

const DEV_ROOT = process.env.DEV_ROOT ?? 'D:\\Dev';
const USAGE_PATH = `${DEV_ROOT}/logs/tokens/usage.json`.replace(/\\/g, '/');

async function main() {
  let inputData = '';
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) inputData += line;

  let hookData;
  try {
    hookData = JSON.parse(inputData);
  } catch {
    process.exit(0);
  }

  const transcriptPath = hookData.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

  const lines = readFileSync(transcriptPath, 'utf-8').trim().split('\n');

  let inputTokens = 0,
    outputTokens = 0;
  let model = 'claude-sonnet-4-6';
  const sessionId = hookData.session_id ?? 'unknown';

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'assistant' && entry.message?.usage) {
        const u = entry.message.usage;
        inputTokens +=
          (u.input_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0);
        outputTokens += u.output_tokens ?? 0;
        if (entry.message.model) model = entry.message.model;
      }
    } catch {
      /* skip invalid lines */
    }
  }

  if (inputTokens === 0 && outputTokens === 0) process.exit(0);

  let data = { records: [] };
  if (existsSync(USAGE_PATH)) {
    try {
      data = JSON.parse(readFileSync(USAGE_PATH, 'utf-8'));
    } catch {
      /* use default */
    }
  }

  const idx = data.records.findIndex((r) => r.session === sessionId);
  const record = {
    timestamp: new Date().toISOString(),
    model,
    inputTokens,
    outputTokens,
    cost: 0,
    session: sessionId,
  };

  if (idx >= 0) data.records[idx] = record;
  else data.records.push(record);

  const dir = USAGE_PATH.substring(0, USAGE_PATH.lastIndexOf('/'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(USAGE_PATH, JSON.stringify(data, null, 2));
}

main().catch(() => process.exit(0));
