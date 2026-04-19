"""sounddevice 기반 녹음 → 16kHz mono wav.

Ctrl+C로 조기 종료 시 그 시점까지 녹음된 분량만 저장.
"""
import argparse
import queue
import sys
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf

from . import config

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def record(duration, out_path: Path) -> Path:
    """duration이 None 또는 0 이하이면 무제한 녹음 (Ctrl+C로만 종료)."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    unlimited = duration is None or duration <= 0

    device_info = sd.query_devices(kind="input")
    print(f"입력 장치: {device_info['name']}")
    if unlimited:
        print("녹음 시간: 무제한 (Ctrl+C로 종료)")
    else:
        print(f"녹음 시간: {duration:.0f}초 ({duration/60:.1f}분)")

    for i in range(3, 0, -1):
        print(f"  {i}...", flush=True)
        time.sleep(1)
    print("● 녹음 시작 (Ctrl+C로 종료)\n", flush=True)

    q: "queue.Queue[np.ndarray]" = queue.Queue()

    def callback(indata, frames, time_info, status):
        if status:
            print(f"  [warn] {status}", file=sys.stderr)
        q.put(indata.copy())

    frames: list[np.ndarray] = []
    start_time = time.time()

    try:
        with sd.InputStream(
            samplerate=config.SAMPLE_RATE,
            channels=config.CHANNELS,
            dtype="float32",
            callback=callback,
        ):
            while True:
                if not unlimited and time.time() - start_time >= duration:
                    break
                try:
                    frames.append(q.get(timeout=0.5))
                except queue.Empty:
                    continue
    except KeyboardInterrupt:
        print("\n(종료 감지 — 지금까지 녹음분 저장)")

    # 큐에 남은 버퍼 마저 비우기
    while not q.empty():
        frames.append(q.get_nowait())

    elapsed = time.time() - start_time
    if not frames:
        raise RuntimeError("녹음된 데이터 없음 — 입력 장치 확인 필요")

    data = np.concatenate(frames, axis=0)
    sf.write(str(out_path), data, config.SAMPLE_RATE, subtype="PCM_16")
    print(f"저장: {out_path} ({elapsed:.1f}초, {data.shape[0]} 샘플)")
    return out_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, default=None,
                        help="최대 녹음 시간(초). 미지정/0이면 무제한, Ctrl+C로만 종료.")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    record(args.duration, Path(args.output))


if __name__ == "__main__":
    main()
