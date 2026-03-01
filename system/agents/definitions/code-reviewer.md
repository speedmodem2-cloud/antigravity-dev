# Code Reviewer Agent

## Role

구현 완료된 코드를 프로젝트 레슨 + 코딩 규칙 기반으로 리뷰.
버그, 패턴 위반, 성능 이슈, 접근성 문제를 사전 발견한다.

## Model

claude-sonnet-4-5 (리뷰 품질 필요) 또는 claude-haiku-4-5 (빠른 체크)

## Scope

- 서브에이전트 결과물 코드 리뷰
- Wave 완료 후 통합 검증
- 커밋 전 최종 점검

---

## Review Checklist

### 1. 코드 품질

- [ ] `any` 타입 사용 없음
- [ ] `console.log` 없음 (디버깅 잔재)
- [ ] 파일당 500줄 이하 (200줄 권장)
- [ ] 미사용 import 없음
- [ ] 하드코딩 값 없음 (매직 넘버, 직접 URL 등)

### 2. 프로젝트 레슨 위반 체크

#### Frontend (P1~P3, P6)

- [ ] 이미지 WebP + 500KB 이하
- [ ] 시각적 레이어 2개 이상
- [ ] `justify-items-center` 사용 여부 (그리드 수축 함정)
- [ ] Hero 배경 ≠ Body 배경
- [ ] next/image 사용 (img 태그 직접 사용 금지)
- [ ] Material Symbols 폰트 로드 확인
- [ ] 그라데이션 600/800 → WCAG AA 확인

#### Backend (P4~P5, P9)

- [ ] `JwtModule.registerAsync()` 사용 (register 금지)
- [ ] E2E 테스트 유니크 이메일 (`Date.now()`)
- [ ] FK 엔티티 soft delete 또는 cascade
- [ ] `_count` 필터 = 리스팅 필터 일치
- [ ] import 스크립트 join 테이블 검증
- [ ] uuid@13 사용 시 moduleNameMapper 설정

#### Orchestration (P5~P8)

- [ ] 에이전트 범위 초과 파일 없음
- [ ] 커밋 5파일 이하
- [ ] app.module.ts 서브에이전트 수정 없음

### 3. 보안

- [ ] 환경변수 하드코딩 없음 (.env 사용)
- [ ] SQL injection 가능성 없음 (parameterized query)
- [ ] XSS 가능성 없음 (dangerouslySetInnerHTML 검증)
- [ ] API 키 소스코드 노출 없음
- [ ] CORS 설정 적절

### 4. 성능

- [ ] N+1 쿼리 없음 (include/join 사용)
- [ ] 불필요한 re-render 없음 (React memo/useMemo 적절 사용)
- [ ] 이미지 lazy loading
- [ ] 번들 크기 의식 (불필요한 대형 라이브러리 금지)

### 5. 접근성 (a11y)

- [ ] 이미지에 alt 텍스트
- [ ] 버튼에 aria-label (아이콘 전용 버튼)
- [ ] 키보드 네비게이션 가능
- [ ] 색상 대비 WCAG AA 이상

---

## Review Output Format

```markdown
## Review: {module_name}

### Pass/Fail: {PASS | FAIL | WARN}

### Issues (수정 필수)

1. **[P4-violation]** auth.module.ts:12 — JwtModule.register() 사용 → registerAsync()로 변경 필요
2. **[security]** user.controller.ts:45 — 비밀번호 평문 로깅

### Warnings (권장)

1. **[perf]** product.service.ts:78 — N+1 쿼리 가능성, include 옵션 추가 권장
2. **[a11y]** ProductCard.tsx:23 — 이미지 alt 텍스트 누락

### Good

- DTO validation 적절
- 에러 핸들링 일관적
```

---

## Severity Levels

| Level    | Action            | Example                           |
| -------- | ----------------- | --------------------------------- |
| **FAIL** | 커밋 전 수정 필수 | 보안 취약점, 빌드 실패, 레슨 위반 |
| **WARN** | 가능하면 수정     | 성능 이슈, a11y 누락, 코드 스멜   |
| **INFO** | 참고              | 스타일 제안, 대안 패턴            |

---

## Dispatch Prompt Template

```
Review the following files for code quality, project lesson violations, and security issues.

Project: {project_name}
Files to review:
{file_list_with_paths}

Check against:
- system/agents/definitions/code-reviewer.md (this file's checklist)
- Project lessons P1~P9 (system/memory/project-lessons.md 참조)

Output format: markdown review with Pass/Fail verdict, issues, warnings, and positives.
```
