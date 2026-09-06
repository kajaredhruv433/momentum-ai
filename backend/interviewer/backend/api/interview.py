"""
interview.py

REST API endpoints for the EchoSphere AI Interview Platform.
Requirement 46:
- POST /api/interviews
- GET  /api/interviews/{interview_id}
- POST /api/interviews/{interview_id}/start
- POST /api/interviews/{interview_id}/answer
- GET  /api/interviews/{interview_id}/report
- POST /api/interviews/{interview_id}/agora/token
- POST /api/interviews/{interview_id}/agora/event
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Response

try:
    from ..interview_controller import InterviewController
    from ..schemas import AgoraEventRequest, CandidateAnswerRequest, CanvasSubmitRequest, CreateInterviewRequest
    from .websocket import manager
except ImportError:
    from interview_controller import InterviewController
    from schemas import AgoraEventRequest, CandidateAnswerRequest, CanvasSubmitRequest, CreateInterviewRequest
    from api.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["interviews"])

# Instantiate controller and wire WebSocket broadcasting
controller = InterviewController()
controller.subscribe(manager.sync_broadcast)


def _handle_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("API handling error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Interview pipeline error: {exc}") from exc


# ============================================================================
# INTERVIEW SETUP & DATA PRE-FETCH
# ============================================================================

def _format_resume_text(resume_doc: Optional[dict], candidate_name: str = "Candidate", candidate_email: str = "") -> str:
    if not resume_doc:
        return (
            f"CANDIDATE: {candidate_name}\n"
            f"EMAIL: {candidate_email}\n"
            f"SUMMARY: Software Engineering candidate with practical experience in relevant technical domains, web architectures, APIs, and systems.\n"
            f"TECHNICAL SKILLS: Python, JavaScript, Full-Stack Development, Problem Solving, Data Structures, Algorithms"
        )

    parts = []
    personal = resume_doc.get("personal", {}) or {}
    name = personal.get("fullName") or candidate_name
    email = personal.get("email") or candidate_email
    phone = personal.get("phone", "")
    location = personal.get("location", "")
    linkedin = personal.get("linkedin", "")

    header = f"{name}"
    meta = " | ".join(filter(None, [email, phone, location, linkedin]))
    if meta:
        header += f"\n{meta}"
    parts.append(header)

    summary = personal.get("summary") or personal.get("about")
    if summary:
        parts.append(f"\nPROFESSIONAL SUMMARY\n{summary}")

    skills = resume_doc.get("skills")
    if skills:
        parts.append(f"\nTECHNICAL SKILLS\n{skills}")

    experience = resume_doc.get("experience", [])
    if experience and isinstance(experience, list):
        parts.append("\nWORK EXPERIENCE")
        for exp in experience:
            role = exp.get("role", "")
            company = exp.get("company", "")
            duration = exp.get("duration", "")
            details = exp.get("details", "")
            parts.append(f"- {role} at {company} ({duration})\n  {details}")

    projects = resume_doc.get("projects", [])
    if projects and isinstance(projects, list):
        parts.append("\nPROJECTS")
        for proj in projects:
            pname = proj.get("name", "")
            tech = proj.get("tech", "")
            desc = proj.get("description", "")
            parts.append(f"- {pname} [{tech}]: {desc}")

    education = resume_doc.get("education", [])
    if education and isinstance(education, list):
        parts.append("\nEDUCATION")
        for edu in education:
            degree = edu.get("degree", "")
            school = edu.get("school", "")
            year = edu.get("year", "")
            parts.append(f"- {degree} - {school} ({year})")

    achievements = resume_doc.get("achievements", [])
    if achievements and isinstance(achievements, list):
        parts.append("\nACHIEVEMENTS")
        for ach in achievements:
            parts.append(f"- {ach.get('title', '')}: {ach.get('description', '')}")

    raw_text = "\n\n".join(parts).strip()
    if len(raw_text) < 40:
        raw_text = (
            f"CANDIDATE: {name}\n"
            f"EMAIL: {email}\n"
            f"SUMMARY: Software Engineering candidate with practical experience in relevant technical domains, web architectures, APIs, and systems.\n"
            f"TECHNICAL SKILLS: Python, JavaScript, Full-Stack Development, Problem Solving, Data Structures, Algorithms"
        )
    return raw_text


@router.get("/interview/setup-data")
@router.get("/interviews/setup-data")
def get_interview_setup_data(
    jobId: Optional[str] = None,
    candidateId: Optional[str] = None,
    candidateEmail: Optional[str] = None,
    applicationId: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extract job specification and candidate resume directly from MongoDB,
    allowing the interview to start immediately without manual user input.
    """
    from tools.database import mongo
    from bson import ObjectId

    app = None
    if applicationId:
        try:
            app = mongo.applications.find_one({"_id": ObjectId(applicationId)})
        except Exception:
            app = mongo.applications.find_one({"_id": applicationId})
        if app:
            if not jobId and app.get("jobId"):
                jobId = str(app["jobId"])
            if not candidateId and app.get("applicantUid"):
                candidateId = app["applicantUid"]
            if not candidateEmail and app.get("applicantEmail"):
                candidateEmail = app["applicantEmail"]

    job = None
    if jobId:
        try:
            job = mongo.jobs.find_one({"_id": ObjectId(jobId)})
        except Exception:
            job = mongo.jobs.find_one({"_id": jobId})

    if not job and app:
        job = {
            "company": app.get("company", "Company"),
            "roleRequired": app.get("jobTitle", "Software Engineer"),
            "skillsRequired": "Software Development, Problem Solving, System Design",
        }

    if not job:
        job = mongo.jobs.find_one(sort=[("postedAt", -1)]) or {}

    company_name = job.get("company") or "TechNova Solutions"
    role = job.get("roleRequired") or job.get("title") or "Senior Software Engineer"
    skills = job.get("skillsRequired", [])
    if isinstance(skills, list):
        skills_str = ", ".join(skills)
    elif isinstance(skills, str):
        skills_str = skills
    else:
        skills_str = "Python, FastAPI, System Design, REST APIs, Microservices"

    job_data = {
        "company_name": company_name,
        "role": role,
        "required_skills": skills_str,
        "required_experience": job.get("experience") or "2-5 years",
        "required_qualification": job.get("qualification") or "B.Tech / B.E. in CS or equivalent",
        "salary": job.get("salary") or "Competitive",
        "role_description": job.get("description") or f"Design, build, and scale resilient software architectures and APIs for {role}.",
        "employee_qualities": job.get("employeeQualities") or "Problem solving, ownership, communication, architecture reasoning, team collaboration",
    }

    # Fetch candidate resume
    resume_doc = None
    if candidateId:
        resume_doc = mongo.resumes.find_one({"uid": candidateId})
    if not resume_doc and candidateEmail:
        resume_doc = mongo.resumes.find_one({"userId": {"$regex": f"^{candidateEmail}$", "$options": "i"}})
    if not resume_doc:
        resume_doc = mongo.resumes.find_one()

    candidate_name = (
        (resume_doc.get("personal", {}) if resume_doc else {}).get("fullName")
        or (app.get("applicantName") if app else None)
        or (candidateEmail.split("@")[0].capitalize() if candidateEmail else "Candidate")
    )
    c_email = candidateEmail or ((resume_doc.get("personal", {}) if resume_doc else {}).get("email")) or ""

    resume_text = _format_resume_text(resume_doc, candidate_name=candidate_name, candidate_email=c_email)

    return {
        "success": True,
        "jobData": job_data,
        "resumeText": resume_text,
        "candidateProfile": {
            "name": candidate_name,
            "email": c_email,
            "id": candidateId or "",
        },
        "jobId": str(job.get("_id", jobId or "")),
        "applicationId": applicationId or (str(app.get("_id")) if app else ""),
        "candidateId": candidateId or "",
    }


# ============================================================================
# CREATE / START INTERVIEW
# ============================================================================

@router.post("/interviews")
@router.post("/interview/start")  # Compatibility alias
def create_and_start_interview(request: CreateInterviewRequest) -> Dict[str, Any]:
    """
    Create a new interview, analyze the candidate's resume, generate the AI panel,
    set up Agora credentials, and formulate the opening question.
    """
    company_dict = request.company_details.model_dump()
    return _handle_call(
        controller.start,
        company_details=company_dict,
        resume_text=request.resume_text,
        base_time=request.base_time,
        extended_time=request.extended_time,
        candidate_id=request.candidate_id,
        candidate_email=request.candidate_email,
        candidate_name=request.candidate_name,
        job_id=request.job_id,
        application_id=request.application_id,
    )


@router.post("/interviews/{interview_id}/start")
def start_interview_explicit(interview_id: str) -> Dict[str, Any]:
    """Return status or trigger start if not started."""
    return _handle_call(controller.status, interview_id)


# ============================================================================
# TEXT-TO-SPEECH (TTS) NEURAL PERSONA AUDIO
# Placed before /{interview_id} to prevent FastAPI path parameter shadowing!
# ============================================================================

@router.get("/tts")
@router.get("/interviews/tts")
@router.get("/interviews/{interview_id}/tts")
async def get_interview_tts(
    text: str,
    speaker: Optional[str] = None,
    gender: Optional[str] = None,
    interview_id: Optional[str] = None,
):
    """
    Synthesize and stream neural speech audio (MP3) matching the interviewer persona.
    """
    member_details = None
    if interview_id and speaker:
        try:
            state = controller._get_state(interview_id)
            panel = state.get("panel", {})
            for _, m in panel.items():
                if isinstance(m, dict) and m.get("name") == speaker:
                    member_details = m
                    break
        except Exception:
            pass

    audio_bytes = await controller.agora.synthesize_audio(
        text, panel_member=speaker, gender=gender, member_details=member_details
    )
    if not audio_bytes:
        logger.warning("TTS audio synthesis returned empty audio for speaker %s; responding with 204", speaker)
        return Response(content=b"", media_type="audio/mpeg", status_code=204)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Accept-Ranges": "bytes",
        },
    )


# ============================================================================
# GET STATUS
# ============================================================================

@router.get("/interviews/{interview_id}")
@router.get("/interview/{interview_id}/status")  # Compatibility alias
def get_interview(interview_id: str) -> Dict[str, Any]:
    """Fetch live authoritative interview state, current question, and elapsed time."""
    return _handle_call(controller.status, interview_id)


# ============================================================================
# SUBMIT CANDIDATE ANSWER (VOICE OR TYPING)
# ============================================================================

@router.post("/interviews/{interview_id}/answer")
@router.post("/interview/{interview_id}/answer")  # Compatibility alias
def submit_answer(interview_id: str, request: CandidateAnswerRequest) -> Dict[str, Any]:
    """
    Submit candidate answer. Accepts answers from either microphone (voice) or typing (text).
    Evaluates stage transitions and returns the next interview action.
    """
    return _handle_call(
        controller.answer,
        interview_id=interview_id,
        answer_text=request.answer,
        input_method=request.input_method,
        question_id=request.question_id,
    )


# ============================================================================
# GET FINAL REPORT
# ============================================================================

@router.get("/interviews/{interview_id}/report")
@router.get("/interview/{interview_id}/report")  # Compatibility alias
def get_report(interview_id: str) -> Dict[str, Any]:
    """
    Retrieve final candidate evaluation report once interview closing speech is complete.
    """
    rep = _handle_call(controller.report, interview_id)
    if rep is None:
        raise HTTPException(
            status_code=409,
            detail="The evaluation report is not ready yet. It will generate after the closing speech finishes.",
        )
    return rep


# ============================================================================
# AGORA SPECIFIC ENDPOINTS
# ============================================================================

@router.post("/interviews/{interview_id}/agora/token")
@router.post("/interview/{interview_id}/voice/start")  # Compatibility alias
def get_agora_token(interview_id: str) -> Dict[str, Any]:
    """
    Generate or retrieve Agora RTC token and channel info for candidate microphone connection.
    Does NOT expose private server secrets.
    """
    state = _handle_call(controller.status, interview_id)
    agora_info = state.get("agora") or {}
    if not agora_info.get("token"):
        # Re-connect or refresh
        agora_info = controller.agora.connect(interview_id, panel=state.get("panel"))
    return agora_info


@router.post("/interviews/{interview_id}/agora/event")
@router.post("/interview/{interview_id}/question-started")  # Compatibility alias
def post_agora_event(interview_id: str, request: Optional[AgoraEventRequest] = None) -> Dict[str, Any]:
    """
    Dispatch client-side Agora audio events (e.g. question_started to initiate timer,
    speech_finished to initiate report generation).
    """
    event_name = (request.event if request else "question_started").lower()
    data = (request.data if request else {}) or {}

    if event_name in {"question_started", "speech_started"}:
        return _handle_call(controller.on_question_started, interview_id, True)

    elif event_name in {"speech_finished", "closing_finished", "conclusion_finished"}:
        return _handle_call(controller.on_closing_speech_finished, interview_id)

    return {"success": True, "event": event_name}


@router.post("/interview/{interview_id}/conclusion-finished")  # Compatibility alias
def post_conclusion_finished(interview_id: str) -> Dict[str, Any]:
    return _handle_call(controller.on_closing_speech_finished, interview_id)


@router.post("/interviews/{interview_id}/conclude")
@router.post("/interview/{interview_id}/conclude")
def conclude_interview(interview_id: str) -> Dict[str, Any]:
    """
    Manually conclude an interview, triggering closing message and speech generation.
    """
    return _handle_call(controller.conclude_interview, interview_id)


# ============================================================================
# CANVAS DIAGRAM SUBMISSION
# ============================================================================

@router.post("/interview/{interview_id}/canvas")
@router.post("/interviews/{interview_id}/canvas")
def submit_canvas_diagram(interview_id: str, request: CanvasSubmitRequest) -> Dict[str, Any]:
    """
    Accept a candidate's system-design canvas drawing (base64 PNG), run AI diagram
    analysis, persist the submission, and return structured diagram analysis.

    The analysis is stored in the interview state and automatically included in the
    final evaluation report context.
    """
    if not request.image_data or not request.image_data.strip():
        raise HTTPException(status_code=400, detail="image_data must not be empty.")

    return _handle_call(
        controller.submit_canvas,
        interview_id=interview_id,
        question_id=request.question_id,
        image_data=request.image_data,
    )
