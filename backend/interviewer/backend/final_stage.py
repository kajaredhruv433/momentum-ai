"""
final_stage.py

Final stage for elapsed_time >= extended_time.
Requirements 22-25:
1. Groq decision: CONTINUE vs CONCLUDE (FINAL_DECISION_PROMPT).
   Strongly favors CONCLUDE unless candidate is exceptionally strong.
2. If CONTINUE -> exactly ONE final question.
3. Groq generates final question_pattern (FINAL_QUESTION_PROMPT).
4. Groq selects panel member (FINAL_PANEL_SELECTION_PROMPT).
5. Agora LLM generates actual final question (AGORA_FINAL_QUESTION_PROMPT).
6. Once the candidate answers this final question, FORCE CONCLUDE!
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from .agora.adapter import get_agora_adapter
    from .otheragent import ask_groq
    from .prompts import (
        AGORA_FINAL_QUESTION_PROMPT,
        FINAL_DECISION_PROMPT,
        FINAL_PANEL_SELECTION_PROMPT,
        FINAL_QUESTION_PROMPT,
    )
    from .stage_utils import (
        as_json,
        clean_text,
        validated_decision,
        validated_panel_member,
    )
except ImportError:
    from agora.adapter import get_agora_adapter
    from otheragent import ask_groq
    from prompts import (
        AGORA_FINAL_QUESTION_PROMPT,
        FINAL_DECISION_PROMPT,
        FINAL_PANEL_SELECTION_PROMPT,
        FINAL_QUESTION_PROMPT,
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
    Decides whether an exceptionally strong candidate justifies exactly ONE final question.
    """
    # 22. Final decision: CONTINUE only for exceptionally strong candidates
    decision_prompt = FINAL_DECISION_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
        base_time=base_time,
        elapsed_time=elapsed_time,
    )
    decision = validated_decision(decision_prompt)
    logger.info("Final stage Groq decision: %s (elapsed: %ds)", decision, elapsed_time)

    if decision == "CONCLUDE":
        return {"action": "CONCLUDE"}

    # 23. Groq creates final question_pattern
    question_prompt = FINAL_QUESTION_PROMPT.format(
        covered_areas=as_json(covered_areas),
        knowledge_from_previous_questions=as_json(history),
        areas_to_cover=as_json(areas_to_cover),
        candidate_profile=as_json(profile),
    )
    question_pattern = clean_text(ask_groq(question_prompt))

    # 24. Groq selects panel member for final question
    panel_prompt = FINAL_PANEL_SELECTION_PROMPT.format(
        panels=as_json(panel),
        question_pattern=question_pattern,
    )
    selected_member = validated_panel_member(panel_prompt, panel)

    member_details = None
    for _, member in panel.items():
        if isinstance(member, dict) and member.get("name") == selected_member:
            member_details = member
            break

    # 25. Agora LLM generates actual final question
    agora = get_agora_adapter()
    actual_question = agora.send_question_instruction(
        question_pattern=question_pattern,
        stage="final",
        panel_member=selected_member,
        panel_details=member_details,
    )

    logger.info(
        "Final stage: Groq final pattern -> '%s' | Agora final question by %s -> '%s'",
        question_pattern, selected_member, actual_question
    )

    return {
        "action": "ASK_QUESTION",
        "panel_member": selected_member,
        "panel_member_details": member_details,
        "question": actual_question,
        "question_pattern": question_pattern,
        "selected_area": "Final Evaluation",
        "stage": "FINAL",
        "question_kind": "final",
        "is_final_question": True,
    }
