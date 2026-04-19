"""분석 엔트리: audio → (normalize) → stt → vad → metrics → log."""
import argparse
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

from . import config, log_writer, metrics, stt, vad

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _relative_audio_path(audio_path: Path) -> str:
    try:
        return str(audio_path.resolve().relative_to(config.BASE_DIR)).replace("\\", "/")
    except ValueError:
        return str(audio_path).replace("\\", "/")


def _maybe_normalize(audio_path: Path):
    """작게 녹음된 오디오를 peak 기준으로 끌어올려 임시 wav로 저장.

    반환: (분석에 쓸 경로, 정리할 임시경로 or None, 전처리 메타 dict)
    """
    if not config.AUDIO_NORMALIZE:
        return audio_path, None, {"normalized": False, "reason": "disabled"}

    y, _ = librosa.load(str(audio_path), sr=config.SAMPLE_RATE, mono=True)
    peak = float(np.max(np.abs(y)))
    target = 10 ** (config.AUDIO_NORMALIZE_PEAK_DBFS / 20)

    if peak <= 0:
        return audio_path, None, {"normalized": False, "reason": "silent"}

    peak_dbfs = round(float(20 * np.log10(peak)), 2)
    if peak >= target:
        return audio_path, None, {
            "normalized": False,
            "reason": "already_loud_enough",
            "original_peak_dbfs": peak_dbfs,
        }

    gain = target / peak
    y_norm = np.clip(y * gain, -1.0, 1.0).astype(np.float32)

    fd, tmp = tempfile.mkstemp(suffix=".wav", prefix="speechlogs_norm_")
    os.close(fd)
    tmp_path = Path(tmp)
    sf.write(str(tmp_path), y_norm, config.SAMPLE_RATE, subtype="PCM_16")

    gain_db = round(float(20 * np.log10(gain)), 2)
    rms_db = round(float(20 * np.log10(float(np.sqrt(np.mean(y_norm ** 2))) + 1e-12)), 2)
    print(f"  정규화: +{gain_db} dB (peak→{config.AUDIO_NORMALIZE_PEAK_DBFS} dBFS, RMS {rms_db} dBFS)")

    return tmp_path, tmp_path, {
        "normalized": True,
        "gain_db": gain_db,
        "original_peak_dbfs": peak_dbfs,
        "target_peak_dbfs": config.AUDIO_NORMALIZE_PEAK_DBFS,
    }


def analyze(audio_path, session_id=None, topic=None):
    audio_path = Path(audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(audio_path)

    if session_id is None:
        session_id = datetime.now().strftime("%Y-%m-%d_%H%M%S")

    print(f"분석 시작: {audio_path.name}")

    analysis_path, cleanup_path, preprocessing = _maybe_normalize(audio_path)

    try:
        segments, info, full_text = stt.transcribe(analysis_path)
        print(f"  STT: {len(segments)} 세그먼트 (오디오 {info.duration:.1f}초)")

        speech_ts, duration = vad.detect_speech(analysis_path)
        print(f"  VAD: {len(speech_ts)} 발화 구간")
    finally:
        if cleanup_path is not None:
            cleanup_path.unlink(missing_ok=True)

    m = metrics.compute_metrics(full_text, segments, speech_ts, duration)

    session = {
        "session_id": session_id,
        "audio_path": _relative_audio_path(audio_path),
        "topic": topic,
        "duration_sec": round(duration, 2),
        "model": {"stt": config.STT_MODEL_STR, "vad": config.VAD_MODEL_STR},
        "preprocessing": preprocessing,
        "language": info.language,
        "raw_text": full_text.strip(),
        "segments": [
            {"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()}
            for s in segments
        ],
        "speech_timestamps": [
            {"start": round(s["start"], 2), "end": round(s["end"], 2)}
            for s in speech_ts
        ],
        "metrics": m,
        "notes": None,
    }

    log_path = log_writer.write_log(session)

    print()
    print("=" * 50)
    print(f"  CPM:               {m['cpm']}")
    print(f"  speech_ratio:      {m['speech_ratio']:.2f}")
    print(f"  hotspot_count:     {m['hotspot_count']}")
    print(f"  longest_pause_sec: {m['longest_pause_sec']}")
    print("=" * 50)

    top_hotspots = sorted(
        m["hesitation_hotspots"],
        key=lambda h: h["duration"],
        reverse=True,
    )[: config.HOTSPOT_DISPLAY_COUNT]
    if top_hotspots:
        print(f"\nTop {len(top_hotspots)} hotspots (긴 침묵 순):")
        for h in top_hotspots:
            ctx = h["context"] or "(직전 발화 없음)"
            print(f"  [{h['start']:6.1f}s] {h['duration']:5.2f}초 막힘 | \"{ctx}\"")

    print(f"\n로그: {log_path}")

    return session


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--session-id", default=None)
    parser.add_argument("--topic", default=None)
    args = parser.parse_args()
    analyze(args.audio, session_id=args.session_id, topic=args.topic)


if __name__ == "__main__":
    main()
