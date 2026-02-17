/* eslint-disable no-console */
/**
 * 이미지 브릿지 MCP 서버
 * 나노바나나 생성 이미지를 shared/assets/로 동기화, 이미지 목록/검색 제공
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, '../../../../shared/assets');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];

function ensureAssetsDir(): void {
  if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });
}

function listImages(
  subDir?: string,
): { name: string; path: string; size: number; modified: string }[] {
  const dir = subDir ? resolve(ASSETS_DIR, subDir) : ASSETS_DIR;
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir, { withFileTypes: true });
  const images: { name: string; path: string; size: number; modified: string }[] = [];

  for (const file of files) {
    if (file.isFile() && IMAGE_EXTENSIONS.includes(extname(file.name).toLowerCase())) {
      const fullPath = resolve(dir, file.name);
      const stat = statSync(fullPath);
      images.push({
        name: file.name,
        path: fullPath,
        size: stat.size,
        modified: stat.mtime.toISOString().split('T')[0],
      });
    }
  }

  return images;
}

const server = new Server(
  { name: 'image-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'list_images',
      description: 'shared/assets/ 내 이미지 목록 조회',
      inputSchema: {
        type: 'object' as const,
        properties: {
          subDir: { type: 'string', description: '하위 폴더 (선택)' },
        },
      },
    },
    {
      name: 'sync_image',
      description: '외부 경로의 이미지를 shared/assets/로 복사',
      inputSchema: {
        type: 'object' as const,
        properties: {
          sourcePath: { type: 'string', description: '원본 이미지 경로' },
          targetName: { type: 'string', description: '저장할 파일명 (선택, 미지정시 원본명)' },
          subDir: { type: 'string', description: '하위 폴더 (선택)' },
        },
        required: ['sourcePath'],
      },
    },
    {
      name: 'search_images',
      description: '파일명으로 이미지 검색',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: '검색어 (파일명에 포함)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'sync_nanobanana',
      description: '나노바나나 다운로드 폴더에서 새 이미지를 자동 동기화',
      inputSchema: {
        type: 'object' as const,
        properties: {
          downloadDir: {
            type: 'string',
            description: '나노바나나 다운로드 폴더 경로 (기본: ~/Downloads)',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params;
  ensureAssetsDir();

  switch (name) {
    case 'list_images': {
      const images = listImages(args?.subDir as string | undefined);
      if (images.length === 0) {
        return { content: [{ type: 'text' as const, text: '이미지 없음' }] };
      }
      const list = images.map(
        (img) => `${img.name} (${(img.size / 1024).toFixed(1)}KB, ${img.modified})`,
      );
      return {
        content: [
          { type: 'text' as const, text: `이미지 ${images.length}개:\n${list.join('\n')}` },
        ],
      };
    }

    case 'sync_image': {
      const src = args?.sourcePath as string;
      if (!existsSync(src)) {
        return { content: [{ type: 'text' as const, text: `파일 없음: ${src}` }], isError: true };
      }
      const targetDir = args?.subDir ? resolve(ASSETS_DIR, args.subDir as string) : ASSETS_DIR;
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

      const fileName = (args?.targetName as string) ?? basename(src);
      const dest = resolve(targetDir, fileName);
      copyFileSync(src, dest);
      return {
        content: [{ type: 'text' as const, text: `동기화 완료: ${dest}` }],
      };
    }

    case 'search_images': {
      const query = (args?.query as string).toLowerCase();
      const allImages = listImages();
      const matched = allImages.filter((img) => img.name.toLowerCase().includes(query));
      if (matched.length === 0) {
        return { content: [{ type: 'text' as const, text: `"${query}" 결과 없음` }] };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: `검색 결과 ${matched.length}개:\n${matched.map((m) => m.path).join('\n')}`,
          },
        ],
      };
    }

    case 'sync_nanobanana': {
      const dlDir =
        (args?.downloadDir as string) ?? resolve(process.env.USERPROFILE ?? '', 'Downloads');
      if (!existsSync(dlDir)) {
        return { content: [{ type: 'text' as const, text: `폴더 없음: ${dlDir}` }], isError: true };
      }

      const nanoDir = resolve(ASSETS_DIR, 'nanobanana');
      if (!existsSync(nanoDir)) mkdirSync(nanoDir, { recursive: true });

      const files = readdirSync(dlDir);
      const imageFiles = files.filter((f) => {
        const ext = extname(f).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext) && f.toLowerCase().includes('nanobanana');
      });

      let synced = 0;
      for (const file of imageFiles) {
        const src = resolve(dlDir, file);
        const dest = resolve(nanoDir, file);
        if (!existsSync(dest)) {
          copyFileSync(src, dest);
          synced++;
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `나노바나나 동기화: ${synced}개 새 이미지 (전체 ${imageFiles.length}개 감지)`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: 'text' as const, text: `알 수 없는 도구: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Image Bridge MCP 서버 시작');
}

main().catch(console.error);
