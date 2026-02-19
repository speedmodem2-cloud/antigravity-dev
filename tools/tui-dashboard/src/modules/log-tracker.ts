import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

export interface LogEntry {
  icon: string;
  tool: string;
  summary: string;
  timestamp?: number;
}

const CLAUDE_DIR = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.claude');
const PROJECTS_CLAUDE_DIR = join(CLAUDE_DIR, 'projects');

const TOOL_ICONS: Record<string, string> = {
  Bash: '🔧',
  Read: '📖',
  Write: '✏️',
  Edit: '✏️',
  Grep: '🔍',
  Glob: '📁',
  Task: '🤖',
  WebFetch: '🌐',
  WebSearch: '🌐',
  TodoWrite: '📋',
  Text: '💬',
};

function getIcon(tool: string): string {
  return TOOL_ICONS[tool] ?? '⚙️';
}

function findLatestJsonlFile(): string {
  try {
    if (!existsSync(PROJECTS_CLAUDE_DIR)) return '';
    let latestFile = '';
    let latestMtime = 0;
    const projectDirs = readdirSync(PROJECTS_CLAUDE_DIR);
    for (const dir of projectDirs) {
      const dirPath = join(PROJECTS_CLAUDE_DIR, dir);
      try {
        const stat = statSync(dirPath);
        if (!stat.isDirectory()) {
          if (dir.endsWith('.jsonl') && stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestFile = dirPath;
          }
          continue;
        }
        const files = readdirSync(dirPath).filter((f: string) => f.endsWith('.jsonl'));
        for (const f of files) {
          const fp = join(dirPath, f);
          const ms = statSync(fp).mtimeMs;
          if (ms > latestMtime) {
            latestMtime = ms;
            latestFile = fp;
          }
        }
      } catch {
        /* skip */
      }
    }
    return latestFile;
  } catch {
    return '';
  }
}

function firstStringValue(obj: Record<string, unknown>): string {
  for (const val of Object.values(obj)) {
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return '';
}

function extractSummary(name: string, input: Record<string, unknown>): string {
  if (name === 'Bash') {
    const cmd = input['command'];
    if (typeof cmd === 'string') return cmd.trim();
  }
  const filePath = input['file_path'] ?? input['path'];
  if (typeof filePath === 'string') return filePath.trim();
  const pattern = input['pattern'];
  if (typeof pattern === 'string') return pattern.trim();
  const prompt = input['prompt'];
  if (typeof prompt === 'string') return prompt.trim();
  return firstStringValue(input);
}

export class LogTracker {
  getRecentLogs(): LogEntry[] {
    try {
      const filePath = findLatestJsonlFile();
      if (!filePath) return [];

      const raw = readFileSync(filePath, 'utf-8');
      const lines = raw.split('\n').slice(-200);

      const entries: LogEntry[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as Record<string, unknown>;
          const type = obj['type'];

          if (type !== 'assistant') continue;

          const message = obj['message'] as Record<string, unknown> | undefined;
          if (!message) continue;

          const content = message['content'];
          if (!Array.isArray(content)) continue;

          for (const block of content as Record<string, unknown>[]) {
            const blockType = block['type'];

            if (blockType === 'tool_use') {
              const name = (block['name'] as string | undefined) ?? 'Unknown';
              const input = (block['input'] as Record<string, unknown> | undefined) ?? {};
              const rawSummary = extractSummary(name, input);
              const summary = rawSummary.slice(0, 100);
              entries.push({
                icon: getIcon(name),
                tool: name,
                summary,
              });
            } else if (blockType === 'text') {
              const text = block['text'];
              if (typeof text === 'string' && text.trim()) {
                const firstLine = text.trim().split('\n')[0] ?? '';
                if (firstLine.length < 3) continue;
                entries.push({
                  icon: getIcon('Text'),
                  tool: 'Text',
                  summary: firstLine.slice(0, 100),
                });
              }
            }
          }
        } catch {
          /* skip malformed lines */
        }
      }

      return entries.slice(-6);
    } catch {
      return [];
    }
  }
}
