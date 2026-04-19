---
name: speech-logs 프로젝트 상태
description: 매일 5분 혼잣말 녹음→STT→메트릭 훈련 파이프라인. Phase 0 검증 완료, 옵션 E 채택
type: project
originSessionId: 385d5e90-1f63-42e9-b097-71e1eda2ebf3
---

# speech-logs — 말하기 훈련 파이프라인

**위치**: `C:\Dev\speech-logs\`
**목적**: 호진 본인이 머릿속 생각을 말로 변환하는 능력 훈련. 매일 5분 혼잣말 녹음 → STT + hesitation 분석 → 누적 데이터로 추세 파악. 부가 목표: 포트폴리오화.

## 상태 (2026-04-17 기준)

**Phase 1 Done + 업그레이드 A/B/C 전부 적용**. 첫 실전 세션 `2026-04-17_215118` (CPM 98, speech_ratio 0.445, hotspot 57, longest 12.6초) 기록. 적용된 업그레이드:

- (a) CLI에 Top 5 hotspot 표출
- (b) 오디오 자동 정규화 (peak -3 dBFS, 이미 크면 skip) — 속삭임 STT 텍스트 품질 보정
- (c) `speech.ps1` 원큐 전환: 장치 체크 + Topic 프롬프트 + `-Smoke` 3초 레벨 테스트 + 종료 시 "스피치 분석" 안내
- (d) `src/device_info.py`, `src/check_level.py` 유틸
- (e) **GPU 활성화** (RTX 2060, int8_float16) — 5분 오디오 5.5분→50초 (≈6.5배). nvidia CUDA 런타임 pip 패키지(`cublas/cudnn/cuda-runtime/cuda-nvrtc cu12`) 필요. `src/__init__.py`에서 DLL 자동 preload (Windows PATH/LoadLibrary 불일치 이슈 우회).
- (f) 스피치 분석 요청 프로토콜 메모리 등록 (위 섹션 참조)

다음: 실전 녹음 루틴 유지 + 1주차 데이터 누적 → Phase 2 메트릭.

## 확정된 기술 스택 (옵션 E)

- STT: **faster-whisper large-v3** (한국어 텍스트 + 의미적 필러 "어/그/뭐/그러니까")
- VAD: **silero-vad** (침묵/hesitation hotspot 탐지)
- Python 3.11 venv (uv 관리)
- **GPU 모드 (기본)**: RTX 2060, `device="cuda"`, `compute_type="int8_float16"`. CPU 롤백은 `config.py` 2줄 수정.
- 드라이버: NVIDIA 595.79 (CUDA 13.2 지원). CUDA Toolkit은 **설치 안 함** — pip nvidia 패키지로 DLL만 공급.

## 핵심 설계 결정

**Why:** Whisper는 한국어 순수 disfluency("음")를 학습 단계에서 제거하도록 훈련돼 있어 프롬프트/옵션 튜닝으로 해결 불가. wav2vec2 한국어 모델은 더 나쁨 (검증 끝, 기각). 그래서 "필러 카운트" 대신 "어디서 얼마나 막혔는지"를 오디오 VAD에서 직접 측정.
**How to apply:** 필러 카운트는 Whisper가 잡는 범위에서만 보조 지표로 쓸 것. 주요 메트릭은 hesitation hotspot(≥0.8초 침묵), 발화/침묵 비율, CPM(한국어라 WPM 아님), 문장 완결률, 어휘 다양성.

## 다음 세션 재개 지점

1. **매일 5분 녹음 루틴 유지** — `.\scripts\speech.ps1` 원큐 (장치 체크 + Topic 프롬프트 자동)
2. 녹음 후 Claude Code에 `스피치 분석` 입력 → 8개 섹션 코칭 리포트
3. 1주차(7세션) 누적 후 추세 확인 → hotspot threshold 개인화 재튜닝 판단
4. 업그레이드 로드맵:
   - ✅ Hotspot 뷰어 (Top 5 CLI 출력)
   - ✅ 오디오 자동 정규화 (peak -3 dBFS, skip 로직)
   - ✅ `speech.ps1` 원큐 개선 (장치 체크, Topic 프롬프트, `-Smoke` 3초 레벨 테스트)
   - ✅ GPU 활성화 (int8_float16, 5분 오디오 6.5배 가속)
   - ✅ 스피치 분석 요청 프로토콜 (Claude Code 세션에서 실시간 코칭)
   - ✅ 바탕화면 바로가기 (`install-shortcut.ps1`, ASCII 파일명 `Speech Log.lnk`)
   - ✅ PowerShell 한글 인코딩 해결 (`speech.ps1` UTF-8 BOM + `[Console]::OutputEncoding=UTF8` + `chcp 65001`)
   - ✅ Ctrl+C 조기 종료 시에도 파일 존재하면 분석 이어가기 (+ 50KB 미만은 확인 프롬프트)
   - ⏳ **[TODO] 녹음 중 경과 시간 표시** — 현재는 "● 녹음 시작" 후 침묵. 매 10초 또는 매 분마다 `[1:23 / 5:00]` 식 진행 표시 필요. `record.py`에서 구현 (Ctrl+C 처리 기존대로 유지).
   - ⏳ **[TODO] 5분 자동 종료 거동 재검토** — 2026-04-18 실측에서 사용자가 "300초 넘어가면 끊어버림"에 당황. 기획대로지만 UX 개선 방향 논의 필요 (예: 5분 지나면 "계속할까요?" 프롬프트, 또는 무한 모드 옵션, 또는 단순 기본 Duration 확장). 현재는 그대로 두고 사용자와 상의 후 결정.
   - ⏳ Phase 2 메트릭 (의미적 필러/TTR/완결률) — 1주차 데이터 누적 후
   - ⏳ Phase 3 리포트 (주간 마크다운, 추세 비교) — Phase 2 이후

## 구현 노트

- `sys.stdout` 교체 방식은 `sys.stdout.reconfigure(encoding='utf-8')`로 통일 (import 중복 시 closed file 에러 회피)
- `record.py`는 `sd.InputStream` + queue 콜백 방식으로 Ctrl+C 조기 종료 시 버퍼 보존
- `pipeline.py`는 녹음 생략 경로 지원 (기존 wav/m4a 파일로 직접 분석 가능)
- 오디오 자동 정규화(peak -3 dBFS)는 `pipeline._maybe_normalize()`에서 처리. 이미 큰 녹음은 skip. 임시 wav로 STT/VAD 돌리고 finally 블록에서 삭제.
- **GPU DLL 이슈 핵심 교훈**: Windows에서 pip `nvidia-*-cu12` 패키지의 DLL은 `os.add_dll_directory()`만으론 ctranslate2가 못 찾음 — **`ctypes.WinDLL()`로 명시적 preload 필요**. `src/__init__.py`에서 2-pass 반복 로딩(의존성 순서 모를 때 안전). 필수 패키지: `cublas`, `cudnn`, `cuda-runtime`, `cuda-nvrtc` 네 개 모두. `cuda-runtime` 빠뜨리면 cublas 로드 실패. 디버그는 `SPEECHLOGS_DEBUG_DLL=1` 환경변수.

## 스피치 분석 요청 프로토콜 (MANDATORY)

**트리거 문구**: "스피치 분석", "스피치 분석해줘", 또는 유사한 분석 요청

**행동**:

1. `C:\Dev\speech-logs\logs\<최근 날짜>_speech.json`에서 가장 마지막 세션을 읽음. (유저가 특정 session_id/날짜 지정 시 그것을 사용.)
2. 8개 섹션 마크다운 리포트 생성해서 채팅 응답:
   1. **말 속도** — CPM을 주제/내용 난이도 대비 해석. 전체 CPM이 낮아도 실제 발화 구간만 계산하면 정상인 경우 구분. (char_count / (duration \* speech_ratio / 60))
   2. **짜임새** — 도입-전개-결론 흐름, 주제 이탈 여부. 일기체 시간순 나열도 "구조 약함"으로 표시.
   3. **구체성** — 사실/수치/고유명사 vs 감정/평가의 비대칭. 사실은 구체인데 감정은 추상인 패턴을 잡아내기.
   4. **일관성** — 자기모순, 논리 비약, **동일 단어/표현 반복 빈도**.
   5. **어휘/표현** — 반복어, 상투어, 모호한 지시사("이게/이거/그거") 남용.
   6. **막힘 패턴 해석** — Top 5 hotspot을 위치별 테이블로 정리, 각 위치가 **도입/전환/감정후/결어** 중 어디에 해당하는지 분류. 패턴이 주제 경계에 집중되면 "회피/도망 메커니즘" 가능성 명시.
   7. **강점 3가지** — 잘한 부분 구체 인용 (자기 회피 섞인 평가가 아니라 실제 데이터에 근거).
   8. **다음 훈련 포인트 3가지** — 내일 녹음 시 바로 적용 가능한 구체 규칙 (추상 조언 금지).
3. `reports/<session_id>.md`로 저장은 유저 요청 시에만.
4. **유저가 자기 경험으로 해석을 보태주면 (예: "말이 막혀서 다른 주제로 넘어갔다") 그 관점을 데이터와 대조해서 재해석해줄 것**. 구조(결과) 관점과 메커니즘(원인) 관점을 구분하고, 유저의 자기 진단이 데이터와 맞으면 명시적으로 인정. 훈련 포인트도 그 관점에서 재조정.

**톤**: 직설적, 인신공격 금지. 사실 검증은 하지 않고 "말하기" 자체만 평가 (개인 신상/주관 주제는 그대로 수용).

**Why**: 매일 녹음 후 Claude Code 세션에서 직접 분석하는 방식 채택 (외부 LLM API/코드 추가 0). Python 파이프라인은 수치 메트릭만 담당, 내용 코칭은 Claude가 실시간으로. 2026-04-17 첫 실전 분석에서 이 포맷이 유저에게 확실히 먹혔음 — 특히 "주제 경계에서 회피" 메커니즘 분석과 "주제당 최소 4문장" 같은 구체 규칙.
**How to apply**: 트리거 감지 즉시 위 프로토콜 수행. Gemini 호출 불필요 (스피치 분석 한정).

## 참고

- Phase 0 상세 결과: `C:\Dev\speech-logs\PHASE0_RESULTS.md`
- 1차 계획서: `C:\Dev\speech-logs_1차계획서.md`
- **2차 계획서(Phase 1 확정판)**: `C:\Dev\speech-logs\PHASE1_PLAN.md`
- 테스트 녹음: `C:\Dev\speech-logs\audio\test1.m4a` (필러 의도적 삽입, 31.6초, 베이스라인용 유지)
- 하드웨어: RTX 2060 6GB, 주닉스 BY600 USB 마이크 (녹음 전 Windows 기본 입력으로 설정 필요)
