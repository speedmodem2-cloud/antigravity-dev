# 파이프라인 단계 전환 조건 정의서

## 전체 흐름

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
사전점검   설계      에셋준비   구현      리뷰      테스트    문서화    배포
```

## 필수 규칙

- Phase 스킵 시 반드시 사용자 확인
- Phase 전환 시 완료 요약 보고
- "진행" 지시 = 현재 Phase 완료 후 다음으로

---

## Phase 0: 사전 점검 → Phase 1: 설계

### 완료 조건

- 환경변수 확인 (GEMINI_API_KEY 등)
- MCP 서버 연결 상태 확인
- 필요 디렉토리 존재 확인
- 의존성 설치 상태 확인
- **TUI 대시보드 백그라운드 실행** (`cd c:/Dev/tools/tui-dashboard && pnpm dev`)

### 검증 방법

- 환경변수 echo 확인
- MCP 도구 호출 테스트
- 디렉토리 ls 확인
- TUI 프로세스 실행 확인

---

## Phase 1: 설계 → Phase 2: 에셋 준비

### 완료 조건

- INSTRUCTIONS.md 생성 완료
- 이미지 프롬프트 가이드 작성 (나노바나나 등)
- 폴더 구조 확정
- 기술 스택 결정
- 사용자 확인

### 검증 방법

- INSTRUCTIONS.md 파일 존재 및 내용 검토
- 이미지 프롬프트 목록 확인

---

## Phase 2: 에셋 준비 → Phase 3: 구현

### 완료 조건

**경로 A: 이미지 필요 프로젝트**

- 이미지 생성 완료 OR 사용자가 fallback 승인
- shared/assets/ 에 이미지 동기화
- WebP 변환 + 500KB 이하 확인

**경로 B: 이미지 불필요 프로젝트 (typography-first, icon-only 등)**

- 사용자에게 이미지 스킵 확인 받기
- CSS-only 시각 레이어 전략 확인 (ghost text, dot patterns, grid borders 등)
- 최소 2+ 시각 레이어 달성 방안 명시

### 검증 방법

- 경로 A: shared/assets/ 내 파일 존재 + 크기 확인
- 경로 B: 사용자 스킵 확인 기록 + CSS 레이어 계획 존재

---

## Phase 3: 구현 → Phase 4: 리뷰

### 완료 조건

- 모든 개발 TASK 완료
- shared/assets/ → src/assets/ 복사 완료 (이미지 있는 프로젝트만)
- tsc --noEmit 통과
- eslint --max-warnings=0 통과
- 브라우저 렌더링 확인

### 검증 방법

- TypeScript 컴파일 성공
- ESLint 에러 0개
- 개발 서버 실행 확인

---

## Phase 4: 리뷰 → Phase 5: 테스트

> ⚠️ Phase 4도 스킵 시 반드시 사용자 확인 필수 (v1.2 교훈: P2에서 미준수)

### 완료 조건

- REVIEW.md 작성 완료 (PASS 판정)
- 또는 2회 리뷰 후 CRITICAL 이슈 0개
- 접근성 체크리스트 확인
- 에셋 크기 검증 (이미지 있는 경우)
- CSS 시각 레이어 품질 검증 (이미지 없는 경우)

### 검증 방법

- REVIEW.md 존재 + PASS 판정
- review-checklist.md 체크리스트 통과

---

## Phase 5: 테스트 → Phase 6: 문서화

### 완료 조건

- tsc --noEmit 통과
- eslint --max-warnings=0 통과
- vitest 통과 (테스트 있을 경우)
- pnpm build 성공
- dist/ 크기 5MB 이하

### 검증 방법

- 각 명령어 exit code 0
- dist/ 폴더 크기 확인

---

## Phase 6: 문서화 → Phase 7: 배포

### 완료 조건

- README.md 생성
- 교훈(Lessons Learned) 기록

### 검증 방법

- README.md 파일 존재 및 내용 확인

---

## Phase 7: 배포

### 최종 확인

- deploy.sh 스크립트 실행 성공
- dist/ 크기 보고
- 이미지 크기 경고 없음 (이미지 없는 프로젝트는 해당 없음)
- 배포 태그 생성

---

## 보조 시스템 연동

### phase-state.json

파이프라인 진행 시 `logs/phase-state.json`을 업데이트하여 TUI 대시보드와 연동:

```json
{
  "project": "portfolio2",
  "currentPhase": 3,
  "completedPhases": [0, 1, 2],
  "updatedAt": "2026-02-18T12:00:00Z"
}
```

아키텍트 에이전트가 Phase 전환 시 이 파일을 업데이트할 책임.

### system/projects.json

프로젝트 시작 시 등록, 완료 시 상태 변경:

```json
{
  "projects": [
    {
      "name": "portfolio2",
      "status": "active",
      "path": "workspace/portfolio2",
      "startedAt": "2026-02-18"
    }
  ]
}
```
