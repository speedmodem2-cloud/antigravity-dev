/**
 * Gemini Visual UI Review
 *
 * Takes screenshots of a URL at multiple viewports,
 * sends them to Gemini 2.5 Pro Vision for UI/UX analysis.
 *
 * Usage:
 *   npx tsx src/visual-review.ts <url> [--viewport 375x812] [--json] [--pages /,/shops,/blog]
 *
 * Exit codes:
 *   0 = approved
 *   1 = issues found
 *   2 = error
 */

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const REVIEW_FILE = resolve(process.cwd(), 'VISUAL-REVIEW.md');

interface Viewport {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
}

const PRESET_VIEWPORTS: Record<string, Viewport> = {
  mobile: {
    name: 'Mobile (375x812)',
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    isMobile: true,
  },
  tablet: { name: 'Tablet (768x1024)', width: 768, height: 1024, deviceScaleFactor: 2 },
  desktop: { name: 'Desktop (1440x900)', width: 1440, height: 900 },
};

interface VisualIssue {
  severity: 'critical' | 'major' | 'minor';
  category: string;
  description: string;
  location?: string;
}

interface VisualReviewResult {
  page: string;
  viewport: string;
  score: number;
  issues: VisualIssue[];
  positives: string[];
  summary: string;
}

interface ReviewOutput {
  url: string;
  timestamp: string;
  results: VisualReviewResult[];
  overallScore: number;
  totalIssues: number;
}

function buildVisualPrompt(page: string, viewport: Viewport): string {
  return `You are a senior UI/UX reviewer analyzing a screenshot of a Korean web application (떡마실 — a rice cake shop directory).

Page: ${page}
Viewport: ${viewport.name} (${viewport.width}x${viewport.height})
${viewport.isMobile ? 'This is a MOBILE view. Pay special attention to touch targets, readability, and mobile UX.' : ''}

Analyze this screenshot and respond ONLY with JSON:

\`\`\`json
{
  "score": <1-100>,
  "summary": "<one-line summary in Korean>",
  "issues": [
    {
      "severity": "critical|major|minor",
      "category": "layout|typography|color|spacing|accessibility|interaction|responsive|performance",
      "description": "<issue description in Korean>",
      "location": "<where on screen, e.g. 상단 히어로, 하단 카드 그리드>"
    }
  ],
  "positives": ["<positive aspects in Korean>"]
}
\`\`\`

Review criteria:
1. **Layout**: Alignment, spacing consistency, overflow, visual hierarchy
2. **Typography**: Readability, font size (mobile min 14px), line height, contrast
3. **Color**: Brand consistency, contrast ratio (WCAG AA), gradient effectiveness
4. **Spacing**: Consistent padding/margin, breathing room, no cramped elements
5. **Accessibility**: Touch targets (min 44px), focus indicators, color-only info
6. **Responsive**: Proper adaptation to viewport, no horizontal scroll, no cut-off
7. **Interaction cues**: Buttons look clickable, links distinguishable, hover states
8. **Visual polish**: Shadows, border radius consistency, overall professional feel

Rules:
- JSON only, no prose outside the JSON block
- Issues must be specific and actionable
- Score: 90-100 excellent, 70-89 good, 50-69 needs work, <50 poor
- Be thorough but fair — note positives too`;
}

async function captureScreenshot(
  page: puppeteer.Page,
  url: string,
  viewport: Viewport,
): Promise<Buffer> {
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  // Wait for animations to settle
  await new Promise((r) => setTimeout(r, 2000));

  const screenshot = await page.screenshot({
    fullPage: true,
    type: 'png',
  });

  return Buffer.from(screenshot);
}

async function callGeminiVision(
  imageBuffer: Buffer,
  prompt: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const base64Image = imageBuffer.toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.3,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? '';
  const usage = data.usageMetadata ?? {};

  return {
    text,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
  };
}

function parseVisualResponse(text: string): Omit<VisualReviewResult, 'page' | 'viewport'> {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, text];
  try {
    return JSON.parse(jsonMatch[1]!.trim());
  } catch {
    return {
      score: 0,
      summary: 'Failed to parse Gemini response',
      issues: [{ severity: 'critical', category: 'layout', description: text.slice(0, 300) }],
      positives: [],
    };
  }
}

function saveScreenshot(buffer: Buffer, page: string, viewport: string): string {
  const dir = resolve(process.cwd(), 'screenshots');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const safePage = page.replace(/\//g, '_').replace(/^_/, 'home') || 'home';
  const safeViewport = viewport.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safePage}-${safeViewport}.png`;
  const filepath = resolve(dir, filename);
  writeFileSync(filepath, buffer);
  return filepath;
}

function appendToReviewMd(output: ReviewOutput): void {
  const date = new Date().toISOString().split('T')[0];
  let md = '';

  if (!existsSync(REVIEW_FILE)) {
    md += '# Visual Review Log\n\n';
  }

  md += `\n## ${date} | Visual Review — Score: ${output.overallScore}/100\n`;
  md += `**URL**: ${output.url}\n`;
  md += `**Issues**: ${output.totalIssues}\n\n`;

  for (const result of output.results) {
    const icon = result.score >= 90 ? '🟢' : result.score >= 70 ? '🟡' : '🔴';
    md += `### ${icon} ${result.page} (${result.viewport}) — ${result.score}/100\n`;
    md += `${result.summary}\n\n`;

    if (result.issues.length > 0) {
      md += '**Issues:**\n';
      for (const issue of result.issues) {
        const badge =
          issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟠' : '🟡';
        md += `- ${badge} [${issue.category}] ${issue.description}`;
        if (issue.location) md += ` _(${issue.location})_`;
        md += '\n';
      }
      md += '\n';
    }

    if (result.positives.length > 0) {
      md += '**Positives:**\n';
      for (const p of result.positives) md += `- ✅ ${p}\n`;
      md += '\n';
    }
  }

  if (existsSync(REVIEW_FILE)) {
    const existing = readFileSync(REVIEW_FILE, 'utf-8');
    writeFileSync(REVIEW_FILE, existing + md);
  } else {
    writeFileSync(REVIEW_FILE, md);
  }
}

async function visualReview(
  baseUrl: string,
  pages: string[],
  viewports: Viewport[],
  jsonMode: boolean,
): Promise<ReviewOutput> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results: VisualReviewResult[] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  try {
    const page = await browser.newPage();

    for (const pagePath of pages) {
      const fullUrl = `${baseUrl}${pagePath}`;

      for (const viewport of viewports) {
        if (!jsonMode) {
          process.stdout.write(`  Capturing ${pagePath} @ ${viewport.name}...`);
        }

        const screenshot = await captureScreenshot(page, fullUrl, viewport);
        saveScreenshot(screenshot, pagePath, viewport.name);

        if (!jsonMode) {
          process.stdout.write(' sending to Gemini...');
        }

        const prompt = buildVisualPrompt(pagePath, viewport);
        const response = await callGeminiVision(screenshot, prompt);
        totalTokensIn += response.inputTokens;
        totalTokensOut += response.outputTokens;

        const parsed = parseVisualResponse(response.text);
        results.push({
          page: pagePath,
          viewport: viewport.name,
          ...parsed,
        });

        if (!jsonMode) {
          const icon = parsed.score >= 90 ? '🟢' : parsed.score >= 70 ? '🟡' : '🔴';
          console.log(` ${icon} ${parsed.score}/100 (${parsed.issues.length} issues)`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  const overallScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

  const output: ReviewOutput = {
    url: baseUrl,
    timestamp: new Date().toISOString(),
    results,
    overallScore,
    totalIssues,
  };

  // Save review
  appendToReviewMd(output);

  if (!jsonMode) {
    console.log(
      `\n  Overall: ${overallScore}/100 | Issues: ${totalIssues} | Tokens: in=${totalTokensIn} out=${totalTokensOut}`,
    );
    console.log(`  -> VISUAL-REVIEW.md updated`);
    console.log(`  -> Screenshots saved to ./screenshots/`);
  }

  return output;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Gemini Visual Review

Usage:
  npx tsx src/visual-review.ts <url> [options]

Options:
  --viewport <preset|WxH>  Viewport preset (mobile/tablet/desktop) or custom WxH
  --pages <paths>          Comma-separated page paths (default: /)
  --json                   Machine-readable JSON output
  --all                    Review all presets (mobile + tablet + desktop)

Examples:
  npx tsx src/visual-review.ts http://localhost:3000 --all --pages /,/shops,/blog
  npx tsx src/visual-review.ts http://localhost:3000 --viewport mobile
  npx tsx src/visual-review.ts http://localhost:3000 --viewport 1920x1080
`);
    process.exit(0);
  }

  const baseUrl = args[0]!;
  let viewports: Viewport[] = [];
  let pages = ['/'];
  let jsonMode = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--viewport' && args[i + 1]) {
      const val = args[++i]!;
      if (PRESET_VIEWPORTS[val]) {
        viewports.push(PRESET_VIEWPORTS[val]);
      } else {
        const [w, h] = val.split('x').map(Number);
        if (w && h) {
          viewports.push({ name: `Custom (${w}x${h})`, width: w, height: h });
        }
      }
    } else if (args[i] === '--pages' && args[i + 1]) {
      pages = args[++i]!.split(',');
    } else if (args[i] === '--json') {
      jsonMode = true;
    } else if (args[i] === '--all') {
      viewports = Object.values(PRESET_VIEWPORTS);
    }
  }

  if (viewports.length === 0) {
    viewports = [PRESET_VIEWPORTS.mobile, PRESET_VIEWPORTS.desktop];
  }

  if (!jsonMode) {
    console.log(`\nGemini Visual Review`);
    console.log(`  URL: ${baseUrl}`);
    console.log(`  Pages: ${pages.join(', ')}`);
    console.log(`  Viewports: ${viewports.map((v) => v.name).join(', ')}\n`);
  }

  try {
    const output = await visualReview(baseUrl, pages, viewports, jsonMode);

    if (jsonMode) {
      console.log(JSON.stringify(output));
    }

    process.exit(output.overallScore >= 70 ? 0 : 1);
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
