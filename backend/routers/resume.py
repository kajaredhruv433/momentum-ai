from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from datetime import datetime
from backend.database import get_db, serialize_doc

router = APIRouter(prefix="/api/resume", tags=["resume"])

@router.get("")
async def get_resume(email: Optional[str] = Query(None), uid: Optional[str] = Query(None)):
    if not email and not uid:
        raise HTTPException(status_code=400, detail="Email or UID is required")

    db = get_db()
    query = {}
    if email and uid:
        query["$or"] = [{"userId": {"$regex": f"^{email}$", "$options": "i"}}, {"uid": uid}]
    elif email:
        query["userId"] = {"$regex": f"^{email}$", "$options": "i"}
    else:
        query["uid"] = uid

    resume = await db.resumes.find_one(query)
    if not resume:
        return {"success": True, "data": None}

    return {"success": True, "data": serialize_doc(resume)}

@router.post("")
async def save_resume(request: Request):
    data = await request.json()
    user_email = data.get("personal", {}).get("email") or data.get("userId")
    uid = data.get("uid")

    if not user_email and not uid:
        raise HTTPException(status_code=400, detail="User email or UID required")

    db = get_db()

    update_fields = dict(data)
    if user_email:
        update_fields["userId"] = user_email
    if uid:
        update_fields["uid"] = uid
    update_fields["updatedAt"] = datetime.utcnow()

    query = {}
    if user_email and uid:
        query["$or"] = [{"userId": {"$regex": f"^{user_email}$", "$options": "i"}}, {"uid": uid}]
    elif user_email:
        query["userId"] = {"$regex": f"^{user_email}$", "$options": "i"}
    else:
        query["uid"] = uid

    await db.resumes.update_one(
        query,
        {"$set": update_fields},
        upsert=True
    )

    saved_doc = await db.resumes.find_one(query)
    return {"success": True, "data": serialize_doc(saved_doc)}

@router.post("/save")
async def save_resume_candidate(request: Request):
    data = await request.json()
    personal = data.get("personal", {})
    role = personal.get("role") or "Software Engineer"
    target_company = personal.get("targetCompany") or "General"
    name = personal.get("fullName") or "Candidate"

    candidate_entry = {
        "name": name,
        "role": role,
        "targetCompany": target_company,
        "applied": datetime.utcnow(),
        "score": 0,
        "status": "Ready for Interview",
        "skills": data.get("skills", ""),
        "summary": personal.get("summary", ""),
        "feedback": "Resume updated and saved.",
        "resumeData": data
    }

    db = get_db()
    await db.candidates.update_one(
        {"name": name},
        {"$set": candidate_entry},
        upsert=True
    )

    return {"success": True, "data": candidate_entry}


@router.post("/analyze")
async def analyze_candidate_resume(request: Request):
    """
    Analyzes resume data with AI via ask_llm from backend/interviewer/otheragent.py
    and saves the analysis to database.
    """
    from backend.candidate.resume_analyser.resume_analyser import analyze_resume

    data = await request.json()
    resume_payload = data.get("resumeData") or data
    email = data.get("email") or resume_payload.get("personal", {}).get("email") or resume_payload.get("userId")
    uid = data.get("uid") or resume_payload.get("uid")
    target_role = data.get("targetRole") or resume_payload.get("personal", {}).get("role")
    target_company = data.get("targetCompany") or resume_payload.get("personal", {}).get("targetCompany")

    db = get_db()

    # If resume_payload has no experience/education, try fetching existing from DB
    if not resume_payload.get("experience") and not resume_payload.get("skills") and (email or uid):
        query = {}
        if email and uid:
            query["$or"] = [{"userId": {"$regex": f"^{email}$", "$options": "i"}}, {"uid": uid}]
        elif email:
            query["userId"] = {"$regex": f"^{email}$", "$options": "i"}
        else:
            query["uid"] = uid
        found = await db.resumes.find_one(query)
        if found:
            resume_payload = found

    analysis_res = analyze_resume(
        resume_data=resume_payload,
        target_role=target_role,
        target_company=target_company
    )

    # Save to db if user identifier exists
    if email or uid:
        query = {}
        if email and uid:
            query["$or"] = [{"userId": {"$regex": f"^{email}$", "$options": "i"}}, {"uid": uid}]
        elif email:
            query["userId"] = {"$regex": f"^{email}$", "$options": "i"}
        else:
            query["uid"] = uid

        await db.resumes.update_one(
            query,
            {"$set": {"analysis": analysis_res, "analyzedAt": datetime.utcnow()}},
            upsert=False
        )

        name = resume_payload.get("personal", {}).get("fullName")
        if name:
            await db.candidates.update_one(
                {"name": name},
                {"$set": {
                    "score": analysis_res.get("score", 0),
                    "feedback": analysis_res.get("feedback", ""),
                    "status": analysis_res.get("status", "Ready for Interview")
                }},
                upsert=False
            )

    return {"success": True, "analysis": analysis_res}


