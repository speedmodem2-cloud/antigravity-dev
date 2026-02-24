import { callGeminiWithImage } from '../index.js';

const VIEWPORTS: Record<string, { width: number; height: number }> = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

const REVIEW_PROMPT = `You are a senior UI/UX reviewer. Analyze this screenshot and provide:

1. **Overall Score** (0-100): Based on visual quality, consistency, readability, spacing
2. **Issues**: List problems with severity (critical/major/minor), category, description, location
3. **Positives**: What works well
4. **Summary**: 1-2 sentence Korean summary

Respond in JSON format:
{
  "score": number,
  "summary": "string (Korean)",
  "issues": [{ "severity": "critical|major|minor", "category": "string", "description": "string", "location": "string" }],
  "positives": ["string"]
}`;

export const uiReviewTool = {
  name: 'gemini_ui_review',
  description: 'Puppeteer 스크린샷 + Gemini Vision으로 UI 품질 리뷰. 점수/이슈/개선점 반환.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: '리뷰할 URL (예: http://localhost:3000)' },
      pages: {
        type: 'array' as const,
        items: { type: 'string' },
        description: '리뷰할 페이지 경로 (기본: ["/"])',
      },
      viewports: {
        type: 'array' as const,
        items: { type: 'string', enum: ['mobile', 'tablet', 'desktop'] },
        description: '뷰포트 (기본: ["mobile", "desktop"])',
      },
    },
    required: ['url'],
  },

  async execute(args: { url: string; pages?: string[]; viewports?: string[] }) {
    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      return {
        content: [{ type: 'text' as const, text: 'puppeteer 미설치. pnpm add puppeteer 필요.' }],
        isError: true,
      };
    }

    const pages = args.pages ?? ['/'];
    const viewportKeys = args.viewports ?? ['mobile', 'desktop'];
    const results: Array<{ page: string; viewport: string; review: unknown }> = [];
    let totalScore = 0;
    let reviewCount = 0;

    const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });

    try {
      for (const pagePath of pages) {
        for (const vpKey of viewportKeys) {
          const vp = VIEWPORTS[vpKey] ?? VIEWPORTS.desktop;
          const page = await browser.newPage();
          await page.setViewport(vp);

          const fullUrl = `${args.url.replace(/\/$/, '')}${pagePath}`;
          await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 1000));

          const screenshot = (await page.screenshot({
            encoding: 'base64',
            fullPage: true,
          })) as string;
          await page.close();

          const prompt = `${REVIEW_PROMPT}\n\nPage: ${pagePath}\nViewport: ${vpKey} (${vp.width}x${vp.height})`;
          const geminiResult = await callGeminiWithImage(prompt, screenshot, 'image/png', {
            temperature: 0.3,
          });

          let review: unknown;
          try {
            const jsonMatch = geminiResult.text.match(/\{[\s\S]*\}/);
            review = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: geminiResult.text };
          } catch {
            review = { raw: geminiResult.text };
          }

          const score =
            typeof (review as { score?: number }).score === 'number'
              ? (review as { score: number }).score
              : 0;
          totalScore += score;
          reviewCount++;

          results.push({ page: pagePath, viewport: `${vpKey} (${vp.width}x${vp.height})`, review });
        }
      }
    } finally {
      await browser.close();
    }

    const overallScore = reviewCount > 0 ? Math.round(totalScore / reviewCount) : 0;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              overallScore,
              totalPages: pages.length,
              totalReviews: reviewCount,
              results,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
