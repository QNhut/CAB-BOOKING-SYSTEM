import json
import logging
import sys
from datetime import datetime, timezone


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )


def log_event(level: int, event: str, trace_id: str, **fields: object) -> None:
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": logging.getLevelName(level),
        "event": event,
        "trace_id": trace_id,
        **fields,
    }
    logging.log(level, json.dumps(payload, ensure_ascii=True))
