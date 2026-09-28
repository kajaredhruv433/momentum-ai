"""
final_stage.py

Final stage for elapsed_time >= extended_time.
Direct reasoning and decisive question generation via otheragent (Groq/Gemini):
1. Groq decision: CONTINUE vs CONCLUDE (FINAL_DECISION_PROMPT).
   Favors CONCLUDE unless candidate is exceptionally strong.
2. If CONTINUE -> generates exactly ONE decisive final question via FINAL_STAGE_QUESTION_PROMPT.
3. Selects panel member based on final question (FINAL_PANEL_SELECTION_PROMPT).
4. Dispatches directly to ElevenLabs TTS for voice delivery.
5. Once the candidate answers this final question, interview forcefully concludes.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from .otheragent import ask_groq
    from .prompts import (
        FINAL_DECISION_PROMPT,
        FINAL_PANEL_SELECTION_PROMPT,
        FINAL_STAGE_QUESTION_PROMPT,
    )
    from .stage_utils import (
        as_json,
        clean_text,
        validated_decision,
        validated_panel_member,
    )
except ImportError:
    from otheragent import ask_groq
    from prompts import (
        FINAL_DECISION_PROMPT,
        FINAL_PANEL_SELECTION_PROMPT,
        FINAL_STAGE_QUESTION_PROMPT,
    )
    from stage_utils import (
        as_json,
        clean_text,
        validated_decision,
        validated_panel_member,
    )

logger = logging.getLogger(__name__)


def final_action(
    history: List[Dict[str, Any]],
    answer: str,
    profile: Dict[str, Any],
    panel: Dict[str, Any],
    areas_to_cover: List[str],
    covered_areas: List[str],
    base_time: int,
    elapsed_time: int,
    interview_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluate candidate in the final stage.
    Decides whether an exceptionally strong candidate justifies exactly ONE final question
    generated directly via otheragent.
    """
    # 1. Final decision: CONTINUE only for exceptionally strong candidates
    decision_prompt = FINAL_DECISION_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
        base_time=base_time,
        elapsed_time=elapsed_time,
    )
    decision = validated_decision(decision_prompt)
    logger.info("Final stage decision: %s (elapsed: %ds)", decision, elapsed_time)

    if decision == "CONCLUDE":
        return {"action": "CONCLUDE"}

    # 2. Stage 3 Direct Decisive Final Question Generation Prompt
    question_prompt = FINAL_STAGE_QUESTION_PROMPT.format(
        covered_areas=as_json(covered_areas),
        knowledge_from_previous_questions=as_json(history),
        areas_to_cover=as_json(areas_to_cover),
        candidate_profile=as_json(profile),
        last_candidate_response=answer,
    )
    question = clean_text(ask_groq(question_prompt))

    # 3. Select panel member for final question
    panel_prompt = FINAL_PANEL_SELECTION_PROMPT.format(
        panels=as_json(panel),
        question=question,
    )
    selected_member = validated_panel_member(panel_prompt, panel)

    member_details = None
    for _, member in panel.items():
        if isinstance(member, dict) and member.get("name") == selected_member:
            member_details = member
            break

    logger.info(
        "Final stage: Decisive question generated directly by otheragent for %s -> '%s'",
        selected_member, question
    )

    return {
        "action": "ASK_QUESTION",
        "panel_member": selected_member,
        "panel_member_details": member_details,
        "question": question,
        "question_pattern": question,
        "selected_area": "Final Evaluation",
        "stage": "FINAL",
        "question_kind": "final",
        "is_final_question": True,
    }
