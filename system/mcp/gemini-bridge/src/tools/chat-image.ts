import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { callGeminiWithImage } from '../index.js';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export const chatImageTool = {
  name: 'gemini_chat_image',
  description: 'Gemini Vision으로 이미지 분석. UI 시안, 스크린샷, 다이어그램 등.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prompt: { type: 'string', description: '이미지에 대한 분석 요청' },
      imagePath: { type: 'string', description: '이미지 절대 경로' },
      model: { type: 'string', description: '모델 (기본: gemini-2.5-pro)' },
    },
    required: ['prompt', 'imagePath'],
  },

  async execute(args: { prompt: string; imagePath: string; model?: string }) {
    if (!existsSync(args.imagePath)) {
      return {
        content: [{ type: 'text' as const, text: `파일 없음: ${args.imagePath}` }],
        isError: true,
      };
    }

    const ext = extname(args.imagePath).toLowerCase();
    const mimeType = MIME[ext] ?? 'image/png';
    const base64 = readFileSync(args.imagePath).toString('base64');

    const result = await callGeminiWithImage(args.prompt, base64, mimeType, { model: args.model });
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
