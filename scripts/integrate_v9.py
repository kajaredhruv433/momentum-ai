import os
import re

V9_BACKEND = r"C:\Users\dhruv\Music\Skill\EchoSphere\v9\backend"
V9_FRONTEND = r"C:\Users\dhruv\Music\Skill\EchoSphere\v9\frontend"

# 1. Update schemas.py
schemas_path = os.path.join(V9_BACKEND, "schemas.py")
with open(schemas_path, "r", encoding="utf-8") as f:
    schemas_content = f.read()

target_create_req = """class CreateInterviewRequest(BaseModel):
    company_details: CompanyDetails
    resume_text: str = Field(..., min_length=20, description="Raw text of the candidate's resume")
    base_time: Optional[int] = Field(1800, description="Base interview duration in seconds (default: 30m)")
    extended_time: Optional[int] = Field(2700, description="Extended interview threshold in seconds (default: 45m)")"""

new_create_req = """class CreateInterviewRequest(BaseModel):
    company_details: CompanyDetails
    resume_text: str = Field(..., min_length=20, description="Raw text of the candidate's resume")
    base_time: Optional[int] = Field(1800, description="Base interview duration in seconds (default: 30m)")
    extended_time: Optional[int] = Field(2700, description="Extended interview threshold in seconds (default: 45m)")
    job_id: Optional[str] = Field(None, description="Optional linked job ID from MongoDB")
    candidate_id: Optional[str] = Field(None, description="Optional candidate UID")
    candidate_email: Optional[str] = Field(None, description="Optional candidate email")
    application_id: Optional[str] = Field(None, description="Optional linked application ID from MongoDB")"""

if target_create_req in schemas_content:
    schemas_content = schemas_content.replace(target_create_req, new_create_req)
    with open(schemas_path, "w", encoding="utf-8") as f:
        f.write(schemas_content)
    print("Updated schemas.py successfully")
else:
    print("CreateInterviewRequest target not found in schemas.py (might already be updated)")

# 2. Update interview_controller.py
ctrl_path = os.path.join(V9_BACKEND, "interview_controller.py")
with open(ctrl_path, "r", encoding="utf-8") as f:
    ctrl_content = f.read()

# Update start signature and state in interview_controller.py
start_def_target = """    def start(
        self,
        company_details: Dict[str, Any],
        resume_text: str,
        base_time: int = 1800,
        extended_time: int = 2700,
    ) -> Dict[str, Any]:"""

start_def_new = """    def start(
        self,
        company_details: Dict[str, Any],
        resume_text: str,
        base_time: int = 1800,
        extended_time: int = 2700,
        job_id: Optional[str] = None,
        candidate_id: Optional[str] = None,
        candidate_email: Optional[str] = None,
        application_id: Optional[str] = None,
    ) -> Dict[str, Any]:"""

if start_def_target in ctrl_content:
    ctrl_content = ctrl_content.replace(start_def_target, start_def_new)

# In start(), store the metadata in state
state_init_target = """        # 6. Initialize State Machine and Persist
        state = {
            "interview_id": interview_id,
            "status": "in_progress",
            "stage": NORMAL,"""

state_init_new = """        # 6. Initialize State Machine and Persist
        state = {
            "interview_id": interview_id,
            "job_id": job_id,
            "candidate_id": candidate_id,
            "candidate_email": candidate_email,
            "application_id": application_id,
            "status": "in_progress",
            "stage": NORMAL,"""

if state_init_target in ctrl_content:
    ctrl_content = ctrl_content.replace(state_init_target, state_init_new)

# In on_closing_speech_finished(), persist report to MongoDB momentum
report_mongo_target = """        try:
            mongo.save_interview_event(interview_id, "interview_completed", {"report": report_data})
        except Exception as exc:
            logger.warning("MongoDB save interview event warning: %s", exc)"""

report_mongo_new = """        try:
            mongo.save_interview_event(interview_id, "interview_completed", {"report": report_data})
        except Exception as exc:
            logger.warning("MongoDB save interview event warning: %s", exc)

        # Save comprehensive report to Momentum MongoDB database (applications and interview_sessions)
        try:
            import pymongo
            from bson import ObjectId
            from datetime import datetime, timezone
            _mclient = pymongo.MongoClient("mongodb://localhost:27017")
            _mdb = _mclient["momentum"]

            app_id = state.get("application_id")
            j_id = state.get("job_id")
            c_email = state.get("candidate_email")
            c_id = state.get("candidate_id")

            m_score = report_data.get("overall_match_percentage", 0)
            t_score = report_data.get("technical_score", 0)
            comm_score = report_data.get("communication_score", 0)
            p_score = report_data.get("problem_solving_score", 0)
            h_rec = report_data.get("final_recommendation", "Consider")

            app_update = {
                "status": "Completed",
                "report": report_data,
                "score": m_score,
                "matchScore": m_score,
                "technicalScore": t_score,
                "communicationScore": comm_score,
                "problemSolvingScore": p_score,
                "recommendation": h_rec,
                "interviewCompletedAt": datetime.now(timezone.utc)
            }

            if app_id:
                try:
                    _mdb["applications"].update_one({"_id": ObjectId(app_id)}, {"$set": app_update})
                    logger.info("Updated application %s with interview report in momentum DB", app_id)
                except Exception as ex:
                    logger.warning("Could not update app by ObjectId: %s", ex)

            if j_id and (c_id or c_email):
                q = {}
                try:
                    q["jobId"] = ObjectId(j_id)
                except Exception:
                    q["jobId"] = j_id
                if c_id and c_email:
                    q["$or"] = [{"applicantUid": c_id}, {"applicantEmail": c_email}]
                elif c_id:
                    q["applicantUid"] = c_id
                else:
                    q["applicantEmail"] = c_email
                _mdb["applications"].update_one(q, {"$set": app_update})

            _mdb["interview_sessions"].update_one(
                {"_id": interview_id},
                {"$set": {
                    "interview_id": interview_id,
                    "job_id": j_id,
                    "candidate_id": c_id,
                    "candidate_email": c_email,
                    "application_id": app_id,
                    "report": report_data,
                    "matchScore": m_score,
                    "score": m_score,
                    "recommendation": h_rec,
                    "completedAt": datetime.now(timezone.utc)
                }},
                upsert=True
            )
            logger.info("Persisted interview session and report to momentum.interview_sessions")
        except Exception as exc:
            logger.exception("Error saving report to Momentum MongoDB: %s", exc)"""

if report_mongo_target in ctrl_content:
    ctrl_content = ctrl_content.replace(report_mongo_target, report_mongo_new)
    with open(ctrl_path, "w", encoding="utf-8") as f:
        f.write(ctrl_content)
    print("Updated interview_controller.py successfully")
else:
    print("report_mongo_target not found in interview_controller.py")

# 3. Update api/interview.py
interview_api_path = os.path.join(V9_BACKEND, "api", "interview.py")
with open(interview_api_path, "r", encoding="utf-8") as f:
    api_content = f.read()

# Update create_and_start_interview call
ctrl_call_target = """    return _handle_call(
        controller.start,
        company_details=company_dict,
        resume_text=request.resume_text,
        base_time=request.base_time,
        extended_time=request.extended_time,
    )"""

ctrl_call_new = """    return _handle_call(
        controller.start,
        company_details=company_dict,
        resume_text=request.resume_text,
        base_time=request.base_time,
        extended_time=request.extended_time,
        job_id=getattr(request, "job_id", None),
        candidate_id=getattr(request, "candidate_id", None),
        candidate_email=getattr(request, "candidate_email", None),
        application_id=getattr(request, "application_id", None),
    )"""

if ctrl_call_target in api_content:
    api_content = api_content.replace(ctrl_call_target, ctrl_call_new)

# Add session-data endpoint in api/interview.py if not already present
session_data_endpoint = '''
# ============================================================================
# FETCH SESSION DATA FROM MONGO DB (JOB REQUIREMENTS & CANDIDATE RESUME)
# ============================================================================

def _format_resume_document_to_text(doc: dict) -> str:
    if not doc:
        return "Candidate Profile: Experienced Software Engineering Candidate."
    parts = []
    personal = doc.get("personal", {})
    name = personal.get("fullName") or personal.get("name") or "Candidate"
    email = personal.get("email") or doc.get("userId") or ""
    phone = personal.get("phone", "")
    location = personal.get("location", "")
    linkedin = personal.get("linkedin", "")
    role = personal.get("role", "")
    summary = personal.get("summary", "")

    parts.append(f"{name.upper()}")
    contact = []
    if email: contact.append(f"Email: {email}")
    if phone: contact.append(f"Phone: {phone}")
    if location: contact.append(f"Location: {location}")
    if linkedin: contact.append(f"LinkedIn: {linkedin}")
    if contact:
        parts.append(" | ".join(contact))

    if summary:
        parts.append(f"\\nSUMMARY\\n{summary}")
    elif role:
        parts.append(f"\\nSUMMARY\\nDedicated {role} with proven engineering experience.")

    skills = doc.get("skills", "")
    if isinstance(skills, list):
        skills = ", ".join(skills)
    if skills:
        parts.append(f"\\nSKILLS\\n{skills}")

    experience = doc.get("experience", [])
    if experience and isinstance(experience, list):
        parts.append("\\nEXPERIENCE")
        for exp in experience:
            if isinstance(exp, dict):
                comp = exp.get("company", "")
                r = exp.get("role", "")
                dur = exp.get("duration", "")
                det = exp.get("details", "")
                parts.append(f"- {r} at {comp} ({dur})\\n  {det}")

    projects = doc.get("projects", [])
    if projects and isinstance(projects, list):
        parts.append("\\nPROJECTS")
        for p in projects:
            if isinstance(p, dict):
                pname = p.get("name", "")
                ptech = p.get("tech", "")
                pdesc = p.get("description", "")
                parts.append(f"- {pname} (Tech: {ptech})\\n  {pdesc}")

    education = doc.get("education", [])
    if education and isinstance(education, list):
        parts.append("\\nEDUCATION")
        for edu in education:
            if isinstance(edu, dict):
                sch = edu.get("school", "")
                deg = edu.get("degree", "")
                yr = edu.get("year", "")
                pct = edu.get("percentage", "")
                parts.append(f"- {deg} - {sch} ({yr}) {pct}")

    achievements = doc.get("achievements", [])
    if achievements and isinstance(achievements, list):
        parts.append("\\nACHIEVEMENTS")
        for ach in achievements:
            if isinstance(ach, dict):
                t = ach.get("title", "")
                d = ach.get("description", "")
                parts.append(f"- {t}: {d}")

    text = "\\n".join(parts).strip()
    return text if len(text) >= 20 else f"{name} - Software Engineering Candidate with technical development and architecture experience."


def _format_job_document_to_company_details(job: dict) -> dict:
    skills = job.get("skillsRequired", [])
    if isinstance(skills, list):
        skills_str = ", ".join(skills)
    else:
        skills_str = str(skills or "Software Engineering, Problem Solving, Architecture, System Design")

    return {
        "company_name": job.get("company") or "Momentum Partner",
        "role": job.get("roleRequired") or job.get("title") or "Software Engineer",
        "required_skills": skills_str or "Full Stack, Problem Solving, Clean Code",
        "required_experience": job.get("experience") or "2-4 years",
        "required_qualification": job.get("qualification") or "B.Tech / B.E. in Computer Science or equivalent",
        "salary": job.get("salary") or "Competitive",
        "role_description": job.get("description") or "Collaborate with cross-functional teams to design, build, test, and deploy resilient software applications.",
        "employee_qualities": job.get("employeeQualities") or "Ownership, analytical thinking, technical communication, adaptability"
    }


@router.get("/interview/session-data")
def get_interview_session_data(
    jobId: Optional[str] = None,
    candidateId: Optional[str] = None,
    candidateEmail: Optional[str] = None,
    applicationId: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch job requirements and candidate resume from MongoDB to start the interview automatically.
    """
    import pymongo
    from bson import ObjectId

    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["momentum"]

    job_doc = None
    app_doc = None

    if applicationId:
        try:
            app_doc = db["applications"].find_one({"_id": ObjectId(applicationId)})
            if app_doc:
                if not jobId and app_doc.get("jobId"):
                    jobId = str(app_doc["jobId"])
                if not candidateEmail and app_doc.get("applicantEmail"):
                    candidateEmail = app_doc["applicantEmail"]
                if not candidateId and app_doc.get("applicantUid"):
                    candidateId = app_doc["applicantUid"]
        except Exception:
            pass

    if jobId:
        try:
            job_doc = db["jobs"].find_one({"_id": ObjectId(jobId)})
        except Exception:
            try:
                job_doc = db["jobs"].find_one({"_id": jobId})
            except Exception:
                pass

    company_details = _format_job_document_to_company_details(job_doc or {})

    resume_doc = None
    if candidateEmail:
        resume_doc = db["resumes"].find_one({"userId": {"$regex": f"^{candidateEmail}$", "$options": "i"}})
    if not resume_doc and candidateId:
        resume_doc = db["resumes"].find_one({"uid": candidateId})
    if not resume_doc and candidateEmail:
        resume_doc = db["users"].find_one({"email": {"$regex": f"^{candidateEmail}$", "$options": "i"}})
    if not resume_doc and app_doc:
        resume_doc = {"personal": {"fullName": app_doc.get("applicantName", "Candidate"), "email": app_doc.get("applicantEmail", "")}}

    resume_text = _format_resume_document_to_text(resume_doc or {})

    return {
        "company_details": company_details,
        "resume_text": resume_text,
        "candidate_name": (resume_doc.get("personal", {}).get("fullName") if resume_doc else None) or (app_doc.get("applicantName") if app_doc else "Candidate"),
        "job_id": jobId,
        "candidate_id": candidateId,
        "candidate_email": candidateEmail,
        "application_id": applicationId or (str(app_doc["_id"]) if app_doc else None)
    }
'''

if "/interview/session-data" not in api_content:
    api_content = api_content + "\n" + session_data_endpoint
    with open(interview_api_path, "w", encoding="utf-8") as f:
        f.write(api_content)
    print("Updated api/interview.py successfully")
else:
    print("/interview/session-data already present in api/interview.py")

print("Backend updates complete!")
