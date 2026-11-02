import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/momentum")
DB_NAME = os.getenv("DB_NAME", "momentum")

# Baseten API Configuration
BASETEN_API_KEY = os.getenv("BASETEN_API_KEY", "")
BASETEN_BASE_URL = os.getenv("BASETEN_BASE_URL", "https://inference.baseten.co/v1")
BASETEN_MODEL = os.getenv("BASETEN_MODEL", "meta-models/muse-spark-open-1026")

# Backwards compatibility alias
GEMINI_API_KEY = BASETEN_API_KEY

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
