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

