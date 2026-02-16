/* eslint-disable no-console */
/**
 * 에이전트 팩토리
 * 새 에이전트 프로필을 템플릿 기반으로 자동 생성하고 registry.json에 등록
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_ROOT = resolve(__dirname, '../../../system/agents');
const REGISTRY_PATH = resolve(SYSTEM_ROOT, 'registry.json');
const DEFINITIONS_DIR = resolve(SYSTEM_ROOT, 'definitions');

interface AgentEntry {
  id: string;
  name: string;
  role: string;
  modelTier: string;
  status: string;
  profile: string;
}

interface Registry {
  version: string;
  lastUpdated: string;
  modelTiers: Record<string, unknown>;
  agents: AgentEntry[];
  meetingProtocol: string;
  retrospectProtocol: string;
}

interface AgentSpec {
  id: string;
  name: string;
  role: string;
  modelTier: 'top' | 'high' | 'mid' | 'low';
  defaultModel: string;
  fallbackModel?: string;
  permissions: string[];
  constraints: string[];
  references?: string[];
  outputs: string[];
}

function generateProfile(spec: AgentSpec): string {
  const lines: string[] = [
    `# ${spec.name} 에이전트`,
    '',
    '## 역할',
    spec.role,
    '',
    '## 모델 계층',
    `- 기본: ${spec.defaultModel} (${spec.modelTier})`,
  ];

  if (spec.fallbackModel) {
    lines.push(`- 폴백: ${spec.fallbackModel}`);
  }

  lines.push('', '## 권한');
  for (const perm of spec.permissions) {
    lines.push(`- ${perm}`);
  }

  lines.push('', '## 제약');
  for (const constraint of spec.constraints) {
    lines.push(`- ${constraint}`);
  }

  if (spec.references && spec.references.length > 0) {
    lines.push('', '## 참조');
    for (const ref of spec.references) {
      lines.push(`- ${ref}`);
    }
  }

  lines.push('', '## 출력');
  for (const output of spec.outputs) {
    lines.push(`- ${output}`);
  }

  lines.push('');
  return lines.join('\n');
}

function loadRegistry(): Registry {
  const raw = readFileSync(REGISTRY_PATH, 'utf-8');
  return JSON.parse(raw) as Registry;
}

function saveRegistry(registry: Registry): void {
  registry.lastUpdated = new Date().toISOString().split('T')[0];
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
}

export function createAgent(spec: AgentSpec): void {
  const registry = loadRegistry();

  // 중복 체크
  if (registry.agents.some((a) => a.id === spec.id)) {
    console.error(`에이전트 '${spec.id}'가 이미 존재합니다.`);
    return;
  }

  // 프로필 파일 생성
  const profilePath = `definitions/${spec.id}.md`;
  const fullPath = resolve(DEFINITIONS_DIR, `${spec.id}.md`);
  const content = generateProfile(spec);
  writeFileSync(fullPath, content);
  console.log(`프로필 생성: ${fullPath}`);

  // registry에 등록
  registry.agents.push({
    id: spec.id,
    name: spec.name,
    role: spec.role,
    modelTier: spec.modelTier,
    status: 'active',
    profile: profilePath,
  });
  saveRegistry(registry);
  console.log(`레지스트리 등록 완료: ${spec.id}`);
}

export function listAgents(): void {
  const registry = loadRegistry();
  console.log(`\n등록된 에이전트 (${registry.agents.length}개):\n`);
  for (const agent of registry.agents) {
    const status = agent.status === 'active' ? '[ON]' : '[OFF]';
    console.log(`  ${status} ${agent.id} - ${agent.name} (${agent.modelTier})`);
    console.log(`       ${agent.role}`);
  }
  console.log('');
}

export function removeAgent(agentId: string): void {
  const registry = loadRegistry();
  const idx = registry.agents.findIndex((a) => a.id === agentId);
  if (idx === -1) {
    console.error(`에이전트 '${agentId}'를 찾을 수 없습니다.`);
    return;
  }
  const removed = registry.agents.splice(idx, 1)[0];
  saveRegistry(registry);
  console.log(`에이전트 제거: ${removed.name} (${agentId})`);
}

// CLI 실행
const command = process.argv[2];

if (command === 'list') {
  listAgents();
} else if (command === 'remove' && process.argv[3]) {
  removeAgent(process.argv[3]);
} else if (command === 'create' && process.argv[3]) {
  // JSON 파일에서 spec 읽기
  const specPath = resolve(process.argv[3]);
  if (!existsSync(specPath)) {
    console.error(`스펙 파일을 찾을 수 없습니다: ${specPath}`);
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(specPath, 'utf-8')) as AgentSpec;
  createAgent(spec);
} else {
  console.log(`
에이전트 팩토리 사용법:
  pnpm create list              - 등록된 에이전트 목록
  pnpm create create <spec.json> - 새 에이전트 생성
  pnpm create remove <id>       - 에이전트 제거
  `);
}
