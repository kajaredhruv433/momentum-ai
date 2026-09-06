from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from bson import ObjectId
from backend.database import get_db, serialize_doc, serialize_docs

router = APIRouter(prefix="/api/applications", tags=["applications"])

class ApplyRequest(BaseModel):
    jobId: str
    applicantUid: str
    applicantName: Optional[str] = None
    applicantEmail: Optional[str] = None
    coverNote: Optional[str] = ""

class SaveReportRequest(BaseModel):
    report: dict
    matchScore: Optional[float] = None
    technicalScore: Optional[float] = None
    communicationScore: Optional[float] = None
    recommendation: Optional[str] = None

@router.post("/apply")
async def apply_to_job(req: ApplyRequest):
    db = get_db()
    try:
        job_obj_id = ObjectId(req.jobId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    job = await db.jobs.find_one({"_id": job_obj_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    applicant = await db.users.find_one({"firebaseUid": req.applicantUid})
    applicant_name = req.applicantName or (applicant.get("name") if applicant else "Candidate")
    applicant_email = req.applicantEmail or (applicant.get("email") if applicant else "")

    existing = await db.applications.find_one({"jobId": job_obj_id, "applicantUid": req.applicantUid})
    if existing:
        # Return existing application so candidate can proceed directly to Give Interview
        return serialize_doc(existing)

    app_doc = {
        "jobId": job_obj_id,
        "applicantUid": req.applicantUid,
        "recruiterUid": job.get("recruiterUid") or job.get("uid") or "default_recruiter",
        "applicantName": applicant_name,
        "applicantEmail": applicant_email,
        "jobTitle": job.get("roleRequired") or job.get("title", "Software Engineer"),
        "company": job.get("company", "Company"),
        "coverNote": req.coverNote or "",
        "status": "Applied",
        "score": 0,
        "matchScore": 0,
        "report": None,
        "aiReview": "Application submitted. Ready for interview.",
        "appliedAt": datetime.utcnow()
    }

    result = await db.applications.insert_one(app_doc)
    app_doc["_id"] = result.inserted_id

    # Increment job applicant counter
    await db.jobs.update_one(
        {"_id": job_obj_id},
        {
            "$inc": {"counter": 1},
            "$push": {"applicants": {"uid": req.applicantUid, "name": applicant_name}}
        }
    )

    return serialize_doc(app_doc)

@router.get("/user/{user_id}")
async def get_user_applications(user_id: str):
    """Retrieve all applications submitted by a candidate to show Give Interview status."""
    db = get_db()
    query = {"$or": [{"applicantUid": user_id}, {"applicantEmail": {"$regex": f"^{user_id}$", "$options": "i"}}]}
    apps = await db.applications.find(query).sort("appliedAt", -1).to_list(length=200)
    return serialize_docs(apps)

@router.post("/{app_id}/report")
async def save_application_report(app_id: str, req: SaveReportRequest):
    """Persist interview evaluation report and match score into MongoDB."""
    db = get_db()
    try:
        obj_id = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid application ID")

    rep = req.report or {}
    match_score = req.matchScore if req.matchScore is not None else rep.get("overall_match_percentage", 0)
    tech_score = req.technicalScore if req.technicalScore is not None else rep.get("technical_score", 0)
    comm_score = req.communicationScore if req.communicationScore is not None else rep.get("communication_score", 0)
    rec = req.recommendation or rep.get("final_recommendation", "Consider")

    update_fields = {
        "status": "Completed",
        "report": rep,
        "score": match_score,
        "matchScore": match_score,
        "technicalScore": tech_score,
        "communicationScore": comm_score,
        "recommendation": rec,
        "interviewCompletedAt": datetime.utcnow()
    }

    await db.applications.update_one({"_id": obj_id}, {"$set": update_fields})
    updated = await db.applications.find_one({"_id": obj_id})
    return serialize_doc(updated)

@router.get("/{app_id}")
async def get_application(app_id: str):
    db = get_db()
    try:
        obj_id = ObjectId(app_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid application ID")

    app = await db.applications.find_one({"_id": obj_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    resume = None
    if app.get("applicantEmail"):
        resume = await db.resumes.find_one({"userId": {"$regex": f"^{app['applicantEmail']}$", "$options": "i"}})

    candidate_data = {
        "id": str(app["_id"]),
        "name": app.get("applicantName"),
        "role": app.get("jobTitle"),
        "company": app.get("company", ""),
        "status": app.get("status"),
        "applied": app.get("appliedAt").strftime("%m/%d/%Y") if isinstance(app.get("appliedAt"), datetime) else str(app.get("appliedAt", "")),
        "score": app.get("matchScore", app.get("score", 0)),
        "matchScore": app.get("matchScore", app.get("score", 0)),
        "technicalScore": app.get("technicalScore", 0),
        "communicationScore": app.get("communicationScore", 0),
        "recommendation": app.get("recommendation", "Pending"),
        "report": app.get("report"),
        "feedback": app.get("coverNote") or "Application submitted.",
        "email": app.get("applicantEmail"),
        "resumeData": serialize_doc(resume) if resume else None
    }
    return candidate_data

