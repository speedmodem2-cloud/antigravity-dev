"""단일 오디오 파일의 peak/RMS 레벨 출력 (스모크 모드용).

사용: python -m src.check_level <audio_path>
"""
import argparse
import sys

import librosa
import numpy as np

from . import config

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def measure(audio_path):
    y, _ = librosa.load(str(audio_path), sr=config.SAMPLE_RATE, mono=True)
    peak = float(np.max(np.abs(y)))
    rms = float(np.sqrt(np.mean(y ** 2)))
    peak_db = float(20 * np.log10(peak + 1e-12))
    rms_db = float(20 * np.log10(rms + 1e-12))
    return peak_db, rms_db


def verdict(rms_db):
    if rms_db < -35:
        return "속삭임 수준. 더 크게 말하거나 마이크 입력 볼륨을 올리세요. (정규화로 보정은 되지만 텍스트 품질이 떨어짐)"
    if rms_db < -25:
        return "약간 작음. 자동 정규화가 처리 가능하지만 조금 더 크면 이상적."
    if rms_db < -12:
        return "정상 범위."
    return "피크에 가까움. 거리를 조금 두세요 (클리핑 위험)."


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    args = parser.parse_args()

    peak_db, rms_db = measure(args.audio)
    print(f"peak: {peak_db:.1f} dBFS")
    print(f"RMS:  {rms_db:.1f} dBFS")
    print(f"→ {verdict(rms_db)}")


if __name__ == "__main__":
    main()
