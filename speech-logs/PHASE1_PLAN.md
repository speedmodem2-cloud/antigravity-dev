# Speech Logs — Phase 1 Plan (옵션 E 확정판)

> 작성일: 2026-04-13
> 전제: 1차 계획서(`C:\Dev\speech-logs_1차계획서.md`) + Phase 0 검증(`PHASE0_RESULTS.md`)
> 목적: Phase 1 MVP 구현 직전 확정본. 이 문서 기준으로 바로 코딩 착수.

---

## 0. 1차 → 2차 핵심 변경점

| 항목                  | 1차 (draft)               | 2차 (확정)                                          |
| --------------------- | ------------------------- | --------------------------------------------------- |
| STT 접근              | Whisper 단독, 필러 카운트 | Whisper(텍스트) + Silero VAD **하이브리드**         |
| 주요 메트릭           | filler count/ratio        | **hesitation hotspot** + speech/silence ratio + CPM |
| 속도 단위             | WPM                       | **CPM** (한국어 특성)                               |
| 순수 disfluency("음") | 사전 카운트               | **포기** (Whisper 학습 단계 제거, 기술적 불가)      |
| 장치                  | GPU (CUDA) 기본           | **CPU 우선**, GPU는 Phase 1 후 옵션                 |
| 모듈 구조             | transcribe + analyze      | **stt + vad + metrics** (VAD 분리)                  |
| 녹음 방식             | Windows 녹음기 수동 저장  | **Python sounddevice CLI, 원큐 자동화**             |
| 오디오 포맷           | wav/mp3 유연              | **wav 기본** (기존 m4a도 분석 가능)                 |

배경: Phase 0에서 Whisper "음" 100% 제거 확인, wav2vec2 fallback 더 나쁨으로 기각. "필러 카운트" 대신 "어디서 얼마나 막혔는지"를 VAD로 직접 측정하는 옵션 E로 피벗. 녹음도 자동화 최대화 방향으로 원큐 커맨드 채택.

---

## 1. 기술 스택 (확정)

- **STT**: `faster-whisper large-v3`, `compute_type="int8"`, `device="cpu"`
- **VAD**: `silero-vad` (torch 기반)
- **오디오 분석 로드**: `librosa` (16kHz mono resample)
- **녹음**: `sounddevice` + `soundfile` — **추가 설치 필요**
- **Python**: 3.11 (uv venv, 구축됨)
- **실행 플랫폼**: PowerShell (Windows 11)
- **GPU**: CPU 모드. 실측 CPU 35초/31.6초 오디오 ≈ 1.1x realtime → 5분 녹음 약 5.5분 처리. 매일 1회 배치 기준 용인 가능. CUDA 12 런타임 설치는 Phase 1 완료 후 결정.
- **녹음 입력 장치**: 주닉스 BY600 USB 마이크 (Windows 기본 입력으로 설정 필요)

---

## 2. 메트릭 정의

### 2.1 Phase 1 자동 계산 대상

| 메트릭                | 정의                                              | 출처                      |
| --------------------- | ------------------------------------------------- | ------------------------- |
| `cpm`                 | chars/min (공백 제외)                             | Whisper 텍스트 + duration |
| `char_count`          | 공백 제외 글자수                                  | Whisper 텍스트            |
| `speech_ratio`        | 발화 시간 / 전체 시간                             | VAD                       |
| `silence_ratio`       | 1 - speech_ratio                                  | VAD                       |
| `longest_pause_sec`   | 가장 긴 침묵 (앞뒤 무음 제외)                     | VAD + 필터                |
| `longest_pause_at`    | 가장 긴 침묵 시작 시점 (초)                       | VAD                       |
| `hotspot_count`       | ≥0.8초 침묵 구간 수 (필터 후)                     | VAD + 필터                |
| `hesitation_hotspots` | 각 hotspot의 {start, end, duration, context} 배열 | VAD + Whisper 세그먼트    |
| `segment_count`       | Whisper 세그먼트 수                               | Whisper                   |

### 2.2 Phase 2로 미룸 (1주차 데이터 누적 후)

- 의미적 필러 카운트 ("어/그/뭐/그러니까/막/이제") — Whisper가 잡는 범위
- 종결어미 기반 문장 완결률
- TTR (unique word ratio)
- 반복 표현 탐지

### 2.3 폐기

- 순수 disfluency 필러 카운트 ("음") — 기술적 불가
- WPM — CPM으로 대체
- filler_ratio — 불완전한 카운트 기반이라 무의미

---

## 3. False Positive 필터 규칙 (확정)

Phase 0에서 전체 hotspot 4개 중 2개가 앞뒤 무음이었음 → 필터 규칙화:

```python
# config.py 기본값
HOTSPOT_THRESHOLD = 0.8       # hotspot 침묵 길이(초)
LEADING_MARGIN = 0.3          # 녹음 시작 직후 무시 구간
TRAILING_MARGIN = 0.3         # 녹음 종료 직전 무시 구간
MIN_SILENCE_GAP = 0.1         # 이보다 짧으면 침묵 집계도 안 함

def filter_hotspots(silences, total_duration):
    filtered = []
    for start, end, dur in silences:
        if end <= LEADING_MARGIN:
            continue
        if start >= total_duration - TRAILING_MARGIN:
            continue
        if dur < HOTSPOT_THRESHOLD:
            continue
        filtered.append((start, end, dur))
    return filtered
```

- 모든 파라미터 `config.py`에 상수로 노출 → 1주차 회고 후 재튜닝
- `longest_pause_sec`도 필터 후 기준으로 계산 (앞뒤 무음이 longest로 잡히는 걸 방지)

---

## 4. 디렉토리 구조 (확정)

```
C:\Dev\speech-logs\
├── CLAUDE.md                     # [신규] Claude Code 컨텍스트 (Phase 1 후)
├── README.md                     # [신규] 사용법
├── PHASE0_RESULTS.md             # 기존
├── PHASE1_PLAN.md                # 이 문서 (= 2차 계획서)
├── .venv\                        # 기존
├── audio\
│   ├── test1.m4a                 # 기존 베이스라인, 절대 건드리지 않음
│   └── YYYY-MM-DD_HHMMSS.wav     # 일일 녹음 (신규, wav 고정)
├── src\
│   ├── __init__.py
│   ├── config.py                 # 경로/모델/threshold/녹음 길이 상수
│   ├── record.py                 # [신규] sounddevice 녹음 → wav
│   ├── stt.py                    # Whisper 전사
│   ├── vad.py                    # Silero VAD + hotspot + false positive 필터
│   ├── metrics.py                # 메트릭 집계
│   ├── log_writer.py             # JSON 저장/append
│   └── pipeline.py               # stt → vad → metrics → log (분석 엔트리)
├── logs\
│   └── YYYY-MM-DD_speech.json
├── reports\                      # Phase 3
├── scripts\
│   └── speech.ps1                # 원큐: record → pipeline → 요약
├── test.py                       # 기존, Whisper 베이스라인 (유지)
└── test_vad.py                   # 기존, 옵션 E 프로토타입 (유지)
```

- `test.py`, `test_vad.py`는 의도적 루트 유지. 베이스라인/프로토타입 역할, src/ 구조와 독립적으로 실행 가능해야 함.
- `src/pipeline.py`는 **분석만** 담당 (record 제외). 기존 m4a/외부 wav도 pipeline 직접 실행 가능.
- `scripts/speech.ps1`이 record + pipeline을 묶는 얇은 래퍼.

---

## 5. JSON 로그 스키마 (확정)

```json
{
  "date": "2026-04-13",
  "sessions": [
    {
      "session_id": "2026-04-13_213000",
      "audio_path": "audio/2026-04-13_213000.wav",
      "topic": null,
      "duration_sec": 312.4,
      "model": {
        "stt": "faster-whisper large-v3 int8 cpu",
        "vad": "silero-vad 6.2.1"
      },
      "language": "ko",
      "raw_text": "...",
      "segments": [{ "start": 0.0, "end": 4.2, "text": "..." }],
      "speech_timestamps": [{ "start": 0.3, "end": 4.1 }],
      "metrics": {
        "char_count": 542,
        "cpm": 171,
        "speech_ratio": 0.75,
        "silence_ratio": 0.25,
        "longest_pause_sec": 1.4,
        "longest_pause_at": 18.2,
        "hotspot_count": 2,
        "hesitation_hotspots": [
          {
            "start": 8.3,
            "end": 9.2,
            "duration": 0.9,
            "context": "어 그러니까"
          }
        ],
        "segment_count": 8
      },
      "notes": null
    }
  ]
}
```

- **Top-level `sessions` 배열**: 같은 날 여러 번 녹음 시 append. 활동 로그 시스템과 동일 패턴.
- `speech_timestamps`는 VAD 원시 결과 보존 → 나중에 raw audio 없이 메트릭 재계산 가능.
- `hesitation_hotspots[].context`는 해당 시점 직전 Whisper 세그먼트 텍스트 (최대 30자).
- Phase 2 메트릭 필드는 넣지 않음 — 스키마 버전업은 Phase 2 시작 시 한 번에.

---

## 6. Phase 1 MVP 구현 계획

**목표 한 줄**: `.\scripts\speech.ps1` 한 번 → 녹음부터 로그 생성까지 끝.

### 6.1 실행 흐름

```
.\scripts\speech.ps1
 │  (session_id 생성, 카운트다운 3-2-1, BY600 입력 확인)
 ↓
python -m src.record --duration 300 --output audio\{session_id}.wav
 │  (5분 고정, Ctrl+C 조기 종료 허용, 16kHz mono wav 저장)
 ↓
python -m src.pipeline audio\{session_id}.wav
 │  (Whisper → VAD → false positive 필터 → metrics → log append)
 ↓
CLI 요약: cpm / speech_ratio / hotspot_count / longest_pause_sec
```

### 6.2 구현 순서

1. 디렉토리 구조 + `sounddevice`/`soundfile` 설치 + README에 설치 명령 기록 (1인 프로젝트라 `pyproject.toml` 생략)
2. `src/config.py` — 경로/모델/threshold/녹음 길이 상수
3. `src/record.py` — `record(duration, out_path) → path`, 16kHz mono wav, 카운트다운 + Ctrl+C 허용
4. `src/stt.py` — `transcribe(path) → (segments, info, full_text)` (test.py에서 분리)
5. `src/vad.py` — `detect_speech(path)`, `compute_hotspots(speech_ts, duration, segments)` + 필터 내장 (test_vad.py에서 분리)
6. `src/metrics.py` — `compute_metrics(...) → dict`
7. `src/log_writer.py` — `write_log(session_dict) → path`, 같은 날 sessions append
8. `src/pipeline.py` — 분석 엔트리: `audio_path → stt → vad → metrics → log_writer → 요약 출력`
9. `scripts/speech.ps1` — record + pipeline 원큐 래퍼
10. **스모크 테스트**: `test1.m4a`에 `pipeline.py` 직접 호출 (녹음 생략)
11. **실전 테스트**: `speech.ps1`로 실제 5분 녹음 1회

### 6.3 Phase 1 Done 판정

- [ ] `sounddevice`, `soundfile` 설치 완료
- [ ] `.\scripts\speech.ps1` 한 번으로 녹음 → 로그까지 완료
- [ ] `test1.m4a`로도 `pipeline.py` 단독 실행 가능 (녹음 생략 경로 동작)
- [ ] 같은 날 2회 실행 시 `sessions` 배열에 append (덮어쓰지 않음)
- [ ] CLI 요약 한 줄 출력: cpm / speech_ratio / hotspot_count / longest_pause_sec
- [ ] 실전 5분 녹음 1개 성공

### 6.4 예상 소요

구조 + pyproject 0.3일 + `record.py` 0.3일 + src 모듈 분리 0.5일 + pipeline/script 0.3일 + 테스트/버그 0.3일 ≈ **1.5~2일**.

---

## 7. Phase 2+ 로드맵 (요약)

- **Phase 2 — 텍스트 분석**: 1주차 데이터 누적 후. 의미적 필러 카운트, 종결어미 판정, TTR, 반복 탐지. 스키마 v2.
- **Phase 3 — 리포트**: 주간 마크다운 생성, 추세 비교, Claude 붙여넣기용 포맷.
- **Phase 4 — 시각화** (선택): matplotlib 시계열.
- **Phase 5 — 음향** (선택): 피치/볼륨/에너지 (librosa).
- **성능 최적화**: CUDA 12 런타임 설치로 GPU 활성화 (CPU 35초 → 예상 3초).

---

## 8. 리스크 / 열린 질문

### 남은 리스크

1. **Silero VAD 한국어 비학습**: 조용한 발화 구간을 침묵으로 오인할 수 있음. 실전 5~10개 녹음 쌓이면 VAD 파라미터(min_speech/min_silence) 재튜닝.
2. **Hotspot threshold 0.8초 고정**: 사람/주제마다 다를 수 있음. config 상수로 노출, 1주차 후 개인화.
3. **파이프라인 중독**: 도구 만드는 재미에 빠져 정작 말하기 훈련 소홀 위험. Phase 1 완료 즉시 매일 녹음 루틴 시작. Phase 2+는 루틴 안착 뒤.
4. **녹음 입력 장치**: `sounddevice`는 Windows 기본 입력을 씀. 녹음 전 BY600이 기본 입력인지 확인. `src/record.py`에 기본 장치명 로깅 포함 권장.

---

## 9. 다음 액션

1. **Claude**: `sounddevice` + `soundfile` 설치, 디렉토리 생성, README 초안 (설치 명령 기록)
2. **Claude**: `src/config.py` → `src/record.py` → `src/stt.py` → `src/vad.py` → `src/metrics.py` → `src/log_writer.py` → `src/pipeline.py` 순차 구현
3. **Claude**: `scripts/speech.ps1` 원큐 래퍼 작성
4. **Claude+호진**: `test1.m4a` 스모크 테스트 → 실제 5분 녹음 실전 테스트
5. **Phase 1 Done** → 매일 녹음 루틴 시작 → 1주차 데이터 쌓이면 Phase 2 진입
