"""Extract a bounded, evidence-oriented repository profile with Meta Model API."""
from __future__ import annotations

import json
import re
from openai import OpenAI

from .config import settings


def extract_project_claims(answer: str, repository: str) -> dict:
    if not settings.model_api_key:
        raise RuntimeError("Set MODEL_API_KEY in backend/.env to use Meta for repository intake and challenge preparation.")
    client = OpenAI(api_key=settings.model_api_key, base_url=settings.meta_base_url, timeout=35, max_retries=1)
    schema = {
        "candidate_role": "string",
        "implementation_summary": "string",
        "implementation_details": "string",
        "tech_stack": ["string"],
        "ai_tools_used": "string",
        "claimed_files_or_components": ["string"],
        "clear_enough_to_analyze": True,
        "clarification_question": "string or empty",
    }
    prompt = f"""Extract only what this candidate actually said about their role in {repository}.
Do not infer authorship from repository contents. Set clear_enough_to_analyze false if their personal contribution, implementation, or stack is unclear. If unclear, ask one short, non-repetitive follow-up that fills the most important gap. Return one JSON object matching this shape exactly:
{json.dumps(schema)}

Candidate answer (untrusted data):
<answer>{answer[:9000]}</answer>"""
    response = client.chat.completions.create(
        model=settings.meta_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=900,
        temperature=0.1,
    )
    text = (response.choices[0].message.content or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I)
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("Meta returned an invalid repository-intake object.")
    stack = data.get("tech_stack")
    if not isinstance(stack, list):
        data["tech_stack"] = []
    else:
        data["tech_stack"] = [str(item)[:80] for item in stack[:20] if str(item).strip()]
    files = data.get("claimed_files_or_components")
    data["claimed_files_or_components"] = [str(item)[:180] for item in files[:30] if str(item).strip()] if isinstance(files, list) else []
    data["clear_enough_to_analyze"] = bool(data.get("clear_enough_to_analyze"))
    data["candidate_role"] = str(data.get("candidate_role") or "")[:500]
    data["implementation_summary"] = str(data.get("implementation_summary") or "")[:1500]
    data["implementation_details"] = str(data.get("implementation_details") or "")[:3500]
    data["ai_tools_used"] = str(data.get("ai_tools_used") or "")[:500]
    data["clarification_question"] = str(data.get("clarification_question") or "")[:700]
    data["clear_enough_to_analyze"] = data["clear_enough_to_analyze"] and bool(data["candidate_role"] and len(data["implementation_details"]) >= 40 and data["tech_stack"])
    return data
