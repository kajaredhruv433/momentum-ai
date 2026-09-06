@echo off
echo ========================================================
echo Starting Momentum Services (FastAPI + Next.js)
echo ========================================================

echo [1/2] Starting Python FastAPI Backend on http://127.0.0.1:8000 ...
start "Momentum Backend (Uvicorn)" cmd /k "backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting Next.js Frontend on http://localhost:3000 ...
start "Momentum Frontend (Next.js)" cmd /k "cd frontend && npm run dev"

echo ========================================================
echo Both servers are starting up in separate windows!
echo Frontend: http://localhost:3000
echo Backend:  http://127.0.0.1:8000 (Swagger docs at /docs)
echo ========================================================
