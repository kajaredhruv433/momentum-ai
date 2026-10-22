from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, timedelta
from bson import ObjectId
from backend.database import get_db, serialize_doc, serialize_docs

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


async def _mongo_text_search(db, query: str, limit: int):
    """Search and rank jobs directly from MongoDB fields."""
    import re

    stop_words = {"the", "and", "for", "with", "from", "that", "this", "are", "you", "your",
                  "have", "has", "will", "our", "job", "role", "skills", "experience", "years",
                  "resume", "summary", "education", "company", "candidate", "looking", "work"}
    tokens = {word for word in re.findall(r"[a-z0-9+#.]{2,}", query.lower())
              if word not in stop_words}
    docs = await db.jobs.find({}).sort("postedAt", -1).to_list(length=500)
    ranked = []
    for doc in docs:
        skills = doc.get("skillsRequired") or []
        if isinstance(skills, str):
            skills = [item.strip() for item in skills.split(",")]
        title_text = f"{doc.get('title', '')} {doc.get('roleRequired', '')}".lower()
        skill_text = " ".join(map(str, skills)).lower()
        body = " ".join(str(doc.get(key, "")) for key in (
            "description", "experience", "qualification", "employeeQualities", "location", "type"
        )).lower()
        score = sum(3 for token in tokens if token in title_text)
        score += sum(2 for token in tokens if token in skill_text)
        score += sum(1 for token in tokens if token in body)
        if score:
            ranked.append((score, doc))
    ranked.sort(key=lambda item: (item[0], item[1].get("postedAt") or datetime.min), reverse=True)
    result = serialize_docs([doc for _, doc in ranked[:limit]])
    for (score, _), job in zip(ranked[:limit], result):
        job["relevanceScore"] = score
    return result

class CreateJobRequest(BaseModel):
    title: Optional[str] = ""
    roleRequired: Optional[str] = ""
    description: Optional[str] = ""
    location: Optional[str] = "Remote"
    type: Optional[str] = "Full-time"
    salary: Optional[str] = "Competitive"
    company: Optional[str] = None
    skillsRequired: Optional[Any] = []
    experience: Optional[str] = ""
    qualification: Optional[str] = ""
    employeeQualities: Optional[str] = ""
    roleDocument: Optional[Any] = None
    recruiterUid: Optional[str] = None
    recruiterEmail: Optional[str] = None
    uid: Optional[str] = None
    email: Optional[str] = None
    interviewConfig: Optional[dict] = None

class JobSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    limit: int = Field(default=20, ge=1, le=50)
    resumeText: Optional[str] = Field(default=None, max_length=20000)

@router.get("")
async def list_jobs(recruiterUid: Optional[str] = Query(None)):
    db = get_db()
    query = {}
    if recruiterUid:
        query["recruiterUid"] = recruiterUid

    cursor = db.jobs.find(query).sort("postedAt", -1)
    jobs = await cursor.to_list(length=500)
    serialized = serialize_docs(jobs)

    seen_ids = set()
    deduped = []
    for j in serialized:
        jid = str(j.get("id") or j.get("_id") or "")
        if jid and jid not in seen_ids and (j.get("title") or j.get("roleRequired")):
            seen_ids.add(jid)
            deduped.append(j)

    return deduped

@router.post("/search")
async def semantic_job_search(req: JobSearchRequest):
    db = get_db()
    return await _mongo_text_search(db, req.query, req.limit)

@router.post("", status_code=201)
async def create_job(req: CreateJobRequest):
    db = get_db()

    skills = req.skillsRequired
    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]
    elif not isinstance(skills, list):
        skills = []

    r_uid = req.recruiterUid or req.uid or "default_recruiter"
    r_email = req.recruiterEmail or req.email or "recruiter@momentum.ai"
    title = req.title or req.roleRequired or "Job Title"

    company_name = req.company or "Momentum AI"
    if r_uid and company_name == "Momentum AI":
        user = await db.users.find_one({"firebaseUid": r_uid})
        if user and user.get("companyName"):
            company_name = user["companyName"]

    new_job = {
        "title": title,
        "roleRequired": req.roleRequired or title,
        "description": req.description or "",
        "location": req.location or "Remote",
        "type": req.type or "Full-time",
        "salary": req.salary or "Competitive",
        "company": company_name,
        "skillsRequired": skills,
        "experience": req.experience or "",
        "qualification": req.qualification or "",
        "employeeQualities": req.employeeQualities or "",
        "roleDocument": req.roleDocument,
        "recruiterUid": r_uid,
        "recruiterEmail": r_email,
        "postedAt": datetime.utcnow(),
        "counter": 0,
        "applicants": [],
        "interviewConfig": req.interviewConfig or {}
    }

    result = await db.jobs.insert_one(new_job)
    new_job["_id"] = result.inserted_id
    return serialize_doc(new_job)

@router.get("/{job_id}")
async def get_job_by_id(job_id: str):
    db = get_db()
    try:
        obj_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    job = await db.jobs.find_one({"_id": obj_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return serialize_doc(job)

@router.api_route("/{job_id}/interview", methods=["PUT", "POST"])

async def configure_job_interview(job_id: str, request: Request):
    db = get_db()
    try:
        obj_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    body = await request.json()
    interview_config = body.get("interviewConfig", {})

    if interview_config.get("type") == "video" and interview_config.get("scheduleConfig"):
        sched = interview_config["scheduleConfig"]
        start_date_str = sched.get("startDate")
        end_date_str = sched.get("endDate")
        start_time_str = sched.get("startTime", "09:00")
        end_time_str = sched.get("endTime", "17:00")
        duration = interview_config.get("duration", 30)

        applications = await db.applications.find({
            "jobId": obj_id,
            "status": {"$in": ["Applied", "Screening", "Interviewing"]}
        }).to_list(length=100)

        slots = []
        app_idx = 0
        try:
            start = datetime.fromisoformat(start_date_str.replace("Z", "+00:00")).date()
            end = datetime.fromisoformat(end_date_str.replace("Z", "+00:00")).date()

            curr_date = start
            while curr_date <= end and app_idx < len(applications):
                start_h, start_m = map(int, start_time_str.split(":"))
                end_h, end_m = map(int, end_time_str.split(":"))

                slot_time = datetime.combine(curr_date, datetime.min.time()).replace(hour=start_h, minute=start_m)
                day_end = datetime.combine(curr_date, datetime.min.time()).replace(hour=end_h, minute=end_m)

                while slot_time + timedelta(minutes=duration) <= day_end and app_idx < len(applications):
                    app = applications[app_idx]
                    date_formatted = curr_date.isoformat()
                    time_formatted = slot_time.strftime("%H:%M")

                    slots.append({
                        "date": date_formatted,
                        "time": time_formatted,
                        "isBooked": True,
                        "candidateId": app.get("applicantUid"),
                        "applicationId": str(app["_id"])
                    })

                    await db.applications.update_one(
                        {"_id": app["_id"]},
                        {"$set": {"status": "Interviewing"}}
                    )

                    app_idx += 1
                    slot_time += timedelta(minutes=duration + 10)

                curr_date += timedelta(days=1)
        except Exception as e:
            print("Slot scheduling calculation error:", e)

        interview_config["slots"] = slots

    await db.jobs.update_one(
        {"_id": obj_id},
        {"$set": {"interviewConfig": interview_config}}
    )

    updated_job = await db.jobs.find_one({"_id": obj_id})
    return serialize_doc(updated_job)
