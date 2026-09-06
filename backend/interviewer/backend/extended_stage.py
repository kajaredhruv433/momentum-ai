"""
extended_stage.py

Extended interview loop for base_time <= elapsed_time < extended_time.
Requirements 18-21:
1. Groq decision: CONTINUE vs CONCLUDE (EXTENDED_DECISION_PROMPT).
2. If CONTINUE -> Groq direction (EXTENDED_DIRECTION_PROMPT).
3. Groq generates difficult question_pattern (EXTENDED_PROJECT_QUESTION_PROMPT / EXTENDED_SKILL_QUESTION_PROMPT).
4. Groq selects panel member (PANEL_SELECTION_PROMPT with question_pattern).
5. Agora LLM transforms difficult question_pattern into the actual difficult question.
6. Hands off to Agora TTS to speak in the panel member's voice.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from .agora.adapter import get_agora_adapter
    from .otheragent import ask_groq
    from .prompts import (
        AGORA_EXTENDED_QUESTION_PROMPT,
        EXTENDED_DECISION_PROMPT,
        EXTENDED_DIRECTION_PROMPT,
        EXTENDED_PROJECT_QUESTION_PROMPT,
        EXTENDED_SKILL_QUESTION_PROMPT,
        PANEL_SELECTION_PROMPT,
    )
    from .stage_utils import (
        as_json,
        choose_question_kind,
        clean_text,
        validated_decision,
        validated_panel_member,
    )
except ImportError:
    from agora.adapter import get_agora_adapter
    from otheragent import ask_groq
    from prompts import (
        AGORA_EXTENDED_QUESTION_PROMPT,
        EXTENDED_DECISION_PROMPT,
        EXTENDED_DIRECTION_PROMPT,
        EXTENDED_PROJECT_QUESTION_PROMPT,
        EXTENDED_SKILL_QUESTION_PROMPT,
        PANEL_SELECTION_PROMPT,
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
    Handle extended stage evaluation and deeper technical question generation.
    """
    # 18. Groq decision: Continue or Conclude beyond base time?
    decision_prompt = EXTENDED_DECISION_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
        base_time=base_time,
        elapsed_time=elapsed_time,
    )
    decision = validated_decision(decision_prompt)
    logger.info("Extended stage Groq decision: %s (elapsed: %ds / base: %ds)", decision, elapsed_time, base_time)

    if decision == "CONCLUDE":
        return {"action": "CONCLUDE"}

    # 19. Groq direction
    direction_prompt = EXTENDED_DIRECTION_PROMPT.format(
        question_answer_history=as_json(history),
        areas_to_cover=as_json(areas_to_cover),
        candidate_profile=as_json(profile),
    )
    selected_area = clean_text(ask_groq(direction_prompt))

    # Determine project vs skill path
    kind = choose_question_kind(profile, selected_area)

    # 20 & 21: Groq generates difficult question_pattern
    if kind == "project":
        projects = profile.get("projects", [])
        q_prompt = EXTENDED_PROJECT_QUESTION_PROMPT.format(
            candidate_projects=as_json(projects),
            selected_area=selected_area,
        )
    else:
        skills = (
            profile.get("professional", {}).get("skills", [])
            or profile.get("skills", [])
        )
        q_prompt = EXTENDED_SKILL_QUESTION_PROMPT.format(
            candidate_skills=as_json(skills),
            selected_area=selected_area,
        )

    question_pattern = clean_text(ask_groq(q_prompt))

    # Groq selects panel member using question_pattern
    panel_prompt = PANEL_SELECTION_PROMPT.format(
        panels=as_json(panel),
        selected_area=selected_area,
        question_pattern=question_pattern,
    )
    selected_member = validated_panel_member(panel_prompt, panel)

    member_details = None
    for _, member in panel.items():
        if isinstance(member, dict) and member.get("name") == selected_member:
            member_details = member
            break

    # Agora LLM generates actual difficult question
    agora = get_agora_adapter()
    actual_question = agora.send_question_instruction(
        question_pattern=question_pattern,
        stage="extended",
        panel_member=selected_member,
        panel_details=member_details,
    )

    logger.info(
        "Extended stage: Groq pattern -> '%s' | Agora question by %s -> '%s'",
        question_pattern, selected_member, actual_question
    )

    return {
        "action": "ASK_QUESTION",
        "panel_member": selected_member,
        "panel_member_details": member_details,
        "question": actual_question,
        "question_pattern": question_pattern,
        "selected_area": selected_area,
        "stage": "EXTENDED",
        "question_kind": kind,
    }
