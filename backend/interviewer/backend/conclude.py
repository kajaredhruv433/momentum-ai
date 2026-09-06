"""
conclude.py

Handles the conclusion of the interview:
1. Groq generates professional closing message thanking candidate (CONCLUDE_PROMPT).
2. Groq chooses the closing panel member (CONCLUDE_PANEL_PROMPT).
3. Uses existing voice.py metadata for the selected panel member.
4. Agora TTS speaks the closing message.
5. The backend waits for Agora speech_finished before generating the evaluation report.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

try:
    from .agora.adapter import get_agora_adapter
    from .otheragent import ask_groq
    from .prompts import CONCLUDE_PANEL_PROMPT, CONCLUDE_PROMPT
    from .stage_utils import as_json, clean_text, validated_panel_member
except ImportError:
    from agora.adapter import get_agora_adapter
    from otheragent import ask_groq
    from prompts import CONCLUDE_PANEL_PROMPT, CONCLUDE_PROMPT
    from stage_utils import as_json, clean_text, validated_panel_member

logger = logging.getLogger(__name__)


def create_conclusion(
    history: List[Dict[str, Any]],
    panel: Dict[str, Any],
    interview_id: str = "",
) -> Dict[str, Any]:
    """
    Generate the closing message and choose the closing panel member.
    """
    # 26. Groq generates closing message
    closing_prompt = CONCLUDE_PROMPT.format(
        question_answer_history=as_json(history),
    )
    closing_message = clean_text(ask_groq(closing_prompt))

    # 27. Groq selects the panel member to deliver the closing message
    panel_prompt = CONCLUDE_PANEL_PROMPT.format(
        panels=as_json(panel),
        closing_message=closing_message,
    )
    selected_member = validated_panel_member(panel_prompt, panel)

    member_details = None
    for _, member in panel.items():
        if isinstance(member, dict) and member.get("name") == selected_member:
            member_details = member
            break

    # 28. Deliver closing message to Agora
    agora = get_agora_adapter()
    if interview_id:
        agora.speak_message(
            interview_id=interview_id,
            message=closing_message,
            panel_member=selected_member,
            member_details=member_details,
        )

    logger.info("Interview concluded. Closing message by %s: %s", selected_member, closing_message)

    return {
        "action": "CONCLUDE",
        "panel_member": selected_member,
        "panel_member_details": member_details,
        "message": closing_message,
        "stage": "CONCLUDING",
    }
