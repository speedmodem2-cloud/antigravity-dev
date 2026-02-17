/* eslint-disable no-console */
/**
 * Gemini API + NotebookLM 연동 모듈
 * AG 내에서 Gemini API 직접 호출 + NotebookLM 문서 분석 자동화
 *
 * 사용 전 환경변수 설정 필요:
 *   GEMINI_API_KEY=your-api-key
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

const DEFAULT_CONFIG: GeminiConfig = {
  apiKey: process.env.GEMINI_API_KEY ?? '',
  model: 'gemini-2.5-pro',
  maxTokens: 8192,
  temperature: 0.7,
};

/**
 * Gemini API 호출
 */
export async function callGemini(
  prompt: string,
  config: Partial<GeminiConfig> = {},
): Promise<GeminiResponse> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: cfg.maxTokens,
      temperature: cfg.temperature,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API 오류 (${response.status}): ${error}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? '';
  const usage = data.usageMetadata ?? {};

  return {
    text,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
    model: cfg.model,
  };
}

/**
 * 파일 내용을 Gemini에게 분석 요청
 */
export async function analyzeFile(
  filePath: string,
  instruction: string,
  config: Partial<GeminiConfig> = {},
): Promise<GeminiResponse> {
  if (!existsSync(filePath)) {
    throw new Error(`파일 없음: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const prompt = `${instruction}\n\n---\n파일: ${filePath}\n---\n${content}`;

  return callGemini(prompt, config);
}

/**
 * NotebookLM 소스 준비 - 문서를 NotebookLM에 업로드할 형식으로 정리
 * NotebookLM은 직접 API가 없으므로 문서를 정리하여 수동 업로드 지원
 */
export function prepareForNotebookLM(
  files: string[],
): { fileName: string; content: string; wordCount: number }[] {
  const results: { fileName: string; content: string; wordCount: number }[] = [];

  for (const file of files) {
    const fullPath = resolve(__dirname, '../../../../', file);
    if (!existsSync(fullPath)) continue;

    const content = readFileSync(fullPath, 'utf-8');
    results.push({
      fileName: file,
      content,
      wordCount: content.split(/\s+/).length,
    });
  }

  return results;
}

/**
 * 멀티모델 비교 - 같은 프롬프트로 Gemini와 Claude 결과 비교용 포맷 생성
 */
export function createComparisonPrompt(
  task: string,
  context: string,
): {
  geminiPrompt: string;
  claudePrompt: string;
} {
  const base = `[태스크] ${task}\n\n[컨텍스트]\n${context}\n\n[응답 형식] 간결하게 핵심만 답변`;

  return {
    geminiPrompt: `당신은 Gemini AI입니다. ${base}`,
    claudePrompt: base,
  };
}

// CLI 진입점
if (process.argv[1]?.includes('gemini-bridge')) {
  const command = process.argv[2];

  if (command === 'test') {
    console.log('Gemini 연결 테스트...');
    callGemini('Hello, 간단한 테스트입니다. 한국어로 짧게 답해주세요.')
      .then((res) => {
        console.log(`응답: ${res.text}`);
        console.log(`토큰: in=${res.inputTokens} out=${res.outputTokens}`);
      })
      .catch((err: Error) => console.error(`오류: ${err.message}`));
  } else if (command === 'analyze' && process.argv[3]) {
    const instruction = process.argv[4] ?? '이 파일의 주요 내용을 요약해주세요';
    analyzeFile(process.argv[3], instruction)
      .then((res) => console.log(res.text))
      .catch((err: Error) => console.error(`오류: ${err.message}`));
  } else {
    console.log(`
Gemini Bridge 사용법:
  node --import tsx src/index.ts test              - 연결 테스트
  node --import tsx src/index.ts analyze <file>    - 파일 분석
    `);
  }
}
