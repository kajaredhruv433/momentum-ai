"""
normal_stage.py

Main repeated interview loop for elapsed_time < base_time.
Requirements 9-17:
1. Groq decision: CONTINUE vs CONCLUDE (NORMAL_DECISION_PROMPT).
2. If CONCLUDE -> stops asking questions and hands off to conclude.py.
3. If CONTINUE -> Groq direction (NORMAL_DIRECTION_PROMPT).
4. Determines question path: ROLE/AREA, PROJECT, or SKILL.
5. Groq generates question_pattern (instruction for Agora).
6. Groq selects panel member (PANEL_SELECTION_PROMPT with question_pattern).
7. Agora LLM transforms question_pattern into the actual spoken question.
8. Hands off to Agora TTS to speak in the panel member's voice.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from .agora.adapter import get_agora_adapter
    from .otheragent import ask_groq
    from .prompts import (
        AGORA_QUESTION_GENERATION_PROMPT,
        AGORA_SKILL_QUESTION_PROMPT,
        DRAW_prompt,
        NORMAL_DECISION_PROMPT,
        NORMAL_DIRECTION_PROMPT,
        PANEL_SELECTION_PROMPT,
        PROJECT_QUESTION_PROMPT,
        ROLE_AREA_PROMPT,
        SKILL_QUESTION_PROMPT,
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
        AGORA_QUESTION_GENERATION_PROMPT,
        AGORA_SKILL_QUESTION_PROMPT,
        DRAW_prompt,
        NORMAL_DECISION_PROMPT,
        NORMAL_DIRECTION_PROMPT,
        PANEL_SELECTION_PROMPT,
        PROJECT_QUESTION_PROMPT,
        ROLE_AREA_PROMPT,
        SKILL_QUESTION_PROMPT,
    )
    from stage_utils import (
        as_json,
        choose_question_kind,
        clean_text,
        validated_decision,
        validated_panel_member,
    )

logger = logging.getLogger(__name__)


def next_normal_action(
    history: List[Dict[str, Any]],
    answer: str,
    profile: Dict[str, Any],
    panel: Dict[str, Any],
    areas_to_cover: List[str],
    covered_areas: List[str],
    interview_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluate candidate response, generate question pattern via Groq,
    select panel member via Groq, and produce actual conversational question via Agora LLM.
    """
    # STEP 1: Ask Groq: Continue, Conclude, or Draw?
    decision_prompt = NORMAL_DECISION_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
    )
    decision = validated_decision(decision_prompt, allow_draw=True)
    logger.info("Normal stage Groq decision: %s", decision)

    # Check if a system design draw question has already been completed in history
    has_completed_draw = any(
        (h.get("selected_area") == "System Design & Architecture" or
         "canvas" in (h.get("question") or "").lower() or
         h.get("question_kind") == "system_design")
        for h in history
    )

    # 10. Normal conclude path
    if decision == "CONCLUDE":
        return {"action": "CONCLUDE"}

    # If 1 draw question has already completed, continue normal interview questions
    if decision == "DRAW" and has_completed_draw:
        logger.info("One draw question has already completed in this interview; continuing normal interview.")
        decision = "CONTINUE"

    # 10.1 Normal draw path: System Design Canvas Question
    if decision == "DRAW":
        selected_area = "System Design & Architecture"
        draw_instruction = (
            f"{DRAW_prompt}\n\n"
            f"Candidate profile:\n{as_json(profile)}\n\n"
            f"Interview history:\n{as_json(history)}\n\n"
            "Generate a system design question instructing the candidate to use the canvas to sketch the architecture."
        )
        question_pattern = clean_text(ask_groq(draw_instruction))

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

        agora = get_agora_adapter()
        actual_question = agora.send_question_instruction(
            question_pattern=question_pattern,
            stage="normal",
            panel_member=selected_member,
            panel_details=member_details,
        )

        logger.info(
            "Normal stage (DRAW): Groq pattern -> '%s' | Agora question by %s -> '%s'",
            question_pattern, selected_member, actual_question
        )

        return {
            "action": "ASK_QUESTION",
            "panel_member": selected_member,
            "panel_member_details": member_details,
            "question": actual_question,
            "question_pattern": question_pattern,
            "selected_area": selected_area,
            "stage": "NORMAL",
            "question_kind": "system_design",
            "requires_canvas": True,
        }

    # 11. Normal continue path - Groq direction
    direction_prompt = NORMAL_DIRECTION_PROMPT.format(
        question_answer_history=as_json(history),
        areas_to_cover=as_json(areas_to_cover),
        candidate_profile=as_json(profile),
    )
    selected_area = clean_text(ask_groq(direction_prompt))

    # Determine which path applies: ROLE/AREA, PROJECT, SKILL
    kind = choose_question_kind(profile, selected_area)

    if kind == "role_area":
        remaining_areas = [a for a in areas_to_cover if a not in covered_areas]
        if remaining_areas:
            role_prompt = ROLE_AREA_PROMPT.format(
                covered_areas=as_json(covered_areas),
                remaining_areas=as_json(remaining_areas),
                candidate_profile=as_json(profile),
            )
            selected_area = clean_text(ask_groq(role_prompt))
            kind = choose_question_kind(profile, selected_area)

    # 13 & 16: Groq produces question_pattern (NOT the final polished question)
    if kind == "project":
        projects = profile.get("projects", [])
        q_prompt = PROJECT_QUESTION_PROMPT.format(
            candidate_projects=as_json(projects),
            selected_area=selected_area,
        )
    else:
        skills = (
            profile.get("professional", {}).get("skills", [])
            or profile.get("skills", [])
        )
        q_prompt = SKILL_QUESTION_PROMPT.format(
            candidate_skills=as_json(skills),
            selected_area=selected_area,
        )

    question_pattern = clean_text(ask_groq(q_prompt))

    # 15. Groq selects panel member using question_pattern
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

    # 14 & 16: Send question_pattern to Agora Conversational AI LLM to produce actual question
    agora = get_agora_adapter()
    actual_question = agora.send_question_instruction(
        question_pattern=question_pattern,
        stage="normal",
        panel_member=selected_member,
        panel_details=member_details,
    )

    logger.info(
        "Normal stage: Groq pattern -> '%s' | Agora question by %s -> '%s'",
        question_pattern, selected_member, actual_question
    )

    return {
        "action": "ASK_QUESTION",
        "panel_member": selected_member,
        "panel_member_details": member_details,
        "question": actual_question,
        "question_pattern": question_pattern,
        "selected_area": selected_area,
        "stage": "NORMAL",
        "question_kind": kind,
        "requires_canvas": False,
    }
