# Momentum

### Autonomous Multi-Agent AI Interview & GitHub-Based Technical Assessment Platform

Momentum combines an adaptive voice-interview experience with an optional, repository-specific coding assessment. Interviewer personas take turns through a shared interview controller; when a candidate connects GitHub, Momentum can prepare a temporary bug-fix challenge against a pinned copy of a selected repository.

## Project overview

- **Adaptive panel interviews:** The controller coordinates one to five role-specific interviewer personas, stage transitions, follow-up questions, and interview timing.
- **Voice and text:** Realtime speech recognition and speech output are integrated through ElevenLabs. Candidates can also type answers.
- **GitHub-based assessment:** Candidates can connect GitHub and select a repository to discuss during an interview.
- **Background preparation:** Repository analysis and challenge preparation run while the interview continues.
- **Isolated coding task:** A selected code path may be modified in a temporary Daytona workspace. Candidate changes are not pushed to GitHub.
- **Candidate guidance:** An assessment assistant offers repository-aware explanations while applying a prompt-level restriction against giving the challenge's completed fix.

## What's new in the hackathon

The interview portal, voice experience, interviewer panel, and adaptive interview flow were developed before the hackathon. The hackathon adds GitHub-based code review, repository access, the interview typing pad, and more powerful interview decision-making.

The hackathon implementation includes:

1. **Powerful interview decision engine:** The NORMAL-stage prompt accepts five continuation domains: `clarification`, `project`, `area`, `repo_assessment`, and `code`. `DRAW` and `CONCLUDE` are separate outcomes. See [the decision engine details](documentation.md#4-five-option-interview-decision-engine).
2. **GitHub access and repository selection:** OAuth connects a GitHub account and lets the candidate select a repository for assessment.
3. **Background repository preparation:** A pinned repository snapshot is analyzed and the assessment is prepared while the interview continues.
4. **Interview typing pad:** Candidates can type code or SQL responses during the interview.
5. **GitHub code review and repository assessment:** Meta Muse proposes a targeted regression in a temporary Daytona checkout, with a challenge description and focused validation.
6. **Correctness-first evaluation:** Candidate changes are checked against the original repository reference before the solution approach is compared.
7. **Assessment assistant:** Candidates can ask for repository-aware explanations and conceptual guidance during the challenge.

## High-level workflow

Candidate registration -> GitHub connection -> repository selection -> multi-panel voice interview -> background repository analysis -> contribution verification -> isolated assessment creation -> bug injection -> candidate problem solving -> solution evaluation -> assessment results.

Repository context informs the assessment and candidate review.

## Technology stack

| Area | Technologies verified in the repository |
|---|---|
| Recruitment portal | Next.js, React, TypeScript, Firebase Authentication client |
| Interview room | React and Vite |
| Backend | Python, FastAPI, Uvicorn |
| Interview voice | ElevenLabs realtime STT and TTS |
| Repository connection | GitHub OAuth and REST API |
| Model clients | OpenAI-compatible Python SDK and HTTP client |
| Interview/assessment AI | Meta Muse Spark through the Meta Model API and Baseten |
| Isolated assessment | Daytona remote workspaces |
| Persistence | MongoDB; SQLite for evaluator lifecycle state |
| Repository retrieval | MongoDB with local feature-hash vectors; no hosted embedding service is used by this index |

### Meta AI integration

- **Interview engine:** `backend/interviewer/llm.py` uses Meta Muse Spark through two services: the Meta Model API (`muse-spark-1.3`) and Baseten (`meta-models/muse-spark-open-1026`). Both provide Meta models; using two endpoints helps keep interviews running when the Meta API reaches a rate or quota limit. The OpenAI-compatible Python SDK is the client.
- **Repository challenge generation:** The evaluator calls the Meta Model API directly with `muse-spark-1.3` to propose a targeted challenge and to generate/review a focused test when local testing is feasible.
- **Assessment assistant:** The assistant calls the Baseten-compatible endpoint with `meta-models/muse-spark-open-1026`.

## Demonstration videos

### Main hackathon submission video - 3 minutes

Highlights the GitHub integration and hackathon-specific repository assessment.

Watch the hackathon submission: [https://youtu.be/Y4X_4PMRq8g](https://youtu.be/Y4X_4PMRq8g)

### Complete Momentum interview demonstration - 13 minutes

Demonstrates the broader interview experience developed before the hackathon.

Watch the complete interview: [https://youtu.be/Vsutph-l0Jc](https://youtu.be/Vsutph-l0Jc)

## Documentation

- [Detailed technical documentation](documentation.md)
- [System architecture](architecture.md)

## Setup and installation

### Prerequisites

- Git, Python, Node.js/npm, and a running MongoDB instance.
- API credentials for the services you intend to use: Meta Model API, Baseten, GitHub OAuth, Daytona, and ElevenLabs.
- Daytona and GitHub credentials are required for the repository assessment flow; ElevenLabs credentials are required for live voice services.

### Clone and install

```powershell
git clone https://github.com/kajaredhruv433/momentum-ai.git
Set-Location momentum-ai

py -m venv backend\venv
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt

npm ci --prefix frontend
npm ci --prefix frontend\interviewer
```

### Configure services

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

Edit the copied files locally:

- In `backend/.env`, set the Meta Model API key (`MODEL_API_KEY`), Baseten key (`BASETEN_API_KEY`), GitHub OAuth credentials and callback, Daytona key, ElevenLabs key, and MongoDB connection as needed. Set `REPO_EVALUATOR_APP_SECRET` to a strong random value.
- In `frontend/.env.local`, configure `NEXT_PUBLIC_API_URL` and `MONGODB_URI` for the portal.
- Register `http://localhost:8000/auth/github/callback` as the local GitHub callback URL. Keep OAuth secrets and model-provider credentials in the backend environment only.
- The main backend uses MongoDB database `momentum` by default. The evaluator stores lifecycle state in `backend/data/repo_evaluator.sqlite3` and uses a separate MongoDB database by default.

The complete variable list and defaults are in [the configuration reference](documentation.md#22-environment-variables-and-configuration). Never commit real credentials.

### Start the application

Start the backend and recruitment portal in separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

The live interview room can be run separately with `npm run dev:interviewer` (Vite on port 5173), or built with `npm run build:interviewer` so FastAPI can serve the built app at `/interview-app`. The root `start-dev.bat` starts the backend and Next.js portal; it does not start the Vite development server.

### Verify local services

- Backend health: `http://127.0.0.1:8000/api/health`
- FastAPI/OpenAPI docs: `http://127.0.0.1:8000/docs`
- Recruitment portal: `http://localhost:3000`
- Interview room: `http://localhost:5173` in Vite development, or `http://127.0.0.1:8000/interview-app` after building the interview frontend.

## Repository structure

```text
backend/
  main.py
  routers/
  interviewer/
    api/
    github_evaluator/
  services/
frontend/
  src/                         Next.js portal
  interviewer/
    src/                       Interview room
    public/repo-evaluator/     Embedded assessment interface
docs/
scripts/
README.md
documentation.md
architecture.md
LICENSE
```

## License

Momentum is licensed under **AGPL-3.0-only**; see [LICENSE](LICENSE). The official GNU license is [available here](https://www.gnu.org/licenses/agpl-3.0.html). Third-party dependencies retain their own licenses and notices; see the licensing notes in the [technical documentation](documentation.md#23-error-handling-and-security-considerations).

## Author

**Dhruv Kajare**

- GitHub: [kajaredhruv433](https://github.com/kajaredhruv433)
- LinkedIn: [Dhruv Kajare](https://www.linkedin.com/in/dhruv-kajare-b060b0260/)
