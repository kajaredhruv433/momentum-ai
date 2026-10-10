"""Single-call EXTENDED interview stage."""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

try:
    from .prompts import EXTENDED_STAGE_PROMPT
    from .stage_utils import as_json, clean_text, panel_names, prompt_text, repair_json
except ImportError:
    from prompts import EXTENDED_STAGE_PROMPT
    from stage_utils import as_json, clean_text, panel_names, prompt_text, repair_json

logger = logging.getLogger(__name__)

def next_extended_action(history: List[Dict[str, Any]], answer: str, profile: Dict[str, Any],
                         panel: Dict[str, Any], areas_to_cover: List[str], base_time: int,
                         elapsed_time: int, interview_id: Optional[str] = None) -> Dict[str, Any]:
    prompt = EXTENDED_STAGE_PROMPT.format(
        role=profile.get("role") or profile.get("job_role") or "the target role",
        company_requirements=as_json(profile.get("company_requirements") or profile.get("company_details") or {}),
        candidate_profile=as_json(profile), projects=as_json(profile.get("projects") or []),
        areas_to_cover=as_json(areas_to_cover), covered_areas=as_json([]), panels=as_json(panel),
        base_time=base_time, elapsed_time=elapsed_time, question_answer_history=as_json(history),
        last_candidate_response=answer,
    )
    try:
        result = repair_json(prompt_text(prompt, retries=1))
        if not isinstance(result, dict) or str(result.get("status", "")).lower() == "conclude":
            return {"action": "CONCLUDE"}
        status = str(result.get("status", "")).lower()
        question = clean_text(str(result.get("generated_question") or ""))
        domain = str(result.get("question_domain") or "").lower()
        selected = clean_text(str(result.get("panel") or ""))
        member = next((n for n in panel_names(panel) if n.casefold() == selected.casefold()), None)
        if status != "continue" or domain not in {"clarification", "project", "area"} or not question or not member:
            raise ValueError(f"invalid response: {result}")
    except Exception as exc:
        logger.warning("EXTENDED single-call response invalid: %s", exc)
        return {"action": "CONCLUDE"}
    details = next((m for m in panel.values() if isinstance(m, dict) and m.get("name") == member), None)
    return {"action": "ASK_QUESTION", "panel_member": member, "panel_member_details": details,
            "question": question, "question_pattern": question, "selected_area": domain,
            "stage": "EXTENDED", "question_kind": domain}
