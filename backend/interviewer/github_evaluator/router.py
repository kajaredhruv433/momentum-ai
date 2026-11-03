"""FastAPI routes exposing the copied evaluator's assessment APIs in Momentum."""
import json

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.routing import APIRoute

from .api import app as evaluator_app, _assessment, _session
from .store import connect

router = APIRouter()

# Reuse the evaluator's hardened status, workspace, hint, run, and submit
# endpoints. OAuth and its standalone dashboard stay out; interviews use the
# GitHub connection already established by the main application.
for route in evaluator_app.routes:
    if isinstance(route, APIRoute) and (
        route.path.startswith("/api/assessments/")
        or route.path.startswith("/api/assistant/context/")
        or route.path.startswith("/api/assessment/")
    ):
        router.routes.append(route)


def _interview_assessment(interview_id: str, request: Request):
    try:
        from backend.interviewer.api.interview import controller
    except ImportError:
        from ..api.interview import controller
    state = controller._get_state(interview_id)
    evaluation = state.get("repository_evaluation") or {}
    assessment_id = evaluation.get("id")
    if not assessment_id:
        raise HTTPException(404, "Repository evaluation has not started for this interview.")
    candidate = _session(request, assessment_id)
    db = connect()
    try:
        return state, evaluation, candidate, _assessment(db, assessment_id, candidate["id"])
    finally:
        db.close()


@router.get("/api/interviews/{interview_id}/repository-assessment")
def repository_assessment_status(interview_id: str, request: Request):
    state, evaluation, candidate, assessment = _interview_assessment(interview_id, request)
    from .api import assessment_status
    request.path_params["assessment_id"] = evaluation["id"]
    result = assessment_status(evaluation["id"], request)
    state["repository_evaluation"] = {
        "id": result["id"], "repo": result["repo"], "status": result["status"],
        "progress": result["progress"], "challenge": result.get("challenge"),
    }
    from backend.interviewer.api.interview import controller
    controller._save_state(state)
    result["interview_id"] = interview_id
    return result


@router.post("/api/interviews/{interview_id}/repository-assessment/finish")
def finish_repository_assessment(interview_id: str, request: Request):
    state, evaluation, candidate, assessment = _interview_assessment(interview_id, request)
    if assessment["status"] != "submitted":
        raise HTTPException(409, "Wait for the code submission evaluation to finish.")
    state["repository_evaluation"] = {**evaluation, "status": "submitted"}
    state["repository_assessment_completed"] = True
    db = connect()
    try:
        row = db.execute(
            "SELECT result FROM submissions WHERE assessment_id=? ORDER BY created_at DESC LIMIT 1",
            (evaluation["id"],),
        ).fetchone()
        state["repository_assessment_result"] = json.loads(row["result"]) if row and row["result"] else None
    except (TypeError, json.JSONDecodeError):
        state["repository_assessment_result"] = None
    finally:
        db.close()
    paused_at = state.pop("interview_timer_paused_at", None)
    if paused_at is not None:
        state["interview_timer_paused_seconds"] = int(state.get("interview_timer_paused_seconds", 0)) + max(0, int(__import__("time").time() - paused_at))
    panel_member = next((m for m in state.get("panel", {}).values() if isinstance(m, dict)), {})
    action = {
        "action": "ASK_QUESTION",
        "panel_member": panel_member.get("name", "Interviewer"),
        "panel_member_details": panel_member,
        "question": "Thank you for submitting your change. Walk us through how you diagnosed the regression, what you changed, and how you verified the fix.",
        "question_pattern": "Explain your diagnosis and validation of the repository bug fix.",
        "selected_area": "repo_assessment_review",
        "stage": "NORMAL",
        "question_kind": "repo_assessment_review",
    }
    state["current_question"] = action
    state["interview_phase"] = "normal"
    from backend.interviewer.api.interview import controller
    controller._save_state(state)
    gender = (panel_member or {}).get("gender", "Female")
    controller._broadcast(interview_id, "speaker_changed", {
        "panel_member": action["panel_member"], "question": action["question"],
        "question_pattern": action["question_pattern"], "selected_area": action["selected_area"],
        "question_kind": action["question_kind"], "gender": gender,
        "panel_member_details": panel_member,
    })
    return {**controller._public(state), **action}
