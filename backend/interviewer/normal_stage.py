"""Single-call NORMAL interview stage."""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

try:
    from .prompts import NORMAL_STAGE_PROMPT
    from .stage_utils import as_json, clean_text, panel_names, prompt_text, repair_json
except ImportError:
    from prompts import NORMAL_STAGE_PROMPT
    from stage_utils import as_json, clean_text, panel_names, prompt_text, repair_json

logger = logging.getLogger(__name__)

def _member(panel: Dict[str, Any], name: str):
    return next((v for v in panel.values() if isinstance(v, dict) and v.get("name") == name), None)

def next_normal_action(history: List[Dict[str, Any]], answer: str, profile: Dict[str, Any],
                       panel: Dict[str, Any], areas_to_cover: List[str], covered_areas: List[str],
                       interview_id: Optional[str] = None, repo_assessment_ready: bool = False) -> Dict[str, Any]:
    prompt = NORMAL_STAGE_PROMPT.format(
        role=profile.get("role") or profile.get("job_role") or "the target role",
        company_requirements=as_json(profile.get("company_requirements") or profile.get("company_details") or {}),
        candidate_profile=as_json(profile), projects=as_json(profile.get("projects") or []),
        areas_to_cover=as_json(areas_to_cover), covered_areas=as_json(covered_areas), panels=as_json(panel),
        question_answer_history=as_json(history), last_candidate_response=answer,
        repo_assessment_option=(
            'The repository evaluator is READY. You may choose question_domain "repo_assessment" as the fourth interview option to invite the candidate into the prepared temporary coding editor.'
            if repo_assessment_ready else
            'The repository coding assessment is not ready. Do not choose question_domain "repo_assessment".'
        ),
    )
    try:
        result = repair_json(prompt_text(prompt, retries=1))
        if not isinstance(result, dict):
            raise ValueError("response is not an object")
        status = str(result.get("status", "")).lower()
        if status == "conclude":
            return {"action": "CONCLUDE"}
        question = clean_text(str(result.get("generated_question") or ""))
        domain = str(result.get("question_domain") or "").lower()
        selected = clean_text(str(result.get("panel") or ""))
        member = next((n for n in panel_names(panel) if n.casefold() == selected.casefold()), None)
        if status == "continue" and domain == "repo_assessment" and repo_assessment_ready and member:
            return {
                "action": "START_REPO_ASSESSMENT", "panel_member": member,
                "panel_member_details": _member(panel, member),
                "question": "We have prepared a focused bug-fix challenge in a temporary copy of the project you described. Open the code editor, read problem.md, repair the introduced regression, and submit your change. The original repository will not be modified.",
                "question_pattern": "Introduce the project bug-fix assessment and open the temporary editor.",
                "selected_area": "repo_assessment", "stage": "NORMAL", "question_kind": "repo_assessment",
            }
        if status == "continue" and domain == "repo_assessment" and not repo_assessment_ready and member:
            return {
                "action": "ASK_QUESTION", "panel_member": member,
                "panel_member_details": _member(panel, member),
                "question": clean_text(str(result.get("generated_question") or "Could you walk us through the most complex part of the project and the trade-offs you made?")),
                "question_pattern": "Continue project discussion while repository evaluator prepares.",
                "selected_area": "project", "stage": "NORMAL", "question_kind": "project",
            }
        if status != "continue" or domain not in {"draw", "clarification", "project", "area"} or not question or not member:
            raise ValueError(f"invalid response: {result}")
    except Exception as exc:
        logger.warning("NORMAL single-call response invalid: %s", exc)
        return {"action": "CONCLUDE"}
    return {"action": "ASK_QUESTION", "panel_member": member, "panel_member_details": _member(panel, member),
            "question": question, "question_pattern": question, "selected_area": domain, "stage": "NORMAL",
            "question_kind": "system_design" if domain == "draw" else domain, "requires_canvas": domain == "draw"}
