"""기본 입력 장치명 출력 + 예상 장치 키워드 매칭 판정.

사용:
  python -m src.device_info              # 장치명만 출력
  python -m src.device_info --check      # 매칭 여부도 출력, 미매칭 시 exit 2
"""
import argparse
import sys

import sounddevice as sd

from . import config

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def current_device_name() -> str:
    return sd.query_devices(kind="input")["name"]


def matches_expected(name: str) -> bool:
    lname = name.lower()
    return any(kw.lower() in lname for kw in config.EXPECTED_INPUT_KEYWORDS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    name = current_device_name()
    if args.check:
        matched = matches_expected(name)
        print(f"device: {name}")
        print(f"matched: {'yes' if matched else 'no'}")
        sys.exit(0 if matched else 2)

    print(name)


if __name__ == "__main__":
    main()
