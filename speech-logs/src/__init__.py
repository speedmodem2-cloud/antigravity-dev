"""speech-logs 패키지 초기화.

Windows에서 ctranslate2 GPU가 pip-installed nvidia CUDA 런타임 DLL을
찾도록 두 가지 처리:
  1) `os.add_dll_directory()`로 탐색 경로 등록
  2) 주요 DLL들을 `ctypes.WinDLL`로 명시적 preload (2-pass 의존성 해결)

Python 3.8+에서 LoadLibrary가 PATH만으론 DLL을 못 찾고,
ctranslate2 내부 로딩이 `add_dll_directory`와도 불일치할 수 있어서 preload가 안전.
"""
import ctypes
import importlib.util
import os
import sys
from pathlib import Path

_DEBUG = bool(os.environ.get("SPEECHLOGS_DEBUG_DLL"))


def _dll_candidates():
    for mod_name in ("nvidia.cuda_runtime", "nvidia.cublas", "nvidia.cudnn", "nvidia.cuda_nvrtc"):
        try:
            spec = importlib.util.find_spec(mod_name)
        except Exception:
            spec = None
        if spec and spec.submodule_search_locations:
            yield Path(spec.submodule_search_locations[0]) / "bin"

    pkg_root = Path(__file__).resolve().parent.parent / ".venv" / "Lib" / "site-packages" / "nvidia"
    if pkg_root.is_dir():
        for sub in pkg_root.iterdir():
            bin_dir = sub / "bin"
            if bin_dir.is_dir():
                yield bin_dir


def _prepare_cuda() -> None:
    if sys.platform != "win32":
        return

    seen_dirs = set()
    dll_paths = []

    for bin_dir in _dll_candidates():
        try:
            key = str(bin_dir.resolve()).lower()
        except OSError:
            continue
        if key in seen_dirs or not bin_dir.is_dir():
            continue
        seen_dirs.add(key)

        try:
            os.add_dll_directory(str(bin_dir))
            if _DEBUG:
                print(f"[dll] dir + {bin_dir}", file=sys.stderr)
        except (OSError, AttributeError):
            pass

        dll_paths.extend(sorted(bin_dir.glob("*.dll")))

    # 2-pass preload — 의존성 순서 모를 때 반복으로 해결.
    remaining = list(dll_paths)
    for attempt in range(3):
        if not remaining:
            break
        new_remaining = []
        for dll_path in remaining:
            try:
                ctypes.WinDLL(str(dll_path))
                if _DEBUG:
                    print(f"[dll] load ok {dll_path.name}", file=sys.stderr)
            except OSError as e:
                new_remaining.append(dll_path)
                if _DEBUG and attempt == 2:
                    print(f"[dll] load fail {dll_path.name}: {e}", file=sys.stderr)
        remaining = new_remaining


_prepare_cuda()
