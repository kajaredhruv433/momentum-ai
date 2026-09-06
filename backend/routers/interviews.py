from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.database import get_db, serialize_doc, serialize_docs
from backend.services.gemini_service import (
    generate_interview_questions,
    evaluate_interview_report
)

router = APIRouter(tags=["interviews"])

class GenerateQuestionsRequest(BaseModel):
    topic: str
    difficulty: Optional[str] = "Medium"

class InterviewReportRequest(BaseModel):
    topic: str
    difficulty: Optional[str] = "Medium"
    questions: List[str]
    answers: List[str]
    violations: Optional[int] = 0

class CreateSessionRequest(BaseModel):
    userId: str
    topic: str
    difficulty: str

@router.post("/api/interview/generate")
async def generate_questions(req: GenerateQuestionsRequest):
    questions = await generate_interview_questions(req.topic, req.difficulty)
    return {"questions": questions}

@router.post("/api/interview/report")
async def create_interview_report(req: InterviewReportRequest):
    report = await evaluate_interview_report(
        req.topic,
        req.difficulty,
        req.questions,
        req.answers,
        req.violations or 0
    )
    return report

@router.post("/api/interview/create")
async def create_session(req: CreateSessionRequest):
    db = get_db()
    session_doc = {
        "userId": req.userId,
        "topic": req.topic,
        "difficulty": req.difficulty,
        "createdAt": datetime.utcnow(),
        "status": "in-progress"
    }
    result = await db.interview_sessions.insert_one(session_doc)
    return {
        "message": "Interview session created",
        "sessionId": str(result.inserted_id)
    }

@router.get("/api/interviews/recent")
async def get_recent_interviews(email: Optional[str] = Query(None)):
    db = get_db()
    query = {}
    if email:
        query["userId"] = {"$regex": f"^{email}$", "$options": "i"}

    # Fetch recent completed interviews or any with reports
    sessions = await db.interview_sessions.find(query).sort("createdAt", -1).to_list(length=10)
    return {"interviews": serialize_docs(sessions)}
