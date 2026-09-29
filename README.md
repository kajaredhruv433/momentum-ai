# Momentum: Adaptive Multi-Agent AI Voice Interview & Recruitment Platform
### Developed for the EchoSphere Competition - Problem Statement 11 (PS11)

---

## Table of Contents
1. [Platform Vision and Overview](#1-platform-vision-and-overview)
2. [Direct Alignment with Problem Statement 11 (PS11)](#2-direct-alignment-with-problem-statement-11-ps11)
   - [PS11 Requirements Compliance Matrix](#ps11-requirements-compliance-matrix)
   - [Dynamic Panel Generation: 1 to 5 Roles](#dynamic-panel-generation-1-to-5-roles)
   - [Walkthrough: The Example Multi-Role Scenario](#walkthrough-the-example-multi-role-scenario)
3. [System Architecture and Working Theory](#3-system-architecture-and-working-theory)
   - [System Architecture Flow (Mermaid)](#system-architecture-flow-mermaid)
   - [Voice Architecture: ElevenLabs Realtime STT Relay & Neural TTS Synthesis](#voice-architecture-elevenlabs-realtime-stt-relay--neural-tts-synthesis)
   - [External Multi-Tier LLM Reasoning Brain: otheragent.py](#external-multi-tier-llm-reasoning-brain-otheragentpy)
   - [Multi-Tier External LLM Hierarchy: Groq and Google AI Studio](#multi-tier-external-llm-hierarchy-groq-and-google-ai-studio)
   - [Decision Latency Analysis and Production Scaling](#decision-latency-analysis-and-production-scaling)
   - [Authoritative Server-Side Timer Architecture](#authoritative-server-side-timer-architecture)
   - [Adaptive Interview Lifecycle Stages](#adaptive-interview-lifecycle-stages)
   - [Interactive System Design Canvas with Vision Analysis](#interactive-system-design-canvas-with-vision-analysis)
4. [Core Engine Modules and Key Packages](#4-core-engine-modules-and-key-packages)
   - [Core Functional Engines](#core-functional-engines)
   - [Primary Software Packages and SDKs](#primary-software-packages-and-sdks)
5. [The Momentum Recruitment Platform (In Short)](#5-the-momentum-recruitment-platform-in-short)
6. [Setup and Installation Guide](#6-setup-and-installation-guide)
   - [Prerequisites and System Requirements](#prerequisites-and-system-requirements)
   - [Step-by-Step Installation](#step-by-step-installation)
   - [Environment Variables Reference](#environment-variables-reference)
   - [Running the Platform](#running-the-platform)
   - [Automated Verification Suite](#automated-verification-suite)
   - [System Access Points](#system-access-points)

---

## 1. Platform Vision and Overview

**Momentum** is an autonomous recruitment platform and adaptive multi-agent AI voice interview system developed for the **EchoSphere** competition. Rather than forcing candidates through a static questionnaire or robotic form-filling, our platform deploys a coordinated panel of distinct, specialized AI interviewers who listen, converse, evaluate, and challenge candidates in real time.

Our portal unifies the entire hiring pipeline:
- **Recruiters** post technical job openings, define required skills, experience levels, and evaluation parameters.
- **Candidates** browse open positions and submit applications using their stored resume profile with one click.
- **Zero-Friction Interview Bridge**: When a candidate initiates an interview, our portal automatically extracts the candidate's resume and job requirements from the database into the interview room without requiring manual re-uploading or form-filling.
- **Adaptive Multi-Agent Interview**: An AI panel conducts an interactive voice interview powered by **ElevenLabs** for real-time speech-to-text (STT) and neural text-to-speech (TTS), and **`otheragent.py`** as the centralized cognitive reasoning brain for dynamic turn-taking, follow-up probing, system design sketching, and difficulty scaling.
- **Automated Result Declaration**: Upon completion, a comprehensive evaluation report with granular metrics (match percentage, technical skills, communication, problem-solving) automatically feeds into the recruiter candidate leaderboard, sorted strictly by score for streamlined hiring decisions.

The interview engine is completely dedicated to real-time conversational adaptability, multi-role turn-taking, and deep cognitive reasoning.

---

## 2. Direct Alignment with Problem Statement 11 (PS11)

### Problem Statement Definition
> **PS11**: Build an adaptive voice interview platform in which one or more AI interviewers represent different roles. The interview panel may include a technical interviewer, hiring manager, customer, product manager or behavioural interviewer. The system should adapt its questions based on the candidate's previous answers rather than following only a predefined question list.

---

### PS11 Requirements Compliance Matrix

| PS11 Requirement | How Momentum (Our System) Implements It |
|---|---|
| **1. Real-Time & Interruptible Voice Interviews** | Powered by **ElevenLabs Realtime STT** (`scribe_v2_realtime`) and **ElevenLabs Neural TTS** (`eleven_flash_v2_5`). Candidate speech is captured via the browser Web Audio API (16 kHz PCM) and streamed over an authenticated server-side WebSocket relay. When a candidate begins speaking (barge-in), the client immediately stops ongoing TTS playback and yields the floor without delay. |
| **2. Multiple Interviewer Roles & Personalities** | Our panel generator dynamically composes an interview committee of 1 to 5 members tailored to the job requirements and candidate profile. Potential roles include **Technical Interviewer**, **Senior Software Engineer**, **Product Manager**, **Engineering Manager**, **Customer Advocate**, and **HR Manager**, each with distinct personalities, behavioral rules, and mapped neural voices from our 21+ ElevenLabs voice catalog. |
| **3. Shared Candidate Context Between Roles** | A centralized server-side state machine (`interview_controller.py`) maintains complete session memory. Every question asked, candidate answer, resume section, and evaluation metric is stored in a shared context. When one interviewer hands off to another, the incoming interviewer possesses full awareness of everything discussed previously. |
| **4. Dynamic Follow-Up Questions** | Our system does not follow a predefined question list. After every candidate response, our reasoning brain (`otheragent.py`) evaluates the substance of the answer against the candidate's resume and job requirements using stage-specific prompts (`prompts.py`), choosing whether to probe deeper into technical trade-offs, explore project claims, or change directions. |
| **5. Controlled Interviewer Turn-Taking** | After each response, our reasoning engine determines which panel member should speak next based on their domain expertise and the topic being probed. The system passes the virtual floor seamlessly, ensuring natural committee conversation without overlapping voices. |
| **6. Role-Play & Scenario-Based Questions** | Panel members pose contextual scenarios (e.g., handling production outages, designing scalable architectures, balancing business impact with engineering speed, and addressing customer needs). The system also features an interactive System Design Canvas for real-time architecture diagrams. |
| **7. Difficulty Adjustment Based on Performance** | Structured three-stage progression: **Normal Stage** (core competencies and project validation) -> **Extended Stage** (deeper questions probing trade-offs, edge cases, failure recovery, and architectural scalability) -> **Final Stage** (strictly one decisive, high-complexity question for top candidates). |
| **8. Identification of Vague or Contradictory Answers** | Our reasoning engine analyzes candidate responses against known engineering principles and previously stated claims. If an answer lacks concrete implementation details, contradicts an earlier response, or dodges a key requirement, the panel generates targeted follow-up prompts to address the gap. |
| **9. Evidence-Based Feedback Linked to Transcript** | The post-interview evaluation report synthesizes exact quotes, timestamps, and question-answer pairs directly from the transcript, providing objective evidence for strengths, concerns, hire reasons, and reject reasons. |
| **10. Structured Final Assessment** | Generates a validated multi-dimensional scorecard: overall match percentage, job role match, skills match, experience match, qualification match, technical score, communication score, problem-solving score, and an actionable hiring recommendation (`Strong Hire`, `Hire`, `Consider`, `Do Not Hire`). |
| **11. Clear Disclosure of AI Interaction** | Our portal explicitly discloses that the interview is conducted by an autonomous AI panel. Disclosures are prominently displayed in the pre-flight device lobby, atop the live interview room header, and acknowledged in the opening welcome statement. |

---

### Dynamic Panel Generation: 1 to 5 Roles

Our panel composition is **100% dynamic and adaptive**—nothing is hardcoded or static. When an interview is initialized, our reasoning brain analyzes the company background, role title, required skills, and candidate seniority to determine the optimal panel size (from **1 up to 5 members**) and their distinct responsibilities.

#### Concrete Dynamic Example: 3-Member Panel for a Full-Stack Product Engineer
When evaluating a Full-Stack Product Engineer position, our system dynamically instantiates a 3-member panel:
1. **Juhi / Bella (HR & Behavioral Manager)**:
   - **Focus**: Evaluates communication, work ethics, culture fit, and teamwork.
   - **Persona**: Warm, professional, and perceptive.
   - **Voice Profile**: ElevenLabs `Bella` (`hpp4J3VqNfWAUOO0d1Us`), American, bright & warm.
   - **Behavior**: Asks structured behavioral questions and assesses how the candidate collaborates with cross-functional teams.
2. **Dhruv / Charlie (Lead Technical Interviewer / Senior Software Engineer)**:
   - **Focus**: Evaluates technical depth, Python/FastAPI backend architecture, caching, database indexing, and scalability.
   - **Persona**: Analytical, deep, authoritative, and methodical.
   - **Voice Profile**: ElevenLabs `Charlie` (`IKne3meq5aSn9XLyUdCD`), Australian, deep & confident.
   - **Behavior**: Probes technical claims made on the resume and challenges algorithmic and architectural choices.
3. **Neha / Laura (Product Manager / Engineering Manager)**:
   - **Focus**: Evaluates user empathy, business metrics, feature trade-offs, and customer impact.
   - **Persona**: Energetic, structured, pragmatic, and outcome-focused.
   - **Voice Profile**: ElevenLabs `Laura` (`FGY2WhTYpPnrIDTdsKH5`), American, enthusiastic & conversational.
   - **Behavior**: Challenges candidates to justify engineering complexity against customer value and delivery timelines.

#### Dynamic Adaptation for Other Roles
- **DevOps / Infrastructure Engineer**: Our system dynamically selects a 2-member panel: an Infrastructure Architect and a Site Reliability Engineer.
- **Enterprise / Engineering Leadership**: Our system dynamically scales up to 4 or 5 members, introducing a Customer Success Lead, a Security Architect, and a VP of Engineering.

Each panel member receives a distinct role, seniority level, evaluation focus, behavioral guidelines, and an assigned neural voice from our 21+ ElevenLabs voice catalog (`voice.py`).

---

### Walkthrough: The Example Multi-Role Scenario

**Problem Statement Scenario:**
> *"A candidate provides a technically correct solution but does not explain its impact on customers. The technical interviewer may accept the implementation, while the product interviewer should challenge the candidate to explain the business implications."*

**How Our System Handles This Scenario at Runtime:**

1. **Step 1: Technical Interviewer Probes Architecture**
   - **Dhruv / Charlie (Lead Technical Interviewer)** asks:
     `"How would you design a caching layer to handle a 10x traffic spike on our payment service?"`
   - **Candidate Answer**:
     `"I would introduce Redis clusters with a write-through caching strategy and set up LRU eviction with a 5-minute TTL to keep hot data in memory."`

2. **Step 2: Reasoning Brain Evaluates Response**
   - Our reasoning engine (`otheragent.py`) reviews the candidate's transcript.
   - Evaluation: The technical implementation (Redis cluster, write-through, LRU, TTL) is sound. However, the candidate failed to consider customer experience during checkout, potential data inconsistencies, or duplicate billing scenarios.

3. **Step 3: Controlled Turn-Taking to Product Manager Persona**
   - The reasoning brain switches speakers from the Technical Interviewer to the Product Manager persona (**Neha / Laura**).
   - Our reasoning engine formulates a targeted internal question pattern:
     `"Candidate gave a sound technical Redis caching setup, but ignored customer transaction consistency and payment checkout impact. Challenge them on user-facing implications during cache inconsistencies."`

4. **Step 4: Direct Spoken Question Generation and Delivery**
   - `otheragent.py` directly formulates the natural, polite spoken challenge using the stage prompt:
     `"That caching setup handles the load well technically, Dhruv. But looking at this from our customers' perspective: if a user makes a payment and sees an outdated balance because of that 5-minute cache delay, they might panic and submit a duplicate charge. How would you design this so customers never experience inconsistent transaction states?"`
   - **ElevenLabs Neural TTS** synthesizes the audio using Neha's distinct persona voice ID (`FGY2WhTYpPnrIDTdsKH5`) and streams high-fidelity MP3 audio to the candidate's browser.

5. **Step 5: Assessment Integration**
   - The candidate's subsequent explanation is transcribed via ElevenLabs Realtime STT and recorded in the shared transcript. If the candidate adapts, they gain points under `problem_solving_score` and `communication_score`; if they dismiss the customer impact, this is cited as a specific concern in the final report under `concerns` with direct transcript evidence.

---

## 3. System Architecture and Working Theory

### System Architecture Flow (Mermaid)

```mermaid
flowchart TD
    subgraph Client ["Candidate Interface (Browser)"]
        MIC["Microphone (Web Audio API 16kHz PCM)"]
        SPEAKER["Audio Player (Web Audio API MP3)"]
        CAM["Webcam Preview Feed"]
        CANVAS["System Design Canvas (Drawings)"]
        ROOM["Interview Room UI & Live Transcript"]
    end

    subgraph VoicePipeline ["ElevenLabs Voice Services (STT & TTS)"]
        STT_RELAY["FastAPI STT WebSocket Relay (/api/interviews/{id}/stt)"]
        ELEVEN_STT["ElevenLabs Realtime STT (scribe_v2_realtime)"]
        TTS_EP["FastAPI TTS Endpoint (/api/tts)"]
        ELEVEN_TTS["ElevenLabs Neural TTS (eleven_flash_v2_5)"]
    end

    subgraph BackendCore ["FastAPI Backend (Momentum Core)"]
        CONTROLLER["Interview Controller (Authoritative State Machine)"]
        TIMER["Server Timer (Authoritative Clock)"]
        WS["WebSocket Event Bus (/api/interviews/{id}/events)"]
        CANVAS_AI["Canvas Vision Analysis Engine"]
    end

    subgraph ExternalBrain ["External Multi-Tier LLM Reasoning Brain (otheragent.py)"]
        GATEWAY["otheragent.py Router"]
        GROQ["Groq LPU (Prompts <= 7,500 tokens, Fast Conversational Turns)"]
        GEMINI["Google AI Studio Gemini (Prompts > 7,500 tokens, Large Context & Reports)"]
        ROTATION["Dynamic Multi-Key Token Bucket Rotation (Up to 20 Keys)"]
        PROMPTS["3 Stage Prompts in prompts.py (Normal, Extended, Final)"]
    end

    subgraph Storage ["Persistent Storage Layer"]
        MONGO[("MongoDB Atlas (Interviews, Jobs, Applications)")]
        QDRANT[("Qdrant Cloud (Semantic Resume Vector Chunks)")]
    end

    %% Audio input flow
    MIC -->|"PCM 16kHz Audio Chunks"| STT_RELAY
    STT_RELAY -->|"Secure Upstream Audio Stream"| ELEVEN_STT
    ELEVEN_STT -->|"Partial & Committed Transcripts"| STT_RELAY
    STT_RELAY -->|"Transcribed Answer"| CONTROLLER

    %% Persistence
    CONTROLLER -->|"Persist State, Answers & Events"| MONGO
    CONTROLLER -->|"Index Resume Chunks"| QDRANT

    %% Reasoning flow
    CONTROLLER -->|"Candidate Answer & Stage Context"| GATEWAY
    GATEWAY --> ROTATION
    ROTATION -->|"<= 7.5k Tokens"| GROQ
    ROTATION -->|"> 7.5k Tokens"| GEMINI
    GROQ <--> PROMPTS

    GROQ -->|"Direct Spoken Question & Speaker Turn"| CONTROLLER
    GEMINI -->|"Full Context Evaluation Report"| CONTROLLER

    %% Audio output flow
    CONTROLLER -->|"Question Text & Persona Voice ID"| TTS_EP
    TTS_EP -->|"Synthesize Audio Request"| ELEVEN_TTS
    ELEVEN_TTS -->|"Synthesized Neural MP3 Audio"| TTS_EP
    TTS_EP -->|"Stream Audio Response"| SPEAKER
    SPEAKER -->|"Spoken Question to Candidate"| ROOM

    %% Lifecycle synchronization
    SPEAKER -.->|"question_started Event"| CONTROLLER
    CONTROLLER -.->|"Trigger Server Countdown"| TIMER

    CONTROLLER <-->|"Real-Time State Events & Clock Ticks"| WS
    WS <-->|"Live WebSocket Stream"| ROOM

    %% Canvas vision flow
    CANVAS -->|"Base64 PNG Image"| CANVAS_AI
    CANVAS_AI -->|"Architectural Insights"| CONTROLLER
```

---

### Voice Architecture: ElevenLabs Realtime STT Relay & Neural TTS Synthesis

Our voice pipeline provides natural, low-latency, interruptible communication between the candidate and the AI interview panel:

1. **ElevenLabs Realtime STT Relay (`services/elevenlabs/stt.py`)**:
   - The browser captures candidate microphone audio using Web Audio API (`ScriptProcessorNode` / `AudioContext`) at 16,000 Hz mono PCM.
   - Audio is streamed over a secure WebSocket endpoint (`/api/interviews/{interview_id}/stt`).
   - The FastAPI backend relays audio chunks upstream to `wss://api.elevenlabs.io/v1/speech-to-text/realtime` with the `scribe_v2_realtime` model.
   - **Zero Client Credential Exposure**: The `ELEVENLABS_API_KEY` is kept strictly server-side.
   - Real-time partial transcripts provide immediate UI feedback (`partial_transcript` events), while committed transcripts (`committed_transcript`) trigger automatic answer submission after candidate silence.
   - **Barge-In / Interruption**: When the candidate starts speaking while an interviewer audio is playing, the client immediately pauses TTS playback, resets the audio player, and gives the candidate the floor.

2. **ElevenLabs Neural TTS (`services/elevenlabs/tts.py`)**:
   - Synthesizes spoken questions with emotional inflection and natural conversational cadence using the `eleven_flash_v2_5` model.
   - The backend maps each panel member's persona to their assigned ElevenLabs voice ID (e.g., Bella, Roger, Sarah, Charlie, Laura, George).
   - Audio is fetched via `/api/tts` (or `/api/interviews/{interview_id}/tts`) as standard MP3 (`audio/mpeg`) with streaming headers and played directly through the browser's Web Audio pipeline.

---

### External Multi-Tier LLM Reasoning Brain: `otheragent.py`

![Otheragent Dynamic LLM Routing and Token Architecture](docs/otheragent_working.jpg)

All cognitive decision-making is unified under **`otheragent.py`**, which serves as the single AI entry point across the platform:

1. **Transparent Token-Based Routing**:
   - Input prompt token count is estimated locally before dispatching.
   - **Prompts <= 7,500 tokens** (conversational turns, dynamic turn-taking, follow-up generation, and canvas analysis): Automatically routed to **Groq** for ultra-fast sub-second LPU inference.
   - **Prompts > 7,500 tokens** (full multi-page resume ingestion, exhaustive interview transcripts, and final structured evaluation reports): Automatically routed to **Google AI Studio (Gemini)** with massive 120k+ TPM throughput.

2. **Direct Spoken Question Generation**:
   - Rather than generating abstract meta-instructions, `otheragent.py` directly formulates the natural, polite, second-person spoken interview question tailored to the exact lifecycle stage (`Normal`, `Extended`, `Final`), which ElevenLabs TTS immediately synthesizes and delivers.

3. **Multi-Key Token Bucket Rotation**:
   - Inside `groqrouter.py` and `geminirouter.py`, our system loads up to 20 API keys from the environment (`GROQ_API_KEY_1..20`, `GEMINI_API_KEY_1..20`).
   - Dynamically tracks per-minute token buckets, active concurrent requests, and daily quotas to eliminate rate-limit errors and provide smooth interview execution.

---

### Decision Latency Analysis and Production Scaling

During live interviews, evaluators may observe a reasoning decision latency averaging approximately 1.5 to 2.0 seconds between the end of candidate speech and the generation of the next question.

**Root Cause**:
This latency is primarily an artifact of using free-tier API accounts:
1. Programmatic overhead of verifying token buckets across multiple keys.
2. Checking rate-limit states before each request.
3. Sequential fallback handling when an individual key reaches its per-minute quota.

**Production Scaling Path**:
In an enterprise deployment with dedicated or paid tier API access:
- Key rotation and quota-checking overhead is completely eliminated.
- Direct streaming from dedicated Groq LPU endpoints and ElevenLabs Flash TTS reduces the full reasoning and synthesis cycle to **0.5 to 1.0 second**, enabling near-instantaneous committee turn-taking.

---

### Authoritative Server-Side Timer Architecture

To maintain strict evaluation integrity and prevent client-side clock tampering:
- **The timer does NOT start** on "Start Interview" button click.
- **The timer does NOT start** during resume parsing or panel generation.
- **The timer does NOT start** when the opening greeting is formulated.
- **The timer STARTS ONLY** when the client emits the `question_started` event indicating that the first interview question audio is actively playing.

The backend maintains the authoritative start timestamp and broadcasts countdown ticks over WebSockets (`/api/interviews/{interview_id}/events`). If the candidate refreshes the page, the timer remains strictly synchronized to the server clock.

---

### Adaptive Interview Lifecycle Stages

```text
[ START STAGE ]
       |
       | Opening question formulated -> ElevenLabs TTS starts -> question_started event
       v
[ NORMAL STAGE ] (Elapsed < Base Time, default 30 min)
       |
       +---> Candidate answers via mic (ElevenLabs STT) or text
       +---> Groq evaluates: CONTINUE, CONCLUDE, or DRAW
       |       * CONTINUE -> Topic direction, question pattern, panel member, spoken question, ElevenLabs TTS
       |       * DRAW     -> System Design Canvas question
       |       * CONCLUDE -> Early conclusion if candidate answers prove completely inadequate
       v
[ EXTENDED STAGE ] (Base Time <= Elapsed < Extended Time, default 45 min)
       |
       +---> Deeper questions probing architecture, scalability, edge cases, and trade-offs
       +---> Performance evaluation decides whether to continue or conclude
       v
[ FINAL STAGE ] (Elapsed >= Extended Time)
       |
       +---> Groq decides CONCLUDE or permits strictly ONE final question
       +---> If final question asked -> Candidate answers -> FORCED CONCLUSION
       v
[ CONCLUSION STAGE ]
       |
       +---> Closing remarks thanking candidate delivered by selected panel member via ElevenLabs TTS
       +---> System strictly WAITS for closing audio completion (speech-finished event)
       v
[ EVALUATION REPORT STAGE ]
       |
       +---> Full transcript, answers, and canvas diagrams evaluated against job criteria via Gemini
       +---> Validated JSON report persisted to MongoDB and linked to candidate application
```

#### 1. Start Stage
Our system analyzes the job description and candidate resume to formulate an opening greeting and initial question, assigning it to an opening panel member (e.g., HR Manager). The authoritative timer starts upon ElevenLabs audio playback.

#### 2. Normal Stage
Active while `elapsed_time < base_time` (default 30 minutes). Operates in an adaptive loop: candidate responds -> ElevenLabs STT transcribes -> Reasoning brain decides whether to continue, conclude, or trigger a system design drawing.

#### 3. Extended Stage
Active while `base_time <= elapsed_time < extended_time` (default 45 minutes). The interview increases in rigor, probing production debugging, distributed system trade-offs, and failure recovery.

#### 4. Final Stage
Active once extended time is reached. The reasoning engine permits **strictly ONE final question** for top performers. Once answered, the interview concludes unconditionally.

#### 5. Conclusion Stage
Our system generates a closing message. The closing panel member delivers it via ElevenLabs TTS. The system waits for the `speech-finished` event before generating the final report.

#### 6. Evaluation Report Stage
Compiles a structured scorecard with numeric scores (0–100) across technical depth, communication, and problem-solving, supported by direct transcript quotes and an explicit recommendation (`Strong Hire`, `Hire`, `Consider`, `Do Not Hire`).

---

### Interactive System Design Canvas with Vision Analysis

Momentum incorporates an interactive architectural sketch pad for technical evaluations:
- When a system design question is triggered, the candidate interface presents a drawing canvas equipped with pen tools, shapes, and labels.
- The candidate sketches their architectural topology (e.g., microservices, load balancers, database caches, message queues).
- Upon submission, the drawing is sent as a base64 PNG image to our backend (`/api/interview/{interview_id}/canvas`).
- Our vision analysis engine evaluates structural components, connectivity, data flow bottlenecks, single points of failure, and scalability.
- The resulting analysis is factored into the interview state and final scorecard.

---

## 4. Core Engine Modules and Key Packages

### Core Functional Engines

| Engine Component | Primary Capability & Responsibility |
|---|---|
| **Authoritative State Controller** | Coordinates the interview state machine (`interview_controller.py`), enforces stage transitions, guarantees server timer authority, manages turn-taking lifecycles, and broadcasts real-time events over WebSockets. |
| **Cognitive Reasoning Gateway (`otheragent.py`)** | The single AI entry point. Manages multi-key rotation across Groq and Google AI Studio keys, calculates token counts, routes workloads dynamically based on token limits, and handles sequential fallbacks. |
| **Dynamic Panel Generator** | Evaluates the job description and candidate profile to construct a tailored interview panel of 1 to 5 fictional personas with distinct roles, seniorities, evaluation criteria, and behavioral rules (`panel.py`). |
| **Voice Catalog & Persona Mapper** | Maps panel members to distinct ElevenLabs neural voices with specific genders, accents (American, British, Australian), and vocal tones (warm, analytical, authoritative, pragmatic) (`voice.py`). |
| **ElevenLabs STT Voice Pipeline** | Manages real-time audio capture from the browser Web Audio API via WebSocket relay (`/api/interviews/{id}/stt`), streaming 16kHz PCM audio to ElevenLabs Realtime STT (`scribe_v2_realtime`), tracking partial transcripts, and committing on silence. |
| **Stage Question Generation Engine** | Powered directly by `otheragent.py` using 3 stage-specific prompts in `prompts.py` (Normal, Extended, Final) to formulate natural spoken questions directly. |
| **ElevenLabs TTS Audio Dispatcher** | Synthesizes and streams high-fidelity neural MP3 audio matching the active interviewer's persona voice ID using `eleven_flash_v2_5` (`services/elevenlabs/tts.py`). |
| **Structured Evaluation & Scoring Engine** | Parses full interview transcripts, validates schema integrity, normalizes multi-dimensional scores (0-100), extracts transcript-backed strengths and concerns, and assigns hiring recommendations (`report.py`). |
| **Database Persistence Layer** | Utilizes MongoDB as the primary source of truth for jobs, candidates, interview states, answers, and evaluation reports. Utilizes Qdrant Cloud for semantic resume chunk indexing. |

---

### Primary Software Packages and SDKs

- **`fastapi` & `uvicorn`**: High-performance asynchronous Python framework powering REST APIs and WebSocket communication.
- **`httpx` & `websockets`**: Asynchronous HTTP client and WebSocket streaming infrastructure powering the ElevenLabs STT relay and TTS synthesis.
- **`groq`**: Ultra-low-latency LPU inference SDK executing reasoning prompts, turn decisions, and spoken question generation.
- **`google-genai` & `google-generativeai`**: Google AI Studio Gemini SDK providing high-throughput, large-context reasoning for candidate profile evaluations and final report compilation.
- **`pymongo` & `motor`**: Synchronous and asynchronous MongoDB drivers for persistent data management.
- **`qdrant-client`**: Vector database client for indexing candidate resume chunks and semantic similarity queries.
- **`PyMuPDF` & `python-docx`**: Robust document parsing engines extracting structured text from candidate PDF and Word resumes.

---

## 5. The Momentum Recruitment Platform (In Short)

While the AI voice interview engine delivers autonomous evaluation intelligence, **Momentum** provides the complete hiring portal around it:

1. **Job Creation & Requirements Definition**:
   Recruiters publish detailed job openings with title, department, employment type, location, salary range, required skills, minimum experience, and custom interview durations.

2. **One-Click Candidate Applications**:
   Candidates explore open positions and apply using their stored profile and resume with a single click. Applications progress through statuses: `Applied` -> `Interviewing` -> `Completed` -> `Hired`.

3. **Zero-Friction Interview Launch**:
   When a candidate clicks **"Give Interview"**, Momentum automatically transfers the job requirements and candidate resume from MongoDB into the interview room without requiring manual re-entry.

4. **Hardware Pre-Flight Lobby**:
   Candidates verify their equipment before entering the room using an interactive device check with a live webcam preview and a real-time Web Audio API microphone volume meter.

5. **Recruiter Leaderboard & Ranked Results**:
   Once an interview concludes, the candidate's application is updated with match scores and reports. Recruiters access a dedicated dashboard (`/recruiter/dashboard/candidates`) where all interviewed candidates are arranged in strictly descending order of their overall match score.

6. **Individual & Batch Hiring**:
   Recruiters review evaluation evidence, examine score breakdowns, and mark candidates as `Hired` individually or in batches.

---

## 6. Setup and Installation Guide

### Prerequisites and System Requirements

| Tool | Required Version | Verification Command |
|---|---|---|
| **Python** | 3.12.x (Tested on 3.12.10) | `python --version` |
| **Node.js** | v18.x or higher (Tested on v24.12.0) | `node --version` |
| **npm** | 10.x or higher | `npm --version` |
| **MongoDB** | 6.0+ / 7.0+ (Local or Atlas) | `mongod --version` |

---

### Step-by-Step Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/kajaredhruv433/RunTimeError-Momentum-EchoSphere.git
cd RunTimeError-Momentum-EchoSphere
```

#### 2. Configure Python Virtual Environment (Backend)
```bash
# Windows
python -m venv backend\venv
backend\venv\Scripts\activate
pip install --upgrade pip
pip install -r backend\requirements.txt

# macOS / Linux
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

#### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

#### 4. Configure Environment Variables
Copy the template files to create local environment configurations:

```bash
# Windows
copy backend\interviewer\backend\.env.example backend\interviewer\backend\.env
copy frontend\.env.example frontend\.env.local

# macOS / Linux
cp backend/interviewer/backend/.env.example backend/interviewer/backend/.env
cp frontend/.env.example frontend/.env.local
```

---

### Environment Variables Reference

#### Backend Configuration (`backend/interviewer/backend/.env`)

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `GROQ_API_KEY_1` | Primary Groq API key for reasoning turns | `gsk_...` |
| `GROQ_API_KEY_2` | Secondary Groq key for rotation (up to 20 keys) | `gsk_...` |
| `GROQ_TPM_LIMIT` | Groq tokens per minute limit | `8000` |
| `GEMINI_API_KEY_1` | Primary Google AI Studio Gemini API key | `AIzaSy...` |
| `GEMINI_API_KEY_2` | Secondary Gemini key for rotation (up to 20 keys) | `AIzaSy...` |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for STT & TTS | `sk_...` |
| `ELEVENLABS_STT_MODEL` | ElevenLabs Realtime STT model | `scribe_v2_realtime` |
| `ELEVENLABS_TTS_MODEL` | ElevenLabs Neural TTS model | `eleven_flash_v2_5` |
| `ELEVENLABS_VOICE_ID` | Default fallback ElevenLabs voice ID | `hpp4J3VqNfWAUOO0d1Us` |
| `MONGODB_URI` | MongoDB connection URL | `mongodb://localhost:27017` |
| `MONGODB_DATABASE` | Database name | `momentum` |
| `QDRANT_URL` | Qdrant Cloud cluster endpoint | `https://your-cluster.qdrant.tech:6333` |
| `QDRANT_API_KEY` | Qdrant Cloud API access key | `your_qdrant_api_key` |
| `HOST` | Backend server bind host | `0.0.0.0` or `127.0.0.1` |
| `PORT` | Backend server port | `8000` |

#### Frontend Configuration (`frontend/.env.local`)

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `MONGODB_URI` | MongoDB connection URL | `mongodb://localhost:27017/momentum` |
| `GEMINI_API_KEY` | Google Gemini API key for candidate matching | `AIzaSy...` |
| `NEXT_PUBLIC_API_URL` | Backend FastAPI service URL | `http://127.0.0.1:8000` |

*Note: Qdrant Cloud is utilized for semantic candidate resume chunk indexing. If Qdrant credentials are not configured, the system gracefully logs an informational event and continues the interview without interruption.*

---

### Running the Platform

#### Method A: Windows One-Click Launcher (Recommended)
Run the automated batch file from the project root:
```bat
start-dev.bat
```
This automatically initializes the FastAPI backend on port 8000 and the Next.js frontend on port 3000 in separate terminals.

#### Method B: Manual Startup via NPM
Open two separate terminal windows:

**Terminal 1 (Backend):**
```bash
npm run dev:backend
```

**Terminal 2 (Frontend):**
```bash
npm run dev:frontend
```

---

### Automated Verification Suite

Run the end-to-end integration test to verify database connections, automated setup pre-fetching, evaluation persistence, and recruiter leaderboard queries:

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

### System Access Points

| Service | Access URL | Description |
|---|---|---|
| **Momentum Web Portal** | `http://localhost:3000` | Candidate job search and recruiter dashboard |
| **Recruiter Leaderboard** | `http://localhost:3000/recruiter/dashboard/candidates` | Candidates ranked by interview match score with reports |
| **AI Interviewer Lobby** | `http://127.0.0.1:8000/interview-app` | Pre-flight hardware check and live interview room |
| **FastAPI Swagger Docs** | `http://127.0.0.1:8000/docs` | Interactive API documentation |
