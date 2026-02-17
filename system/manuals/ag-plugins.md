# Antigravity 플러그인 가이드

## 필수 확장

### 코드 품질

- **ESLint** - 코드 린팅 (eslint.config.mjs 자동 연동)
- **Prettier** - 코드 포맷팅 (저장 시 자동 포맷)

### Git

- **GitLens** - Git blame, 히스토리, 브랜치 비교

### 개발 도구

- **TypeScript** - 타입 검사 (내장)
- **Path Intellisense** - 경로 자동완성

## MCP 서버 연결 설정

AG 설정 파일에 MCP 서버를 등록하여 에이전트가 도구를 사용할 수 있게 합니다.

```json
{
  "mcpServers": {
    "project-manager": {
      "command": "node",
      "args": ["--import", "tsx", "C:/Dev/system/mcp/project-manager/src/index.ts"]
    },
    "token-monitor": {
      "command": "node",
      "args": ["--import", "tsx", "C:/Dev/system/mcp/token-monitor/src/index.ts"]
    },
    "image-bridge": {
      "command": "node",
      "args": ["--import", "tsx", "C:/Dev/system/mcp/image-bridge/src/index.ts"]
    }
  }
}
```

## AG 브라우저 에이전트

AG 내장 브라우저 에이전트 활용:

- 웹 페이지 분석 → 디자인 참고
- API 문서 크롤링 → 타입 자동 생성
- 경쟁사 분석 → 기능 비교표 작성

## 권장 설정

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.eol": "\n"
}
```
