# [프로젝트명] 지침서
> 생성일: YYYY-MM-DD | 버전: 1.0

## 프로젝트 개요
- 목적:
- 타겟 사용자:
- 핵심 기능:

## 기술 스택
- 프레임워크:
- 스타일링:
- 상태관리:
- 배포:

## 코딩 컨벤션
- 네이밍: camelCase (변수/함수), PascalCase (컴포넌트)
- 파일 구조: feature-based
- 컴포넌트 패턴: 함수형 컴포넌트만 사용
- 스타일 방식:

## 금지 패턴
- any 타입 사용 금지
- 인라인 스타일 금지 (특수한 경우 제외)
- console.log 커밋 금지
- 하드코딩 금지 (상수 파일 분리)

## 폴더 구조
```
src/
├── components/
├── pages/
├── hooks/
├── utils/
├── constants/
├── types/
└── styles/
```

## 품질 기준
- TypeScript strict 모드
- ESLint 에러 0개
- 모든 export 함수에 JSDoc 주석

## 커밋 컨벤션
- feat: 새 기능
- fix: 버그 수정
- refactor: 리팩토링
- style: 스타일 변경
- docs: 문서 수정
- chore: 설정/빌드

## AI 작업 지시사항
- 코드 변경 전 반드시 현재 파일 구조 확인
- 한 번에 한 파일만 수정
- 수정 후 lint 실행
- 테스트가 있으면 테스트 실행
