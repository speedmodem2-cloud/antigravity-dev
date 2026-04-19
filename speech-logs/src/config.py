"""Phase 1 상수 — 경로, 모델, threshold, 녹음 파라미터."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
AUDIO_DIR = BASE_DIR / "audio"
LOGS_DIR = BASE_DIR / "logs"

SAMPLE_RATE = 16000
CHANNELS = 1

STT_MODEL = "large-v3"
STT_DEVICE = "cuda"            # cpu로 롤백하려면 여기 두 줄만 되돌리면 됨
STT_COMPUTE_TYPE = "int8_float16"
STT_LANGUAGE = "ko"
STT_BEAM_SIZE = 5

VAD_MIN_SILENCE_MS = 300
VAD_MIN_SPEECH_MS = 200

HOTSPOT_THRESHOLD = 0.8
LEADING_MARGIN = 0.3
TRAILING_MARGIN = 0.3
MIN_SILENCE_GAP = 0.1
CONTEXT_MAX_CHARS = 30
HOTSPOT_DISPLAY_COUNT = 5  # CLI 요약에 표시할 상위 hotspot 개수 (긴 침묵 순)

# 오디오 전처리: 속삭임/작게 녹음된 파일 피크 정규화 → Whisper 텍스트 품질 보정.
# 이미 peak가 목표보다 크면 자동 skip.
AUDIO_NORMALIZE = True
AUDIO_NORMALIZE_PEAK_DBFS = -3.0

# 기본 입력 장치명에 포함돼야 하는 키워드 (OR 매칭, 대소문자 무시).
# BY600은 Windows에 "USB Audio Device"로 잡혀서 키워드 기반 매칭을 씀.
EXPECTED_INPUT_KEYWORDS = ["USB", "BY600", "Juniks"]

# 스모크 모드 녹음 길이 (초)
SMOKE_DURATION_SEC = 3

STT_MODEL_STR = f"faster-whisper {STT_MODEL} {STT_COMPUTE_TYPE} {STT_DEVICE}"
VAD_MODEL_STR = "silero-vad"
