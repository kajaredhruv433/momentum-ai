from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime
from backend.database import get_db, serialize_docs

router = APIRouter(tags=["candidate"])

@router.get("/api/candidate/interviews")
async def get_candidate_interviews(
    applicantUid: Optional[str] = Query(None),
    applicantEmail: Optional[str] = Query(None)
):
    if not applicantUid and not applicantEmail:
        raise HTTPException(status_code=400, detail="Missing applicant identifier (UID or email required)")

    db = get_db()
    query = {}
    if applicantUid and applicantEmail:
        query["$or"] = [{"applicantUid": applicantUid}, {"applicantEmail": applicantEmail}]
    elif applicantUid:
        query["applicantUid"] = applicantUid
    else:
        query["applicantEmail"] = applicantEmail

    applications = await db.applications.find(query).sort("appliedAt", -1).to_list(length=200)

    queue = []
    completed = []

    for app in applications:
        job = None
        if app.get("jobId"):
            job = await db.jobs.find_one({"_id": app["jobId"]})

        is_completed = app.get("status") == "Completed" or app.get("report") is not None

        if is_completed:
            rep = app.get("report") or {}
            completed.append({
                "sessionId": str(app["_id"]),
                "applicationId": str(app["_id"]),
                "jobId": str(job["_id"]) if job else str(app.get("jobId", "")),
                "topic": (job.get("roleRequired") if job else None) or (job.get("title") if job else None) or app.get("jobTitle", "Software Engineer"),
                "company": job.get("company", "Company") if job else app.get("company", "Company"),
                "date": app.get("interviewCompletedAt", app.get("appliedAt")).isoformat() if isinstance(app.get("interviewCompletedAt", app.get("appliedAt")), datetime) else str(app.get("interviewCompletedAt", app.get("appliedAt"))),
                "score": app.get("matchScore", rep.get("overall_match_percentage", 0)),
                "matchScore": app.get("matchScore", rep.get("overall_match_percentage", 0)),
                "technical_score": rep.get("technical_score", 0),
                "communication_score": rep.get("communication_score", 0),
                "problem_solving_score": rep.get("problem_solving_score", 0),
                "recommendation": rep.get("final_recommendation", "Consider"),
                "feedback": rep.get("final_recommendation") or "Interview completed.",
                "report": rep
            })
        else:
            # Active queue - ready to Give Interview
            queue.append({
                "applicationId": str(app["_id"]),
                "jobId": str(job["_id"]) if job else str(app.get("jobId", "")),
                "jobTitle": (job.get("roleRequired") if job else None) or (job.get("title") if job else None) or app.get("jobTitle"),
                "company": job.get("company", "Company") if job else "Company",
                "location": job.get("location", "Remote") if job else "Remote",
                "salary": job.get("salary", "Competitive") if job else "Competitive",
                "jobType": job.get("type", "Full-time") if job else "Full-time",
                "status": "Ready for Interview",
                "topic": (job.get("roleRequired") if job else None) or (job.get("title") if job else None) or app.get("jobTitle"),
                "skillsRequired": job.get("skillsRequired", []) if job else [],
                "appliedAt": app.get("appliedAt").isoformat() if isinstance(app.get("appliedAt"), datetime) else str(app.get("appliedAt", "")),
                "score": 0,
                "matchScore": 0
            })

    return {
        "queue": queue,
        "completed": completed,
        "totalApplied": len(applications)
    }


@router.get("/api/candidates")
async def list_candidates():
    db = get_db()
    candidates = await db.candidates.find({}).to_list(length=200)
    return serialize_docs(candidates)
