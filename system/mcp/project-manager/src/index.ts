/* eslint-disable no-console */
/**
 * 프로젝트 관리 MCP 서버
 * projects.json을 읽고/쓰고/수정하는 도구 제공
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECTS_PATH = resolve(__dirname, '../../../projects.json');

interface Project {
  id: string;
  name: string;
  type: 'web' | 'app' | 'library' | 'tool';
  status: 'planning' | 'active' | 'paused' | 'completed';
  path: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

interface ProjectsFile {
  version: string;
  lastUpdated: string;
  projects: Project[];
}

function loadProjects(): ProjectsFile {
  if (!existsSync(PROJECTS_PATH)) {
    return { version: '1.0', lastUpdated: new Date().toISOString().split('T')[0], projects: [] };
  }
  return JSON.parse(readFileSync(PROJECTS_PATH, 'utf-8'));
}

function saveProjects(data: ProjectsFile): void {
  data.lastUpdated = new Date().toISOString().split('T')[0];
  writeFileSync(PROJECTS_PATH, JSON.stringify(data, null, 2));
}

const server = new Server(
  { name: 'project-manager', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'list_projects',
      description: '등록된 프로젝트 목록 조회',
      inputSchema: {
        type: 'object' as const,
        properties: {
          status: { type: 'string', enum: ['planning', 'active', 'paused', 'completed'] },
        },
      },
    },
    {
      name: 'add_project',
      description: '새 프로젝트 등록',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: '프로젝트 이름' },
          type: { type: 'string', enum: ['web', 'app', 'library', 'tool'] },
          path: { type: 'string', description: '프로젝트 경로' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'type', 'path'],
      },
    },
    {
      name: 'update_project_status',
      description: '프로젝트 상태 변경',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: '프로젝트 ID' },
          status: { type: 'string', enum: ['planning', 'active', 'paused', 'completed'] },
        },
        required: ['id', 'status'],
      },
    },
    {
      name: 'remove_project',
      description: '프로젝트 제거 (파일은 삭제하지 않음)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: '프로젝트 ID' },
        },
        required: ['id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params;
  const data = loadProjects();

  switch (name) {
    case 'list_projects': {
      const status = args?.status as string | undefined;
      const filtered = status ? data.projects.filter((p) => p.status === status) : data.projects;
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(filtered, null, 2) }],
      };
    }

    case 'add_project': {
      const id = (args?.name as string).toLowerCase().replace(/\s+/g, '-');
      const project: Project = {
        id,
        name: args?.name as string,
        type: args?.type as Project['type'],
        status: 'planning',
        path: args?.path as string,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        tags: (args?.tags as string[]) ?? [],
      };
      data.projects.push(project);
      saveProjects(data);
      return {
        content: [
          { type: 'text' as const, text: `프로젝트 "${project.name}" 등록 완료 (ID: ${id})` },
        ],
      };
    }

    case 'update_project_status': {
      const proj = data.projects.find((p) => p.id === args?.id);
      if (!proj) {
        return {
          content: [{ type: 'text' as const, text: `프로젝트 "${args?.id}" 없음` }],
          isError: true,
        };
      }
      proj.status = args?.status as Project['status'];
      proj.updatedAt = new Date().toISOString().split('T')[0];
      saveProjects(data);
      return {
        content: [{ type: 'text' as const, text: `"${proj.name}" 상태 → ${proj.status}` }],
      };
    }

    case 'remove_project': {
      const idx = data.projects.findIndex((p) => p.id === args?.id);
      if (idx === -1) {
        return {
          content: [{ type: 'text' as const, text: `프로젝트 "${args?.id}" 없음` }],
          isError: true,
        };
      }
      const removed = data.projects.splice(idx, 1)[0];
      saveProjects(data);
      return {
        content: [{ type: 'text' as const, text: `"${removed.name}" 제거 완료` }],
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
  console.error('Project Manager MCP 서버 시작');
}

main().catch(console.error);
