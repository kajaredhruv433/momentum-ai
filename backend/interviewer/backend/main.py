"""
main.py

FastAPI application serving the Momentum AI Interview Platform backend APIs,
WebSocket event stream, and hosting the frontend UI.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Ensure environment variables are loaded
load_dotenv(Path(__file__).resolve().parent / ".env")

try:
    from .api.candidate import router as candidate_router
    from .api.interview import router as interview_router
    from .api.websocket import router as websocket_router
except ImportError:
    from api.candidate import router as candidate_router
    from api.interview import router as interview_router
    from api.websocket import router as websocket_router

LOG_PATH = Path(__file__).resolve().parent / "interview-api.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_PATH, encoding="utf-8")],
)
logger = logging.getLogger("momentum.main")

app = FastAPI(
    title="Momentum AI Interview Platform",
    description="Multi-panel AI Interview Platform with ElevenLabs speech and Groq reasoning.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API and WebSocket Routers
app.include_router(interview_router)
app.include_router(candidate_router)
app.include_router(websocket_router)


@app.on_event("startup")
async def on_startup():
    import asyncio
    try:
        from .api.websocket import manager
    except ImportError:
        from api.websocket import manager
    manager.loop = asyncio.get_running_loop()


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "Momentum AI Interview Platform"}


# Host frontend static files (prefers built dist/ if available, otherwise frontend root)
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
FRONTEND_SRC = Path(__file__).resolve().parents[1] / "frontend"


@app.get("/")
def serve_root():
    index_file = FRONTEND_DIST / "index.html"
    if not index_file.exists():
        index_file = FRONTEND_SRC / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return {"status": "ok", "service": "Momentum AI Interview Platform"}


if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
elif FRONTEND_SRC.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_SRC, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
