# Sonnet Implementation Agent Template

## 사용법

Opus가 Sonnet 서브에이전트 디스패치 시 이 템플릿 + 태스크 설명을 결합하여 프롬프트 생성.

## 프롬프트 템플릿

```
프로젝트: {project_name} (workspace/{project_folder}/)
태스크: {task_description}
참조 파일: {reference_files}

## 규칙 (필수)
1. 커밋: 5파일 이하, 모듈당 1커밋. conventional commits.
2. 빌드 검증: 구현 후 `pnpm build` 성공 확인. 실패 시 1회 자체 수정.
3. 에러 보고: 자체 수정 실패 시 에러 내용 + 시도한 수정 보고.
4. any 타입 금지, console.log 금지, 500줄/파일 이하.
5. 기존 패턴 따를 것: {existing_pattern_hint}

## 완료 조건
- [ ] 구현 완료
- [ ] 빌드 통과
- [ ] 커밋 완료 (conventional commit)
- [ ] 결과 1-2줄 요약 보고
```
