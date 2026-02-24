/* eslint-disable no-console */
/**
 * Gemini Bridge MCP Server
 * Claude ↔ Gemini 자유 통신 + 멀티턴 핑퐁
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { chatTool } from './tools/chat.js';
import { chatImageTool } from './tools/chat-image.js';
import { pingpongTool } from './tools/pingpong.js';
import { uiReviewTool } from './tools/ui-review.js';

const tools = [chatTool, chatImageTool, pingpongTool, uiReviewTool];
const toolMap = new Map(tools.map((t) => [t.name, t]));

const server = new Server(
  { name: 'gemini-bridge', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = toolMap.get(request.params.name);
  if (!tool) {
    return {
      content: [{ type: 'text' as const, text: `알 수 없는 도구: ${request.params.name}` }],
      isError: true,
    };
  }
  try {
    return await tool.execute(request.params.arguments as never);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `오류: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Gemini Bridge MCP Server v2.0 started');
}

main().catch((err) => {
  console.error('서버 시작 실패:', err);
  process.exit(1);
});
