# Momentum: Developer and Evaluator Documentation

## 1. Introduction and objectives

Momentum combines a recruitment portal with a live, adaptive interview and an optional GitHub-backed code assessment. The server-side interview controller manages the lifecycle; generated interviewer personas are turn-taking roles, not separate long-running model agents. When a candidate has connected GitHub and selected a repository, a temporary assessment can be prepared while the interview continues.

The assessment provides repository-specific evidence for candidate review. Repository access is read-only; edits are made in a temporary workspace.

## 2. Existing platform capabilities

The recruiter/candidate portal, resume and job/application workflows, interview setup, one-to-five-persona panel, voice interaction, transcript, canvas-based system-design answers, and report generation were developed before the hackathon. The interview controller coordinates NORMAL, EXTENDED, FINAL, and CONCLUSION stages.

The voice interview uses ElevenLabs for realtime speech-to-text (WebSocket relay) and text-to-speech. Typed answers are also accepted.

## 3. Hackathon-specific implementations

The hackathon implementation adds:

- GitHub account connection and repository selection for an interview.
- A background repository snapshot, inventory, and claim-guided assessment preparation.
- A temporary Daytona workspace with a targeted regression challenge.
- An in-interview typing pad for code or SQL answers.
- GitHub code review through a separate repository editor, with focused validation and a candidate-assistance endpoint.

## 4. Five-option interview decision engine

The expanded interview decision engine supports five `question_domain` values in the NORMAL stage when the model chooses `CONTINUE`:

| Exact domain | Meaning in the current prompt |
|---|---|
| `clarification` | Probe a vague, incomplete, contradictory, or unsupported previous answer. |
| `project` | Ask about a supplied candidate project without inventing project details. |
| `area` | Evaluate an area that is not already adequately covered. |
| `repo_assessment` | Invite the candidate to start the prepared repository challenge, but only when the evaluator is `READY`. |
| `code` | Ask for one small standalone function or one SQL query, answered through the typing pad. |

`DRAW` is a separate canvas action/domain and `CONCLUDE` is a separate terminal outcome; neither is one of those five `CONTINUE` domains. EXTENDED and FINAL prompts allow smaller, stage-specific sets. If a normal-stage response is invalid, `next_normal_action` logs it and returns `CONCLUDE`.

The model also selects one exact panel-member name from the generated panel. `InterviewController` owns the state machine, timer, persistence, turn dispatch, and WebSocket broadcasts.

## 5. GitHub OAuth and account integration

`backend/routers/github.py` implements the session-only connection:

1. `GET /auth/github` creates a random OAuth state and redirects to GitHub.
2. `GET /auth/github/callback` verifies the saved state and browser state cookie, exchanges the code, reads the GitHub profile, and sets an HTTP-only session cookie.
3. `GET /api/github/session` reports connection status.
4. `GET /api/github/repositories` lists repositories available to the connected account using GitHub's REST API.
5. `POST /api/github/repository` accepts a `full_name` and checks it against that list.
6. `DELETE /api/github/session` disconnects the session.

OAuth states and the main application’s GitHub sessions are held in process memory; the main session expires after 12 hours. The callback URL and client credentials are configured in `backend/.env`.

## 6. Repository selection and permissions

The selected repository is stored in the in-memory GitHub session and copied into the interview state. `get_selected_repository` rejects a repository name that does not match the session selection. The GitHub API calls used to enumerate and fetch the repository use GET requests; the assessment does not push candidate changes to GitHub.

## 7. Background repository analysis

The answer endpoint in `backend/interviewer/api/interview.py` checks whether the controller has completed repository intake. If so, it calls `start_for_interview`, which stores an assessment record and queues `run_analysis` as a FastAPI background task. The answer response and subsequent interview turns do not wait for repository preparation.

Repository analysis runs in the background while the interview continues. The workflow fetches the selected repository at a pinned commit, inventories the source, and prepares the assessment.

## 8. Candidate contribution verification

`github_evaluator/workflow.py` fetches the selected branch’s commit and pins the assessment to that SHA. It filters repository files and creates a project inventory, including Python AST symbols and bounded import relationships. `index_snapshot` stores commit-scoped repository chunks and metadata in the evaluator MongoDB database using local feature-hash vectors; it does not call a remote embedding model.

`challenge.prepare_verified_challenge` supplies candidate claims, the repository map, and candidate source to Meta Muse. Muse proposes a relevant file and function; local validation checks the target and proposed replacement. The evaluator verifies the candidate's completed change against the original repository reference.

## 9. Interview typing pad

When the current question kind is `code_response`, `frontend/interviewer/src/components/InterviewRoom.jsx` displays a multiline typing pad and submit button. It supports code or SQL responses, including tab indentation. Submission calls the ordinary interview answer endpoint with `input_method: "text"`.

This is distinct from the repository challenge editor, which is served from `frontend/interviewer/public/repo-evaluator/`.

## 10. Daytona workspace creation and lifecycle

`github_evaluator/daytona_workspace.py` creates and addresses remote workspaces through the Daytona SDK. The workflow clones a repository at the pinned commit, writes the intentionally modified target and `problem.md`, adds a focused test and optional fixture when available, and writes a private oracle separately from candidate-accessible files.

The interview challenge has a five-minute deadline. Its timer starts on the first `POST /api/assessments/{assessment_id}/start`, when the editor opens, not while repository analysis runs. Submission is accepted only within the server-recorded window. The submit route removes the sandbox after evaluation; an expiry sweeper also removes expired or abandoned workspaces. Daytona’s configured TTL is a further cleanup backstop.

## 11. Repository preparation and indexing

`fetch_snapshot` obtains the repository tree and blob contents through GitHub’s API, skips configured build/vendor directories, excludes credential-like files and large/unsupported assets, and enforces configured file and byte limits. The pinned source is inventoried before challenge generation.

`knowledge.py` chunks source, extracts Python AST symbols and approximate declarations for other supported source files, removes common secret patterns, and stores commit-scoped retrieval data in MongoDB. Local feature hashing supplies vectors; retrieval is not based on a hosted embedding API. The MongoDB knowledge index is an aid to analysis and assistant context, separate from the Daytona checkout.

## 12. AI-driven bug selection and injection

`prepare_verified_challenge` asks the Meta Model API for a structured proposal. The proposal identifies a target path and function, exact old/new source snippets, the intended behavior, the broken user-visible flow, private recovery guidance, runtime dependencies, and whether a local test is feasible.

Before any challenge files are written, the application checks that the file is eligible, the old snippet occurs exactly once, and the patch is inside the named function for Python or associated with the named JavaScript/TypeScript declaration. Python is parsed before and after the patch. A rejected or malformed patch does not produce a ready challenge.

## 13. `problem.md` generation

The generated `problem.md` names the affected file and function, explains the broken workflow, and states the function’s responsibility. It does not contain the fixed source excerpt or private recovery notes. A generated-image section is added only when a local image fixture is needed and the challenge is locally testable.

## 14. Conditional dependency installation

The challenge planner chooses a runtime and a minimal dependency set for the selected behavior rather than installing every project dependency. When a locally testable challenge is ready, dependency preparation runs in Daytona and status/logs are exposed to the editor. Python setup can invoke a restricted Meta-assisted repair flow; the tool allows only a small set of approved package-inspection or CPU-only retry actions.

## 15. Hidden focused tests

`challenge.py` asks Muse to generate and review focused tests against the original source and injected regression. Python tests use `test.py` unless the repository already has that path; Node tests use a generated test path.

The generated test path is locked by the assessment file API so its contents are not available through the editor's read and edit endpoints.

## 16. Test execution workflow

The assessment UI calls `POST /api/assessments/{assessment_id}/run`. The backend checks assessment and challenge metadata, prepares dependencies, and invokes the isolated test runner.

## 17. Reference-based solution verification

The evaluator checks each candidate submission against the original repository reference to verify that the challenged behavior is corrected. It then compares the accepted solution with the reference implementation.

## 18. Hierarchical solution evaluation

Evaluation is implemented in `daytona_workspace.evaluate_submission`; it is not an AI grading call:

1. **Correctness first.** The candidate solution is checked against the saved original-repository reference and the challenge's corrected behavior.
2. **Approach after correctness.** The evaluator compares the verified solution structure with the reference and returns an approach result.

## 19. AI assessment assistant

`POST /api/assessments/{assessment_id}/hint` uses the Baseten-configured Muse model with repository retrieval, challenge context, and optional unsaved candidate code. The policy allows conceptual explanations and discussion of observed behavior while refusing requests for the exact challenge patch or corrected implementation.

The assistant requires a ready challenge, the candidate’s assessment cookie, evaluator MongoDB context, and a Baseten API key.

## 20. Meta AI model integrations

| Component | Provider and model in code | Use |
|---|---|---|
| Interview LLM entry point (`interviewer/llm.py`) | Meta Muse Spark through two services: Meta Model API model `muse-spark-1.3` and Baseten model `meta-models/muse-spark-open-1026`. Both endpoints support interview continuity when rate or quota limits are reached. | Stage prompts, interview questions, and other calls through `ask_llm`. Uses the OpenAI-compatible Python SDK as an API client. |
| Repository challenge generation and test planning (`github_evaluator/challenge.py`, `workflow.py`) | Direct Meta Model API, `muse-spark-1.3`, through `AsyncOpenAI`. | Selects a claimed code area, proposes a small regression, prepares `problem.md`, and authors/reviews focused tests. |
| Assessment assistant (`github_evaluator/api.py`) | Baseten OpenAI-compatible HTTP endpoint, model `meta-models/muse-spark-open-1026`. | Contextual assistance during a ready challenge. |
| Recruitment AI services (`backend/services/baseten_service.py`) | Baseten, model from `BASETEN_MODEL`. | Existing recruitment and resume/problem/report-related model calls. |

The model identifier configured for Baseten is not the same string as the direct Meta Model API model. The OpenAI SDK is a compatible client library; it does not mean the underlying model is OpenAI.

## 21. API endpoints and request/response flow

The unified FastAPI app is assembled in `backend/main.py`; the interactive interview frontend communicates with it over HTTP and WebSockets.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend health response. |
| `GET` | `/api/interview/setup-data` or `/api/interviews/setup-data` | Load candidate/job setup context. |
| `POST` | `/api/interviews` | Create and initialize an interview. |
| `GET` | `/api/interviews/{id}` | Read public interview state. |
| `POST` | `/api/interviews/{id}/answer` | Submit voice transcript or typed answer; may start repository analysis after intake. |
| `GET` | `/api/interviews/{id}/report` | Candidate endpoint returns `403`; recruiter reports are served through recruiter/application routes. |
| `POST` | `/api/interviews/{id}/question-started` | Start the interview timer at the opening question. |
| `POST` | `/api/interviews/{id}/speech-finished` | Finalize closing speech and report lifecycle. |
| `POST` | `/api/interviews/{id}/canvas` | Submit a canvas response for analysis. |
| `WS` | `/api/interviews/{id}/events` | Interview events and transcript updates. |
| `WS` | `/api/interviews/{id}/stt` | Realtime STT relay. |
| `GET` | `/auth/github`, `/auth/github/callback` | Start and complete GitHub OAuth. |
| `GET`, `DELETE` | `/api/github/session` | Check or disconnect the GitHub session. |
| `GET` | `/api/github/repositories` | List repositories available to the connected account. |
| `POST` | `/api/github/repository` | Select a listed repository. |
| `GET`, `POST` | `/api/interviews/{id}/repository-assessment` and `/finish` | Poll the interview’s assessment and return to the interview after submission. |
| `GET` | `/api/assessments/{id}` | Poll assessment status. |
| `POST` | `/api/assessments/{id}/start` | Start the timed coding assessment. |
| `GET` | `/api/assessments/{id}/files` | List workspace files. |
| `GET`, `PUT` | `/api/assessments/{id}/file` | Read or save an editable workspace file. |
| `POST` | `/api/assessments/{id}/run` | Run an available focused test. |
| `POST` | `/api/assessments/{id}/submit` | Submit and evaluate the change. |
| `POST` | `/api/assessments/{id}/hint` | Request assessment assistance. |

Evaluator routes are mounted selectively; consult the generated OpenAPI page at `/docs` for request/response schemas and to distinguish the interview-integrated routes from routes available only in the standalone evaluator app.

## 22. Environment variables and configuration

Copy the checked-in examples to ignored local files and replace placeholders locally:

- `backend/.env.example` -> `backend/.env`
- `frontend/.env.example` -> `frontend/.env.local`

| Variable(s) | Purpose |
|---|---|
| `MODEL_API_KEY` (aliases: `META_API_KEY`, `META_AI_API_KEY`) | Meta Model API access for repository generation and Meta-primary interview calls. |
| `META_API_BASE_URL`, `META_API_MODEL` | Direct Meta endpoint/model; defaults are set in `backend/config.py` and evaluator config. |
| `BASETEN_API_KEY`, `BASETEN_BASE_URL`, `BASETEN_MODEL` | Baseten model calls; the model defaults to `meta-models/muse-spark-open-1026`. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GITHUB_FRONTEND_ORIGINS` | GitHub OAuth and allowed callback/return origins. |
| `DAYTONA_API_KEY` | Remote workspaces for repository assessment. |
| `REPO_EVALUATOR_APP_SECRET` | Signs assessment cookies and derives the Fernet key used for evaluator token encryption. |
| `REPO_EVALUATOR_DATABASE_PATH` | Local SQLite evaluator state; defaults to `backend/data/repo_evaluator.sqlite3`. |
| `MONGODB_URI`, `DB_NAME` | MongoDB connection URI and database for the recruitment portal; `DB_NAME` defaults to `momentum`. |
| `MONGODB_DATABASE`, `MONGODB_INTERVIEW_COLLECTION` | MongoDB database and collection used by the interview engine. |
| `REPO_EVALUATOR_MONGODB_DATABASE` | Evaluator MongoDB database, default `momentum_interview_repo_evaluator`. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_STT_MODEL`, `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_VOICE_ID` | Speech recognition and voice output. |
| `NEXT_PUBLIC_API_URL`, `MONGODB_URI` | Frontend API URL and MongoDB URI for the Next.js portal. |
| `HOST`, `PORT` | Backend bind settings; defaults are `0.0.0.0` and `8000`. |
| `BASETEN_MAX_OUTPUT_TOKENS`, `BASETEN_REASONING_EFFORT` | Interview model output-token limit and Baseten reasoning setting. |
| `ASSESSMENT_MINUTES`, `MAX_REPOSITORY_FILES`, `MAX_KNOWLEDGE_CHUNKS`, `MAX_FILE_BYTES`, `MAX_WORKSPACE_READ_BYTES` | Evaluator session lifetime and repository/workspace bounds. The integrated interview challenge separately uses its fixed five-minute editor timer. |
| `VECTOR_DIMENSIONS` or `EMBEDDING_DIMENSIONS` | Dimension count for the evaluator's local feature-hash vectors. |
| `SECURE_COOKIES`, `FRONTEND_ORIGIN` | Evaluator cookie security and standalone evaluator frontend origin. |
| `ASSISTANT_API_KEY` | Protects trusted server-to-server evaluator-context endpoints; it is not the candidate hint API key. |

The main portal/interview data uses MongoDB. Assessment lifecycle metadata also uses SQLite; repository indexes and evaluator knowledge use a separate MongoDB database. Never commit real credentials. The frontend environment file should contain only values that are intended for the browser.

## 23. Security and data handling

- OAuth state is checked against both server state and an HTTP-only cookie; GitHub sessions have an expiry and repository selection is checked against the session.
- The standalone evaluator encrypts stored GitHub access tokens using a key derived from `REPO_EVALUATOR_APP_SECRET`. The live main GitHub session is process-memory-only.
- Repository ingestion skips common credential files and scans source chunks for common secret patterns.
- Candidate changes and assessment execution take place in a temporary Daytona workspace. Candidate modifications are not pushed upstream; the workspace is removed after submission or expiry.
- Generated test access is restricted by evaluator file endpoints.
- Provider credentials belong in backend environment files. Backend `.env` files are ignored by Git.
