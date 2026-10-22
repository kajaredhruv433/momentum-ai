"""
Resume Analyser Module for Momentum Candidate Platform.
Analyzes resumes using AI via ask_llm from backend/interviewer/llm.py.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

try:
    from backend.interviewer.llm import ask_llm
except ImportError:
    from interviewer.llm import ask_llm

from backend.database import get_db, serialize_doc

router = APIRouter(prefix="/api/candidate/resume-analyser", tags=["candidate-resume-analyser"])


def _extract_json(text: str) -> Any:
    """Extract and parse JSON safely from LLM output."""
    if not text:
        return None
    cleaned = text.strip()

    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1]
        cleaned = cleaned.split("```", 1)[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1]
        cleaned = cleaned.split("```", 1)[0]

    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    object_match = re.search(r'\{[\s\S]*\}', cleaned)
    if object_match:
        try:
            return json.loads(object_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _default_analysis(resume_data: Dict[str, Any], target_role: str) -> Dict[str, Any]:
    """Fallback analysis if LLM is unavailable or fails."""
    personal = resume_data.get("personal", {})
    name = personal.get("fullName") or "Candidate"
    skills_raw = resume_data.get("skills") or ""
    skills_count = len([s for s in skills_raw.split(",") if s.strip()])
    exp_count = len(resume_data.get("experience", []))
    proj_count = len(resume_data.get("projects", []))

    base_score = min(92, max(60, 50 + (exp_count * 10) + (proj_count * 5) + min(15, skills_count * 2)))

    return {
        "score": base_score,
        "status": "Ready for Interview" if base_score >= 70 else "Needs Enhancement",
        "feedback": f"Strong baseline profile for {target_role}. Demonstrated experience across {exp_count} role(s) and {proj_count} project(s). Recommended to add quantifiable impact metrics.",
        "strengths": [
            f"Demonstrated project portfolio with practical applications in {target_role}",
            "Solid core technical and problem-solving foundational skill set",
            "Clear timeline and structured professional educational history"
        ],
        "improvements": [
            "Incorporate quantifiable business impact metrics (e.g. latency reductions, scale, % improvements)",
            "Deepen architectural system design explanations in recent project summaries",
            "Highlight specialized tooling and modern production infrastructure experience"
        ],
        "skills_identified": [s.strip() for s in skills_raw.split(",") if s.strip()] or ["Problem Solving", "Software Engineering"],
        "radar_scores": {
            "core_skills": min(100, base_score + 5),
            "system_design": max(40, base_score - 10),
            "domain_fit": base_score,
            "problem_solving": min(95, base_score + 8),
            "communication": min(90, base_score + 4)
        },
        "market_readiness": {
            "frontend": min(100, base_score + 8),
            "backend": base_score,
            "full_stack": min(95, base_score + 5),
            "devops": max(35, base_score - 15)
        }
    }


def analyze_resume(
    resume_data: Dict[str, Any],
    target_role: Optional[str] = None,
    target_company: Optional[str] = None
) -> Dict[str, Any]:
    """
    Perform deep AI analysis of candidate resume using ask_llm from backend/interviewer/llm.py.
    """
    personal = resume_data.get("personal", {})
    role = target_role or personal.get("role") or "Software Engineer"
    company = target_company or personal.get("targetCompany") or "Top Technology Firms"

    # Assemble summary string of resume for LLM
    education = resume_data.get("education", [])
    experience = resume_data.get("experience", [])
    projects = resume_data.get("projects", [])
    skills = resume_data.get("skills", "")
    summary = personal.get("summary", "")

    prompt = f"""You are a Principal Technical Recruiter and AI Talent Assessor at {company}.
Evaluate this candidate resume specifically for the target role: "{role}".

--- CANDIDATE RESUME ---
Full Name: {personal.get("fullName", "Candidate")}
Target Role: {role}
Target Company: {company}
Summary: {summary}
Skills: {skills}

Experience:
{json.dumps(experience, indent=2)}

Education:
{json.dumps(education, indent=2)}

Projects:
{json.dumps(projects, indent=2)}
------------------------

Perform an in-depth, rigorous evaluation. Return STRICT JSON with this exact structure:
{{
  "score": <integer 0 to 100 representing overall ATS and job readiness score>,
  "status": "Ready for Interview" | "Strong Match" | "Needs Enhancement" | "Exceptional",
  "feedback": "<2-3 paragraph insightful assessment of strengths, candidate alignment, and actionable career guidance>",
  "strengths": [
    "<Key strength 1>",
    "<Key strength 2>",
    "<Key strength 3>"
  ],
  "improvements": [
    "<Actionable area of improvement 1>",
    "<Actionable area of improvement 2>",
    "<Actionable area of improvement 3>"
  ],
  "skills_identified": [
    "<List of technical skills extracted and validated from profile>"
  ],
  "radar_scores": {{
    "core_skills": <integer 0-100>,
    "system_design": <integer 0-100>,
    "domain_fit": <integer 0-100>,
    "problem_solving": <integer 0-100>,
    "communication": <integer 0-100>
  }},
  "market_readiness": {{
    "frontend": <integer 0-100>,
    "backend": <integer 0-100>,
    "full_stack": <integer 0-100>,
    "devops": <integer 0-100>
  }}
}}
Return ONLY the JSON object. Do not include markdown preamble.
"""

    try:
        raw_response = ask_llm(prompt=prompt, max_output_tokens=3000)
        parsed = _extract_json(raw_response)

        if isinstance(parsed, dict) and "score" in parsed and "feedback" in parsed:
            score = parsed.get("score")
            try:
                score = int(score)
            except (ValueError, TypeError):
                score = 75

            # Ensure radar and market readiness are present
            radar = parsed.get("radar_scores") or {}
            market = parsed.get("market_readiness") or {}

            return {
                "score": score,
                "status": parsed.get("status") or ("Ready for Interview" if score >= 70 else "Needs Enhancement"),
                "feedback": parsed.get("feedback") or "Profile reviewed successfully.",
                "strengths": parsed.get("strengths") or ["Strong technical foundation"],
                "improvements": parsed.get("improvements") or ["Add quantified achievements"],
                "skills_identified": parsed.get("skills_identified") or [s.strip() for s in str(skills).split(",") if s.strip()],
                "radar_scores": {
                    "core_skills": int(radar.get("core_skills", min(100, score + 5))),
                    "system_design": int(radar.get("system_design", max(40, score - 10))),
                    "domain_fit": int(radar.get("domain_fit", score)),
                    "problem_solving": int(radar.get("problem_solving", min(95, score + 8))),
                    "communication": int(radar.get("communication", min(90, score + 4))),
                },
                "market_readiness": {
                    "frontend": int(market.get("frontend", min(100, score + 8))),
                    "backend": int(market.get("backend", score)),
                    "full_stack": int(market.get("full_stack", min(95, score + 5))),
                    "devops": int(market.get("devops", max(35, score - 15))),
                }
            }
    except Exception as e:
        print(f"[candidate.resume_analyser] Error analyzing resume via ask_llm: {e}")

    return _default_analysis(resume_data, role)


def extract_resume_skills(resume_text_or_dict: Any) -> List[str]:
    """Extract list of skills from resume text or dict using ask_llm."""
    content = json.dumps(resume_text_or_dict) if isinstance(resume_text_or_dict, dict) else str(resume_text_or_dict)
    prompt = f"""Extract all programming languages, frameworks, libraries, developer tools, and technical concepts mentioned in this text:
{content}

Return ONLY a JSON array of strings: ["Python", "FastAPI", "React", ...]
"""
    try:
        res = ask_llm(prompt=prompt, max_output_tokens=1000)
        parsed = _extract_json(res)
        if isinstance(parsed, list):
            return [str(s).strip() for s in parsed if s]
    except Exception as e:
        print(f"[candidate.resume_analyser] extract_resume_skills error: {e}")
    return ["Python", "Problem Solving", "Web Development"]


def suggest_resume_improvements(resume_data: Dict[str, Any]) -> List[str]:
    """Generate prioritized actionable improvements using ask_llm."""
    analysis = analyze_resume(resume_data)
    return analysis.get("improvements", [])


class AnalyzeResumeRequest(BaseModel):
    resumeData: Optional[Dict[str, Any]] = None
    email: Optional[str] = None
    uid: Optional[str] = None
    targetRole: Optional[str] = None
    targetCompany: Optional[str] = None


@router.post("/analyze")
async def api_analyze_resume(req: AnalyzeResumeRequest):
    """
    API endpoint: Analyze resume via ask_llm and persist analysis to database.
    """
    db = get_db()
    data = req.resumeData

    # If resume data not provided directly in body, look up in database
    if not data and (req.email or req.uid):
        query = {}
        if req.email and req.uid:
            query["$or"] = [{"userId": {"$regex": f"^{req.email}$", "$options": "i"}}, {"uid": req.uid}]
        elif req.email:
            query["userId"] = {"$regex": f"^{req.email}$", "$options": "i"}
        else:
            query["uid"] = req.uid

        doc = await db.resumes.find_one(query)
        if doc:
            data = doc

    if not data:
        raise HTTPException(status_code=400, detail="Resume data or valid user email/uid required")

    analysis_result = analyze_resume(
        resume_data=data,
        target_role=req.targetRole,
        target_company=req.targetCompany
    )

    # Persist the analysis onto the resume document in DB if user is identifiable
    user_email = data.get("personal", {}).get("email") or data.get("userId") or req.email
    uid = data.get("uid") or req.uid

    if user_email or uid:
        query = {}
        if user_email and uid:
            query["$or"] = [{"userId": {"$regex": f"^{user_email}$", "$options": "i"}}, {"uid": uid}]
        elif user_email:
            query["userId"] = {"$regex": f"^{user_email}$", "$options": "i"}
        else:
            query["uid"] = uid

        await db.resumes.update_one(
            query,
            {"$set": {"analysis": analysis_result, "analyzedAt": datetime.utcnow()}},
            upsert=False
        )

        # Also update candidate entry
        cand_name = data.get("personal", {}).get("fullName")
        if cand_name:
            await db.candidates.update_one(
                {"name": cand_name},
                {"$set": {
                    "score": analysis_result.get("score", 0),
                    "feedback": analysis_result.get("feedback", ""),
                    "status": analysis_result.get("status", "Ready for Interview")
                }},
                upsert=False
            )

    return {
        "success": True,
        "analysis": analysis_result
    }
