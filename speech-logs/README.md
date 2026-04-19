# speech-logs

매일 5분 혼잣말 녹음 → STT + VAD 분석 → 메트릭 누적으로 말하기 훈련 추세 파악.
내용 코칭은 Claude Code 세션에서 "스피치 분석"이라고 말하면 실시간으로 받는다.

## 설치

Python 3.11 + uv 전제. 이미 `.venv`는 구축되어 있음.

```powershell
uv pip install sounddevice soundfile
```

전체 의존성 (참고용):

- `faster-whisper` (STT)
- `silero-vad`, `torch` (VAD)
- `librosa` (오디오 리샘플/정규화)
- `sounddevice`, `soundfile` (녹음)
- **CUDA GPU 런타임** (선택, 속도 6배): `nvidia-cublas-cu12`, `nvidia-cudnn-cu12`, `nvidia-cuda-runtime-cu12`, `nvidia-cuda-nvrtc-cu12`

## 사용법

### 일상 루틴 (원큐)

```powershell
.\scripts\speech.ps1
```

흐름:

1. **입력 장치 자동 체크** — "USB"/"BY600" 키워드 매칭. 내장 마이크로 잡히면 경고 + 확인 프롬프트.
2. **주제 입력** — 엔터로 건너뛰기 가능.
3. **녹음** — 3-2-1 카운트다운 후 시작. **기본은 무제한**, Ctrl+C로 직접 종료. 파일은 그 시점까지 저장됨.
4. **자동 분석** — STT + VAD + 메트릭 + Top 5 hotspot 출력 + JSON 저장.
5. **내용 코칭**: Claude Code 세션에서 `스피치 분석` 입력 → 8개 섹션 리포트.

옵션:

- `-Duration 300` — 최대 녹음 시간 강제 (초). 지정 시 그 시간 후 자동 종료.
- `-Topic "오늘 회고"` — 토픽 즉시 지정
- `-Smoke` — **3초 짧은 녹음으로 마이크 입력 레벨만 확인** (분석 생략). 본 녹음 전 스모크 추천.
- `-SkipDeviceCheck` — 장치 매칭 경고 우회

### 기존 오디오 분석만 (녹음 생략)

```powershell
.venv\Scripts\python.exe -m src.pipeline audio\test1.m4a
```

m4a/wav 모두 지원. 자동 정규화가 속삭임 녹음도 보정.

### 유틸

```powershell
# 현재 기본 입력 장치명
.venv\Scripts\python.exe -m src.device_info

# 단일 파일 피크/RMS 레벨 측정
.venv\Scripts\python.exe -m src.check_level audio\파일.wav
```

## 출력

`logs\YYYY-MM-DD_speech.json` — 같은 날 여러 세션은 `sessions` 배열에 append.

CLI 요약 예시:

```
  CPM:               98
  speech_ratio:      0.45
  hotspot_count:     57
  longest_pause_sec: 12.6

Top 5 hotspots (긴 침묵 순):
  [  10.2s] 12.50초 막힘 | "오늘은 여기 수원 고시 원룸텔로 온지 2일차고"
  ...
```

## 디렉토리

```
speech-logs/
├── audio/         녹음 파일 (wav/m4a)
├── logs/          일자별 JSON 로그
├── reports/       (선택) 코칭 리포트 저장용
├── scripts/
│   └── speech.ps1     원큐 래퍼
├── src/
│   ├── __init__.py     GPU DLL preload (Windows CUDA 런타임)
│   ├── config.py       상수 (threshold, 모델, 경로, 정규화, 장치 키워드)
│   ├── record.py       sounddevice 녹음
│   ├── stt.py          faster-whisper 전사
│   ├── vad.py          silero-vad + hotspot 필터
│   ├── metrics.py      메트릭 집계
│   ├── log_writer.py   JSON append
│   ├── pipeline.py     분석 엔트리 (정규화 포함)
│   ├── device_info.py  기본 입력 장치 확인
│   └── check_level.py  피크/RMS 레벨 측정
├── PHASE0_RESULTS.md   Phase 0 검증 결과
├── PHASE1_PLAN.md      확정 계획서
└── README.md
```

## 녹음 준비 체크

- 주닉스 BY600 USB 마이크를 Windows 기본 입력으로 설정.
- Windows 설정 → 시스템 → 소리 → 입력 → BY600 "장치 속성" → 입력 볼륨 ≥ 80%.
- 마이크와 입 거리 15~25cm.
- 새 환경에서는 **먼저 `speech.ps1 -Smoke`**로 레벨 확인.

## 메트릭 해석

- **CPM**: 분당 글자수 (공백 제외). 한국어라 WPM 대신 사용.
- **speech_ratio**: 발화 시간 / 전체 시간. 낮을수록 막힘이 많음.
- **hotspot_count**: 0.8초 이상 침묵한 구간 수 (앞뒤 무음 제외).
- **longest_pause_sec**: 가장 길게 막힌 시간.
- **hesitation_hotspots[].context**: 막히기 직전 발화 (최대 30자).
- **preprocessing.normalized**: 정규화 적용 여부와 gain 기록.

Threshold는 `src/config.py`에서 조정. 1주차 데이터 쌓이면 개인화 재튜닝.

## GPU / CPU 전환

현재 기본: GPU (`STT_DEVICE = "cuda"`, `STT_COMPUTE_TYPE = "int8_float16"`).
5분 오디오 기준 CPU 5.5분 → GPU 50초.

CPU로 롤백하려면 `src/config.py`의 STT 두 줄만 되돌리면 됨:

```python
STT_DEVICE = "cpu"
STT_COMPUTE_TYPE = "int8"
```

**GPU 환경 요구**:

- NVIDIA GPU (Turing 이상, RTX 2060 검증) + 드라이버 CUDA 12 이상 지원
- pip 패키지: `nvidia-cublas-cu12`, `nvidia-cudnn-cu12`, `nvidia-cuda-runtime-cu12`, `nvidia-cuda-nvrtc-cu12`
- `src/__init__.py`가 CUDA DLL 자동 preload (Windows PATH 이슈 우회)
- VRAM ~2GB 사용 (large-v3 int8_float16)

**디버그**: `SPEECHLOGS_DEBUG_DLL=1` 환경변수 설정 시 DLL 로딩 로그 출력.

## 트러블슈팅

| 증상                                   | 원인/해결                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| "예상 장치 키워드가 장치명에 없습니다" | 내장 마이크로 잡힘. Windows 입력 설정에서 BY600 선택.                                                                                    |
| 텍스트가 엉터리 ("진보자로 내려" 같은) | 속삭임 수준 음량. `-Smoke`로 레벨 확인 후 크게 말하기.                                                                                   |
| `Library cublas64_12.dll is not found` | nvidia CUDA 런타임 패키지 미설치. `uv pip install nvidia-cublas-cu12 nvidia-cudnn-cu12 nvidia-cuda-runtime-cu12 nvidia-cuda-nvrtc-cu12`. |
| GPU 사용 중 CUDA OOM                   | 다른 GPU 프로세스(브라우저 가속 등) 종료. 또는 `STT_COMPUTE_TYPE = "int8"`로 낮춤.                                                       |
| CPU로 돌아가고 싶음                    | `src/config.py`에서 `STT_DEVICE="cpu"`, `STT_COMPUTE_TYPE="int8"` 2줄만 수정.                                                            |
| 한글 깨짐                              | PowerShell에서 `chcp 65001` 또는 `$env:PYTHONIOENCODING="utf-8"`. `speech.ps1`은 이미 설정됨.                                            |
