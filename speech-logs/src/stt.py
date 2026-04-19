"""faster-whisper 전사 모듈."""
from faster_whisper import WhisperModel

from . import config

_model = None


def get_model():
    global _model
    if _model is None:
        print("Whisper 모델 로딩 중...")
        _model = WhisperModel(
            config.STT_MODEL,
            device=config.STT_DEVICE,
            compute_type=config.STT_COMPUTE_TYPE,
        )
    return _model


def transcribe(audio_path):
    model = get_model()
    segments, info = model.transcribe(
        str(audio_path),
        language=config.STT_LANGUAGE,
        beam_size=config.STT_BEAM_SIZE,
        vad_filter=False,
        condition_on_previous_text=False,
        word_timestamps=True,
    )
    seg_list = []
    full_text = ""
    for seg in segments:
        seg_list.append({"start": seg.start, "end": seg.end, "text": seg.text})
        full_text += seg.text
    return seg_list, info, full_text
