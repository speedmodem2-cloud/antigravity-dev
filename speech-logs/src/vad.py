"""Silero VAD + 침묵 구간 계산 + false positive 필터."""
import librosa
import torch
from silero_vad import load_silero_vad, get_speech_timestamps

from . import config

_vad_model = None


def get_model():
    global _vad_model
    if _vad_model is None:
        print("VAD 모델 로딩 중...")
        _vad_model = load_silero_vad()
    return _vad_model


def detect_speech(audio_path):
    speech, sr = librosa.load(str(audio_path), sr=config.SAMPLE_RATE, mono=True)
    duration = len(speech) / sr
    tensor = torch.from_numpy(speech)
    ts = get_speech_timestamps(
        tensor,
        get_model(),
        sampling_rate=config.SAMPLE_RATE,
        min_silence_duration_ms=config.VAD_MIN_SILENCE_MS,
        min_speech_duration_ms=config.VAD_MIN_SPEECH_MS,
        return_seconds=True,
    )
    return ts, duration


def compute_silences(speech_timestamps, duration):
    """VAD 결과에서 침묵 구간 추출. MIN_SILENCE_GAP 미만은 제외."""
    silences = []
    prev_end = 0.0
    for s in speech_timestamps:
        gap = s["start"] - prev_end
        if gap > config.MIN_SILENCE_GAP:
            silences.append((prev_end, s["start"], gap))
        prev_end = s["end"]
    tail = duration - prev_end
    if tail > config.MIN_SILENCE_GAP:
        silences.append((prev_end, duration, tail))
    return silences


def filter_hotspots(silences, total_duration):
    """앞뒤 무음 제거 + threshold 미만 제거."""
    filtered = []
    for start, end, dur in silences:
        if end <= config.LEADING_MARGIN:
            continue
        if start >= total_duration - config.TRAILING_MARGIN:
            continue
        if dur < config.HOTSPOT_THRESHOLD:
            continue
        filtered.append((start, end, dur))
    return filtered


def find_context(time_point, segments, max_chars=None):
    """주어진 시점 직전의 Whisper 세그먼트 텍스트."""
    if max_chars is None:
        max_chars = config.CONTEXT_MAX_CHARS
    context = ""
    for seg in segments:
        if seg["start"] <= time_point <= seg["end"] + 1.0:
            context = seg["text"].strip()
            break
        if seg["end"] < time_point:
            context = seg["text"].strip()
    return context[-max_chars:]
