# Orchestration Rules

## Hierarchy

```
User
 └── Claude Code session (Sonnet 4.6) = Dispatcher/Integrator
       ├── Phase 0 → Task(model:"opus") = Planner [1 invocation]
       ├── W1..Wn → Task(model:"sonnet") = Implementer [parallel, max 4]
       │            Task(model:"haiku")  = Lightweight [parallel]
       └── Between waves → session handles integration files directly
```

## Role Rules

### Opus [Phase 0 Planner]

- Invoked once via `Task(model:"opus", ...)` before any implementation
- Output MUST include: wave dependency graph, interface contracts, agent roster JSON
- Interface contract format: `path/to/file.ts → export class Foo { method(arg): ReturnType }`
- May be re-invoked for: complex error root cause, schema redesign ("wrong = rebuild everything")
- NOT for: dispatch, file structure decisions, pass/fail checks

### Sonnet session [Dispatcher/Integrator]

- Reads Opus output → writes active-agents.json → dispatches waves → integrates → verifies build
- Handles integration files directly after each wave (app.module.ts, barrel exports)
- Does NOT implement feature modules (delegates to subagents)
- Build verification: `pnpm build` exit 0 required before next wave

### Sonnet subagent [Implementer]

- Scope: 1–2 modules per agent, specified files only
- Prompt MUST state: "Write THIS module only. Do NOT modify app.module.ts."
- Self-verify: run build, fix once on error, report result
- Commit: ≤5 files, 1 commit per module

### Haiku subagent [Lightweight]

- docs, README, .env.example, search, simple config files
- Default subagent model (use unless implementation required)

## Wave Dispatch Protocol

1. Opus produces wave plan → session reads it
2. Per wave: identify tasks with no unresolved dependencies
3. Check file conflict: tasks touching different directories → safe to parallelize
4. Dispatch all wave tasks simultaneously (single message, multiple Task calls)
5. Wait for all wave tasks to complete
6. Session integrates: update app.module.ts, verify build
7. Proceed to next wave

### Dependency rule

- Same prerequisites → same wave
- Wave N task depends on Wave N-1 output → sequential
- `app.module.ts`, `*.module.ts` (parent) → orchestrator only, post-wave

## Phase 0 Procedure

```
1. Task(model:"opus") → request: architecture analysis + wave plan + interface contracts + roster
2. Receive opus output
3. Write logs/active-agents.json  (roster with phase=wave_number, projectStartedAt)
4. Write logs/phase-state.json    (totalPhases, phaseNames)
5. Update system/projects.json    (status: "active")
6. Dispatch W1
```

## active-agents.json Schema

```json
{
  "project": "<name>",
  "currentPhase": 0,
  "projectStartedAt": "<ISO>",
  "roster": [
    {
      "name": "Opus-Planner",
      "model": "claude-opus-4-6",
      "task": "...",
      "phase": 0,
      "status": "pending"
    },
    {
      "name": "Sonnet-Foo",
      "model": "claude-sonnet-4-6",
      "task": "...",
      "phase": 1,
      "status": "pending"
    },
    {
      "name": "Haiku-Docs",
      "model": "claude-haiku-4-5-20251001",
      "task": "...",
      "phase": 5,
      "status": "pending"
    }
  ],
  "agents": [],
  "updatedAt": "<ISO>"
}
```

- `phase` = wave number (used for TUI grouping)
- Status transitions: pending → running → completed | failed

## Commit Rules

- ≤5 files per commit
- 1 commit per module
- Wave-level commit after orchestrator integration
- Message: `feat(<module>): <what>`

## Subagent Prompt Template (required fields)

```
Task: <module name>
Files to create: <explicit list>
Do NOT modify: app.module.ts, <other modules>
Interface contracts available:
  - <path> → <class/method signature>
After completion: run `pnpm build`, fix once if error, commit, report result.
```
