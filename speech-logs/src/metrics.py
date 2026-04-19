"""메트릭 집계 — cpm, speech/silence ratio, hotspot."""
from . import vad as vad_module


def compute_metrics(full_text, segments, speech_timestamps, duration):
    char_count = len(full_text.replace(" ", "").replace("\n", ""))
    cpm = round(char_count / (duration / 60)) if duration > 0 else 0

    total_speech = sum(s["end"] - s["start"] for s in speech_timestamps)
    speech_ratio = total_speech / duration if duration > 0 else 0
    silence_ratio = 1 - speech_ratio

    silences = vad_module.compute_silences(speech_timestamps, duration)
    hotspots = vad_module.filter_hotspots(silences, duration)

    if hotspots:
        longest = max(hotspots, key=lambda x: x[2])
        longest_pause_sec = round(longest[2], 2)
        longest_pause_at = round(longest[0], 2)
    else:
        longest_pause_sec = 0.0
        longest_pause_at = 0.0

    hotspot_list = [
        {
            "start": round(start, 2),
            "end": round(end, 2),
            "duration": round(dur, 2),
            "context": vad_module.find_context(start, segments),
        }
        for start, end, dur in hotspots
    ]

    return {
        "char_count": char_count,
        "cpm": cpm,
        "speech_ratio": round(speech_ratio, 3),
        "silence_ratio": round(silence_ratio, 3),
        "longest_pause_sec": longest_pause_sec,
        "longest_pause_at": longest_pause_at,
        "hotspot_count": len(hotspots),
        "hesitation_hotspots": hotspot_list,
        "segment_count": len(segments),
    }
