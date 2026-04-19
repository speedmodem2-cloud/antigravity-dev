---
name: personal-hub 통합 관리 시스템
description: 호진씨 개인 데이터 허브. Claude가 모든 로그를 통합 참조하고 프로필을 상시 갱신하며 방향성 조언 제공.
type: project
originSessionId: b861ffd6-d015-4196-9485-4e6d16aae1c3
---

# personal-hub — 호진씨 개인 AI 비서 시스템

**위치**: `C:\Dev\personal-hub\`
**철학**: 로컬에 흩어진 모든 로그를 Claude가 통합 관리 → 호진씨 상태 상시 업데이트 → 데이터 기반 방향성 조언.

## 구조

```
C:\Dev\personal-hub\
├── sources.json       # 모든 로그 소스 레지스트리 (경로/포맷/의미/상태)
├── profile.md         # 호진씨 통합 프로필 (상황/역량/감정/관심사)
├── goals.md           # 목표 체계 (단기/중기/장기)
└── updates/
    └── YYYY-WNN.md    # 주간 업데이트 누적
```

## 트리거 프로토콜 (MANDATORY)

### ① "상황 업데이트" / "프로필 업데이트"

1. `sources.json`의 active 소스를 모두 스캔 (speech-logs, work-history, retrospect, 바탕화면 계획 파일, git log 등)
2. **`scripts/crypto_price.py` 실행**하여 코인 실시간 평가액 업데이트 (Upbit API)
3. 새 정보를 profile.md에 반영 (변경 섹션만 수정). 코인 평가액/수익률 수치 갱신.
4. 변경사항 요약해서 채팅 응답 (3~5 bullet)
5. 추정 항목은 `(추정)` 표시 유지, 사용자가 확정하면 태그 제거

### ② "방향성 조언" / "어떻게 해야 할까" / "추천해줘"

1. profile.md + goals.md + 최근 7일 speech-logs 읽기
2. **구체 행동 제안 3~5개** 제시. 각 제안:
   - **Why**: 데이터 근거 (예: "4월 지출 330만원, 일일 식비 17100원으로 목표 15000원 초과")
   - **What**: 구체 행동 (예: "편의점 대신 고시원 공용 주방 활용 시도")
   - **When**: 시점 (예: "내일 저녁부터")
3. 가치관/삶의 방향은 제안하되 결정은 사용자 몫. 단 "A할까 B할까" 물음표 남발 금지 — 근거 제시 후 "이게 맞아 보입니다" 주도형으로.
4. 위험/부작용이 있으면 명시

### ③ "주간 회고" (일요일 권장, 트리거 시 실행)

1. 지난 7일 소스 스캔:
   - speech-logs 세션 전부 → 반복 주제 Top 3, 메트릭 추세
   - activity-logs 세션 → 기술 활동 요약
   - git log (dev/cad) → 커밋 패턴
   - inbox/ 내 새 파일 → 재산·노트·이미지 변화
2. `updates/YYYY-WNN.md` 생성
   - 반복 주제 Top 3
   - 메트릭 추세 (CPM, hotspot, speech_ratio)
   - 재산/지출 변화 (finance 데이터 있을 때)
   - 강점/약점 변화
   - 다음 주 훈련/학습 포인트
3. profile.md도 이 회고 내용 반영하여 갱신

### ④ "inbox 정리" / "폰 정보 정리"

1. `C:\Dev\personal-hub\inbox\` 하위 새 파일 스캔 (archive/extracted 제외)
2. 형식별 처리:
   - **CSV/Excel (finance/stocks)**: 파싱 → 요약 수치 추출 → profile.md의 "재정 상태" 섹션 갱신, goals.md의 재정 항목 업데이트
   - **이미지 (images/)**: Gemini MCP `gemini_chat_image` 호출해 OCR/설명 생성 → `inbox/extracted/<timestamp>_<원본명>.md`에 저장. 이후 이 .md를 읽어 profile 반영.
   - **텍스트 (notes/)**: 직접 읽어 맥락 요약 → profile.md의 관련 섹션 반영
3. 처리 끝난 원본 → `inbox/archive/YYYY-MM-DD/` 이동 (원본 보존, 실수 복구 대비)
4. 변경 사항 요약 채팅 응답
5. 중요 변화(큰 지출, 자산 변동) 감지 시 "방향성 조언" 자동 제안 여부 물어봄

## 판단 모드 (관련: feedback_decision_delegation.md)

사용자는 Claude가 판단·실행하길 원함.

- **실행 결정** (파일 구조, 기본값, 색상, 이름, 스키마 등) → Claude가 결정
- **방향성 제안** → Claude가 주도형으로 제시
- **삶의 가치 결정** (우선순위, 관계, 큰 지출) → 사용자

세부 선택 계속 묻지 말 것. 합리적 기본값으로 진행 후 결과 공유 → 사용자 수정.

## 통합 원칙

- **Single Source of Truth**: 호진씨에 대한 공식 상태는 `profile.md`. 메모리(project_speech_logs.md 등)는 부속.
- **추정 vs 사실 구분**: 추정은 반드시 `(추정)` 태그. 사용자 확정 시 제거.
- **시간 태그**: 상태 변화는 날짜와 함께 기록 (예: "2026-04-17 수원 이주").
- **개인정보 로컬 한정**: personal-hub는 .gitignore로 제외. 외부 전송 금지.
- **갱신 시 변경 이력 추가**: profile.md·goals.md 하단 "변경 이력" 섹션에 날짜+요약.

## 주의사항

- sources.json의 dormant 소스(CAD 등)는 직업학교 시작 같은 이벤트 시 재활성화 판단.
- unregistered_candidates는 사용자에게 주기적 확인 (일기/가계부/건강 등).
- profile.md가 500줄 넘으면 오래된 변경이력을 `profile-archive-YYYY.md`로 분리.
