"""
candidate.py

Candidate resume extraction and profile parsing API.
Integrates with existing resume.py.
"""
from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    from .. import resume
except ImportError:
    import resume

router = APIRouter(prefix="/api/candidate", tags=["candidate"])


class ParseResumeRequest(BaseModel):
    resume_text: str = Field(..., min_length=20, description="Raw resume text")


@router.post("/parse")
def parse_candidate_resume(request: ParseResumeRequest) -> Dict[str, Any]:
    """Parse raw resume text into structured candidate profile using existing resume.py."""
    try:
        profile = resume.parse_resume_text(request.resume_text)
        return {"success": True, "profile": profile}
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse resume: {exc}") from exc
