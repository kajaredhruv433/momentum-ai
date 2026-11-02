import os
from pathlib import Path
from dotenv import dotenv_values, load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")

class Settings:
    backend_root = BACKEND_ROOT
    github_client_id = os.getenv("GITHUB_CLIENT_ID", "")
    github_client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
    github_callback_url = os.getenv("GITHUB_CALLBACK_URL", "http://localhost:8000/auth/github/callback")
    model_api_key = ""
    for key_name in ("MODEL_API_KEY", "META_API_KEY", "META_AI_API_KEY"):
        model_api_key = os.getenv(key_name, "").strip() or str(dotenv_values(BACKEND_ROOT / ".env").get(key_name) or "").strip()
        if model_api_key:
            break
    meta_base_url = "https://api.meta.ai/v1"
    meta_model = "muse-spark-1.3"
    baseten_api_key = os.getenv("BASETEN_API_KEY", "")
    daytona_api_key = os.getenv("DAYTONA_API_KEY", "").strip()
    if daytona_api_key.lower().startswith("paste_your_"):
        daytona_api_key = ""
    baseten_base_url = "https://inference.baseten.co/v1"
    baseten_model = "meta-models/muse-spark-open-1026"
    app_secret = os.getenv("REPO_EVALUATOR_APP_SECRET", "development-only-change-me")
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:8080")
    database_path = os.getenv("REPO_EVALUATOR_DATABASE_PATH", str(BACKEND_ROOT / "data" / "repo_evaluator.sqlite3"))
    assessment_minutes = int(os.getenv("ASSESSMENT_MINUTES", "60"))
    max_repository_files = int(os.getenv("MAX_REPOSITORY_FILES", "2500"))
    max_knowledge_chunks = int(os.getenv("MAX_KNOWLEDGE_CHUNKS", "5000"))
    max_file_bytes = int(os.getenv("MAX_FILE_BYTES", "300000"))
    max_workspace_read_bytes = int(os.getenv("MAX_WORKSPACE_READ_BYTES", str(8 * 1024 * 1024)))
    assistant_api_key = os.getenv("ASSISTANT_API_KEY", "")
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongodb_database = os.getenv("REPO_EVALUATOR_MONGODB_DATABASE", "momentum_interview_repo_evaluator")
    vectorizer_name = "local-feature-hash-v1"
    embedding_dimensions = int(os.getenv("VECTOR_DIMENSIONS", os.getenv("EMBEDDING_DIMENSIONS", "768")))
    secure_cookies = os.getenv("SECURE_COOKIES", "false").lower() == "true"

    @classmethod
    def get_baseten_api_key(cls) -> str:
        """Read the current key, falling back to backend/.env if startup env was empty/stale."""
        value = os.getenv("BASETEN_API_KEY", "").strip()
        if value:
            return value
        file_value = dotenv_values(cls.backend_root / ".env").get("BASETEN_API_KEY", "")
        return str(file_value or "").strip()

settings = Settings()
