"""Phase 0 옵션 E 검증 — Whisper(텍스트) + Silero VAD(hesitation hotspot)
사용법: python test_vad.py audio/파일명.m4a
"""
import sys
import io
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import librosa
import torch
from faster_whisper import WhisperModel
from silero_vad import load_silero_vad, get_speech_timestamps

if len(sys.argv) < 2:
    print("사용법: python test_vad.py <오디오경로>")
    sys.exit(1)

audio_path = sys.argv[1]

# === 1. Whisper 전사 ===
print("=" * 60)
print("1. Whisper 전사")
print("=" * 60)
print("모델 로딩 중...")
t0 = time.time()
whisper = WhisperModel("large-v3", device="cpu", compute_type="int8")
print(f"로딩 완료: {time.time() - t0:.1f}초\n")

t0 = time.time()
segments, info = whisper.transcribe(
    audio_path, language="ko", beam_size=5,
    vad_filter=False, condition_on_previous_text=False,
    word_timestamps=True,
)
segments = list(segments)
print(f"Whisper 완료: {time.time() - t0:.1f}초 ({info.duration:.1f}초 오디오)\n")

full_text = ""
print("세그먼트:")
for seg in segments:
    print(f"  [{seg.start:6.2f} → {seg.end:6.2f}] {seg.text.strip()}")
    full_text += seg.text

# === 2. Silero VAD로 음성 구간 탐지 ===
print("\n" + "=" * 60)
print("2. Silero VAD — hesitation hotspot 탐지")
print("=" * 60)

print("VAD 모델 로딩 중...")
t0 = time.time()
vad_model = load_silero_vad()
print(f"로딩 완료: {time.time() - t0:.1f}초\n")

# 16kHz mono로 로드
speech, sr = librosa.load(audio_path, sr=16000, mono=True)
speech_tensor = torch.from_numpy(speech)

# Silero VAD는 음성 구간 [{'start': sample, 'end': sample}] 반환
speech_timestamps = get_speech_timestamps(
    speech_tensor,
    vad_model,
    sampling_rate=16000,
    min_silence_duration_ms=300,   # 0.3초 이상 침묵 = 구분
    min_speech_duration_ms=200,
    return_seconds=True,
)

print(f"감지된 음성 구간 수: {len(speech_timestamps)}\n")

# === 3. 침묵 구간 계산 (hesitation hotspot) ===
print("=" * 60)
print("3. 침묵/hesitation 분포")
print("=" * 60)

total_duration = info.duration
total_speech = sum(s["end"] - s["start"] for s in speech_timestamps)
total_silence = total_duration - total_speech

silences = []
prev_end = 0.0
for s in speech_timestamps:
    gap = s["start"] - prev_end
    if gap > 0.1:  # 0.1초 이상은 무시할 침묵 아님
        silences.append((prev_end, s["start"], gap))
    prev_end = s["end"]
# 마지막 끝 이후
if total_duration - prev_end > 0.1:
    silences.append((prev_end, total_duration, total_duration - prev_end))

print(f"총 오디오 길이:   {total_duration:.1f}초")
print(f"발화 시간:        {total_speech:.1f}초 ({100*total_speech/total_duration:.0f}%)")
print(f"침묵 시간:        {total_silence:.1f}초 ({100*total_silence/total_duration:.0f}%)")
print(f"침묵 구간 수:     {len(silences)}")

if silences:
    longest = max(silences, key=lambda x: x[2])
    print(f"가장 긴 침묵:     {longest[2]:.2f}초 (at {longest[0]:.1f}초)")

# hesitation hotspot: 0.8초 이상 침묵
HOTSPOT_THRESHOLD = 0.8
hotspots = [s for s in silences if s[2] >= HOTSPOT_THRESHOLD]
print(f"\nHesitation hotspots (≥{HOTSPOT_THRESHOLD}초 침묵): {len(hotspots)}")
for start, end, dur in hotspots:
    # 이 시점 직전의 Whisper 세그먼트 찾기
    context = ""
    for seg in segments:
        if seg.start <= start <= seg.end + 1.0:
            context = seg.text.strip()
            break
        if seg.end < start:
            context = seg.text.strip()  # 가장 최근
    print(f"  [{start:6.2f}초] {dur:.2f}초 막힘 | 직전: \"{context[-30:]}\"")

# === 4. 종합 메트릭 ===
print("\n" + "=" * 60)
print("4. 종합 메트릭 (옵션 E 후보)")
print("=" * 60)
char_count = len(full_text.replace(" ", ""))
cpm = char_count / (total_duration / 60) if total_duration > 0 else 0
print(f"총 글자수 (공백제외):  {char_count}")
print(f"발화 속도:             {cpm:.0f} CPM (chars/min)")
print(f"발화/침묵 비율:        {total_speech/total_silence:.1f}" if total_silence > 0 else "침묵 없음")
print(f"Hesitation hotspot 수: {len(hotspots)}")
