"""
extended_stage.py

Extended interview loop for base_time <= elapsed_time < extended_time.
Direct reasoning and deeper question generation via otheragent (Groq/Gemini):
1. Groq decision: CONTINUE vs CONCLUDE (EXTENDED_DECISION_PROMPT).
2. If CONTINUE -> routes to clarification, project, or fresh-area prompts.
3. Generates a difficult, production-grade spoken question via the selected route.
4. Selects the exact panel member to speak via EXTENDED_PANEL_SELECTION_PROMPT.
5. Dispatches directly to ElevenLabs TTS for voice delivery.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from .otheragent import ask_groq
    from .prompts import (
        EXTENDED_DECISION_PROMPT,
        EXTENDED_CONTINUE_KIND_PROMPT,
        EXTENDED_CLARIFICATION_SELECTION_PROMPT,
        EXTENDED_PROJECT_SELECTION_PROMPT,
        EXTENDED_AREA_SELECTION_PROMPT,
        EXTENDED_CLARIFICATION_QUESTION_PROMPT,
        EXTENDED_PROJECT_QUESTION_PROMPT,
        EXTENDED_AREA_QUESTION_PROMPT,
        EXTENDED_PANEL_SELECTION_PROMPT,
    )
    from .stage_utils import (
        as_json,
        clean_text,
        validated_decision,
        validated_followup_kind,
        validated_panel_member,
    )
except ImportError:
    from otheragent import ask_groq
    from prompts import (
        EXTENDED_DECISION_PROMPT,
        EXTENDED_CONTINUE_KIND_PROMPT,
        EXTENDED_CLARIFICATION_SELECTION_PROMPT,
        EXTENDED_PROJECT_SELECTION_PROMPT,
        EXTENDED_AREA_SELECTION_PROMPT,
        EXTENDED_CLARIFICATION_QUESTION_PROMPT,
        EXTENDED_PROJECT_QUESTION_PROMPT,
        EXTENDED_AREA_QUESTION_PROMPT,
        EXTENDED_PANEL_SELECTION_PROMPT,
    )
    from stage_utils import (
        as_json,
        clean_text,
        validated_decision,
        validated_followup_kind,
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

    # 2. Explicitly choose clarification, project, or fresh area.
    kind_prompt = EXTENDED_CONTINUE_KIND_PROMPT.format(
        question_answer_history=as_json(history),
        last_candidate_response=answer,
        candidate_profile=as_json(profile),
    )
    route = validated_followup_kind(kind_prompt)
    selected_area = ""
    if route == "CLARIFICATION":
        selected = clean_text(ask_groq(EXTENDED_CLARIFICATION_SELECTION_PROMPT.format(question_answer_history=as_json(history))))
        selected_entry = next((h for i, h in enumerate(history) if str(h.get("question_id")) == selected or str(i) == selected), history[-1] if history else {})
        q_prompt = EXTENDED_CLARIFICATION_QUESTION_PROMPT.format(selected_qa=as_json(selected_entry), question_answer_history=as_json(history), candidate_profile=as_json(profile))
        kind, selected_area = "clarification", selected_entry.get("selected_area") or "Clarification"
    elif route == "PROJECT":
        projects = profile.get("projects", []) or []
        selected_project = clean_text(ask_groq(EXTENDED_PROJECT_SELECTION_PROMPT.format(projects=as_json(projects), question_answer_history=as_json(history))))
        project = next((p for p in projects if selected_project.casefold() in as_json(p).casefold()), selected_project)
        q_prompt = EXTENDED_PROJECT_QUESTION_PROMPT.format(selected_project=as_json(project), candidate_profile=as_json(profile), question_answer_history=as_json(history))
        kind, selected_area = "project", "Candidate Project"
    else:
        selected_area = clean_text(ask_groq(EXTENDED_AREA_SELECTION_PROMPT.format(areas_to_cover=as_json(areas_to_cover), covered_areas="[]", question_answer_history=as_json(history))))
        q_prompt = EXTENDED_AREA_QUESTION_PROMPT.format(selected_area=selected_area, candidate_profile=as_json(profile), question_answer_history=as_json(history))
        kind = "role_area"
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
