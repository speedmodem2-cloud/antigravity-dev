/**
 * 대화 세션 관리자 — 멀티턴 핑퐁용
 */
import type { GeminiMessage } from './index.js';

export interface ConversationMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface ConversationSession {
  id: string;
  topic?: string;
  startedAt: string;
  lastActivityAt: string;
  messages: ConversationMessage[];
  tokensUsed: { input: number; output: number };
}

const SESSION_TTL = 60 * 60 * 1000; // 1 hour
let counter = 0;

class ConversationManager {
  private sessions = new Map<string, ConversationSession>();

  createSession(topic?: string): string {
    this.pruneStale();
    const id = `conv_${Date.now()}_${++counter}`;
    const now = new Date().toISOString();
    this.sessions.set(id, {
      id,
      topic,
      startedAt: now,
      lastActivityAt: now,
      messages: [],
      tokensUsed: { input: 0, output: 0 },
    });
    return id;
  }

  getSession(id: string): ConversationSession | undefined {
    return this.sessions.get(id);
  }

  addMessage(sessionId: string, role: 'user' | 'model', text: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`세션 없음: ${sessionId}`);
    session.messages.push({ role, text, timestamp: new Date().toISOString() });
    session.lastActivityAt = new Date().toISOString();
  }

  addTokens(sessionId: string, input: number, output: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.tokensUsed.input += input;
    session.tokensUsed.output += output;
  }

  formatForGemini(sessionId: string): GeminiMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`세션 없음: ${sessionId}`);
    return session.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
  }

  getTurnNumber(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    return session.messages.filter((m) => m.role === 'user').length;
  }

  completeSession(sessionId: string): ConversationSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) this.sessions.delete(sessionId);
    return session;
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - new Date(session.lastActivityAt).getTime() > SESSION_TTL) {
        this.sessions.delete(id);
      }
    }
  }
}

export const conversationManager = new ConversationManager();
