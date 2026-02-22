/**
 * Claude ↔ Gemini Bidirectional Review Bridge
 *
 * Modes:
 *   DEFAULT:  Human-readable output + REVIEW.md append
 *   --json:   Machine-readable JSON to stdout (for Claude to parse)
 *
 * Usage:
 *   npx tsx src/review.ts <file1> [file2] [--context <file>] [--json]
 *
 * Exit codes:
 *   0 = approved ([TASK_COMPLETE])
 *   1 = issues found ([ACTION_REQUIRED])
 *   2 = error
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { callGemini } from './index.js';

const REVIEW_FILE = resolve(process.cwd(), 'REVIEW.md');
const MAX_PING_PONG = 2;

interface ReviewRequest {
  files: { path: string; content: string }[];
  context?: string;
  round?: number;
  previousIssues?: string[];
}

interface ReviewResult {
  summary: string;
  issues: string[];
  suggestions: string[];
  approved: boolean;
}

interface MachineOutput {
  status: 'TASK_COMPLETE' | 'ACTION_REQUIRED' | 'HUMAN_REVIEW_NEEDED';
  round: number;
  approved: boolean;
  summary: string;
  issues: string[];
  suggestions: string[];
  tokensIn: number;
  tokensOut: number;
}

function buildReviewPrompt(req: ReviewRequest): string {
  const fileBlock = req.files
    .map((f) => `### ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``)
    .join('\n\n');

  const contextBlock = req.context ? `## Project Context\n${req.context}\n\n` : '';

  const roundInfo =
    req.round && req.round > 1
      ? `## Re-review (Round ${req.round}/${MAX_PING_PONG})
The following issues were reported in the previous round. Check if they are fixed:
${req.previousIssues?.map((i) => `- ${i}`).join('\n') ?? 'none'}

Focus ONLY on whether previous issues are resolved and any new critical problems.\n\n`
      : '';

  return `You are a senior frontend developer and UI/UX expert.
Review the code below. Respond ONLY with JSON, no prose.

${contextBlock}${roundInfo}## Code to Review
${fileBlock}

## Response Format (JSON only)
\`\`\`json
{
  "summary": "one-line summary",
  "issues": ["critical problems (empty array if none)"],
  "suggestions": ["improvement suggestions"],
  "approved": true/false
}
\`\`\`

Review criteria:
1. React 19 + Next.js 15 App Router compatibility
2. "use client" isolation (RSC principle)
3. Tailwind CSS v4 patterns
4. Mobile responsive + accessibility
5. Performance (unnecessary re-renders, bundle size)
6. Security (XSS, injection)

Rules:
- No pleasantries or filler text. JSON only.
- Keep issues/suggestions concise and actionable.
- issues[] = MUST fix (blocks approval). suggestions[] = SHOULD fix (does not block).`;
}

function parseReviewResponse(text: string): ReviewResult {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, text];
  try {
    return JSON.parse(jsonMatch[1]!.trim());
  } catch {
    return {
      summary: text.slice(0, 200),
      issues: [],
      suggestions: [text],
      approved: false,
    };
  }
}

function getStatusTag(result: ReviewResult, round: number): MachineOutput['status'] {
  if (result.approved && result.issues.length === 0) return 'TASK_COMPLETE';
  if (round >= MAX_PING_PONG && result.issues.length > 0) return 'HUMAN_REVIEW_NEEDED';
  if (result.issues.length > 0) return 'ACTION_REQUIRED';
  return 'TASK_COMPLETE';
}

function appendToReviewMd(filePaths: string[], result: ReviewResult, round: number): void {
  const date = new Date().toISOString().split('T')[0];
  const filesStr = filePaths.map((f) => `\`${f}\``).join(', ');
  const statusTag = getStatusTag(result, round);

  let entry = `\n### ${date} | Gemini Review R${round} — ${statusTag}\n`;
  entry += `**Files**: ${filesStr}\n`;
  entry += `**Summary**: ${result.summary}\n\n`;

  if (result.issues.length > 0) {
    entry += `**Issues:**\n`;
    for (const issue of result.issues) {
      entry += `- [ ] ${issue}\n`;
    }
    entry += '\n';
  }

  if (result.suggestions.length > 0) {
    entry += `**Suggestions:**\n`;
    for (const suggestion of result.suggestions) {
      entry += `- ${suggestion}\n`;
    }
    entry += '\n';
  }

  if (existsSync(REVIEW_FILE)) {
    const existing = readFileSync(REVIEW_FILE, 'utf-8');
    writeFileSync(REVIEW_FILE, existing + entry);
  } else {
    writeFileSync(REVIEW_FILE, `# Review Log\n\n## Feedback\n${entry}`);
  }
}

async function review(
  filePaths: string[],
  contextFile?: string,
  round = 1,
  previousIssues?: string[],
): Promise<MachineOutput> {
  const files = filePaths.map((p) => {
    const fullPath = resolve(process.cwd(), p);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    return { path: p, content: readFileSync(fullPath, 'utf-8') };
  });

  let context: string | undefined;
  if (contextFile) {
    const ctxPath = resolve(process.cwd(), contextFile);
    if (existsSync(ctxPath)) {
      context = readFileSync(ctxPath, 'utf-8');
    }
  }

  const prompt = buildReviewPrompt({ files, context, round, previousIssues });

  const response = await callGemini(prompt, {
    maxTokens: 4096,
    temperature: 0.3,
  });

  const result = parseReviewResponse(response.text);
  const status = getStatusTag(result, round);

  appendToReviewMd(filePaths, result, round);

  return {
    status,
    round,
    approved: result.approved,
    summary: result.summary,
    issues: result.issues,
    suggestions: result.suggestions,
    tokensIn: response.inputTokens,
    tokensOut: response.outputTokens,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Gemini Review Bridge

Usage:
  npx tsx src/review.ts <file1> [file2] [--context <file>] [--json] [--round N] [--prev-issues "i1||i2"]

Flags:
  --json              Machine-readable JSON output (for Claude)
  --round N           Review round number (default: 1)
  --prev-issues "..." Previous issues separated by || (for re-review)
  --context <file>    Project context file

Exit codes:
  0 = TASK_COMPLETE
  1 = ACTION_REQUIRED
  2 = HUMAN_REVIEW_NEEDED / error
`);
    process.exit(0);
  }

  // Parse args
  const filePaths: string[] = [];
  let contextFile: string | undefined;
  let jsonMode = false;
  let round = 1;
  let previousIssues: string[] | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--context' && args[i + 1]) {
      contextFile = args[++i];
    } else if (args[i] === '--json') {
      jsonMode = true;
    } else if (args[i] === '--round' && args[i + 1]) {
      round = parseInt(args[++i]!, 10);
    } else if (args[i] === '--prev-issues' && args[i + 1]) {
      previousIssues = args[++i]!.split('||').map((s) => s.trim());
    } else if (!args[i]!.startsWith('--')) {
      filePaths.push(args[i]!);
    }
  }

  try {
    const output = await review(filePaths, contextFile, round, previousIssues);

    if (jsonMode) {
      // Machine output: pure JSON to stdout
      console.log(JSON.stringify(output));
    } else {
      // Human output
      const icon = output.approved ? '✅' : '⚠️';
      console.log(`\n${icon} [R${output.round}] ${output.summary}`);

      if (output.issues.length > 0) {
        console.log('\nIssues:');
        for (const issue of output.issues) console.log(`  - ${issue}`);
      }
      if (output.suggestions.length > 0) {
        console.log('\nSuggestions:');
        for (const s of output.suggestions) console.log(`  - ${s}`);
      }
      console.log(`\nTokens: in=${output.tokensIn} out=${output.tokensOut}`);
      console.log(`Status: ${output.status}`);
      console.log(`-> REVIEW.md updated`);
    }

    // Exit code based on status
    if (output.status === 'TASK_COMPLETE') process.exit(0);
    if (output.status === 'ACTION_REQUIRED') process.exit(1);
    process.exit(2); // HUMAN_REVIEW_NEEDED
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (jsonMode) {
      console.log(JSON.stringify({ status: 'ERROR', message: msg }));
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(2);
  }
}

main();
