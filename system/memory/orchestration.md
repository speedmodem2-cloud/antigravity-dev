# Orchestration Details

## Opus = Conductor Only

- 코드 직접 작성 금지. Break tasks → dispatch to subagents.
- 목표 비중: 전체 토큰의 20% 이하. 판단+디스패치만.
- Parallel dispatch: 단일 메시지에 복수 Task tool 호출.

## Sonnet = Implementation

- 자체 빌드 검증 후 보고, 에러 시 자체 수정 1회
- 한 커밋 5파일 이하, 모듈당 1커밋 — 프롬프트에 명시 필수

## Haiku = Lightweight

- docs, simple edits, search 전담
- 서브에이전트 기본 모델

## Opus-Gemini 핑퐁 의사결정

- **계획 단계에서 Opus 단독 결정 금지** → 반드시 Gemini와 핑퐁
- 흐름: Opus 초안(짧게) → Gemini 반론/대안/리스크 → Opus 최종 결정(1-2줄)
- **적용 시점**:
  - Phase 0: 프로젝트 구조, 에이전트 편성, 기술 스택 결정
  - 아키텍처 결정 (엔티티 설계, 모듈 구조, API 설계)
  - 복잡한 에러 원인 분석
  - Phase 전환 판단 (완료 조건 충족 여부)
- **안 쓸 때**: 단순 디스패치, pass/fail 확인, 사소한 수정
- 도구: gemini-bridge MCP 활용

## Wave-Based Parallel Dispatch (핵심 원칙)

### 원칙

- **Phase 순서가 아니라 의존성 그래프 기준**으로 Wave를 구성한다
- 파일 충돌이 없는 태스크는 무조건 동시 실행
- Wave = 동일 선행 조건을 가진 태스크 집합
- `app.module.ts` 같은 통합 파일은 Wave 완료 후 오케스트레이터가 직접 통합

### Wave 계획 절차 (Phase 0에서 필수)

1. 모든 태스크를 나열
2. 각 태스크의 선행 조건(어떤 파일/모듈이 존재해야 하나) 분석
3. 선행 조건이 같은 태스크 → 동일 Wave로 묶기
4. 각 Wave 내 파일 충돌 여부 확인 (다른 디렉토리면 OK)
5. Wave별 최대 병렬 에이전트 수 결정

### shop-backend2-1 기준 예시 (Wave 5개로 전체 커버)

| Wave | 에이전트                                            | 동시 수 |
| ---- | --------------------------------------------------- | ------- |
| W1   | Scaffold                                            | 1       |
| W2   | Auth+Users // Auctions // Redis // Notif-Schema     | 4       |
| W3   | Bids // WS-Gateway // Notif-Service                 | 3       |
| W4   | DistLock+Dashboard // UnitTests // Docker-Hardening | 3       |
| W5   | E2E // Deploy // Docs                               | 3       |

→ 최대 동시 4개, 예상 시간 ~50% 단축

### 에이전트 로스터 설계 원칙

- 로스터 = Wave별로 그룹핑 (JSON의 `phase` 필드 = wave 번호)
- 에이전트당 담당 범위: 독립 모듈 1~2개 (파일 충돌 없을 것)
- 각 에이전트 프롬프트에 **인터페이스 계약** 명시 (다른 Wave 결과물 임포트 시 경로/클래스명 사전 정의)

## Pre-Phase Agent Planning

- Phase 0에서 **에이전트 배치 계획** 필수 작성
- 기본 5종(architect/developer/tester/reviewer/documenter) 그대로 쓰지 말 것
- **프로젝트 특성 분석 먼저**:
  1. 이 프로젝트에 필요한 기술 도메인은? (예: WebSocket, Redis, CSS)
  2. 각 도메인별 난이도는? → 적합한 모델 선정
  3. Opus가 직접 할 일 vs 위임할 일 명확히 구분
  4. Gemini 핑퐁이 필요한 결정 사항 목록 작성
- 태스크 특화 에이전트 생성: WebSocket 전담, Redis 전담, 테스트 전담 등
- 계획서에 포함: 에이전트명, 모델, 담당 태스크, 병렬 그룹핑, Opus 위임 범위
