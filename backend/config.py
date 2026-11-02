import os
from pathlib import Path
from dotenv import dotenv_values, load_dotenv

ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_FILE)


def _secret_from_env_file(*names: str) -> str:
    """Prefer a non-empty process variable, then read the ignored backend/.env directly."""
    file_values = dotenv_values(ENV_FILE)
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
        value = str(file_values.get(name) or "").strip()
        if value:
            return value
    return ""

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/momentum")
DB_NAME = os.getenv("DB_NAME", "momentum")

# Baseten API Configuration
MODEL_API_KEY = _secret_from_env_file("MODEL_API_KEY", "META_API_KEY", "META_AI_API_KEY")
META_API_BASE_URL = os.getenv("META_API_BASE_URL", "https://api.meta.ai/v1").strip().rstrip("/")
META_API_MODEL = os.getenv("META_API_MODEL", "muse-spark-1.3").strip()
BASETEN_API_KEY = os.getenv("BASETEN_API_KEY", "").strip()
if BASETEN_API_KEY.lower() in {"your-baseten-api-key", "your_baseten_api_key_here", "placeholder"}:
    BASETEN_API_KEY = ""
BASETEN_BASE_URL = os.getenv("BASETEN_BASE_URL", "https://inference.baseten.co/v1").strip().rstrip("/")
BASETEN_MODEL = os.getenv("BASETEN_MODEL", "meta-models/muse-spark-open-1026").strip()

# GitHub App OAuth for session-only project selection.
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
GITHUB_CALLBACK_URL = os.getenv(
    "GITHUB_CALLBACK_URL", "http://localhost:8000/auth/github/callback"
).strip()
GITHUB_FRONTEND_ORIGINS = tuple(
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "GITHUB_FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
)

# Backwards compatibility alias
GEMINI_API_KEY = BASETEN_API_KEY

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
