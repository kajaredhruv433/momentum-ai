import json
import re
import uuid
from typing import Any, List, Optional
from openai import OpenAI

from backend.config import BASETEN_API_KEY, BASETEN_BASE_URL, BASETEN_MODEL
from backend.services.ai_workflows import run_model_call

# Backwards compatibility alias
GEMINI_API_KEY = BASETEN_API_KEY


def get_client() -> Optional[OpenAI]:
    if not BASETEN_API_KEY:
        return None
    return OpenAI(
        base_url=BASETEN_BASE_URL,
        api_key=BASETEN_API_KEY,
        timeout=60.0,
        max_retries=2,
    )


def generate_text(prompt: str, temperature: float = 0.2) -> str:
    """Execute chat completion with Baseten OpenAI-compatible inference."""
    client = get_client()
    if not client:
        raise RuntimeError("BASETEN_API_KEY is not configured.")
    if not prompt.strip():
        raise ValueError("prompt cannot be empty.")
    response = client.chat.completions.create(
        model=BASETEN_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return response.choices[0].message.content or ""


class BasetenModelWrapper:
    """Adapter providing a .generate_content() interface for compatibility."""
    def __init__(self, model_name: str = BASETEN_MODEL):
        self.model_name = model_name

    def generate_content(self, prompt: str):
        text = generate_text(prompt)
        class ResponseWrapper:
            def __init__(self, t: str):
                self.text = t
        return ResponseWrapper(text)


def get_model(model_name: str = BASETEN_MODEL):
    if BASETEN_API_KEY:
        return BasetenModelWrapper(model_name)
    return None


def safe_parse_json(text: str):
    cleaned = re.sub(r"```json|```", "", text).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    arr_match = re.search(r"\[[\s\S]*\]", cleaned)
    if arr_match:
        try:
            return json.loads(arr_match.group(0))
        except Exception:
            pass
    obj_match = re.search(r"\{[\s\S]*\}", cleaned)
    if obj_match:
        try:
            return json.loads(obj_match.group(0))
        except Exception:
            pass
    return None


def generate_mock_problems(topic: str, is_coding: bool = True) -> list:
    problems = []
    difficulties = ["Easy", "Medium", "Hard"]
    for i in range(5):
        prob_id = f"gen_{uuid.uuid4().hex[:9]}"
        slug = f"{re.sub(r'[^a-z0-9]+', '-', topic.lower()).strip('-')}-{i+1}"
        if is_coding:
            problems.append({
                "id": prob_id,
                "title": f"{topic} Challenge {i+1}",
                "description": f"<p>This is a coding problem related to <strong>{topic}</strong> ({i+1}).</p><p>Implement an efficient algorithm that solves the problem requirements.</p>",
                "difficulty": difficulties[i % 3],
                "slug": slug,
                "status": "Unsolved",
                "tags": [topic, "Practice"],
                "type": "coding",
                "defaultCode": {
                    "python": f"def solution():\n    # TODO: Implement solution for {topic}\n    pass",
                    "javascript": f"function solution() {{\n    // TODO: Implement solution for {topic}\n}}"
                },
                "functionName": "solution",
                "args": ["input"],
                "testCases": [
                    {"id": "1", "input": "test_input", "output": "expected_output", "isHidden": False}
                ],
                "companies": [],
                "constraints": ["1 <= N <= 10^5"]
            })
        else:
            problems.append({
                "id": prob_id,
                "title": f"{topic} Concept {i+1}",
                "description": f"<p>This is a conceptual question about <strong>{topic}</strong> ({i+1}).</p><p>Explain the architecture and key tradeoffs involved.</p>",
                "difficulty": difficulties[i % 3],
                "slug": slug,
                "status": "Unsolved",
                "tags": [topic, "Theory"],
                "type": "general",
                "companies": [],
                "constraints": []
            })
    return problems


async def generate_problems_ai(topic: str, is_coding: bool = True) -> list:
    if not BASETEN_API_KEY:
        return generate_mock_problems(topic, is_coding)

    try:
        model = get_model()
        if is_coding:
            prompt = f"""
            Generate 5 unique coding problems related to "{topic}".
            It should be a LeetCode style problem.
            
            STRICTLY return ONLY a JSON array of objects. Do NOT include markdown formatting.
            
            JSON Format:
            [
              {{
                "title": "Problem Title",
                "description": "HTML formatted detailed description...",
                "difficulty": "Easy" | "Medium" | "Hard",
                "slug": "problem-slug",
                "status": "Unsolved",
                "tags": ["{topic}"],
                "type": "coding",
                "defaultCode": {{ "python": "def solution():\\n    pass", "javascript": "function solution() {{}}" }},
                "functionName": "solution",
                "args": ["input"],
                "testCases": [
                   {{"id": "1", "input": "test_input", "output": "expected_output", "isHidden": false}}
                ],
                "companies": [],
                "constraints": ["1 <= N <= 10^5"]
              }}
            ]
            """
        else:
            prompt = f"""
            Generate 5 unique conceptual / theoretical interview questions and problems related to "{topic}".
            
            STRICTLY return ONLY a JSON array of objects. Do NOT include markdown formatting.
            
            JSON Format:
            [
              {{
                "title": "Concept Title",
                "description": "HTML formatted detailed scenario or question...",
                "difficulty": "Medium",
                "slug": "problem-slug",
                "status": "Unsolved",
                "tags": ["{topic}", "Theory"],
                "type": "general",
                "companies": [],
                "constraints": []
              }}
            ]
            """
        response = run_model_call(lambda: model.generate_content(prompt))
        parsed = safe_parse_json(response.text)
        if isinstance(parsed, list) and len(parsed) > 0:
            for p in parsed:
                if not p.get("id"):
                    p["id"] = f"gen_{uuid.uuid4().hex[:9]}"
                if not p.get("slug"):
                    p["slug"] = f"{re.sub(r'[^a-z0-9]+', '-', p.get('title', topic).lower()).strip('-')}-{uuid.uuid4().hex[:4]}"
            return parsed
    except Exception as e:
        print("Baseten generate problems error:", e)

    return generate_mock_problems(topic, is_coding)


async def generate_job_description(
    title: str,
    role: str,
    skills: list,
    experience: str,
    company: str = "Momentum AI",
    location: str = "Remote",
    salary: str = "Competitive",
) -> dict:
    if not BASETEN_API_KEY:
        return {
            "overview": f"We are hiring a skilled {title} ({role}) at {company}.",
            "responsibilities": ["Develop scalable features", "Collaborate with cross-functional teams", "Maintain code quality"],
            "requirements": skills or ["Strong technical problem-solving", "Team collaboration"],
            "benefits": ["Competitive salary", "Remote work flexibility", "Growth opportunities"]
        }
    try:
        model = get_model()
        prompt = f"""
        Generate a professional job description for:
        Job Title: {title}
        Role/Department: {role}
        Company: {company}
        Location: {location}
        Salary: {salary}
        Key Skills: {', '.join(skills) if skills else 'Relevant industry skills'}
        Experience Level: {experience}

        Provide output STRICTLY as valid JSON with keys:
        - "overview": a 2-3 sentence overview
        - "responsibilities": list of 4-6 bullet points
        - "requirements": list of 4-6 required qualifications
        - "benefits": list of 3-5 benefits
        """
        response = run_model_call(lambda: model.generate_content(prompt))
        parsed = safe_parse_json(response.text)
        if parsed and "overview" in parsed:
            return parsed
    except Exception as e:
        print("Baseten Job Description Error:", e)

    return {
        "overview": f"We are looking for a qualified {title} to join our team at {company}.",
        "responsibilities": ["Lead core engineering initiatives", "Work with modern technologies", "Ensure architectural scalability"],
        "requirements": skills or ["Relevant domain expertise", "Strong communication skills"],
        "benefits": ["Flexible working hours", "Health insurance", "Learning stipend"]
    }


async def evaluate_resume(resume_data: dict) -> dict:
    default_res = {
        "score": 75,
        "status": "Ready for Review",
        "feedback": "Your resume showcases solid foundational experience. Consider quantifying achievements with metrics.",
        "strengths": ["Clear technical stack", "Structured experience"],
        "improvements": ["Add measurable metrics (e.g. % performance increase)", "Highlight system scalability achievements"]
    }
    if not BASETEN_API_KEY:
        return default_res

    try:
        model = get_model()
        prompt = f"""
        You are an elite technical recruiter and hiring manager. Evaluate this candidate resume:
        {json.dumps(resume_data, indent=2)}

        Return a STRICT JSON response:
        {{
            "score": number from 0 to 100,
            "status": "Needs Improvement" | "Ready for Review" | "Strong Match" | "Top Candidate",
            "feedback": "2-3 sentences of constructive actionable evaluation",
            "strengths": ["strength 1", "strength 2"],
            "improvements": ["area to improve 1", "area to improve 2"]
        }}
        """
        response = run_model_call(lambda: model.generate_content(prompt))
        parsed = safe_parse_json(response.text)
        if parsed and "score" in parsed:
            return parsed
    except Exception as e:
        print("Baseten Resume Eval Error:", e)

    return default_res


async def generate_interview_questions(topic: str, difficulty: str = "Medium") -> list:
    default_questions = [
        f"Can you explain the core fundamentals of {topic} and where it is most effectively applied?",
        f"What are some common performance bottlenecks or pitfalls encountered in {topic}, and how do you mitigate them?",
        f"Describe a challenging scenario where you used {topic} to solve a critical problem.",
        f"How does {topic} compare to alternative approaches or competing technologies?",
        f"How do you test, debug, and monitor systems built with {topic} in production?"
    ]
    if not BASETEN_API_KEY:
        return default_questions

    try:
        model = get_model()
        prompt = f"""
        You are a principal technical interviewer at a top tier company.
        Generate exactly 5 distinct, verbally askable technical interview questions for:
        Topic: {topic}
        Difficulty: {difficulty}

        Return STRICTLY a JSON array of strings:
        ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
        """
        response = run_model_call(lambda: model.generate_content(prompt))
        match = re.search(r"\[[\s\S]*\]", response.text)
        if match:
            questions = json.loads(match.group(0))
            if isinstance(questions, list) and len(questions) > 0:
                return [str(q) for q in questions]
    except Exception as e:
        print("Baseten Questions Error:", e)

    return default_questions


async def evaluate_interview_report(topic: str, difficulty: str, questions: list, answers: list, violations: int = 0) -> dict:
    default_report = {
        "score": 82,
        "understanding_score": 85,
        "skills_score": 80,
        "language_score": 82,
        "ratings": 8,
        "feedback": "Demonstrated solid technical understanding with structured explanations. Addressed main trade-offs effectively.",
        "improvements": "Structure answers more tightly using the STAR method and maintain direct camera engagement.",
        "status": "Passed"
    }
    if not BASETEN_API_KEY:
        return default_report

    try:
        model = get_model()
        q_a_transcript = "\n\n".join([f"Q{i+1}: {q}\nA: {answers[i] if i < len(answers) else '(No response)'}" for i, q in enumerate(questions)])
        prompt = f"""
        You are an expert technical interviewer evaluating a live candidate session:
        Topic: {topic}
        Difficulty: {difficulty}
        Eye Contact Violations (Looking away from screen): {violations}

        Interview Transcript:
        {q_a_transcript}

        Evaluate candidate depth, conceptual understanding, and communication.
        Return STRICT JSON:
        {{
            "score": number (0-100),
            "understanding_score": number (0-100),
            "skills_score": number (0-100),
            "language_score": number (0-100),
            "ratings": number (1-10),
            "feedback": "concise constructive evaluation paragraph",
            "improvements": "key areas candidate should refine",
            "status": "Passed" | "Needs Improvement" | "Failed"
        }}
        """
        response = run_model_call(lambda: model.generate_content(prompt))
        parsed = safe_parse_json(response.text)
        if parsed and "score" in parsed:
            return parsed
    except Exception as e:
        print("Baseten Interview Report Error:", e)

    return default_report

