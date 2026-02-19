# [프로젝트명] 지침서

> 생성일: YYYY-MM-DD | 버전: 1.0

## 프로젝트 개요

- 목적:
- 타겟 사용자:
- 핵심 기능:

## 기술 스택

- 프레임워크:
- 스타일링:
- 상태관리:
- 배포: `bash shared/snippets/deploy.sh [프로젝트명]`

## 페르소나 (해당 시)

- 이름:
- 태그라인:
- 스킬:

## 반응형 브레이크포인트

- Desktop: 1440px
- Tablet: 768px
- Mobile: 375px

## 테마

- 기본 테마:
- 컬러 팔레트:

## 코딩 컨벤션

- 네이밍: camelCase (변수/함수), PascalCase (컴포넌트)
- 파일 구조: 컴포넌트별 폴더 (index.tsx + 컴포넌트명.module.css)
- 컴포넌트 패턴: 함수형 컴포넌트만 사용

## 금지 패턴

- any 타입 사용 금지
- 인라인 스타일 금지 (동적 이미지 URL 예외)
- console.log 커밋 금지
- 하드코딩 금지 (constants/ 파일 분리)

## 폴더 구조

```
src/
├── components/
├── constants/
├── types/
├── styles/
│   ├── variables.css
│   └── global.css
├── assets/
│   └── images/
├── App.tsx
└── main.tsx
```

## Phase 전환 규칙 (필수)

- Phase를 건너뛰려면 반드시 사용자에게 확인받을 것
- Phase 간 전환 시 사용자에게 명시적으로 보고
- 각 Phase 완료 조건이 충족되어야 다음 Phase 진행
- "진행"이라는 지시 = 현재 Phase 완료 후 다음으로 넘어가라는 의미

## 에셋 관리

**이미지 있는 프로젝트:**

- 이미지 원본: shared/assets/ 에 보관
- 프로젝트용: src/assets/images/ 로 복사 (Phase 3 첫 태스크)
- 최적화 필수: WebP 형식, 단일 이미지 500KB 이하
- Fallback: 이미지 미준비 시 CSS 그라디언트 사용하되, 이미지 도입 예정임을 명시

**이미지 없는 프로젝트 (typography-first, icon-only 등):**

- Phase 2에서 사용자에게 이미지 스킵 확인 받기
- Phase 3 에셋 복사 태스크 해당 없음
- CSS-only 시각 레이어로 2+ 레이어 달성 (ghost text, dot patterns, grid borders 등)

## 디자인 품질 기준

- 배경이 단색/단순 그라디언트만으로 구성되면 안 됨
- 최소 2개 이상의 시각적 레이어
  - 이미지 프로젝트: 배경 이미지 + CSS 이펙트 + 콘텐츠
  - CSS-only 프로젝트: ghost text + grid borders + dot patterns 등
- 섹션 간 시각적 구분 (디바이더, 배경색 변화 등)
- 인터랙티브 요소 (호버 효과, 스크롤 애니메이션) 포함
- CSS-only 최소 구현 금지 → 시각적 풍부함 필수
- 장식 요소는 반드시 aria-hidden="true" + prefers-reduced-motion 지원

## 나노바나나 이미지 가이드 (해당 시)

- 이미지 프롬프트를 INSTRUCTIONS.md에 명시
- 파일명에 "nanobanana" 문자열 포함 (image-bridge 감지 조건)
- Downloads 폴더에 저장 후 `sync_nanobanana` MCP 도구로 동기화
- 저장 규칙: WebP 형식, 500KB 이하

## 품질 기준

- TypeScript strict 모드
- ESLint 에러 0개
- 모든 export 함수에 JSDoc 주석

## 커밋 컨벤션

- feat: 새 기능
- fix: 버그 수정
- refactor: 리팩토링
- style: 스타일 변경
- docs: 문서 수정
- chore: 설정/빌드

## AI 작업 지시사항

- 코드 변경 전 반드시 현재 파일 구조 확인
- 한 번에 한 파일만 수정
- 수정 후 lint 실행
- 테스트가 있으면 테스트 실행
- 에셋 복사 태스크 누락 금지

## 에이전트 태스크 목록

### 개발자 (Claude Sonnet 4.5) 태스크

- TASK-01: 프로젝트 스캐폴딩
- TASK-02: 설정 파일 (vite.config.ts 등)
- TASK-03: 타입 정의
- TASK-04: 상수/데이터
- TASK-05: 스타일 토큰 (variables.css)
- TASK-06: 글로벌 스타일 (global.css)
- TASK-07~N: 컴포넌트 구현
- TASK-FINAL: App.tsx 조합

### 리뷰어 (Gemini Pro) 태스크

- REVIEW-01: 전체 코드 리뷰
- 리뷰 초점: 버그, 타입 오류, 접근성(a11y), 에셋 최적화
- 최대 2회 리뷰 (CRITICAL 없으면 PASS)

### 테스터 (Claude Sonnet 4.5) 태스크

- TEST-01: tsc --noEmit
- TEST-02: eslint --max-warnings=0
- TEST-03: 스모크 테스트 작성 (vitest)
- TEST-04: pnpm build + dist/ 크기 검증

### 문서화 (Claude Haiku 4.5) 태스크

- DOC-01: README.md 작성
- DOC-02: 교훈(lessons learned) 기록
