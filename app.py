import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

from parser.log_parser import parse_logs, find_first_error_context

load_dotenv()

app = Flask(__name__)

try:
    import google.generativeai as genai
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    genai = None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def model_name_candidates(raw_name: str | None) -> list[str]:
    """
    Try both short (`gemini-2.5-flash`) and fully-qualified (`models/gemini-2.5-flash`)
    names so the code works across both v1beta and v1 Gemini endpoints.
    """
    default_short = "gemini-2.5-flash"
    candidates: list[str] = []

    def add(name: str | None):
        if not name:
            return
        if name not in candidates:
            candidates.append(name)

    preferred = (raw_name or "").strip() or default_short

    add(preferred)
    if preferred.startswith("models/"):
        add(preferred.split("/", 1)[1])
    elif "/" not in preferred:
        add(f"models/{preferred}")

    add(default_short)
    add(f"models/{default_short}")

    return candidates


GEMINI_MODEL_NAME = None
GEMINI_MODEL = None

if genai and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model_errors = []
        for candidate in model_name_candidates(os.getenv("GEMINI_MODEL")):
            try:
                GEMINI_MODEL = genai.GenerativeModel(candidate)
                GEMINI_MODEL_NAME = candidate
                break
            except Exception as exc:  # pragma: no cover - external dependency
                model_errors.append((candidate, str(exc)))

        if not GEMINI_MODEL and model_errors:
            failed = "; ".join(f"{name}: {err}" for name, err in model_errors)
            app.logger.warning("Gemini model initialization failed: %s", failed)
    except Exception:
        GEMINI_MODEL = None


def build_summary(logs):
    summary = {"total": len(logs)}
    for entry in logs:
        severity = entry.get("severity", "UNKNOWN")
        summary[severity] = summary.get(severity, 0) + 1
    return summary


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    uploaded_file = request.files.get("logFile")
    if not uploaded_file:
        return jsonify({"error": "Please attach a messages.log file."}), 400

    raw_contents = uploaded_file.read().decode("utf-8", errors="ignore")
    logs = parse_logs(raw_contents)
    first_error, context = find_first_error_context(logs)

    response_body = {
        "logs": logs,
        "summary": build_summary(logs),
        "firstError": first_error or None,
        "preErrorContext": context,
    }
    return jsonify(response_body)


@app.route("/ai_explain", methods=["POST"])
def ai_explain():
    payload = request.get_json(silent=True) or {}
    log_text = (payload.get("logText") or "").strip()
    if not log_text:
        return jsonify({"error": "Log text is required for AI explanation."}), 400

    if not genai or not GEMINI_MODEL:
        return jsonify(
            {
                "explanation": "Gemini API is not configured. "
                "Set GEMINI_API_KEY in your environment to enable AI explanations."
            }
        )

    prompt = (
        "You are assisting an SRE troubleshooting IBM WebSphere Liberty. "
        "Explain the log entry clearly, outline likely causes, and propose actionable fixes.\n\n"
        f"Log entry:\n{log_text}"
    )
    try:
        response = GEMINI_MODEL.generate_content(prompt)
        explanation = getattr(response, "text", "").strip() or "No explanation returned."
        return jsonify({"explanation": explanation})
    except Exception as exc:  # pragma: no cover - external dependency
        return (
            jsonify(
                {
                    "explanation": "Gemini API request failed. "
                    "Verify your API key and network connectivity.",
                    "error": str(exc),
                }
            ),
            502,
        )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug)
