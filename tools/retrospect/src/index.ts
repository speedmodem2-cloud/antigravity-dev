/* eslint-disable no-console */
/**
 * 회고 엔진
 * Git 커밋, 에러 로그, 토큰 사용량을 분석하여 KPT 보고서 생성
 * 매뉴얼/지침 갱신 제안 자동 생성
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_ROOT = resolve(__dirname, '../../..');
const REPORTS_DIR = resolve(DEV_ROOT, 'logs/retrospect');
const MANUALS_DIR = resolve(DEV_ROOT, 'system/manuals');

interface CommitInfo {
  hash: string;
  message: string;
  date: string;
  files: number;
}

interface UpdateProposal {
  targetFile: string;
  changeType: 'add' | 'modify' | 'remove';
  description: string;
  approved: boolean;
}

interface RetrospectReport {
  id: string;
  date: string;
  project: string;
  summary: {
    totalCommits: number;
    totalFilesChanged: number;
    tokenEstimate: number;
  };
  keep: string[];
  problem: string[];
  tryNext: string[];
  proposals: UpdateProposal[];
}

function getRecentCommits(since?: string): CommitInfo[] {
  const sinceArg = since ? `--since="${since}"` : '--max-count=20';
  try {
    const raw = execSync(`git log ${sinceArg} --pretty=format:"%h|%s|%ai" --shortstat`, {
      cwd: DEV_ROOT,
      encoding: 'utf-8',
    });

    const commits: CommitInfo[] = [];
    const lines = raw.trim().split('\n');
    let current: Partial<CommitInfo> | null = null;

    for (const line of lines) {
      if (line.includes('|')) {
        if (current?.hash) commits.push(current as CommitInfo);
        const [hash, message, date] = line.split('|');
        current = { hash, message, date: date?.split(' ')[0] ?? '', files: 0 };
      } else if (line.includes('file')) {
        const match = line.match(/(\d+) files? changed/);
        if (match && current) current.files = parseInt(match[1], 10);
      }
    }
    if (current?.hash) commits.push(current as CommitInfo);
    return commits;
  } catch {
    return [];
  }
}

function getManualFiles(): string[] {
  if (!existsSync(MANUALS_DIR)) return [];
  return readdirSync(MANUALS_DIR).filter((f) => f.endsWith('.md'));
}

function analyzeCommits(commits: CommitInfo[]): {
  keep: string[];
  problem: string[];
  tryNext: string[];
} {
  const keep: string[] = [];
  const problem: string[] = [];
  const tryNext: string[] = [];

  // 커밋 패턴 분석
  const hasConventionalCommits = commits.every((c) =>
    /^(feat|fix|docs|chore|refactor|test)\(/.test(c.message),
  );
  if (hasConventionalCommits) {
    keep.push('Conventional Commits 규칙 준수');
  } else {
    problem.push('일부 커밋이 Conventional Commits 형식을 따르지 않음');
    tryNext.push('커밋 메시지 린트 도구 (commitlint) 도입 검토');
  }

  // 대규모 변경 감지
  const largeCommits = commits.filter((c) => c.files > 10);
  if (largeCommits.length > 0) {
    problem.push(`대규모 변경 커밋 ${largeCommits.length}건 (10+ 파일)`);
    tryNext.push('커밋을 더 작은 단위로 분리');
  }

  // fix 커밋 비율
  const fixCommits = commits.filter((c) => c.message.startsWith('fix'));
  if (fixCommits.length > commits.length * 0.4) {
    problem.push(`fix 커밋 비율이 높음 (${fixCommits.length}/${commits.length})`);
    tryNext.push('테스트 커버리지 강화로 버그 사전 방지');
  }

  // feat 커밋 존재
  const featCommits = commits.filter((c) => c.message.startsWith('feat'));
  if (featCommits.length > 0) {
    keep.push(`${featCommits.length}개 기능 구현 완료`);
  }

  return { keep, problem, tryNext };
}

function generateProposals(analysis: {
  keep: string[];
  problem: string[];
  tryNext: string[];
}): UpdateProposal[] {
  const proposals: UpdateProposal[] = [];

  for (const item of analysis.tryNext) {
    if (item.includes('commitlint')) {
      proposals.push({
        targetFile: 'system/manuals/commit-convention.md',
        changeType: 'modify',
        description: 'commitlint 설정 가이드 추가',
        approved: false,
      });
    }
    if (item.includes('테스트')) {
      proposals.push({
        targetFile: 'system/manuals/quality-gates.md',
        changeType: 'modify',
        description: '테스트 커버리지 최소 기준 추가',
        approved: false,
      });
    }
    if (item.includes('커밋') && item.includes('분리')) {
      proposals.push({
        targetFile: 'system/manuals/coding-rules.md',
        changeType: 'modify',
        description: '커밋 크기 제한 규칙 추가 (최대 10파일)',
        approved: false,
      });
    }
  }

  return proposals;
}

function generateReport(project: string, since?: string): RetrospectReport {
  const commits = getRecentCommits(since);
  getManualFiles(); // 향후 매뉴얼 분석에 사용
  const analysis = analyzeCommits(commits);
  const proposals = generateProposals(analysis);

  const totalFilesChanged = commits.reduce((sum, c) => sum + c.files, 0);
  // 대략적 토큰 추정: 파일당 평균 200줄 * 4토큰/줄
  const tokenEstimate = totalFilesChanged * 200 * 4;

  return {
    id: `retro-${Date.now().toString(36)}`,
    date: new Date().toISOString().split('T')[0],
    project,
    summary: {
      totalCommits: commits.length,
      totalFilesChanged,
      tokenEstimate,
    },
    ...analysis,
    proposals,
  };
}

function formatReport(report: RetrospectReport): string {
  const lines: string[] = [
    `# 회고 보고서 - ${report.project} - ${report.date}`,
    '',
    '## 요약',
    `- 커밋: ${report.summary.totalCommits}개`,
    `- 변경 파일: ${report.summary.totalFilesChanged}개`,
    `- 추정 토큰: ${report.summary.tokenEstimate.toLocaleString()}`,
    '',
  ];

  if (report.keep.length > 0) {
    lines.push('## Keep (유지)');
    for (const k of report.keep) lines.push(`- ${k}`);
    lines.push('');
  }

  if (report.problem.length > 0) {
    lines.push('## Problem (문제)');
    for (const p of report.problem) lines.push(`- ${p}`);
    lines.push('');
  }

  if (report.tryNext.length > 0) {
    lines.push('## Try (시도)');
    for (const t of report.tryNext) lines.push(`- ${t}`);
    lines.push('');
  }

  if (report.proposals.length > 0) {
    lines.push('## 지침 갱신 제안');
    lines.push('| 대상 파일 | 변경 유형 | 내용 | 승인 |');
    lines.push('|-----------|----------|------|------|');
    for (const p of report.proposals) {
      const status = p.approved ? 'O' : '대기';
      lines.push(`| ${p.targetFile} | ${p.changeType} | ${p.description} | ${status} |`);
    }
    lines.push('');
  }

  lines.push('## 승인 상태');
  lines.push('- [ ] 사용자 승인 대기');
  lines.push('');

  return lines.join('\n');
}

function saveReport(report: RetrospectReport): string {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const filePath = resolve(REPORTS_DIR, `${report.id}.md`);
  writeFileSync(filePath, formatReport(report));
  return filePath;
}

// CLI
const command = process.argv[2] ?? 'analyze';
const project = process.argv[3] ?? 'dev-environment';
const since = process.argv[4]; // optional: YYYY-MM-DD

if (command === 'analyze') {
  console.log(`회고 분석 시작: ${project}`);
  const report = generateReport(project, since);
  const path = saveReport(report);
  console.log(`\n${formatReport(report)}`);
  console.log(`보고서 저장: ${path}`);
} else {
  console.log(`
회고 엔진 사용법:
  pnpm run analyze                     - 전체 분석
  pnpm run analyze [project]           - 프로젝트 지정
  pnpm run analyze [project] [since]   - 기간 지정 (YYYY-MM-DD)
  `);
}
