# tools/database/config.py

import os
from pathlib import Path
from dotenv import load_dotenv

# Always load the backend-owned configuration, irrespective of the directory
# from which uvicorn is started.
load_dotenv(Path(__file__).resolve().parents[3] / ".env")


# ---------------------------------------------------------
# MongoDB
# ---------------------------------------------------------

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017"
)

MONGODB_DATABASE = os.getenv(
    "MONGODB_DATABASE",
    "momentum"
)

MONGODB_INTERVIEW_COLLECTION = os.getenv(
    "MONGODB_INTERVIEW_COLLECTION",
    "interview_sessions",
)


# ---------------------------------------------------------
# Qdrant Cloud
# ---------------------------------------------------------

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

if not QDRANT_URL:
    raise RuntimeError("QDRANT_URL is missing from .env")

if not QDRANT_API_KEY:
    raise RuntimeError("QDRANT_API_KEY is missing from .env")


# ---------------------------------------------------------
# Qdrant configuration
# ---------------------------------------------------------

# This is the model identifier sent to Qdrant Cloud Inference.  No embedding
# model is loaded locally.
QDRANT_EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)

QDRANT_VECTOR_SIZE = 384

QDRANT_COLLECTION_RESUME = os.getenv("QDRANT_RESUME_COLLECTION", "resume_chunks")
QDRANT_COLLECTION_QUESTIONS = os.getenv("QDRANT_QUESTIONS_COLLECTION", "interview_questions")
QDRANT_COLLECTION_KNOWLEDGE = os.getenv("QDRANT_KNOWLEDGE_COLLECTION", "interview_knowledge")
