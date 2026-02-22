# Gemini Visual Review — Integration Guide

## When to Run (MANDATORY)

- **UI Wave 완료 후, 커밋 전**: UI 컴포넌트/페이지 변경이 포함된 Wave 완료 시 반드시 실행
- **최종 검증**: 프로젝트 완료 전 전체 페이지 리뷰
- **Skip 조건**: API-only, DB schema, util/lib 변경 등 UI 무관 Wave

## Command

```bash
cd c:/Dev/system/mcp/gemini-bridge && MSYS_NO_PATHCONV=1 npx tsx src/visual-review.ts http://localhost:3000 --all --pages /,/shops,/blog
```

### Options

- `--all`: mobile + tablet + desktop 전체 뷰포트
- `--pages /,/shops,/blog`: 검사할 경로 (쉼표 구분)
- `--mobile` / `--tablet` / `--desktop`: 개별 뷰포트
- `--json`: JSON 출력 (파이프라인 통합용)

### Prerequisites

- `GEMINI_API_KEY` 환경변수 필수
- dev server 실행 중 (`pnpm dev` in project)
- `MSYS_NO_PATHCONV=1` prefix 필수 (Git Bash에서 `/` 경로 변환 방지)

## Pass/Fail Criteria

| Score | Action                               |
| ----- | ------------------------------------ |
| ≥ 80  | PASS — 커밋 진행                     |
| 70-79 | 주요 이슈만 수정 후 재실행           |
| < 70  | 전면 수정 필수, 재실행까지 커밋 금지 |

## Workflow Integration

```
Wave 완료 (UI 포함)
  → pnpm build (빌드 검증)
  → visual-review 실행
  → Score ≥ 80? → 커밋
  → Score < 80? → 이슈 수정 → 재실행 → 커밋
```

## Known False Positives (무시해도 됨)

- **'N' 플로팅 아이콘**: Next.js DevTools 인디케이터 (dev mode only, production에선 없음)
- **푸터 연도 2026**: 현재 연도 맞음 (Gemini가 미래로 오인)
- **마지막 행 그리드 불균형**: 데이터 수에 따른 자연스러운 현상, CSS로 강제 정렬 시 오히려 악화

## Output

- `system/mcp/gemini-bridge/VISUAL-REVIEW.md` — 리뷰 히스토리 누적
- `system/mcp/gemini-bridge/screenshots/` — 캡처 이미지 저장

## Lessons from P6 (Phase 7)

1. **Wave 중간에 돌려야 한다**: 끝나고 돌리면 수정 비용 증가
2. **justify-items-center 함정**: CSS Grid에서 아이템 축소 유발 → w-full로 해결
3. **그라데이션 대비**: rose-500/700 → rose-600/800으로 변경해야 WCAG AA 충족
4. **aspect-ratio > fixed height**: 이미지 컨테이너는 `aspect-[4/3]`이 `h-48`보다 일관적
5. **모바일 칩 필터**: `shrink-0 snap-start min-h-[44px]` 조합 필수

## Lessons from P6 (Phase 9)

6. **이미지 교체 후 반드시 `.next` 삭제 + 서버 재시작**: Next.js 이미지 최적화 캐시가 구 이미지 유지. `rm -rf .next/cache/images` 또는 `.next` 전체 삭제
7. **dev server 실행 확인**: visual-review 전에 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` 체크
8. **이미지 플레이스홀더 = major issue**: DB에 이미지 없는 가게가 많으면 review에서 감점. 기본 이미지 품질이 중요
