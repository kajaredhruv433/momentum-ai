"""
interview.py

REST API endpoints for the Momentum AI Interview Platform.
Requirement 46:
- POST /api/interviews
- GET  /api/interviews/{interview_id}
- POST /api/interviews/{interview_id}/start
- POST /api/interviews/{interview_id}/answer
- GET  /api/interviews/{interview_id}/report
- POST /api/interviews/{interview_id}/speech-finished
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response

try:
    from ..interview_controller import InterviewController
    from ..schemas import CandidateAnswerRequest, CanvasSubmitRequest, CreateInterviewRequest
    from ..services.elevenlabs.tts import ElevenLabsTTS
    from .websocket import manager
except ImportError:
    from interview_controller import InterviewController
    from schemas import CandidateAnswerRequest, CanvasSubmitRequest, CreateInterviewRequest
    from services.elevenlabs.tts import ElevenLabsTTS
    from api.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["interviews"])

# Instantiate controller and wire WebSocket broadcasting
controller = InterviewController()
controller.subscribe(manager.sync_broadcast)
tts = ElevenLabsTTS()


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
    try:
        from ..tools.database import mongo
    except ImportError:
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

    # Check if this candidate has already completed an interview for this job
    if not app and (jobId or (job and job.get("_id"))) and (candidateId or candidateEmail):
        target_jid = jobId or (str(job.get("_id")) if job else "")
        crit = []
        if candidateId:
            crit.append({"applicantUid": candidateId})
        if candidateEmail:
            crit.append({"applicantEmail": candidateEmail})

        job_crit = []
        try:
            job_crit.append({"jobId": ObjectId(target_jid)})
        except Exception:
            pass
        job_crit.append({"jobId": target_jid})

        try:
            app = mongo.applications.find_one({"$and": [{"$or": crit}, {"$or": job_crit}]})
        except Exception:
            pass

    already_completed = False
    completed_score = 0
    if app:
        app_status = app.get("status")
        if app_status in ["Completed", "Hired"] or bool(app.get("interviewCompletedAt")) or (app.get("report") is not None and app.get("matchScore")):
            already_completed = True
            completed_score = app.get("matchScore") if app.get("matchScore") is not None else app.get("score", 0)

    job_data["already_completed"] = already_completed
    job_data["completed_score"] = completed_score

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
        "already_completed": already_completed,
        "completed_score": completed_score,
    }


# ============================================================================
# CREATE / START INTERVIEW
# ============================================================================

@router.post("/interviews")
@router.post("/interview/start")  # Compatibility alias
def create_and_start_interview(request: CreateInterviewRequest, http_request: Request) -> Dict[str, Any]:
    """
    Create a new interview, analyze the candidate's resume, generate the AI panel,
    assign ElevenLabs voices, and formulate the opening question.
    """
    # Reject if candidate has already taken the interview for this job
    if request.job_id and (request.candidate_id or request.candidate_email):
        try:
            try:
                from ..tools.database import mongo
            except ImportError:
                from tools.database import mongo
            from bson import ObjectId
            crit = []
            if request.candidate_id:
                crit.append({"applicantUid": request.candidate_id})
            if request.candidate_email:
                crit.append({"applicantEmail": request.candidate_email})

            job_crit = []
            try:
                job_crit.append({"jobId": ObjectId(request.job_id)})
            except Exception:
                pass
            job_crit.append({"jobId": request.job_id})

            prior_app = mongo.applications.find_one({"$and": [{"$or": crit}, {"$or": job_crit}]})
            if prior_app and (prior_app.get("status") in ["Completed", "Hired"] or bool(prior_app.get("interviewCompletedAt")) or (prior_app.get("report") is not None and prior_app.get("matchScore"))):
                raise HTTPException(
                    status_code=403,
                    detail="You have already completed the AI interview for this job. Candidates are permitted to take the interview once per job listing."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Prior completion check notice: {e}")

    company_dict = request.company_details.model_dump()
    from backend.routers.github import get_selected_repository
    selected_repository = get_selected_repository(
        request=http_request, requested_full_name=(request.selected_repository or {}).get("full_name")
    )
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
        selected_repository=selected_repository,
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

    try:
        audio_bytes = await tts.synthesize(text, member_details=member_details)
    except httpx.HTTPStatusError as exc:
        # Keep provider response details in backend logs, but return a useful
        # actionable error to the voice client instead of an opaque 500.
        logger.error("ElevenLabs TTS rejected the request (%s): %s", exc.response.status_code, exc.response.text[:500])
        if exc.response.status_code in (401, 403):
            detail = "ElevenLabs rejected the API key or this account cannot use text-to-speech. Check the backend ElevenLabs credentials and account status."
        elif exc.response.status_code == 402:
            detail = "ElevenLabs account has insufficient funds. Add credits to restore spoken questions."
        else:
            detail = f"ElevenLabs text-to-speech is unavailable (HTTP {exc.response.status_code})."
        raise HTTPException(status_code=503, detail=detail) from exc
    except RuntimeError as exc:
        logger.error("ElevenLabs TTS configuration error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
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
def submit_answer(interview_id: str, request: CandidateAnswerRequest, http_request: Request,
                  background: BackgroundTasks, http_response: Response) -> Dict[str, Any]:
    """
    Submit candidate answer. Accepts answers from either microphone (voice) or typing (text).
    Evaluates stage transitions and returns the next interview action.
    """
    result = _handle_call(
        controller.answer,
        interview_id=interview_id,
        answer_text=request.answer,
        input_method=request.input_method,
        question_id=request.question_id,
    )
    if result.pop("repository_intake_complete", False):
        state = controller._get_state(interview_id)
        try:
            from backend.routers.github import get_github_evaluation_session
            from backend.interviewer.github_evaluator.integration import start_for_interview
            github = get_github_evaluation_session(http_request)
            evaluation = start_for_interview(
                interview_id=interview_id, github_id=github["github_id"], login=github["login"],
                token=github["token"], repository=state["selected_repository"],
                claims=state.get("repository_candidate_claims") or {}, response=http_response,
                background=background,
            )
            state["repository_evaluation"] = {**evaluation, "status": "queued", "progress": "Queued for project analysis"}
        except Exception as exc:
            logger.warning("Repository evaluation could not start for interview %s: %s", interview_id, exc)
            detail = getattr(exc, "detail", "Repository evaluation could not start.")
            state["repository_evaluation"] = {"status": "unavailable", "progress": str(detail)[:500]}
        controller._save_state(state)
        result["repository_evaluation"] = controller._public(state).get("repository_evaluation")
    return result


# ============================================================================
# GET FINAL REPORT
# ============================================================================

@router.get("/interviews/{interview_id}/report")
@router.get("/interview/{interview_id}/report")  # Compatibility alias
def get_report(interview_id: str) -> Dict[str, Any]:
    """
    Candidate sessions must not retrieve the recruiter evaluation report.
    Recruiter dashboards use the persisted application/session report endpoints.
    """
    raise HTTPException(status_code=403, detail="Evaluation reports are available only to recruiters.")


# ============================================================================
# SPEECH LIFECYCLE ENDPOINTS
# ============================================================================

@router.post("/interviews/{interview_id}/question-started")
def question_started(interview_id: str) -> Dict[str, Any]:
    """Start the timer after the ElevenLabs question audio begins playing."""
    return _handle_call(controller.on_question_started, interview_id, True)


@router.post("/interviews/{interview_id}/speech-finished")
@router.post("/interview/{interview_id}/conclusion-finished")
def speech_finished(interview_id: str) -> Dict[str, Any]:
    """Generate the report only after the closing ElevenLabs audio has completed."""
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
