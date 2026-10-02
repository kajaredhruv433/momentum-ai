"""
normal_stage.py

Main repeated interview loop for elapsed_time < base_time.
Direct reasoning and question generation via otheragent (Groq/Gemini):
1. Groq decision: CONTINUE vs CONCLUDE vs DRAW (NORMAL_DECISION_PROMPT).
2. If CONCLUDE -> stops asking questions and hands off to conclude.py.
3. If DRAW -> asks canvas system design architecture question directly.
4. If CONTINUE -> selects area and generates direct spoken question via NORMAL_STAGE_QUESTION_PROMPT.
5. Selects the exact panel member to speak via NORMAL_PANEL_SELECTION_PROMPT (stage-specific, context-aware).
6. Dispatches directly to ElevenLabs TTS for voice delivery.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from .otheragent import ask_groq
    from .prompts import (
        DRAW_prompt,
        NORMAL_DECISION_PROMPT,
        NORMAL_CONTINUE_KIND_PROMPT,
        NORMAL_CLARIFICATION_SELECTION_PROMPT,
        NORMAL_PROJECT_SELECTION_PROMPT,
        NORMAL_AREA_SELECTION_PROMPT,
        NORMAL_CLARIFICATION_QUESTION_PROMPT,
        NORMAL_PROJECT_QUESTION_PROMPT,
        NORMAL_AREA_QUESTION_PROMPT,
        NORMAL_PANEL_SELECTION_PROMPT,
        NORMAL_STAGE_QUESTION_PROMPT,
        ROLE_AREA_PROMPT,
    )
    from .stage_utils import (
        as_json,
        choose_question_kind,
        clean_text,
        validated_decision,
        validated_followup_kind,
        validated_panel_member,
    )
except ImportError:
    from otheragent import ask_groq
    from prompts import (
        DRAW_prompt,
        NORMAL_DECISION_PROMPT,
        NORMAL_CONTINUE_KIND_PROMPT,
        NORMAL_CLARIFICATION_SELECTION_PROMPT,
        NORMAL_PROJECT_SELECTION_PROMPT,
        NORMAL_AREA_SELECTION_PROMPT,
        NORMAL_CLARIFICATION_QUESTION_PROMPT,
        NORMAL_PROJECT_QUESTION_PROMPT,
        NORMAL_AREA_QUESTION_PROMPT,
        NORMAL_PANEL_SELECTION_PROMPT,
        NORMAL_STAGE_QUESTION_PROMPT,
        ROLE_AREA_PROMPT,
    )
    from stage_utils import (
        as_json,
        choose_question_kind,
        clean_text,
        validated_decision,
        validated_followup_kind,
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
    Evaluate candidate response, generate interview question directly via otheragent (Groq/Gemini),
    and select the optimal panel member to deliver it.
    """
    # STEP 1: Ask otheragent: Continue, Conclude, or Draw?
    decision_prompt = NORMAL_DECISION_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
    )
    decision = validated_decision(decision_prompt, allow_draw=True)
    logger.info("Normal stage decision: %s", decision)

    # Check if a system design draw question has already been completed in history
    has_completed_draw = any(
        (h.get("selected_area") == "System Design & Architecture" or
         "canvas" in (h.get("question") or "").lower() or
         h.get("question_kind") == "system_design")
        for h in history
    )

    # 1. Conclude path
    if decision == "CONCLUDE":
        return {"action": "CONCLUDE"}

    # If 1 draw question has already completed, continue normal interview questions
    if decision == "DRAW" and has_completed_draw:
        logger.info("One draw question has already completed in this interview; continuing normal interview.")
        decision = "CONTINUE"

    # 2. Draw path: System Design Canvas Question
    if decision == "DRAW":
        selected_area = "System Design & Architecture"
        draw_instruction = (
            f"{DRAW_prompt}\n\n"
            f"Candidate profile:\n{as_json(profile)}\n\n"
            f"Interview history:\n{as_json(history)}\n\n"
            f"Latest candidate response:\n{answer}\n\n"
            "Generate a direct spoken system design question instructing the candidate to use the canvas to sketch the architecture."
        )
        question = clean_text(ask_groq(draw_instruction))

        # Select the panel member who should speak this DRAW question
        panel_prompt = NORMAL_PANEL_SELECTION_PROMPT.format(
            panels=as_json(panel),
            selected_area=selected_area,
            question=question,
            question_answer_history=as_json(history),
        )
        selected_member = validated_panel_member(panel_prompt, panel)

        member_details = None
        for _, member in panel.items():
            if isinstance(member, dict) and member.get("name") == selected_member:
                member_details = member
                break

        logger.info(
            "Normal stage (DRAW): Question generated directly by otheragent for %s -> '%s'",
            selected_member, question
        )

        return {
            "action": "ASK_QUESTION",
            "panel_member": selected_member,
            "panel_member_details": member_details,
            "question": question,
            "question_pattern": question,
            "selected_area": selected_area,
            "stage": "NORMAL",
            "question_kind": "system_design",
            "requires_canvas": True,
        }

    # 3. Continue path: explicitly choose clarification, project, or fresh area.
    kind_prompt = NORMAL_CONTINUE_KIND_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
        candidate_profile=as_json(profile),
    )
    route = validated_followup_kind(kind_prompt)
    selected_area = ""
    kind = "role_area"
    if route == "CLARIFICATION":
        selected = clean_text(ask_groq(NORMAL_CLARIFICATION_SELECTION_PROMPT.format(question_answer_history=as_json(history))))
        selected_entry = next((h for i, h in enumerate(history) if str(h.get("question_id")) == selected or str(i) == selected), history[-1] if history else {})
        q_prompt = NORMAL_CLARIFICATION_QUESTION_PROMPT.format(selected_qa=as_json(selected_entry), question_answer_history=as_json(history), candidate_profile=as_json(profile))
        kind, selected_area = "clarification", selected_entry.get("selected_area") or "Clarification"
    elif route == "PROJECT":
        projects = profile.get("projects", []) or []
        selected_project = clean_text(ask_groq(NORMAL_PROJECT_SELECTION_PROMPT.format(projects=as_json(projects), question_answer_history=as_json(history))))
        project = next((p for p in projects if selected_project.casefold() in as_json(p).casefold()), selected_project)
        q_prompt = NORMAL_PROJECT_QUESTION_PROMPT.format(selected_project=as_json(project), candidate_profile=as_json(profile), question_answer_history=as_json(history))
        kind, selected_area = "project", "Candidate Project"
    else:
        remaining = [a for a in areas_to_cover if a not in covered_areas] or areas_to_cover
        selected_area = clean_text(ask_groq(NORMAL_AREA_SELECTION_PROMPT.format(areas_to_cover=as_json(remaining), covered_areas=as_json(covered_areas), question_answer_history=as_json(history))))
        q_prompt = NORMAL_AREA_QUESTION_PROMPT.format(selected_area=selected_area, candidate_profile=as_json(profile), question_answer_history=as_json(history))
        kind = "role_area"
    question = clean_text(ask_groq(q_prompt))

    # Select the panel member who should speak this NORMAL question
    panel_prompt = NORMAL_PANEL_SELECTION_PROMPT.format(
        panels=as_json(panel),
        selected_area=selected_area,
        question=question,
        question_answer_history=as_json(history),
    )
    selected_member = validated_panel_member(panel_prompt, panel)

    member_details = None
    for _, member in panel.items():
        if isinstance(member, dict) and member.get("name") == selected_member:
            member_details = member
            break

    logger.info(
        "Normal stage: Question generated directly by otheragent for %s -> '%s'",
        selected_member, question
    )

    return {
        "action": "ASK_QUESTION",
        "panel_member": selected_member,
        "panel_member_details": member_details,
        "question": question,
        "question_pattern": question,
        "selected_area": selected_area,
        "stage": "NORMAL",
        "question_kind": kind,
        "requires_canvas": False,
    }
