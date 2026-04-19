# AntiGravity Dev Environment

## Token Rules (HIGHEST PRIORITY)

- Short replies. No summary tables unless asked.
- Read→Edit same file immediately. Never interleave other Reads.
- Prefer Write over multiple small Edits (avoid repeated file open/close).
- Glob/Grep directly. Explore agent only when necessary.
- Subagents: haiku default, sonnet for implementation only.
- Never re-read a file already in context.
- Report results in 1-2 lines max.

## Pre-flight

- **프로젝트 등록**: 새 프로젝트 시작 시 `system/projects.json`에 `status: "active"` 항목 추가.
- Check env vars, deps, dirs, MCP before coding.
- Proactive: verify before user asks.

## Keys

- `GEMINI_API_KEY` required for Gemini Bridge
- `ANTHROPIC_API_KEY` not needed in Claude Code

## Structure

- `workspace/` projects | `system/manuals/` AI rules | `system/docs/` user docs (Korean)
- `system/agents/` definitions | `system/pipeline/` transitions | `system/mcp/` servers
- `tools/` tui-dashboard, phase-manager, agent-factory, retrospect
- `shared/` snippets, assets | `logs/` phase-state, tokens, retrospect

## Tools

- `phase-manager`: `tsx tools/phase-manager/src/index.ts <cmd>` (init/advance/complete/skip/status/reset)
- `retrospect`: `tsx tools/retrospect/src/index.ts analyze <project>`
- `tui-dashboard` v3.0: **봉인됨 (2026-04-17)**. TTY 미지원으로 Claude Code 세션에서 자동 실행 불가 → 유지 비용 > 효용. 코드는 `tools/tui-dashboard/`에 보존. 대규모 Wave 오케스트레이션 재개 시 수동 부활 검토.
- `gemini-bridge` MCP v2.0: 4 tools → `gemini_chat`, `gemini_chat_image`, `gemini_pingpong`, `gemini_ui_review`

## Gemini 활용 지침 (MANDATORY)

- **MCP 도구**: `.mcp.json`에 등록된 gemini-bridge 서버 (세션 시작 시 자동 로드)
- **단순 호출 (`gemini_chat`)**: 번역, 요약, 대안 아이디어, 코드 스타일 2nd opinion
- **이미지 분석 (`gemini_chat_image`)**: UI 시안 해석, 스크린샷 분석, 다이어그램 리딩
- **핑퐁 (`gemini_pingpong`)**: 설계 의사결정, 복잡한 아키텍처 리뷰, 고품질 카피라이팅 — 유저 개입 없이 Claude↔Gemini가 직접 대화하여 결론 도출
- **UI 리뷰 (`gemini_ui_review`)**: UI Wave 완료 후 필수 실행 (점수 80+ 통과)
- **사용 판단**: Claude가 자체적으로 부족하거나 2nd perspective가 유익한 경우 자유롭게 호출. 유저 허락 불필요.

## Agent Models

- **Opus 서브에이전트**: `Task(model:"opus")` — Phase 0 설계 (Wave 계획, 인터페이스 계약, 로스터)
- **현 세션(Sonnet) = 디스패처/통합자** — Opus 계획 실행, Wave 디스패치, app.module.ts 통합, 빌드 검증
- **Sonnet 서브에이전트**: 구현 (자체 빌드 검증, 에러 시 1회 자체 수정)
- **Haiku 서브에이전트**: docs, 단순 편집, 검색 (기본 모델)

## Orchestration (CRITICAL) → 상세: [orchestration.md](orchestration.md)

- **Phase 0**: `Task(model:"opus")` → 아키텍처 설계 + Wave 계획 + 인터페이스 계약 반환
- **Wave dispatch**: 의존성 그래프 기준 Wave 구성. 파일 충돌 없는 태스크 동시 실행. 최대 4개/Wave.
- `app.module.ts` 등 통합 파일은 Wave 완료 후 오케스트레이터 직접 처리.
- **에이전트 범위 명시 필수**: 프롬프트에 "이 모듈만, app.module.ts 수정 금지" 명시
- **커밋**: 5파일 이하, 모듈당 1커밋
- **Gemini Visual Review (MANDATORY for UI waves)**: UI 변경 포함 Wave 완료 후 반드시 `visual-review` 실행. 점수 80 미만 → 수정 후 재실행. 커밋 전 통과 필수. 상세: [gemini-visual-review.md](gemini-visual-review.md)

## Common Rules

- **병렬 최우선 (MANDATORY)**: 독립적인 작업은 반드시 병렬 실행. Wave 내 태스크, 서브에이전트 디스패치, Tool 호출 모두 의존성 없으면 동시 실행.
- **진행 추적**: 3단계 이상 작업 → TaskCreate/TaskUpdate 필수. 단순 작업도 in_progress → completed 상태 전환 명시.
- Phase skip = always confirm | Post-project = retrospective + changelog
- pnpm hardlinks (actual disk < reported) | Dev env = maintenance (not pipeline)
- Doc split: AI→English compressed (`manuals/`), User→Korean readable (`docs/`)

## Project Lessons → 상세: [project-lessons.md](project-lessons.md)

- P1: WebP ≤500KB, 2+ visual layers, dist ≤5MB
- P2: data/design 분리, typography-first
- P3: image strategy BEFORE coding, hero≠body bg
- P4: registerAsync, unique test emails, soft delete for FK
- P5: Wave dispatch 검증 완료. uuid@13 ESM→moduleNameMapper. 에이전트 범위 초과 주의.
- P6: UI Wave 완료 시 Gemini visual-review 필수. justify-items-center 함정. 그라데이션 600/800이 WCAG AA 충족.
- P6(P7~9): 이미지 교체 시 `.next` 캐시 삭제 필수. import 후 join 테이블 검증. \_count 필터=리스팅 필터 일치. 소규모 변경은 오케스트레이터 직접 Write.

## Subagent Templates → `system/agents/templates/`

- 서브에이전트 디스패치 시 템플릿 활용 → 프롬프트 토큰 절감
- sonnet-implement.md | sonnet-test.md | haiku-task.md

## Active Projects

- [speech-logs](project_speech_logs.md) — 말하기 훈련 파이프라인. Phase 1 MVP 구현 완료, 실전 5분 녹음 1회 대기 중.
- [personal-hub](project_personal_hub.md) — 호진씨 개인 AI 비서 시스템 (`C:\Dev\personal-hub\`). 모든 로그 통합 관리 + 프로필 상시 갱신 + 방향성 조언. 트리거: "상황 업데이트" / "방향성 조언" / "주간 회고".

## Feedback

- [Gemini chat 활용 피드백](feedback_gemini_chat_usage.md) — 디버깅 막힐 때 상세 컨텍스트로 2nd opinion 받는 패턴 긍정 평가
- [판단 위임 선호](feedback_decision_delegation.md) — Claude가 판단·실행 주도. 세부 선택 물음표 남발 금지. 큰 가치 결정만 사용자에게.

## Plan File Convention

- 프로젝트 시작 시 플랜 파일 설명에 프로젝트명 포함
- 완료된 플랜: `workspace/{project}/PLAN.md`로 복사 보관
- 진행 중 플랜: Claude plans 디렉토리 (자동 생성)
- Phase 전환 시 플랜 파일에 진행 상태 업데이트
