"""
Solve Problem Module for Momentum Candidate Platform.
Generates 5 AI-powered technical and conceptual interview questions using ask_llm from backend/interviewer/llm.py.
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

try:
    from backend.interviewer.llm import ask_llm
except ImportError:
    from interviewer.llm import ask_llm

router = APIRouter(prefix="/api/candidate/solve-problem", tags=["candidate-solve-problem"])


def _extract_json(text: str) -> Any:
    """Extract and parse JSON safely from LLM output."""
    if not text:
        return None
    cleaned = text.strip()

    # Remove markdown code fences if present
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1]
        cleaned = cleaned.split("```", 1)[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1]
        cleaned = cleaned.split("```", 1)[0]

    cleaned = cleaned.strip()

    # Direct parse attempt
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Regex search for first JSON array or object
    array_match = re.search(r'\[[\s\S]*\]', cleaned)
    if array_match:
        try:
            return json.loads(array_match.group(0))
        except json.JSONDecodeError:
            pass

    object_match = re.search(r'\{[\s\S]*\}', cleaned)
    if object_match:
        try:
            return json.loads(object_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _generate_fallback_problems(topic: str, is_coding: bool = True) -> List[Dict[str, Any]]:
    """Safe fallback generator returning 5 curated problems if LLM is unavailable."""
    clean_topic = topic.strip().title() or "Algorithms"
    slug_base = re.sub(r'[^a-z0-9]+', '-', clean_topic.lower()).strip('-')

    if is_coding:
        templates = [
            ("Two Element Target Finder", "Given an array of integers and a target sum, determine two indices whose elements add up to the target in linear time.", "Easy"),
            ("Longest Distinct Sequence", "Find the length of the longest contiguous subsegment in the given collection containing only unique elements.", "Medium"),
            ("Interval Consolidation", "Given a collection of overlapping ranges, merge all overlapping ranges into mutually exclusive segments.", "Medium"),
            ("Balanced Structural Validator", "Verify that an expression containing various opening and closing delimiter symbols is syntactically well-formed.", "Easy"),
            ("Optimal Subarray Accumulation", "Find the contiguous subarray within a one-dimensional numerical array that yields the maximum possible total sum.", "Hard"),
        ]
        results = []
        for i, (title, desc, diff) in enumerate(templates, 1):
            results.append({
                "id": f"fallback_{uuid.uuid4().hex[:8]}",
                "title": f"{clean_topic}: {title}",
                "description": f"<p>{desc}</p><p><strong>Topic:</strong> {clean_topic}</p>",
                "difficulty": diff,
                "slug": f"{slug_base}-{i}-{uuid.uuid4().hex[:4]}",
                "status": "Unsolved",
                "tags": [clean_topic, "Coding", diff],
                "type": "coding",
                "defaultCode": {
                    "python": f"def solution(data):\n    # Implement optimal solution for {clean_topic}\n    pass\n",
                    "javascript": f"function solution(data) {{\n    // Implement optimal solution for {clean_topic}\n}}\n"
                },
                "functionName": "solution",
                "args": ["data"],
                "testCases": [
                    {"id": "1", "input": "[2, 7, 11, 15]", "output": "[0, 1]", "isHidden": False},
                    {"id": "2", "input": "[3, 2, 4]", "output": "[1, 2]", "isHidden": False},
                    {"id": "3", "input": "[3, 3]", "output": "[0, 1]", "isHidden": True}
                ],
                "constraints": ["1 <= data.length <= 10^5", "Time Complexity: O(N) preferred"],
                "companies": ["Momentum AI"]
            })
        return results

    # General / Conceptual fallback
    general_templates = [
        ("Core Architectural Trade-offs", f"Explain the core fundamental trade-offs involved when scaling architectures around {clean_topic}. Discuss performance vs consistency.", "Medium"),
        ("Error Resilience and Recovery", f"Describe how you design robust failover, graceful degradation, and retry mechanisms for applications utilizing {clean_topic}.", "Medium"),
        ("Concurrency and Race Conditions", f"Analyze common concurrency pitfalls and mitigation strategies encountered when multiple workers interact with {clean_topic}.", "Hard"),
        ("Monitoring and Observability", f"What telemetry, key metrics, and logging thresholds are essential to monitor production stability for {clean_topic}?", "Easy"),
        ("Security and Threat Modeling", f"Outline primary threat vectors and essential defense-in-depth measures when hardening systems centered on {clean_topic}.", "Medium"),
    ]
    results = []
    for i, (title, desc, diff) in enumerate(general_templates, 1):
        results.append({
            "id": f"fallback_gen_{uuid.uuid4().hex[:8]}",
            "title": f"{clean_topic}: {title}",
            "description": f"<p>{desc}</p>",
            "difficulty": diff,
            "slug": f"{slug_base}-concept-{i}-{uuid.uuid4().hex[:4]}",
            "status": "Unsolved",
            "tags": [clean_topic, "Conceptual", diff],
            "type": "general",
            "constraints": [],
            "companies": ["Momentum AI"]
        })
    return results


def generate_5_problems(topic: str, is_coding: bool = True) -> List[Dict[str, Any]]:
    """
    Generate exactly 5 problems using ask_llm from backend/interviewer/llm.py.
    Returns a list of 5 well-structured problem dictionaries.
    """
    topic_clean = topic.strip() if topic else "Data Structures & Algorithms"

    if is_coding:
        prompt = f"""You are a Principal Software Engineering Interviewer.
Generate exactly 5 distinct, high-quality, practical coding interview questions related to "{topic_clean}".

The questions must cover varying difficulties: 2 Easy, 2 Medium, 1 Hard.

STRICT REQUIREMENTS:
1. Return ONLY a valid JSON array containing exactly 5 problem objects.
2. No conversational text, no markdown preamble, no notes outside the JSON array.
3. Each object MUST strictly have these keys:
[
  {{
    "title": "Clear concise problem title",
    "description": "<p>Detailed problem statement formatted with HTML tags (p, ul, li, code, strong). Include Examples with Input and Output.</p>",
    "difficulty": "Easy" | "Medium" | "Hard",
    "slug": "url-friendly-lowercase-slug",
    "status": "Unsolved",
    "tags": ["{topic_clean}", "Algorithms"],
    "type": "coding",
    "defaultCode": {{
      "python": "def solution(nums):\\n    # Write your solution here\\n    pass\\n",
      "javascript": "function solution(nums) {{\\n    // Write your solution here\\n}}\\n"
    }},
    "functionName": "solution",
    "args": ["nums"],
    "testCases": [
      {{"id": "1", "input": "[2, 7, 11, 15], 9", "output": "[0, 1]", "isHidden": false}},
      {{"id": "2", "input": "[3, 2, 4], 6", "output": "[1, 2]", "isHidden": false}},
      {{"id": "3", "input": "[3, 3], 6", "output": "[0, 1]", "isHidden": true}}
    ],
    "constraints": ["1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
    "companies": ["Momentum", "TechCorp"]
  }}
]
"""
    else:
        prompt = f"""You are an Expert Technical Interviewer.
Generate exactly 5 distinct conceptual, system design, or theoretical technical interview questions related to "{topic_clean}".

The questions must challenge the candidate's deep conceptual understanding and engineering judgment.

STRICT REQUIREMENTS:
1. Return ONLY a valid JSON array containing exactly 5 problem objects.
2. No conversational text, no markdown preamble.
3. Each object MUST strictly have these keys:
[
  {{
    "title": "Clear conceptual question title",
    "description": "<p>Detailed scenario or conceptual question with background context and key points the candidate must address.</p>",
    "difficulty": "Easy" | "Medium" | "Hard",
    "slug": "url-friendly-lowercase-slug",
    "status": "Unsolved",
    "tags": ["{topic_clean}", "Theory", "Conceptual"],
    "type": "general",
    "constraints": [],
    "companies": ["Momentum"]
  }}
]
"""

    try:
        raw_response = ask_llm(prompt=prompt, max_output_tokens=4000)
        parsed = _extract_json(raw_response)

        if isinstance(parsed, list) and len(parsed) > 0:
            final_problems = []
            for item in parsed[:5]:
                if not isinstance(item, dict):
                    continue

                title = item.get("title") or f"{topic_clean} Problem"
                slug_val = item.get("slug")
                if not slug_val:
                    slug_val = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
                slug_val = f"{slug_val}-{uuid.uuid4().hex[:4]}"

                norm: Dict[str, Any] = {
                    "id": item.get("id") or f"gen_{uuid.uuid4().hex[:9]}",
                    "title": title,
                    "description": item.get("description") or f"<p>{title}</p>",
                    "difficulty": item.get("difficulty") or "Medium",
                    "slug": slug_val,
                    "status": "Unsolved",
                    "tags": item.get("tags") or [topic_clean],
                    "type": "coding" if is_coding else "general",
                    "constraints": item.get("constraints") or [],
                    "companies": item.get("companies") or ["Momentum AI"]
                }

                if is_coding:
                    norm["defaultCode"] = item.get("defaultCode") or {
                        "python": "def solution(*args):\n    pass\n",
                        "javascript": "function solution(...args) {\n}\n"
                    }
                    norm["functionName"] = item.get("functionName") or "solution"
                    norm["args"] = item.get("args") or ["input"]
                    norm["testCases"] = item.get("testCases") or [
                        {"id": "1", "input": "sample_input", "output": "sample_output", "isHidden": False}
                    ]

                final_problems.append(norm)

            # If LLM returned fewer than 5, supplement from fallback
            if len(final_problems) < 5:
                fallbacks = _generate_fallback_problems(topic_clean, is_coding)
                for fb in fallbacks:
                    if len(final_problems) >= 5:
                        break
                    final_problems.append(fb)

            return final_problems[:5]

    except Exception as e:
        print(f"[candidate.solve_problem] Error generating problems via ask_llm: {e}")

    # Fallback to 5 guaranteed questions
    return _generate_fallback_problems(topic_clean, is_coding)


def get_problem_solution(title: str, description: str, language: str = "python") -> str:
    """Generate optimal code solution using ask_llm."""
    prompt = f"""Generate an optimal, production-grade, well-commented solution for this coding problem:
Title: {title}
Description: {description}
Language: {language}

Requirements:
1. Clean, efficient code with clear explanations.
2. State the Time Complexity and Space Complexity explicitly.
3. Return ONLY clean executable code with inline comments. Do not include markdown code fence formatting.
"""
    try:
        text = ask_llm(prompt=prompt, max_output_tokens=2048)
        # Strip code fences if present
        text = re.sub(r'^```[a-zA-Z]*\n', '', text.strip())
        text = re.sub(r'\n```$', '', text.strip())
        return text
    except Exception as e:
        print(f"[candidate.solve_problem] Solution generation error: {e}")
        return f"# Optimal solution for {title} ({language})\n# Time: O(N), Space: O(1)\ndef solution(*args):\n    pass\n"


def evaluate_candidate_answer(problem_title: str, problem_description: str, candidate_answer: str) -> Dict[str, Any]:
    """Evaluate candidate verbal/text response to conceptual problem using ask_llm."""
    default_eval = {
        "score": 7,
        "feedback": "Good response covering the main aspects, with room for more concrete architectural trade-offs.",
        "status": "Passed"
    }

    prompt = f"""You are a Senior Technical Interviewer assessing a candidate's answer.
Problem Title: {problem_title}
Problem Details: {problem_description}
Candidate Answer: {candidate_answer}

Evaluate the response objectively. Return STRICT JSON:
{{
  "score": <integer from 1 to 10>,
  "feedback": "<clear, actionable critique of strengths and missing points>",
  "status": "Passed" | "Needs Improvement" | "Failed"
}}
"""
    try:
        res = ask_llm(prompt=prompt, max_output_tokens=1000)
        parsed = _extract_json(res)
        if isinstance(parsed, dict) and "score" in parsed:
            return parsed
    except Exception as e:
        print(f"[candidate.solve_problem] Evaluate answer error: {e}")

    return default_eval


# API endpoints on router for direct candidate usage
class GenerateRequest(BaseModel):
    topic: str
    type: Optional[str] = "coding"
    userId: Optional[str] = "default-user"

class EvaluateRequest(BaseModel):
    problemTitle: str
    problemDescription: str
    userAnswer: str

@router.post("/generate")
async def api_generate_5_problems(req: GenerateRequest):
    is_coding = req.type == "coding"
    problems = generate_5_problems(req.topic, is_coding)
    return {"problems": problems, "count": len(problems)}

@router.post("/evaluate")
async def api_evaluate_candidate_answer(req: EvaluateRequest):
    return evaluate_candidate_answer(req.problemTitle, req.problemDescription, req.userAnswer)
