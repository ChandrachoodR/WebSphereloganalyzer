import pathlib
import sys

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from parser.log_parser import parse_logs, find_first_error_context  # noqa: E402


def test_parse_logs_handles_multiline_and_severity_normalization():
    sample = """[11/7/25 10:30:03:890000 EST] 00000003 WebContainer INFO com.example.Logger Message line 1
continuation line
[11/7/25 10:30:05:000000 EST] 00000005 WebContainer E com.example.Logger Boom"""

    logs = parse_logs(sample)
    assert len(logs) == 2
    first = logs[0]
    assert first["message"].endswith("continuation line")
    assert first["severity"] == "INFO"

    second = logs[1]
    assert second["severity"] == "ERROR"


def test_find_first_error_context_returns_window():
    sample = """[11/7/25 10:30:03:000000 EST] 1 Web INFO com L1
[11/7/25 10:30:04:000000 EST] 2 Web WARN com L2
[11/7/25 10:30:05:000000 EST] 3 Web ERROR com L3"""
    logs = parse_logs(sample)
    first_error, context = find_first_error_context(logs, context_window=2)
    assert first_error["severity"] == "ERROR"
    assert len(context) == 2
