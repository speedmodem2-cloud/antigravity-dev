import { callGeminiMultiTurn } from '../index.js';
import { conversationManager } from '../conversation.js';

export const pingpongTool = {
  name: 'gemini_pingpong',
  description:
    '멀티턴 대화. Claude↔Gemini 핑퐁으로 품질 높은 결론 도출. sessionId 없으면 새 세션 생성.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      message: { type: 'string', description: '이번 턴에 보낼 메시지' },
      sessionId: { type: 'string', description: '기존 세션 ID (새 대화면 생략)' },
      action: {
        type: 'string',
        enum: ['send', 'complete', 'history'],
        description: 'send=메시지전송, complete=대화종료, history=기록조회',
      },
      topic: { type: 'string', description: '새 대화 주제 (새 세션 생성 시)' },
      model: { type: 'string', description: '모델 (기본: gemini-2.5-pro)' },
      temperature: { type: 'number', description: '온도 (기본: 0.7)' },
    },
    required: ['message'],
  },

  async execute(args: {
    message: string;
    sessionId?: string;
    action?: string;
    topic?: string;
    model?: string;
    temperature?: number;
  }) {
    const action = args.action ?? 'send';

    // history: 기존 세션 대화 내용 반환
    if (action === 'history') {
      if (!args.sessionId) {
        return { content: [{ type: 'text' as const, text: 'sessionId 필요' }], isError: true };
      }
      const session = conversationManager.getSession(args.sessionId);
      if (!session) {
        return {
          content: [{ type: 'text' as const, text: `세션 없음: ${args.sessionId}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(session, null, 2) }] };
    }

    // complete: 세션 종료 + 마지막 메시지 전송
    if (action === 'complete') {
      if (!args.sessionId) {
        return { content: [{ type: 'text' as const, text: 'sessionId 필요' }], isError: true };
      }
      // 마지막 메시지 전송
      conversationManager.addMessage(args.sessionId, 'user', args.message);
      const messages = conversationManager.formatForGemini(args.sessionId);
      const result = await callGeminiMultiTurn(messages, {
        model: args.model,
        temperature: args.temperature,
      });
      conversationManager.addMessage(args.sessionId, 'model', result.text);
      conversationManager.addTokens(args.sessionId, result.inputTokens, result.outputTokens);
      const turn = conversationManager.getTurnNumber(args.sessionId);
      const session = conversationManager.completeSession(args.sessionId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                sessionId: args.sessionId,
                response: result.text,
                turnNumber: turn,
                tokensUsed: { input: result.inputTokens, output: result.outputTokens },
                conversationTokens: session?.tokensUsed,
                status: 'completed',
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // send: 메시지 전송 (새 세션 또는 기존 세션)
    const sessionId = args.sessionId ?? conversationManager.createSession(args.topic);
    conversationManager.addMessage(sessionId, 'user', args.message);
    const messages = conversationManager.formatForGemini(sessionId);
    const result = await callGeminiMultiTurn(messages, {
      model: args.model,
      temperature: args.temperature,
    });
    conversationManager.addMessage(sessionId, 'model', result.text);
    conversationManager.addTokens(sessionId, result.inputTokens, result.outputTokens);
    const turn = conversationManager.getTurnNumber(sessionId);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              sessionId,
              response: result.text,
              turnNumber: turn,
              tokensUsed: { input: result.inputTokens, output: result.outputTokens },
              conversationTokens: conversationManager.getSession(sessionId)?.tokensUsed,
              status: 'active',
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
