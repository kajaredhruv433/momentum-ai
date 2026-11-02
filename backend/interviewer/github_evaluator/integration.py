"""Interview-scoped bridge into the copied LangGraph repository evaluator."""
from __future__ import annotations

import uuid
from fastapi import BackgroundTasks, HTTPException, Response

from .api import _cookie, _fernet
from .config import settings
from .store import connect, json_dump
from .workflow import run_analysis


def is_assessment_ready(assessment_id: str) -> bool:
    db = connect()
    try:
        row = db.execute("SELECT status FROM assessments WHERE id=?", (assessment_id,)).fetchone()
        return bool(row and row["status"] == "ready")
    finally:
        db.close()


def start_for_interview(*, interview_id: str, github_id: str, login: str, token: str,
                        repository: dict, claims: dict, response: Response,
                        background: BackgroundTasks) -> dict:
    if not settings.model_api_key:
        raise HTTPException(503, "Meta repository analysis is not configured. Add MODEL_API_KEY to backend/.env.")
    if not settings.daytona_api_key:
        raise HTTPException(503, "The isolated code editor is not configured. Add DAYTONA_API_KEY to backend/.env.")
    repo = str(repository.get("full_name") or "")
    parts = repo.split("/", 1)
    if len(parts) != 2 or not all(parts):
        raise HTTPException(400, "The selected GitHub repository is invalid.")

    assessment_id = str(uuid.uuid4())
    candidate_id = str(uuid.uuid4())  # One isolated candidate identity per interview.
    candidate_claims = {
        "built": f"Role: {claims.get('candidate_role', '')}\n\nContribution: {claims.get('implementation_summary', '')}\n\nImplementation detail: {claims.get('implementation_details', '')}",
        "files": ", ".join(claims.get("claimed_files_or_components", [])),
        "languages": ", ".join(claims.get("tech_stack", [])),
        "comfortable": claims.get("implementation_details", "")[:1000],
        "ai_usage": claims.get("ai_tools_used", ""),
    }
    db = connect()
    try:
        db.execute("BEGIN IMMEDIATE")
        active = db.execute(
            "SELECT id FROM assessments WHERE candidate_id=? AND status IN ('queued','fetching','analyzing','preparing') LIMIT 1",
            (candidate_id,),
        ).fetchone()
        if active:
            raise HTTPException(409, "This interview already has an active repository analysis.")
        encrypted_token = _fernet().encrypt(token.encode()).decode()
        db.execute(
            "INSERT INTO candidates(id,github_id,login,access_token) VALUES(?,?,?,?)",
            (candidate_id, str(github_id), login, encrypted_token),
        )
        db.execute(
            "INSERT INTO assessments(id,candidate_id,repo,branch,claims,status,progress) VALUES(?,?,?,?,?,'queued','Preparing a session-only repository analysis')",
            (assessment_id, candidate_id, repo, repository.get("default_branch"), json_dump(candidate_claims)),
        )
        db.execute(
            "INSERT INTO interview_sessions(interview_id,candidate_id,github_id,github_login,repository,assessment_id) VALUES(?,?,?,?,?,?)",
            (interview_id, candidate_id, str(github_id), login, repo, assessment_id),
        )
        db.commit()
    finally:
        db.close()

    response.set_cookie(
        f"repo_assessment_{assessment_id}", _cookie(candidate_id), httponly=True,
        secure=settings.secure_cookies, samesite="lax", max_age=settings.assessment_minutes * 60, path="/",
    )
    background.add_task(run_analysis, {
        "assessment_id": assessment_id, "candidate_id": candidate_id, "token": token,
        "repo": repo, "branch": repository.get("default_branch"), "claims": candidate_claims,
        "interview_id": interview_id,
    })
    return {"id": assessment_id, "repo": repo, "status": "queued"}
