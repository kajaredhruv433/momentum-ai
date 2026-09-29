"""
extended_stage.py

Extended interview loop for base_time <= elapsed_time < extended_time.
Direct reasoning and deeper question generation via otheragent (Groq/Gemini):
1. Groq decision: CONTINUE vs CONCLUDE (EXTENDED_DECISION_PROMPT).
2. If CONTINUE -> selects area via EXTENDED_DIRECTION_PROMPT.
3. Generates difficult, production-grade spoken question via EXTENDED_STAGE_QUESTION_PROMPT.
4. Selects the exact panel member to speak via EXTENDED_PANEL_SELECTION_PROMPT (stage-specific, context-aware).
5. Dispatches directly to ElevenLabs TTS for voice delivery.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from .otheragent import ask_groq
    from .prompts import (
        EXTENDED_DECISION_PROMPT,
        EXTENDED_DIRECTION_PROMPT,
        EXTENDED_PANEL_SELECTION_PROMPT,
        EXTENDED_STAGE_QUESTION_PROMPT,
    )
    from .stage_utils import (
        as_json,
        choose_question_kind,
        clean_text,
        validated_decision,
        validated_panel_member,
    )
except ImportError:
    from otheragent import ask_groq
    from prompts import (
        EXTENDED_DECISION_PROMPT,
        EXTENDED_DIRECTION_PROMPT,
        EXTENDED_PANEL_SELECTION_PROMPT,
        EXTENDED_STAGE_QUESTION_PROMPT,
    )
    from stage_utils import (
        as_json,
        choose_question_kind,
        clean_text,
        validated_decision,
        validated_panel_member,
    )

logger = logging.getLogger(__name__)


def next_extended_action(
    history: List[Dict[str, Any]],
    answer: str,
    profile: Dict[str, Any],
    panel: Dict[str, Any],
    areas_to_cover: List[str],
    base_time: int,
    elapsed_time: int,
    interview_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Handle extended stage evaluation and deeper technical question generation directly via otheragent.
    """
    # 1. Decision: Continue or Conclude beyond base time?
    decision_prompt = EXTENDED_DECISION_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
        base_time=base_time,
        elapsed_time=elapsed_time,
    )
    decision = validated_decision(decision_prompt)
    logger.info("Extended stage decision: %s (elapsed: %ds / base: %ds)", decision, elapsed_time, base_time)

    if decision == "CONCLUDE":
        return {"action": "CONCLUDE"}

    # 2. Topic direction
    direction_prompt = EXTENDED_DIRECTION_PROMPT.format(
        question_answer_history=as_json(history),
        areas_to_cover=as_json(areas_to_cover),
        candidate_profile=as_json(profile),
    )
    selected_area = clean_text(ask_groq(direction_prompt))

    # Determine project vs skill path
    kind = choose_question_kind(profile, selected_area)

    if kind == "project":
        candidate_context = as_json(profile.get("projects", []))
    else:
        candidate_context = as_json(
            profile.get("professional", {}).get("skills", [])
            or profile.get("skills", [])
        )

    # 3. Stage 2 Direct Difficult Question Generation Prompt
    q_prompt = EXTENDED_STAGE_QUESTION_PROMPT.format(
        candidate_profile=as_json(profile),
        candidate_context=candidate_context,
        selected_area=selected_area,
        question_answer_history=as_json(history),
        last_candidate_response=answer,
    )
    question = clean_text(ask_groq(q_prompt))

    # 4. Select the panel member who should speak this EXTENDED question
    panel_prompt = EXTENDED_PANEL_SELECTION_PROMPT.format(
        panels=as_json(panel),
        selected_area=selected_area,
        question=question,
        question_answer_history=as_json(history),
        last_candidate_response=answer,
    )
    selected_member = validated_panel_member(panel_prompt, panel)

    member_details = None
    for _, member in panel.items():
        if isinstance(member, dict) and member.get("name") == selected_member:
            member_details = member
            break

    logger.info(
        "Extended stage: Question generated directly by otheragent for %s -> '%s'",
        selected_member, question
    )

    return {
        "action": "ASK_QUESTION",
        "panel_member": selected_member,
        "panel_member_details": member_details,
        "question": question,
        "question_pattern": question,
        "selected_area": selected_area,
        "stage": "EXTENDED",
        "question_kind": kind,
    }
