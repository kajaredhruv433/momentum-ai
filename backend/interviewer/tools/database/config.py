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
