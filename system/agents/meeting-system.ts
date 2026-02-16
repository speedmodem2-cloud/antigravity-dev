/**
 * 에이전트 회의 시스템
 * 메시지 패싱, 투표, 회의록 자동 생성
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = resolve(__dirname, '../../logs/meetings');

export type MeetingType = 'design' | 'code-review' | 'retrospective';
export type MessageType = 'request' | 'response' | 'vote' | 'notify';
export type Priority = 'high' | 'normal' | 'low';

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  priority: Priority;
  subject: string;
  body: string;
  context?: {
    project?: string;
    files?: string[];
  };
  timestamp: string;
}

export interface Vote {
  agentId: string;
  choice: string;
  weight: number;
  reason: string;
}

export interface MeetingRecord {
  id: string;
  type: MeetingType;
  date: string;
  participants: string[];
  agenda: string[];
  messages: AgentMessage[];
  votes?: Vote[];
  decisions: string[];
  actionItems: { assignee: string; task: string; deadline?: string }[];
}

// 에이전트별 투표 가중치
const VOTE_WEIGHTS: Record<string, number> = {
  architect: 2,
  developer: 1,
  reviewer: 1,
  tester: 1,
  documenter: 1,
};

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${ts}-${rand}`;
}

export function createMessage(
  from: string,
  to: string,
  type: MessageType,
  subject: string,
  body: string,
  priority: Priority = 'normal',
): AgentMessage {
  return {
    id: generateId('msg'),
    from,
    to,
    type,
    priority,
    subject,
    body,
    timestamp: new Date().toISOString(),
  };
}

export function createMeeting(
  type: MeetingType,
  participants: string[],
  agenda: string[],
): MeetingRecord {
  return {
    id: generateId('mtg'),
    type,
    date: new Date().toISOString().split('T')[0],
    participants,
    agenda,
    messages: [],
    decisions: [],
    actionItems: [],
  };
}

export function addVote(
  meeting: MeetingRecord,
  agentId: string,
  choice: string,
  reason: string,
): void {
  if (!meeting.votes) meeting.votes = [];
  const weight = VOTE_WEIGHTS[agentId] ?? 1;
  meeting.votes.push({ agentId, choice, weight, reason });
}

export function resolveVotes(meeting: MeetingRecord): string | null {
  if (!meeting.votes || meeting.votes.length === 0) return null;

  const tally = new Map<string, number>();
  for (const vote of meeting.votes) {
    const current = tally.get(vote.choice) ?? 0;
    tally.set(vote.choice, current + vote.weight);
  }

  let maxScore = 0;
  let winner: string | null = null;
  let tie = false;

  for (const [choice, score] of tally) {
    if (score > maxScore) {
      maxScore = score;
      winner = choice;
      tie = false;
    } else if (score === maxScore) {
      tie = true;
    }
  }

  // 동률 시 architect 결정
  if (tie && meeting.votes) {
    const architectVote = meeting.votes.find((v) => v.agentId === 'architect');
    if (architectVote) return architectVote.choice;
  }

  return winner;
}

export function generateMinutes(meeting: MeetingRecord): string {
  const lines: string[] = [
    `# 회의록 - ${meeting.type} - ${meeting.date}`,
    '',
    '## 참석 에이전트',
    ...meeting.participants.map((p) => `- ${p}`),
    '',
    '## 의제',
    ...meeting.agenda.map((a, i) => `${i + 1}. ${a}`),
    '',
  ];

  if (meeting.messages.length > 0) {
    lines.push('## 논의 내용');
    for (const msg of meeting.messages) {
      lines.push(`- **${msg.from}** → ${msg.to}: ${msg.subject}`);
      lines.push(`  > ${msg.body}`);
    }
    lines.push('');
  }

  if (meeting.votes && meeting.votes.length > 0) {
    lines.push('## 투표 결과');
    for (const vote of meeting.votes) {
      const w = vote.weight > 1 ? ` (x${vote.weight})` : '';
      lines.push(`- ${vote.agentId}${w}: **${vote.choice}** - ${vote.reason}`);
    }
    const result = resolveVotes(meeting);
    if (result) lines.push(`\n**최종 결정: ${result}**`);
    lines.push('');
  }

  if (meeting.decisions.length > 0) {
    lines.push('## 결정 사항');
    for (const d of meeting.decisions) {
      lines.push(`- ${d}`);
    }
    lines.push('');
  }

  if (meeting.actionItems.length > 0) {
    lines.push('## 액션 아이템');
    for (const item of meeting.actionItems) {
      const dl = item.deadline ? ` (기한: ${item.deadline})` : '';
      lines.push(`- [ ] **${item.assignee}**: ${item.task}${dl}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function saveMeeting(meeting: MeetingRecord): string {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
  const filePath = resolve(LOGS_DIR, `${meeting.id}.md`);
  const content = generateMinutes(meeting);
  writeFileSync(filePath, content);
  return filePath;
}
