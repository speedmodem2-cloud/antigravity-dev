/**
 * Vite 프로젝트 기본 설정 템플릿
 * workspace/ 아래 새 프로젝트 생성 시 복사해서 사용
 *
 * 참고: package.json에 아래 추가 권장 (esbuild 대화형 프롬프트 방지)
 * "pnpm": { "onlyBuiltDependencies": ["esbuild"] }
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  server: {
    port: 3000,
    open: true,
    hmr: {
      overlay: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: { modules: { classNameStrategy: 'non-scoped' } },
    setupFiles: ['./src/test/setup.ts'],
  },
});
