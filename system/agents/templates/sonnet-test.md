# Sonnet Test Agent Template

## 프롬프트 템플릿

```
프로젝트: {project_name} (workspace/{project_folder}/)
태스크: {test_scope_description}

## 규칙 (필수)
1. 테스트 이메일/유저: `Date.now()` 유니크 값 사용. 하드코딩 금지.
2. E2E 순서: auth → CRUD → 연관 기능 → 정리.
3. 각 테스트 독립적: 다른 테스트에 의존하지 않는 데이터 사용.
4. 실패 시: 에러 로그 + 원인 분석 1회 자체 수정.
5. 커밋: 모듈당 1커밋, 5파일 이하.

## 완료 조건
- [ ] 테스트 작성 완료
- [ ] `pnpm test:e2e` 전 통과
- [ ] 커밋 완료
- [ ] 결과 보고: 통과 N개 / 실패 N개
```
