from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.baseten_service import generate_job_description

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

    result = await generate_job_description(
        title=req.title,
        role=req.type or "Full-time",
        skills=[],
        experience="",
        company="Momentum AI",
        location=req.location or "Remote",
        salary=req.salary or "Competitive",
    )
    description = result.get("overview", "")
    return {"description": description, "shortSummary": description, **result}

