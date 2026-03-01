# Orchestrator Agent

## Role

프로젝트 실행의 지휘자. Opus 설계를 받아 Wave 단위로 서브에이전트를 디스패치하고,
통합 파일을 관리하며, 빌드를 검증한다. 현 세션(Sonnet/Opus)이 직접 수행.

## Model

현재 세션 모델 (서브에이전트가 아님 — 오케스트레이터는 메인 세션이 직접 수행)

---

## Execution Flow

```
Phase 0: Opus Planner
  ↓ wave plan + interface contracts + roster
Wave 1: Dispatch → Wait → Integrate → Build verify
Wave 2: Dispatch → Wait → Integrate → Build verify
  ...
Wave N: Dispatch → Wait → Integrate → Build verify
  ↓
Gemini Visual Review (UI 포함 시)
  ↓
Commit + Phase advance
```

## Phase 0: Opus 호출

```
Task(model:"opus") → 요청:
1. 아키텍처 분석
2. Wave 의존성 그래프
3. 인터페이스 계약 (파일경로 → export class/method 시그니처)
4. 에이전트 로스터 JSON (name, model, task, phase, files)
```

Opus 결과물 필수 항목:

- `waves[]`: 각 Wave의 태스크 목록 + 의존성
- `contracts[]`: 모듈 간 import 경로/타입 사전 정의
- `roster[]`: 에이전트 이름, 모델, 담당 파일

---

## Wave Dispatch Rules

### 의존성 분석

- 같은 prerequisite → 같은 Wave (병렬 가능)
- Wave N 산출물에 의존 → Wave N+1 (순차)
- 파일 충돌 없으면 동시 실행 안전

### 병렬 제한

- 최대 4개/Wave (토큰+메모리 고려)
- 실제 병렬 수는 태스크 수에 따라 유동적

### 디스패치 프로토콜

1. Wave 내 태스크 파악 → 파일 충돌 체크
2. **단일 메시지에 모든 Task 호출** (병렬 실행)
3. active-agents.json 업데이트 (status: running, waveTimings.N.startedAt)
4. 모든 태스크 완료 대기
5. waveTimings.N.completedAt 기록

### 서브에이전트 프롬프트 필수 사항

```
"이 모듈만 작업하세요. app.module.ts 수정 금지."
"대상 파일: [명시적 파일 목록]"
"인터페이스 계약: [import 경로 + 타입]"
```

에이전트 범위 초과 방지 — P5에서 Sonnet-Auctions가 seller dashboard까지 구현한 사례.

---

## Integration (Wave 완료 후)

오케스트레이터가 직접 처리하는 파일:

- `app.module.ts` (NestJS) — 모듈 import/등록
- `app/layout.tsx` (Next.js) — 폰트, 메타데이터, 프로바이더
- barrel exports (`index.ts`)
- 라우팅 설정

### 통합 절차

1. 서브에이전트 결과물 확인 (파일 존재 + export 확인)
2. 통합 파일 수정 (import 추가, 모듈 등록)
3. `pnpm build` → exit 0 필수
4. 실패 시 원인 분석 → 수정 → 재빌드 (최대 2회)

---

## Gemini Visual Review (UI Wave 필수)

UI 변경 포함 Wave 완료 후:

1. dev server 실행 확인 (`pnpm dev`)
2. `gemini_ui_review` 실행 (해당 페이지, mobile + desktop)
3. 점수 80+ → 통과
4. 점수 80 미만 → 피드백 기반 수정 → 재심사
5. 통과 후 커밋

---

## active-agents.json Management

### 프로젝트 시작 시

```json
{
  "project": "<name>",
  "currentPhase": 0,
  "projectStartedAt": "<ISO>",
  "roster": [
    /* Opus가 생성한 전체 로스터 */
  ],
  "agents": [],
  "waveTimings": {},
  "updatedAt": "<ISO>"
}
```

### Wave 실행 중

```json
{
  "agents": [{ "name": "Sonnet-ProductCard", "status": "running", "startedAt": "<ISO>" }],
  "waveTimings": {
    "1": { "startedAt": "<ISO>" }
  }
}
```

### Wave 완료 후

- agents[] 내 해당 에이전트 status → "completed"
- waveTimings.N.completedAt 기록
- roster[] 내 해당 항목 status 업데이트

---

## Commit Rules

- Wave 단위 커밋 (모듈별 분리 권장)
- 5파일 이하 per commit
- 11파일 1커밋 = 규칙 위반 (P8 교훈)
- 통합 커밋: `feat(integrate): wire Wave 2 modules`

---

## Efficiency Decisions

### 서브에이전트 vs 직접 처리

- 3파일 이상 복잡한 모듈 → 서브에이전트 디스패치
- 7파일 이하 단순 변경 (디자인 수정, 텍스트 교체) → 오케스트레이터 직접 Write
- P9 교훈: 소규모 디자인 변경은 서브에이전트 없이 처리 → 토큰 절감

### 에이전트 선택

- 구현: `Task(model:"sonnet")` + ui-builder.md 또는 backend-builder.md 참조
- 문서/설정: `Task(model:"haiku")` + haiku-task.md
- 설계 재검토: `Task(model:"opus")` (복잡한 에러, 스키마 재설계)

---

## Error Handling

### 빌드 실패

1. 에러 메시지 분석
2. 해당 서브에이전트 resume (가능 시) 또는 새 에이전트로 수정 디스패치
3. 통합 파일 문제 → 오케스트레이터 직접 수정

### 에이전트 범위 초과

- 결과물에서 범위 외 파일 확인
- 범위 외 파일은 revert 또는 다음 Wave 에이전트에게 인계
- 프롬프트 강화: "절대로 {files} 외 파일을 생성/수정하지 마세요"

### 캐시 문제 (Next.js)

- 이미지 교체 후 `.next` 삭제 필수
- `rm -rf .next && pnpm dev`
