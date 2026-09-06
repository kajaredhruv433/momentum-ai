from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from backend.database import get_db, serialize_doc

router = APIRouter(prefix="/api/recruiter", tags=["recruiter"])

class RecruiterApplicantsRequest(BaseModel):
    recruiterUid: str
    jobId: Optional[str] = None

@router.post("/applicants")
async def get_recruiter_applicants(req: RecruiterApplicantsRequest):
    if not req.recruiterUid:
        raise HTTPException(status_code=400, detail="Missing recruiterUid")

    db = get_db()
    
    # Get all jobs posted by this recruiter
    recruiter_jobs = await db.jobs.find({"$or": [{"uid": req.recruiterUid}, {"recruiterUid": req.recruiterUid}]}).to_list(length=500)
    job_ids = [j["_id"] for j in recruiter_jobs]

    if job_ids:
        query = {"$or": [{"recruiterUid": req.recruiterUid}, {"jobId": {"$in": job_ids}}]}
    else:
        query = {"recruiterUid": req.recruiterUid}

    if req.jobId:
        try:
            from bson import ObjectId
            query["jobId"] = ObjectId(req.jobId)
        except Exception:
            pass

    applications = await db.applications.find(query).sort("appliedAt", -1).to_list(length=300)

    candidates = []
    for app in applications:
        applied_date = app.get("appliedAt")
        if isinstance(applied_date, datetime):
            applied_str = applied_date.strftime("%m/%d/%Y")
        else:
            applied_str = str(applied_date or "")

        is_finished = app.get("status") == "Completed" or app.get("report") is not None

        candidates.append({
            "id": str(app["_id"]),
            "applicationId": str(app["_id"]),
            "candidateId": str(app.get("applicantUid") or app.get("candidateId") or ""),
            "interviewId": str(app.get("interviewId") or ""),
            "jobId": str(app.get("jobId", "")),
            "name": app.get("applicantName", "Applicant"),
            "role": app.get("jobTitle", "Candidate"),
            "targetCompany": app.get("company", "Company"),
            "applied": applied_str,
            "score": match_score,
            "matchScore": match_score,
            "technicalScore": app.get("technicalScore", 0),
            "communicationScore": app.get("communicationScore", 0),
            "problemSolvingScore": app.get("problemSolvingScore", 0),
            "recommendation": app.get("recommendation", "Pending"),
            "status": "Completed" if is_finished else app.get("status", "Applied"),
            "interviewFinished": is_finished,
            "report": app.get("report"),
            "feedback": (app.get("report", {}) or {}).get("final_recommendation") or app.get("coverNote") or "Application submitted.",
            "email": app.get("applicantEmail", "")
        })

    return candidates

@router.post("/interviewed-candidates")
async def get_interviewed_candidates(req: RecruiterApplicantsRequest):
    """
    Returns all interviewed candidates arranged in strictly descending order
    of their match score given by the interviewer.
    """
    if not req.recruiterUid:
        raise HTTPException(status_code=400, detail="Missing recruiterUid")

    db = get_db()
    
    # Get all jobs posted by this recruiter
    recruiter_jobs = await db.jobs.find({"$or": [{"uid": req.recruiterUid}, {"recruiterUid": req.recruiterUid}]}).to_list(length=500)
    job_ids = [j["_id"] for j in recruiter_jobs]

    completion_criteria = [
        {"status": "Completed"},
        {"report": {"$ne": None}},
        {"matchScore": {"$gt": 0}}
    ]

    if job_ids:
        query = {
            "$and": [
                {"$or": [{"recruiterUid": req.recruiterUid}, {"jobId": {"$in": job_ids}}]},
                {"$or": completion_criteria}
            ]
        }
    else:
        query = {
            "recruiterUid": req.recruiterUid,
            "$or": completion_criteria
        }

    if req.jobId:
        try:
            from bson import ObjectId
            query["jobId"] = ObjectId(req.jobId)
        except Exception:
            pass

    # Sort in descending order of matchScore
    applications = await db.applications.find(query).sort("matchScore", -1).to_list(length=300)

    candidates = []
    for idx, app in enumerate(applications):
        applied_date = app.get("appliedAt")
        if isinstance(applied_date, datetime):
            applied_str = applied_date.strftime("%m/%d/%Y")
        else:
            applied_str = str(applied_date or "")

        match_score = app.get("matchScore") if app.get("matchScore") is not None else app.get("score", 0)

        candidates.append({
            "rank": idx + 1,
            "id": str(app["_id"]),
            "applicationId": str(app["_id"]),
            "candidateId": str(app.get("applicantUid") or app.get("candidateId") or ""),
            "interviewId": str(app.get("interviewId") or ""),
            "jobId": str(app.get("jobId", "")),
            "name": app.get("applicantName", "Applicant"),
            "role": app.get("jobTitle", "Candidate"),
            "targetCompany": app.get("company", "Company"),
            "applied": applied_str,
            "score": match_score,
            "matchScore": match_score,
            "technicalScore": app.get("technicalScore", 0),
            "communicationScore": app.get("communicationScore", 0),
            "problemSolvingScore": app.get("problemSolvingScore", 0),
            "recommendation": app.get("recommendation", (app.get("report", {}) or {}).get("final_recommendation", "Consider")),
            "status": "Completed",
            "interviewFinished": True,
            "report": app.get("report"),
            "email": app.get("applicantEmail", "")
        })

    # Sort descending just to guarantee absolute ordering
    candidates.sort(key=lambda x: x["matchScore"], reverse=True)
    for idx, c in enumerate(candidates):
        c["rank"] = idx + 1

    return candidates

