# EchoSphere

EchoSphere is an AI-powered interview platform with a dynamic panel of interviewers, real-time voice interaction, staged questioning, and evidence-based candidate reports.

## Features

- Configurable company, role, skills, experience, and candidate resume input
- Dynamic interview panel and voice assignment
- Normal, extended, and final interview stages governed by a strict timer
- FastAPI backend with MongoDB and Qdrant integrations
- React/Vite interface with interview transcript, timer, voice controls, and report views

## Requirements

- Python 3.11 or newer
- Node.js 18 or newer and npm
- Credentials for the services used by your configuration: Groq, Agora, MongoDB, and Qdrant

## Setup

From the repository root, create a Python virtual environment and install backend dependencies:

```powershell
py -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

Install frontend dependencies:

```powershell
cd frontend
npm install
cd ..
```

Create `backend/.env` locally and add the credentials required by the backend. This file is ignored by Git and must never be committed. Keep a separate secret manager or password vault for production credentials.

## Run Locally

Start the backend from the repository root:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

The backend serves the application at <http://127.0.0.1:8000>.

For frontend-only development, use a second terminal:

```powershell
cd frontend
npm run dev
```

The Vite development server normally runs at <http://localhost:5173>. The production-style workflow is to use the backend URL.

## Use the Application

1. Enter the company and job details.
2. Add the candidate resume text.
3. Start the interview and allow microphone access if voice features are enabled.
4. Submit candidate answers and follow the panel's questions.
5. Review the generated report after the closing message finishes.

## Project Layout

```text
backend/       FastAPI API, interview stages, AI integrations, and persistence
frontend/      React/Vite application
backend/tools/ Database adapters for MongoDB and Qdrant
```

## Checks

Build the frontend before publishing or deploying:

```powershell
cd frontend
npm run build
```

The repository intentionally excludes Python virtual environments, Node dependencies, build output, logs, caches, and local environment files. Recreate them using the setup commands above after cloning.
