import io
import pathlib
import sys

import pytest

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import app as app_module  # noqa: E402


@pytest.fixture
def client(monkeypatch):
    # Prevent accidental Gemini calls during tests.
    monkeypatch.setattr(app_module, "GEMINI_MODEL", None)
    return app_module.app.test_client()


def test_build_summary_counts_severities():
    summary = app_module.build_summary(
        [{"severity": "INFO"}, {"severity": "ERROR"}, {"severity": "INFO"}]
    )
    assert summary["total"] == 3
    assert summary["INFO"] == 2
    assert summary["ERROR"] == 1


def test_analyze_endpoint_returns_parsed_payload(client):
    payload = (
        "[11/7/25 10:30:03:890000 EST] 00000003 com.example.Logger INFO Message line"
    )
    data = {"logFile": (io.BytesIO(payload.encode()), "messages.log")}
    response = client.post("/analyze", data=data, content_type="multipart/form-data")
    assert response.status_code == 200
    body = response.get_json()
    assert body["summary"]["total"] == 1
    assert body["logs"][0]["message"] == "Message line"


def test_ai_explain_requires_text(client):
    response = client.post("/ai_explain", json={})
    assert response.status_code == 400


def test_ai_explain_returns_message_when_model_missing(client):
    response = client.post("/ai_explain", json={"logText": "example"})
    assert response.status_code == 200
    assert "Gemini API is not configured" in response.get_json()["explanation"]


def test_ai_explain_success_when_model_present(monkeypatch):
    class DummyResponse:
        text = "dummy explanation"

    class DummyModel:
        def __init__(self):
            self.prompts = []

        def generate_content(self, prompt):
            self.prompts.append(prompt)
            return DummyResponse()

    dummy = DummyModel()
    monkeypatch.setattr(app_module, "GEMINI_MODEL", dummy)
    client = app_module.app.test_client()

    response = client.post("/ai_explain", json={"logText": "hello"})
    assert response.status_code == 200
    assert response.get_json()["explanation"] == "dummy explanation"
    assert dummy.prompts
