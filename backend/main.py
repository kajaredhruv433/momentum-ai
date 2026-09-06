import os
import sys
import asyncio
from pathlib import Path
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent
INTERVIEWER_BACKEND_DIR = BASE_DIR / "interviewer" / "backend"
INTERVIEWER_FRONTEND_DIST = BASE_DIR / "interviewer" / "frontend" / "dist"
V9_SITE_PACKAGES = r"C:\Users\dhruv\Music\Skill\EchoSphere\v9\backend\.venv\Lib\site-packages"

if V9_SITE_PACKAGES not in sys.path and Path(V9_SITE_PACKAGES).exists():
    sys.path.insert(0, V9_SITE_PACKAGES)

if str(INTERVIEWER_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(INTERVIEWER_BACKEND_DIR))

from backend.routers import (
    users,
    jobs,
    applications,
    candidate,
    recruiter,
    resume,
    problems,
    interviews
)
from backend.config import PORT, HOST

# Import EchoSphere authoritative interview platform routers & controllers
try:
    from api.interview import router as v9_interview_router
    from api.candidate import router as v9_candidate_router
    from api.websocket import router as v9_websocket_router, manager as v9_ws_manager
except ImportError as err:
    print("Warning: Could not import interviewer routers:", err)
    v9_interview_router = None
    v9_candidate_router = None
    v9_websocket_router = None
    v9_ws_manager = None

app = FastAPI(
    title="Momentum & EchoSphere Unified API",
    description="Python FastAPI backend powering Momentum recruitment portal and EchoSphere AI interview engine",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire EchoSphere v9 WebSocket manager on startup
@app.on_event("startup")
async def on_startup():
    if v9_ws_manager:
        v9_ws_manager.loop = asyncio.get_running_loop()

# Include Momentum core routers
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(candidate.router)
app.include_router(recruiter.router)
app.include_router(resume.router)
app.include_router(problems.router)
app.include_router(interviews.router)

# Include EchoSphere interview routers
if v9_interview_router:
    app.include_router(v9_interview_router)
if v9_candidate_router:
    app.include_router(v9_candidate_router)
if v9_websocket_router:
    app.include_router(v9_websocket_router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Momentum & EchoSphere Unified Backend"
    }

# Serve EchoSphere Interview frontend directly
@app.get("/interview-app")
@app.get("/interview-app/{path:path}")
def serve_interview_app(path: str = ""):
    index_file = INTERVIEWER_FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return {"status": "ok", "message": "EchoSphere frontend not built"}

if INTERVIEWER_FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=INTERVIEWER_FRONTEND_DIST / "assets"), name="interviewer_assets")

@app.get("/")
def serve_root():
    index_file = INTERVIEWER_FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return {
        "status": "online",
        "service": "Momentum Python API",
        "framework": "FastAPI",
        "docs": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)

