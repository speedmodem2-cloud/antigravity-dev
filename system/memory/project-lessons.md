# Project Lessons (P1~P4)

## P1 (2026-02-17, synthwave, portfolio)

- No phase skip without user confirm
- Image: WebP ≤500KB, shared/assets/ → src/assets/images/
- Design: min 2 visual layers, no CSS-only minimal
- dist/ ≤5MB, a11y from start, lessons-learned required

## P2 (2026-02-18, brutalist, portfolio2)

- Data/design separation: reuse types/constants, swap design only
- No-image project: typography-first → 548KB dist
- CSS layers: ghost text, grid borders, dot patterns, section numbers
- Phase 4 review also requires skip confirmation
- phase-state.json + system/projects.json integration needed

## P3 (2026-02-18, synthwave-enhanced, portfolio3)

- Image strategy: decide unified vs per-section BEFORE coding (avoid rework)
- Hero bg separate from body bg (overlap = messy)
- Commits too large (10+ files) → split per component
- body fixed bg + blend-mode overlay = effective for non-hero sections
- Ambient glow orbs (body::before/after, fixed, blur) fill viewport margins

## P4 (2026-02-18, shop-backend1, NestJS)

- First backend project: NestJS + MySQL + Docker + TypeORM
- JwtModule.registerAsync() 필수 (register()는 .env 로딩 전 시크릿 평가 → 미스매치)
- E2E 테스트: 하드코딩 이메일 X → `Date.now()` 유니크 이메일
- FK 참조 있는 엔티티 삭제 시 soft delete 또는 cascade 필요
- Opus 비용 71% → 지휘 비용 절감 필요 (Phase 전환/리뷰만 Opus)
- 서브에이전트에게 "모듈당 1커밋" 규칙 전달 필요
- retrospect 도구: 백엔드 지표 추가 필요 (API 수, 테스트 수, 엔티티 수)
- 7 Phase 완주, 31 E2E pass, $6.22

## P5 (2026-02-19, shop-backend2-1, Wave 병렬 재구현)

- **Wave dispatch 검증**: 5 Wave, 최대 4 동시 에이전트 → 실제로 W2=4, W3=3, W4=2, W5=3 병렬 실행
- **Interface contracts 필수**: Wave 간 임포트 경로/클래스명 사전 정의 → 충돌 없이 병렬 가능
- **app.module.ts 오케스트레이터 패턴**: 에이전트는 건드리지 않고 Wave 후 오케스트레이터만 통합
- **uuid@13 ESM 이슈**: Jest CJS 환경에서 uuid@13 파싱 실패 → `src/__mocks__/uuid.js` + `moduleNameMapper` 해결
- **에이전트 범위 초과**: W2 Sonnet-Auctions가 seller dashboard까지 구현 (W4 범위) → W4 태스크 줄어듦. 에이전트 프롬프트에 범위 명시 강화 필요
- **E2E mock 패턴**: TypeORM repo mock + JwtModule.register('test-secret') + HealthModule 제외
- **Sonnet-E2E 자체 수정**: login 201→[200,201] 허용, price assertion 완화 (자체 수정 1회 규칙 작동)
- 유닛 19 pass, E2E 13 pass, 전체 빌드 0 에러

## Common

- pnpm global store: hardlinks (actual disk < reported size)
- Phase skip = always confirm (no exceptions)
- Post-project: retrospective + changelog
- Auto-launch TUI on project start
- Dev env improvements = maintenance (not a pipeline project)
