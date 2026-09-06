# RunTimeError-Momentum (EchoSphere)
### Next-Gen Autonomous AI Recruitment Platform & Real-Time Multi-Agent Interview System

[![Python Version](https://img.shields.io/badge/Python-3.12.10%20(Recommended%3A%203.12.x)-blue.svg)](https://www.python.org/downloads/)
[![Node.js Version](https://img.shields.io/badge/Node.js-v24.12.0%20(Recommended%3A%2018%2B)-green.svg)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-momentum-47A248.svg)](https://www.mongodb.com/)
[![Agora](https://img.shields.io/badge/Agora-Conversational%20AI-099DFD.svg)](https://www.agora.io/)
[![Groq](https://img.shields.io/badge/Groq-Llama%203%20Reasoning-F05A28.svg)](https://groq.com/)

---

## 🌟 Overview

**Momentum (EchoSphere)** is an enterprise-grade, end-to-end recruitment and candidate assessment platform. It unifies a high-performance **Next.js 16** job portal and candidate/recruiter dashboard with a decoupled **Python FastAPI** backend powered by **EchoSphere**—an autonomous multi-agent AI panel capable of conducting voice-driven technical interviews in real time.

### Key Highlights
- **Zero-Input Automated Interview Setup**: Automatically pulls job descriptions from MongoDB (`jobs` collection) and candidate profiles/resumes from MongoDB (`resumes` and `users` collections). No manual file uploading or form filling before an interview.
- **Hardware Readiness Check**: Interactive pre-interview lobby with live webcam feed and real-time Web Audio API microphone volume meter.
- **Multi-Agent Voice Panel**: Centralized Agora Conversational AI with ultra-low latency Groq reasoning and Gemini fallback.
- **Evaluation Persistence**: Comprehensive evaluation report, match score, technical score, and communication metrics are automatically persisted to MongoDB (`applications` and `interview_sessions`) with `interviewId` and `candidateId`.
- **Recruiter Leaderboard**: Recruiter candidate view displaying all candidates who finished the interview, sorted strictly in descending order of match score.

---

## ⚙️ System Requirements & Version Specifications

| Component | Used Version in Repository | Recommended Version |
|---|---|---|
| **Python** | **Python 3.12.10** | **Python 3.12.x** (3.12.10 recommended, matching the backend virtual environment) |
| **Node.js** | **v24.12.0** | **Node.js 18.x, 20.x, 22.x, or 24.x** (LTS or current) |
| **npm** | **10.x+** | **10.x+** |
| **Database** | **MongoDB 6.0+ / 7.0+** | Local MongoDB (`mongodb://localhost:27017`) or MongoDB Atlas |

> [!IMPORTANT]
> **Python Version Notice**: This project was developed and tested using **Python 3.12.10**. We strongly recommend using **Python 3.12.x** (specifically 3.12.10). Python 3.12 ensures complete compatibility with `motor`, `pymupdf`, `agora-agents`, `pydantic v2`, and `qdrant-client`.

---

## 📁 Repository Architecture

```text
RunTimeError-Momentum(EchoSphere)/
├── backend/
│   ├── config.py                           # MongoDB & Gemini server configurations
│   ├── main.py                             # Unified FastAPI application & static mount
│   ├── models/                             # Pydantic & database schemas
│   ├── routers/                            # API endpoints (jobs, applications, recruiter)
│   ├── services/                           # Gemini AI & code execution engines
│   ├── requirements.txt                    # Complete consolidated Python dependencies
│   └── interviewer/                        # Embedded EchoSphere AI Interviewer
│       ├── backend/                        # AI panel agents, Agora RTC/TTS, Groq router
│       │   ├── api/interview.py            # /api/interview/setup-data (MongoDB extractor)
│       │   ├── interview_controller.py     # Session manager & report persistence
│       │   └── requirements.txt            # Interviewer-specific Python dependencies
│       └── frontend/                       # Interviewer React/Vite client
│           ├── src/components/DeviceCheck.jsx  # Cam & Mic pre-flight verification
│           └── dist/                       # Pre-compiled production bundle (served at /interview-app)
├── frontend/                               # Next.js 16 Main Job Portal & Dashboards
│   ├── src/app/                            # App router (recruiter & candidate portals)
│   ├── src/components/                     # Tailwind UI components
│   └── package.json                        # Frontend dependencies
├── scripts/
│   └── verify_interview_integration.py     # Automated E2E verification test suite
├── .env.example                            # Root environment variable template
├── .gitignore                              # Comprehensive git ignore (excludes venv, node_modules)
├── package.json                            # Root NPM dev scripts
├── start-dev.bat                           # 1-Click Windows development launcher
└── README.md                               # Project documentation
```

---

## 🚀 Setup & Installation Guide

Follow these steps to set up the project on your machine from scratch:

### 1. Clone the Repository
```bash
git clone https://github.com/kajaredhruv433/RunTimeError-Momentum-EchoSphere.git
cd RunTimeError-Momentum-EchoSphere
```

### 2. Configure Python Virtual Environment (Backend)
Using **Python 3.12.10** (or 3.12.x):

```bash
# Windows
python -m venv backend\venv
backend\venv\Scripts\activate

# Install all backend and interviewer dependencies
pip install -r backend\requirements.txt
```

*(On macOS/Linux: `python3 -m venv backend/venv && source backend/venv/bin/activate && pip install -r backend/requirements.txt`)*

### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 4. (Optional) Build Interviewer Frontend
The interviewer production bundle is already pre-compiled inside `backend/interviewer/frontend/dist/`. If you make changes to the interviewer React components:
```bash
cd backend/interviewer/frontend
npm install
npm run build
cd ../../../
```

### 5. Environment Variables Configuration

Copy the sample environment file to create your local `.env`:

```bash
# In backend/interviewer/backend:
copy backend\interviewer\backend\.env.example backend\interviewer\backend\.env

# In frontend:
copy frontend\.env.example frontend\.env.local
```

Key environment variables to review:
```env
# MongoDB Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=momentum

# AI & LLM Providers
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY_1=your_groq_api_key

# Agora Voice & Real-Time Communication
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

---

## 🏃 How to Turn On the Servers

### Method 1: Windows 1-Click Launcher (Recommended)
Simply double-click or run from the project root:
```bat
start-dev.bat
```
This opens two dedicated terminal windows:
- **Terminal 1**: Python FastAPI Backend running on `http://127.0.0.1:8000` with hot-reload.
- **Terminal 2**: Next.js Frontend running on `http://localhost:3000`.

---

### Method 2: NPM Scripts (Two Terminals)

**Terminal 1 — Backend:**
```bash
npm run dev:backend
```
*(Or directly: `backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload`)*

**Terminal 2 — Frontend:**
```bash
npm run dev:frontend
```
*(Or directly: `cd frontend && npm run dev`)*

---

## 🌐 Access Points & URL Map

| Service | URL | Description |
|---|---|---|
| **Momentum Web Portal** | [http://localhost:3000](http://localhost:3000) | Main candidate job portal and recruiter dashboards |
| **Recruiter Leaderboard** | [http://localhost:3000/recruiter/dashboard/candidates](http://localhost:3000/recruiter/dashboard/candidates) | Interviewed candidates sorted by match score with evaluation reports |
| **AI Interviewer Lobby** | [http://127.0.0.1:8000/interview-app](http://127.0.0.1:8000/interview-app) | Or triggered automatically when a candidate clicks **"Give Interview"** |
| **FastAPI Interactive Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Swagger UI for exploring all backend endpoints |

---

## 🧪 Verifying the Integration

To verify that the database connections, automated setup extraction, evaluation persistence, and recruiter leaderboard queries work without errors:

```bash
backend\venv\Scripts\python.exe scripts\verify_interview_integration.py
```

Expected output:
```text
==================================================
ECHOSPHERE & MOMENTUM END-TO-END VERIFICATION
==================================================
[Step 1] Found Test Job: ...
[Step 2] Testing /api/interview/setup-data extraction from MongoDB...
 -> SUCCESS: Setup data automatically extracted from MongoDB without user manual input!
[Step 3] Simulating Interview Conclusion & MongoDB Report Persistence...
 -> SUCCESS: Application persisted with status=Completed, matchScore=..., interviewId=...
[Step 4] Testing Recruiter Interviewed Candidates Leaderboard...
 -> SUCCESS: Candidates verified in strictly descending order of match scores
==================================================
ALL VERIFICATIONS PASSED SUCCESSFULLY!
==================================================
```

---

## 🛠️ Troubleshooting & Tips

### Port Conflicts (Port 3000 or 8000 already in use)
If port 3000 or 8000 is occupied by a previous session, run this PowerShell command:
```powershell
Get-NetTCPConnection -LocalPort 3000, 8000 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Python Virtual Environment Check
Verify you are using the correct Python version:
```bash
backend\venv\Scripts\python.exe --version
# Expected: Python 3.12.10
```

---

## 📄 License
MIT License. Built with ❤️ by the **RunTimeError** team.
