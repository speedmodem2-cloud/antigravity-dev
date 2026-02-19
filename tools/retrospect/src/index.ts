/* eslint-disable no-console */
/**
 * Retrospect Engine
 * Analyzes: git commits, build artifacts, token usage, phase state
 * Outputs: KPT report + manual update proposals
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_ROOT = resolve(__dirname, '../../..');
const REPORTS_DIR = resolve(DEV_ROOT, 'logs/retrospect');
const TOKEN_PATH = resolve(DEV_ROOT, 'logs/tokens/usage.json');
const PHASE_PATH = resolve(DEV_ROOT, 'logs/phase-state.json');

// --- Types ---

interface CommitInfo {
  hash: string;
  message: string;
  date: string;
  files: number;
}

interface ArtifactAnalysis {
  distSize: number | null;
  distFileCount: number;
  hasImages: boolean;
  cssLayerCount: number;
  componentCount: number;
  typeFileCount: number;
}

interface TokenAnalysis {
  totalInput: number;
  totalOutput: number;
  totalCost: number;
  byModel: Record<string, { input: number; output: number; cost: number }>;
  sessionCount: number;
}

interface PhaseAnalysis {
  completed: number[];
  skipped: number[];
  current: number;
  allDone: boolean;
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
    distSize: number | null;
    totalTokenCost: number | null;
  };
  keep: string[];
  problem: string[];
  tryNext: string[];
  proposals: UpdateProposal[];
  artifacts: ArtifactAnalysis;
  tokens: TokenAnalysis | null;
  phases: PhaseAnalysis | null;
}

// --- Model costs ($/token) ---

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4.6': { input: 15.0 / 1e6, output: 75.0 / 1e6 },
  'claude-sonnet-4.5': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-haiku-4.5': { input: 0.8 / 1e6, output: 4.0 / 1e6 },
  'gemini-3-pro': { input: 1.25 / 1e6, output: 10.0 / 1e6 },
};

// --- Analyzers ---

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
        if (match?.[1] && current) current.files = parseInt(match[1], 10);
      }
    }
    if (current?.hash) commits.push(current as CommitInfo);
    return commits;
  } catch {
    return [];
  }
}

function analyzeArtifacts(projectPath: string): ArtifactAnalysis {
  const result: ArtifactAnalysis = {
    distSize: null,
    distFileCount: 0,
    hasImages: false,
    cssLayerCount: 0,
    componentCount: 0,
    typeFileCount: 0,
  };

  const distDir = join(projectPath, 'dist');
  if (existsSync(distDir)) {
    result.distSize = getDirSize(distDir);
    result.distFileCount = countFiles(distDir);
  }

  const imgDir = join(projectPath, 'src/assets/images');
  if (existsSync(imgDir)) {
    const imgFiles = readdirSync(imgDir).filter((f: string) =>
      /\.(webp|png|jpg|jpeg|svg)$/i.test(f),
    );
    result.hasImages = imgFiles.length > 0;
  }

  const srcDir = join(projectPath, 'src');
  if (existsSync(srcDir)) {
    result.cssLayerCount = countCssLayers(srcDir);
    result.componentCount = countFiles(join(projectPath, 'src/components'), '.tsx');
    result.typeFileCount = countFiles(join(projectPath, 'src/types'), '.ts');
  }

  return result;
}

function analyzeTokens(): TokenAnalysis | null {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    const records: Array<Record<string, unknown>> = raw.records ?? raw.data ?? [];
    if (records.length === 0) return null;

    const byModel: Record<string, { input: number; output: number; cost: number }> = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (const r of records) {
      const model = (r.model as string) ?? 'unknown';
      const inp = (r.inputTokens as number) ?? (r.input_tokens as number) ?? 0;
      const out = (r.outputTokens as number) ?? (r.output_tokens as number) ?? 0;
      const rates = MODEL_COSTS[model] ?? { input: 3e-6, output: 15e-6 };
      const cost = inp * rates.input + out * rates.output;

      totalInput += inp;
      totalOutput += out;
      totalCost += cost;

      if (!byModel[model]) byModel[model] = { input: 0, output: 0, cost: 0 };
      byModel[model].input += inp;
      byModel[model].output += out;
      byModel[model].cost += cost;
    }

    return { totalInput, totalOutput, totalCost, byModel, sessionCount: records.length };
  } catch {
    return null;
  }
}

function analyzePhases(): PhaseAnalysis | null {
  if (!existsSync(PHASE_PATH)) return null;
  try {
    const state = JSON.parse(readFileSync(PHASE_PATH, 'utf-8'));
    const completed: number[] = state.completedPhases ?? [];
    const allPhases = [0, 1, 2, 3, 4, 5, 6, 7];
    const skipped = allPhases.filter((p) => !completed.includes(p) && p < state.currentPhase);

    return {
      completed,
      skipped,
      current: state.currentPhase,
      allDone: completed.length === 8,
    };
  } catch {
    return null;
  }
}

// --- Utility ---

function getDirSize(dir: string): number {
  let total = 0;
  if (!existsSync(dir)) return 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    } else {
      total += statSync(fullPath).size;
    }
  }
  return total;
}

function countFiles(dir: string, ext?: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(join(dir, entry.name), ext);
    } else if (!ext || entry.name.endsWith(ext)) {
      count++;
    }
  }
  return count;
}

function countCssLayers(srcDir: string): number {
  const layerPatterns = [
    /ghost|opacity:\s*0\.[0-2]/i,
    /border.*solid.*#(000|1a1a)/i,
    /radial-gradient.*circle/i,
    /position:\s*absolute.*font-size.*[3-9]rem/i,
    /repeating-linear-gradient/i,
  ];

  let found = 0;
  const cssFiles = findFiles(srcDir, '.css');
  const allCss = cssFiles.map((f) => readFileSync(f, 'utf-8')).join('\n');

  for (const pattern of layerPatterns) {
    if (pattern.test(allCss)) found++;
  }
  return found;
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// --- Analysis Logic ---

function analyzeCommits(commits: CommitInfo[]): {
  keep: string[];
  problem: string[];
  tryNext: string[];
} {
  const keep: string[] = [];
  const problem: string[] = [];
  const tryNext: string[] = [];

  const hasConventionalCommits = commits.every((c) =>
    /^(feat|fix|docs|chore|refactor|test)\(/.test(c.message),
  );
  if (hasConventionalCommits) {
    keep.push('Conventional Commits compliance');
  } else {
    problem.push('Some commits lack Conventional Commits format');
    tryNext.push('Consider commitlint integration');
  }

  const largeCommits = commits.filter((c) => c.files > 10);
  if (largeCommits.length > 0) {
    problem.push(`${largeCommits.length} large commits (10+ files)`);
    tryNext.push('Split commits into smaller units');
  }

  const fixCommits = commits.filter((c) => c.message.startsWith('fix'));
  if (fixCommits.length > commits.length * 0.4) {
    problem.push(`High fix ratio (${fixCommits.length}/${commits.length})`);
    tryNext.push('Increase test coverage to prevent bugs');
  }

  const featCommits = commits.filter((c) => c.message.startsWith('feat'));
  if (featCommits.length > 0) {
    keep.push(`${featCommits.length} features implemented`);
  }

  return { keep, problem, tryNext };
}

function analyzeWithArtifacts(
  artifacts: ArtifactAnalysis,
  tokens: TokenAnalysis | null,
  phases: PhaseAnalysis | null,
): { keep: string[]; problem: string[]; tryNext: string[] } {
  const keep: string[] = [];
  const problem: string[] = [];
  const tryNext: string[] = [];

  if (artifacts.distSize !== null) {
    const sizeKB = Math.round(artifacts.distSize / 1024);
    if (!artifacts.hasImages && sizeKB < 1024) {
      keep.push(`Compact dist: ${sizeKB}KB (no-image project)`);
    } else if (artifacts.distSize < 5 * 1024 * 1024) {
      keep.push(`dist/ within limit: ${sizeKB}KB`);
    } else {
      problem.push(`dist/ exceeds 5MB: ${sizeKB}KB`);
      tryNext.push('Optimize assets and enable compression');
    }
  }

  if (!artifacts.hasImages && artifacts.cssLayerCount >= 2) {
    keep.push(`CSS-only visual layers: ${artifacts.cssLayerCount} techniques`);
  } else if (!artifacts.hasImages && artifacts.cssLayerCount < 2) {
    problem.push(`Only ${artifacts.cssLayerCount} CSS layer technique(s)`);
    tryNext.push('Add more CSS visual layers (ghost text, dot patterns, grid borders)');
  }

  if (artifacts.componentCount > 0) {
    keep.push(`${artifacts.componentCount} components, ${artifacts.typeFileCount} type files`);
  }

  if (tokens) {
    const costStr = `$${tokens.totalCost.toFixed(2)}`;
    keep.push(`Token cost: ${costStr} (${tokens.sessionCount} sessions)`);

    const opusCost = tokens.byModel['claude-opus-4.6']?.cost ?? 0;
    if (opusCost > tokens.totalCost * 0.6) {
      problem.push(`Opus = ${Math.round((opusCost / tokens.totalCost) * 100)}% of cost`);
      tryNext.push('Delegate more tasks to Sonnet/Haiku');
    }
  }

  if (phases) {
    if (phases.skipped.length > 0) {
      problem.push(`Skipped phases: ${phases.skipped.join(', ')}`);
      tryNext.push('Ensure phase skip has user confirmation');
    }
    if (phases.allDone) {
      keep.push('All 8 phases completed');
    }
  }

  return { keep, problem, tryNext };
}

function generateProposals(analysis: { problem: string[]; tryNext: string[] }): UpdateProposal[] {
  const proposals: UpdateProposal[] = [];

  for (const item of analysis.tryNext) {
    if (item.includes('commitlint')) {
      proposals.push({
        targetFile: 'system/manuals/coding-rules.md',
        changeType: 'modify',
        description: 'Add commitlint setup guide',
        approved: false,
      });
    }
    if (item.includes('test coverage')) {
      proposals.push({
        targetFile: 'system/manuals/quality-gates.md',
        changeType: 'modify',
        description: 'Add minimum test coverage threshold',
        approved: false,
      });
    }
    if (item.includes('CSS visual layers')) {
      proposals.push({
        targetFile: 'system/manuals/review-checklist.md',
        changeType: 'modify',
        description: 'Expand CSS layer technique examples',
        approved: false,
      });
    }
    if (item.includes('Sonnet/Haiku')) {
      proposals.push({
        targetFile: 'system/manuals/token-optimization.md',
        changeType: 'modify',
        description: 'Add model delegation guidelines',
        approved: false,
      });
    }
    if (item.includes('phase skip')) {
      proposals.push({
        targetFile: 'system/pipeline/stage-transitions.md',
        changeType: 'modify',
        description: 'Reinforce phase skip confirmation',
        approved: false,
      });
    }
  }

  return proposals;
}

// --- Report ---

function generateReport(project: string, projectPath?: string, since?: string): RetrospectReport {
  const commits = getRecentCommits(since);
  const commitAnalysis = analyzeCommits(commits);

  const resolvedPath = projectPath
    ? resolve(DEV_ROOT, projectPath)
    : resolve(DEV_ROOT, 'workspace', project);

  const artifacts = analyzeArtifacts(resolvedPath);
  const tokens = analyzeTokens();
  const phases = analyzePhases();
  const artifactAnalysis = analyzeWithArtifacts(artifacts, tokens, phases);

  const keep = [...commitAnalysis.keep, ...artifactAnalysis.keep];
  const problem = [...commitAnalysis.problem, ...artifactAnalysis.problem];
  const tryNext = [...commitAnalysis.tryNext, ...artifactAnalysis.tryNext];
  const proposals = generateProposals({ problem, tryNext });

  const totalFilesChanged = commits.reduce((sum, c) => sum + c.files, 0);
  const today = new Date().toISOString().split('T')[0] ?? '';

  return {
    id: `retro-${Date.now().toString(36)}`,
    date: today,
    project,
    summary: {
      totalCommits: commits.length,
      totalFilesChanged,
      tokenEstimate: totalFilesChanged * 200 * 4,
      distSize: artifacts.distSize,
      totalTokenCost: tokens?.totalCost ?? null,
    },
    keep,
    problem,
    tryNext,
    proposals,
    artifacts,
    tokens,
    phases,
  };
}

function formatReport(report: RetrospectReport): string {
  const lines: string[] = [
    `# Retrospect — ${report.project} — ${report.date}`,
    '',
    '## Summary',
    `- Commits: ${report.summary.totalCommits}`,
    `- Files changed: ${report.summary.totalFilesChanged}`,
  ];

  if (report.summary.distSize !== null) {
    lines.push(`- dist/: ${Math.round(report.summary.distSize / 1024)}KB`);
  }
  if (report.summary.totalTokenCost !== null) {
    lines.push(`- Token cost: $${report.summary.totalTokenCost.toFixed(2)}`);
  }
  lines.push('');

  if (report.keep.length > 0) {
    lines.push('## Keep');
    for (const k of report.keep) lines.push(`- ${k}`);
    lines.push('');
  }

  if (report.problem.length > 0) {
    lines.push('## Problem');
    for (const p of report.problem) lines.push(`- ${p}`);
    lines.push('');
  }

  if (report.tryNext.length > 0) {
    lines.push('## Try');
    for (const t of report.tryNext) lines.push(`- ${t}`);
    lines.push('');
  }

  lines.push('## Artifacts');
  lines.push(`- Images: ${report.artifacts.hasImages ? 'yes' : 'no'}`);
  lines.push(`- CSS layers: ${report.artifacts.cssLayerCount}`);
  lines.push(`- Components: ${report.artifacts.componentCount}`);
  lines.push(`- Type files: ${report.artifacts.typeFileCount}`);
  lines.push('');

  if (report.tokens) {
    lines.push('## Token Usage');
    lines.push('| Model | Input | Output | Cost |');
    lines.push('|-------|-------|--------|------|');
    for (const [model, data] of Object.entries(report.tokens.byModel)) {
      lines.push(
        `| ${model} | ${data.input.toLocaleString()} | ${data.output.toLocaleString()} | $${data.cost.toFixed(2)} |`,
      );
    }
    lines.push('');
  }

  if (report.phases) {
    lines.push('## Phases');
    lines.push(`- Completed: [${report.phases.completed.join(', ')}]`);
    if (report.phases.skipped.length > 0) {
      lines.push(`- Skipped: [${report.phases.skipped.join(', ')}]`);
    }
    lines.push(`- All done: ${report.phases.allDone ? 'yes' : 'no'}`);
    lines.push('');
  }

  if (report.proposals.length > 0) {
    lines.push('## Update Proposals');
    lines.push('| Target | Type | Description | Status |');
    lines.push('|--------|------|-------------|--------|');
    for (const p of report.proposals) {
      lines.push(`| ${p.targetFile} | ${p.changeType} | ${p.description} | pending |`);
    }
    lines.push('');
  }

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

// --- CLI ---

const command = process.argv[2] ?? 'analyze';
const project = process.argv[3] ?? 'dev-environment';
const sinceOrPath = process.argv[4];

if (command === 'analyze') {
  console.log(`Retrospect: ${project}`);

  let projectPath: string | undefined;
  let since: string | undefined;
  if (sinceOrPath?.includes('/') || sinceOrPath?.includes('\\')) {
    projectPath = sinceOrPath;
  } else {
    since = sinceOrPath;
  }

  const report = generateReport(project, projectPath, since);
  const path = saveReport(report);
  console.log(`\n${formatReport(report)}`);
  console.log(`Saved: ${path}`);
} else if (command === 'compare') {
  if (!existsSync(REPORTS_DIR)) {
    console.log('No reports found.');
    process.exit(0);
  }
  const files = readdirSync(REPORTS_DIR)
    .filter((f: string) => f.endsWith('.md'))
    .sort()
    .slice(-2);
  if (files.length < 2) {
    console.log('Need at least 2 reports to compare.');
  } else {
    console.log(`Latest reports:\n  1. ${files[0]}\n  2. ${files[1]}`);
  }
} else {
  console.log(`Retrospect Engine
  analyze [project] [since|path]  - Full analysis
  compare                          - Compare recent reports`);
}
