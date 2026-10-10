from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from backend.database import get_db, serialize_doc, serialize_docs
from backend.services.code_executor import execute_code
import uuid
from backend.services.gemini_service import get_model, safe_parse_json, GEMINI_API_KEY
from backend.candidate.solve_problem.solve_problem import (
    generate_5_problems,
    get_problem_solution,
    evaluate_candidate_answer as evaluate_candidate_answer_ai,
)
from bson import ObjectId
import json

router = APIRouter(tags=["problems"])

class ExecuteRequest(BaseModel):
    language: str
    code: str
    problemId: Optional[str] = None
    testCases: Optional[list] = []

class EvaluateAnswerRequest(BaseModel):
    problemId: str
    userAnswer: str

class SubmissionRequest(BaseModel):
    problemId: str
    userId: Optional[str] = "default-user"
    code: Optional[str] = None
    language: Optional[str] = None
    answer: Optional[str] = None
    evaluation: Optional[dict] = None
    status: Optional[str] = "Accepted"
    runtime: Optional[float] = 0.0
    memory: Optional[float] = 0.0
    testsPassed: Optional[int] = 0
    testsTotal: Optional[int] = 0

class GenerateProblemRequest(BaseModel):
    topic: str
    type: Optional[str] = "coding"
    userId: Optional[str] = "default-user"

@router.post("/api/generate-problem")
async def generate_problem(req: GenerateProblemRequest):
    if not req.topic:
        raise HTTPException(status_code=400, detail="Topic is required")
    if not req.userId:
        raise HTTPException(status_code=400, detail="User ID is required")

    is_coding = req.type == "coding"
    problems_data = generate_5_problems(req.topic, is_coding)

    db = get_db()
    saved_problems = []
    for p in problems_data:
        p["type"] = "coding" if is_coding else "general"
        p["userId"] = req.userId
        base_slug = p.get("slug") or "problem"
        existing = await db.problems.find_one({"slug": base_slug})
        if existing:
            p["slug"] = f"{base_slug}-{uuid.uuid4().hex[:4]}"
        p["createdAt"] = datetime.utcnow()
        result = await db.problems.insert_one(p)
        p["_id"] = result.inserted_id
        saved_problems.append(serialize_doc(p))

    return {"problems": saved_problems}

@router.get("/api/problems/{id}")
async def get_problem_by_id(id: str):
    db = get_db()
    problem = None
    if ObjectId.is_valid(id):
        problem = await db.problems.find_one({"_id": ObjectId(id)})
    if not problem:
        problem = await db.problems.find_one({"$or": [{"id": id}, {"slug": id}]})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return serialize_doc(problem)

@router.get("/api/problems")
async def list_problems(
    tag: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    userId: Optional[str] = Query(None)
):
    db = get_db()
    query = {}
    if userId:
        query["$or"] = [{"userId": userId}, {"userId": "system"}]
    if tag:
        query["tags"] = {"$in": [tag]}
    if difficulty:
        query["difficulty"] = difficulty
    if type:
        query["type"] = type

    problems = await db.problems.find(query).sort("createdAt", -1).to_list(length=300)
    return serialize_docs(problems)

@router.post("/api/problems")
async def create_problem(request: Request):
    db = get_db()
    body = await request.json()
    result = await db.problems.insert_one(body)
    body["_id"] = result.inserted_id
    return serialize_doc(body)

@router.post("/api/execute")
async def execute_user_code(req: ExecuteRequest):
    res = execute_code(req.language, req.code, req.testCases)
    return res

@router.api_route("/api/solution", methods=["GET", "POST"])
async def get_solution(problemId: Optional[str] = Query(None), language: Optional[str] = Query("python"), request: Request = None):
    db = get_db()
    if request and request.method == "POST":
        try:
            body = await request.json()
            problemId = body.get("problemId") or problemId
            language = body.get("language") or language
        except Exception:
            pass

    if not problemId:
        raise HTTPException(status_code=400, detail="Problem ID is required")

    problem = await db.problems.find_one({"$or": [{"id": problemId}, {"slug": problemId}]})
    title = problem.get("title", problemId) if problem else problemId
    desc = problem.get("description", "") if problem else ""

    solution_text = get_problem_solution(title=title, description=desc, language=language)
    return {"solution": solution_text}

@router.post("/api/evaluate-answer")
async def evaluate_answer(req: EvaluateAnswerRequest):
    db = get_db()
    problem = await db.problems.find_one({"$or": [{"id": req.problemId}, {"slug": req.problemId}]})
    title = problem.get("title", req.problemId) if problem else req.problemId
    desc = problem.get("description", "") if problem else ""

    eval_result = evaluate_candidate_answer_ai(
        problem_title=title,
        problem_description=desc,
        candidate_answer=req.userAnswer
    )
    return eval_result

@router.get("/api/submissions")
async def get_submissions(problemId: Optional[str] = Query(None), userId: Optional[str] = Query("default-user")):
    db = get_db()
    query = {}
    if problemId:
        query["problemId"] = problemId
    if userId:
        query["userId"] = userId

    submissions = await db.submissions.find(query).sort("timestamp", -1).to_list(length=100)
    return serialize_docs(submissions)

@router.post("/api/submissions")
async def save_submission(req: SubmissionRequest):
    db = get_db()
    sub_doc = req.dict()
    sub_doc["timestamp"] = datetime.utcnow().isoformat()

    result = await db.submissions.insert_one(sub_doc)
    sub_doc["_id"] = result.inserted_id
    return serialize_doc(sub_doc)

@router.get("/api/seed")
async def seed_database():
    db = get_db()
    count = await db.problems.count_documents({})
    if count > 0:
        return {"message": "Database already contains problems", "count": count}

    sample_problems = [
        {
            "id": "two-sum",
            "userId": "system",
            "title": "Two Sum",
            "slug": "two-sum",
            "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
            "difficulty": "Easy",
            "type": "coding",
            "tags": ["Array", "Hash Table"],
            "functionName": "twoSum",
            "args": ["nums", "target"],
            "testCases": [
                {"id": "1", "input": "[2,7,11,15], 9", "output": "[0,1]", "isHidden": False},
                {"id": "2", "input": "[3,2,4], 6", "output": "[1,2]", "isHidden": False}
            ]
        },
        {
            "id": "valid-parentheses",
            "userId": "system",
            "title": "Valid Parentheses",
            "slug": "valid-parentheses",
            "description": "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
            "difficulty": "Easy",
            "type": "coding",
            "tags": ["Stack", "String"],
            "functionName": "isValid",
            "args": ["s"],
            "testCases": [
                {"id": "1", "input": "'()'", "output": "true", "isHidden": False},
                {"id": "2", "input": "'()[]{}'", "output": "true", "isHidden": False}
            ]
        }
    ]
    await db.problems.insert_many(sample_problems)
    return {"message": "Seeded successfully", "count": len(sample_problems)}
