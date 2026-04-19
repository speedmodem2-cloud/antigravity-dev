"""Phase 0 — faster-whisper 필러 보존률 테스트
사용법: python test.py audio/파일명.wav
"""
import sys
import io
import time

# Windows 콘솔 UTF-8 강제
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from faster_whisper import WhisperModel

if len(sys.argv) < 2:
    print("사용법: python test.py <wav경로>")
    sys.exit(1)

audio_path = sys.argv[1]

# Phase 0은 CPU로 먼저 검증 (GPU는 CUDA 12 런타임 설치 후)
print("모델 로딩 중... (CPU 모드)")
t0 = time.time()
model = WhisperModel("large-v3", device="cpu", compute_type="int8")
print(f"로딩 완료: {time.time() - t0:.1f}초\n")

# 필러 보존을 위한 설정
print("Transcribe 중...")
t0 = time.time()
segments, info = model.transcribe(
    audio_path,
    language="ko",
    beam_size=5,
    vad_filter=False,              # VAD 끄면 필러/침묵 살아남을 확률↑
    condition_on_previous_text=False,  # 문맥 기반 "정리" 방지
    word_timestamps=True,
)

segments = list(segments)
elapsed = time.time() - t0
print(f"완료: {elapsed:.1f}초 (오디오 {info.duration:.1f}초)\n")
print(f"감지 언어: {info.language} (확률 {info.language_probability:.2f})")
print("=" * 60)

full_text = ""
for seg in segments:
    print(f"[{seg.start:6.2f} → {seg.end:6.2f}] {seg.text}")
    full_text += seg.text

print("=" * 60)
print("\n=== 필러 카운트 (STT 결과 기준) ===")
fillers = ["어", "음", "그", "뭐", "그러니까", "막", "이제", "약간", "뭔가", "아"]
for f in fillers:
    count = full_text.count(f)
    if count > 0:
        print(f"  {f}: {count}")

print(f"\n총 글자수: {len(full_text)}")
print(f"총 세그먼트: {len(segments)}")
