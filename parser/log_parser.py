import re
from datetime import datetime
from typing import List, Tuple, Dict, Any

SEVERITY_MAP = {
    "A": "INFO",
    "AUDIT": "INFO",
    "C": "WARN",
    "CONFIG": "WARN",
    "D": "DEBUG",
    "DEBUG": "DEBUG",
    "I": "INFO",
    "INFO": "INFO",
    "O": "INFO",
    "NOTICE": "INFO",
    "R": "ERROR",
    "S": "ERROR",
    "SEVERE": "ERROR",
    "E": "ERROR",
    "ERR": "ERROR",
    "ERROR": "ERROR",
    "F": "FATAL",
    "FATAL": "FATAL",
    "W": "WARN",
    "WARN": "WARN",
    "WARNING": "WARN",
    "T": "TRACE",
    "TRACE": "TRACE",
}

LOG_PATTERNS = [
    re.compile(
        r"""
^\[
    (?P<timestamp>[^\]]+)
\]\s+
    (?P<thread>\S+)
\s+
    (?P<logger>[^\s]+)
\s+
    (?P<severity>[A-Z]+)
\s+
    (?P<message>.*)
$""",
        re.VERBOSE,
    ),
    re.compile(
        r"""
^\[
    (?P<timestamp>[^\]]+)
\]\s+
    (?P<thread>\S+)
\s+
    (?P<component>\S+)
\s+
    (?P<severity>[A-Z]+)
\s+
    (?P<logger>[\w\.\$]+)
\s+
    (?P<message>.*)
$""",
        re.VERBOSE,
    ),
]


def normalize_severity(code: str) -> str:
    return SEVERITY_MAP.get(code.upper(), code.upper())


def parse_timestamp(raw_value: str) -> str:
    candidate = raw_value.strip()
    tz_token = ""
    if " " in candidate:
        maybe_candidate, maybe_tz = candidate.rsplit(" ", 1)
        if maybe_tz.isalpha():
            candidate = maybe_candidate
            tz_token = maybe_tz

    sanitized = candidate.replace(", ", " ").replace(",", " ")
    formats = [
        "%m/%d/%y %H:%M:%S:%f",
        "%m/%d/%Y %H:%M:%S:%f",
        "%Y-%m-%d %H:%M:%S,%f",
        "%d/%m/%Y %H:%M:%S:%f",
    ]

    for fmt in formats:
        try:
            parsed = datetime.strptime(sanitized, fmt)
            iso_value = parsed.isoformat()
            if tz_token:
                iso_value = f"{iso_value} {tz_token}"
            return iso_value
        except ValueError:
            continue

    return raw_value.strip()


def parse_logs(contents: str) -> List[Dict[str, Any]]:
    logs: List[Dict[str, Any]] = []
    for line in contents.splitlines():
        raw_line = line.strip()
        if not raw_line:
            continue
        match = None
        for pattern in LOG_PATTERNS:
            match = pattern.match(raw_line)
            if match:
                break
        if not match:
            if logs:
                logs[-1]["message"] += f" {raw_line}"
                logs[-1]["raw_line"] += f"\n{raw_line}"
            continue

        severity = normalize_severity(match.group("severity"))
        group_map = match.groupdict()
        logger_name = group_map.get("logger") or group_map.get("component") or "UNKNOWN"
        component = group_map.get("component")
        if not component and logger_name:
            component = logger_name.split(".")[-1]
        if not component:
            component = "UNKNOWN"
        entry = {
            "id": len(logs) + 1,
            "timestamp": parse_timestamp(match.group("timestamp")),
            "thread": match.group("thread"),
            "component": component,
            "severity": severity,
            "logger": logger_name,
            "message": match.group("message").strip(),
            "raw_line": raw_line,
        }
        logs.append(entry)
    return logs


def find_first_error_context(
    logs: List[Dict[str, Any]], context_window: int = 3
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    for index, entry in enumerate(logs):
        if entry["severity"] in {"ERROR", "FATAL"}:
            start = max(0, index - context_window)
            return entry, logs[start:index]
    return {}, []


__all__ = ["parse_logs", "find_first_error_context"]
