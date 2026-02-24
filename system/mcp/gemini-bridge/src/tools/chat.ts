import { callGemini } from '../index.js';

export const chatTool = {
  name: 'gemini_chat',
  description: 'Gemini에게 단일 프롬프트 전송. 번역, 요약, 코드 리뷰, 아이디어 등 범용.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prompt: { type: 'string', description: 'Gemini에게 보낼 프롬프트' },
      model: { type: 'string', description: '모델 (기본: gemini-2.5-pro)' },
      temperature: { type: 'number', description: '온도 (기본: 0.7)' },
      maxTokens: { type: 'number', description: '최대 출력 토큰 (기본: 8192)' },
    },
    required: ['prompt'],
  },

  async execute(args: {
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    const result = await callGemini(args.prompt, {
      model: args.model,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
    });
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              response: result.text,
              tokensUsed: { input: result.inputTokens, output: result.outputTokens },
              model: result.model,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
