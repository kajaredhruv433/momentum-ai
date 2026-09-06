from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/ai", tags=["ai"])

class GenerateJobDescRequest(BaseModel):
    title: str
    type: Optional[str] = "Full-time"
    location: Optional[str] = "Remote"
    salary: Optional[str] = "Competitive"

@router.post("/generate-job-description")
async def generate_job_desc(req: GenerateJobDescRequest):
    if not req.title:
        raise HTTPException(status_code=400, detail="Job title is required")

    summary = (
        f"We are seeking a talented {req.title} ({req.type}, {req.location}) to join our engineering team. "
        f"In this role, you will design, build, and deploy resilient systems while collaborating with high-performing cross-functional teams."
    )

    return {
        "description": summary,
        "shortSummary": summary
    }

