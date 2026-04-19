"""JSON 로그 저장 — 같은 날짜 파일에 sessions append."""
import json
from datetime import datetime

from . import config


def write_log(session_dict, date_str=None):
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")

    config.LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = config.LOGS_DIR / f"{date_str}_speech.json"

    if log_path.exists():
        data = json.loads(log_path.read_text(encoding="utf-8"))
    else:
        data = {"date": date_str, "sessions": []}

    data["sessions"].append(session_dict)
    log_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return log_path
