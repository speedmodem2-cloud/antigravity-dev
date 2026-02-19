# Token Optimization

## Prompt Compression

- Instructions ≤500 lines
- Deduplicate → reference links
- Code examples ≤3 lines
- Comments: key points only

## Context Filter

**Include:** task-related files, changed sections, errors, type defs
**Exclude:** node_modules, dist/, build/, lock files, unchanged files, resolved issues

## Size Limits

| Item         | Max       |
| ------------ | --------- |
| Single file  | 500 lines |
| Instruction  | 200 lines |
| Prompt       | 100 lines |
| Code example | 20 lines  |

## Caching

- Repeated Q&A → manual docs (reference)
- Common patterns → shared/snippets/
- Frequent commands → scripts

## Model Selection

| Task         | Model                     |
| ------------ | ------------------------- |
| Architecture | Opus 4.6                  |
| Coding       | Sonnet 4.5 / Gemini 3 Pro |
| Simple tasks | Haiku 4.5                 |
| Code review  | Gemini 3 Pro              |
| Docs         | Haiku                     |
