import asyncio
from pathlib import Path
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent
INTERVIEWER_FRONTEND_DIST = BASE_DIR.parent / "frontend" / "interviewer" / "dist"

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

# Import Momentum authoritative interview platform routers & controllers
try:
    from backend.interviewer.api.interview import router as v9_interview_router
    from backend.interviewer.api.candidate import router as v9_candidate_router
    from backend.interviewer.api.websocket import router as v9_websocket_router, manager as v9_ws_manager
except ImportError as err:
    print("Warning: Could not import interviewer routers:", err)
    v9_interview_router = None
    v9_candidate_router = None
    v9_websocket_router = None
    v9_ws_manager = None

app = FastAPI(
    title="Momentum Unified API",
    description="Python FastAPI backend powering the Momentum recruitment portal and AI interview engine",
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

# Wire the interview WebSocket manager on startup
@app.on_event("startup")
async def on_startup():
    if v9_ws_manager:
        v9_ws_manager.loop = asyncio.get_running_loop()

from backend.candidate.solve_problem.solve_problem import router as candidate_solve_problem_router
from backend.candidate.resume_analyser.resume_analyser import router as candidate_resume_analyser_router

# Include Momentum core routers
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(candidate.router)
app.include_router(recruiter.router)
app.include_router(resume.router)
app.include_router(problems.router)
app.include_router(interviews.router)
app.include_router(candidate_solve_problem_router)
app.include_router(candidate_resume_analyser_router)

# Include interview routers
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
        "service": "Momentum Unified Backend"
    }

# Serve the interview frontend directly
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
    return {"status": "ok", "message": "Momentum frontend not built"}

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
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)

