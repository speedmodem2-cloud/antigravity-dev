# 에이전트 간 메시지 형식

## 메시지 구조

```json
{
  "id": "msg-{timestamp}-{random}",
  "from": "에이전트ID",
  "to": "에이전트ID | all",
  "type": "request | response | vote | notify",
  "priority": "high | normal | low",
  "subject": "메시지 제목",
  "body": "메시지 본문",
  "context": {
    "project": "프로젝트명",
    "files": ["관련 파일 경로"]
  },
  "timestamp": "ISO-8601"
}
```

## 메시지 유형

### request (요청)

- 다른 에이전트에게 작업 요청
- 예: developer → reviewer: 코드 리뷰 요청

### response (응답)

- 요청에 대한 결과 반환
- 예: reviewer → developer: 리뷰 결과

### vote (투표)

- 충돌 해결을 위한 투표
- 예: architect → all: 기술 스택 투표

### notify (알림)

- 일방적 정보 전달
- 예: tester → all: 테스트 실패 알림

## 우선순위 규칙

- high: 보안 이슈, 빌드 실패, 블로킹 버그
- normal: 일반 리뷰, 기능 구현
- low: 문서 업데이트, 스타일 개선
