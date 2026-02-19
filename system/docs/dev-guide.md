# AntiGravity 개발 가이드

이 문서는 사용자를 위한 개발 환경 참조 가이드입니다.
AI 에이전트용 지침은 `system/manuals/`에 별도 관리됩니다.

---

## 코딩 규칙

### 필수

- 코드 변경 전 반드시 현재 파일 읽기
- 한 번에 한 파일씩 수정
- 수정 후 lint 실행
- 새 파일은 TypeScript (.ts/.tsx)
- 모든 함수에 반환 타입 명시
- 매직 넘버 금지 → 상수 파일로 분리

### 금지 사항

- `any` 타입, `var`, `==` (=== 사용)
- `console.log` 잔류
- 주석 없는 복잡한 로직
- 500줄 초과 단일 파일

### 코드 작성 순서

타입/인터페이스 → 상수 → 유틸 함수 → 메인 로직 → export

### 이미지 처리

- WebP 형식 우선 (PNG/JPG는 원본 보관용)
- 단일 이미지 500KB 이하
- 원본: `shared/assets/` → 프로젝트: `src/assets/images/`

---

## 품질 게이트

| 게이트        | 기준                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **G1 코드**   | ESLint 0, TypeScript 0, 미사용 import 0                               |
| **G2 구조**   | 파일 <500줄, 함수 <50줄, 중첩 <3단계                                  |
| **G3 문서**   | JSDoc, README, CHANGELOG 업데이트                                     |
| **G4 보안**   | 하드코딩 키 없음, .env gitignore, 취약점 0                            |
| **G5 에셋**   | 이미지: WebP ≤500KB, dist/ ≤5MB / 무이미지: dist/ ≤1MB, CSS 레이어 ≥2 |
| **G6 접근성** | 시맨틱 HTML, 키보드 탐색, ARIA, 색상 대비 AA, 스킵 내비게이션         |

---

## 리뷰 체크리스트

### 기능 & 코드

- 요구사항 일치 여부
- 엣지 케이스 / 에러 처리
- 명확한 네이밍, 중복 없음, 정확한 타입

### 성능

- 불필요한 리렌더링, 메모리 누수, 최적화

### 접근성 (a11y)

- 시맨틱 HTML (header, nav, main, section, footer)
- 스킵 내비게이션, focus-visible, ARIA role/label
- 이미지 alt 또는 aria-hidden
- WCAG AA 색상 대비, 키보드 전용 탐색

### 에셋 & CSS 레이어

- 이미지 프로젝트: WebP, ≤500KB, dist/ ≤5MB
- 무이미지 프로젝트: 섹션당 CSS 레이어 ≥2, 장식 요소 aria-hidden, prefers-reduced-motion

---

## 토큰 최적화

### 파일 크기 권장

- 단일 파일: 500줄 이하
- 지침 파일: 200줄 이하
- 프롬프트: 100줄 이하
- 예시 코드: 20줄 이하

### 모델 배정

| 작업          | 모델                             |
| ------------- | -------------------------------- |
| 아키텍처 설계 | Claude Opus 4.6                  |
| 일반 코딩     | Claude Sonnet 4.5 / Gemini 3 Pro |
| 단순 작업     | Claude Haiku 4.5                 |
| 코드 리뷰     | Gemini 3 Pro                     |
| 문서 생성     | Haiku                            |

---

## 파이프라인 (8 Phase)

| Phase | 이름      | 담당     | 핵심                            |
| ----- | --------- | -------- | ------------------------------- |
| 0     | 사전 점검 | 아키텍트 | 환경, MCP, TUI 실행             |
| 1     | 설계      | 아키텍트 | INSTRUCTIONS.md 작성            |
| 2     | 에셋      | 아키텍트 | 이미지 생성 or 스킵 (확인 필수) |
| 3     | 구현      | 개발자   | 코드 작성                       |
| 4     | 리뷰      | 리뷰어   | 코드 리뷰 (스킵 시 확인 필수)   |
| 5     | 테스트    | 테스터   | tsc, ESLint, Vitest, build      |
| 6     | 문서화    | 문서화   | README, Lessons Learned         |
| 7     | 배포      | 아키텍트 | deploy.sh, dist 크기 보고       |

**중요:** Phase 스킵은 반드시 사용자 확인 필요 (예외 없음)

---

## 프로젝트 구조

```
c:/Dev/
  workspace/          ← 프로젝트들
  system/
    agents/           ← 에이전트 정의 (AI용)
    manuals/          ← AI용 지침 (영문 압축)
    docs/             ← 사용자용 가이드 (이 파일)
    pipeline/         ← Phase 전환 규칙
    mcp/              ← MCP 서버
    instructions/     ← 프로젝트 템플릿
  tools/              ← TUI 대시보드, agent-factory, retrospect
  shared/             ← 스니펫, 에셋
  logs/               ← phase-state.json, tokens/usage.json
```
