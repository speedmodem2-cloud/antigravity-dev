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
- `tui-dashboard` v2.2: auto-launch on project start (`cd c:/Dev/tools/tui-dashboard && pnpm dev`)

## Agent Models (프로젝트별 편성)

- 기본 풀: Opus, Sonnet, Gemini, Haiku — 프로젝트마다 Phase 0에서 선정
- 난이도: 단순→Haiku, 복잡→Sonnet, 아키텍처→Opus
- 불필요한 모델 생략 가능

## Orchestration (CRITICAL) → 상세: [orchestration.md](orchestration.md)

- **Opus = conductor only**. 코드 직접 작성 X. 판단+디스패치만. 목표 <20%.
- **Wave dispatch**: Phase 순서 아닌 의존성 그래프 기준으로 Wave 구성. 파일 충돌 없는 태스크 무조건 동시 실행. 최대 4개/Wave 목표. → 상세: [orchestration.md](orchestration.md)
- `app.module.ts` 등 통합 파일은 Wave 완료 후 오케스트레이터 직접 처리.
- Sonnet: 구현 (자체 빌드 검증, 에러 시 1회 자체 수정)
- **커밋**: 5파일 이하, 모듈당 1커밋
- **Opus-Gemini 핑퐁**: 계획 단계 중요 결정 시 필수 (gemini-bridge MCP)
- **Pre-Phase Agent Planning**: Phase 0에서 프로젝트별 에이전트 배치 계획 작성

## Common Rules

- Phase skip = always confirm | Post-project = retrospective + changelog
- pnpm hardlinks (actual disk < reported) | Dev env = maintenance (not pipeline)
- Doc split: AI→English compressed (`manuals/`), User→Korean readable (`docs/`)

## Project Lessons → 상세: [project-lessons.md](project-lessons.md)

- P1: WebP ≤500KB, 2+ visual layers, dist ≤5MB
- P2: data/design 분리, typography-first
- P3: image strategy BEFORE coding, hero≠body bg
- P4: registerAsync, unique test emails, soft delete for FK, Opus 71%→target <20%

## Subagent Templates → `system/agents/templates/`

- 서브에이전트 디스패치 시 템플릿 활용 → 프롬프트 토큰 절감
- sonnet-implement.md | sonnet-test.md | haiku-task.md

## Plan File Convention

- 프로젝트 시작 시 플랜 파일 설명에 프로젝트명 포함
- 완료된 플랜: `workspace/{project}/PLAN.md`로 복사 보관
- 진행 중 플랜: Claude plans 디렉토리 (자동 생성)
- Phase 전환 시 플랜 파일에 진행 상태 업데이트
