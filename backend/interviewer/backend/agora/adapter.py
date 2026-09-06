"""
adapter.py

Agora Interview Adapter.
Requirement 37:
Isolates Agora SDK details from the rest of the backend and exposes clean operations:
- connect()
- disconnect()
- publish_microphone()
- send_question_instruction(...)
- speak_message(...)
- on_event(...)
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, Optional

from .events import AgoraEvent, AgoraEventType
from .service import AgoraService

logger = logging.getLogger(__name__)


class AgoraInterviewAdapter:
    """
    Clean interface isolating Agora Conversational AI, STT, TTS, and RTC
    from stage processors and the interview controller.
    """

    def __init__(self, service: Optional[AgoraService] = None) -> None:
        self.service = service or AgoraService()

    @property
    def configured(self) -> bool:
        return self.service.configured

    def connect(
        self,
        interview_id: str,
        panel: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Initialize Agora voice session and return channel credentials/tokens."""
        return self.service.create_channel_session(interview_id, panel=panel)

    def disconnect(self, interview_id: str) -> None:
        """Disconnect and release session resources."""
        self.service.disconnect(interview_id)

    def publish_microphone(self, interview_id: str, user_uid: Optional[str] = None) -> Dict[str, Any]:
        """Authorize microphone publishing on the Agora RTC channel."""
        info = self.service.channel_info.get(interview_id, {})
        return {
            "channel": info.get("channel"),
            "token": info.get("token"),
            "uid": user_uid or info.get("uid"),
            "ready": bool(info.get("token")),
        }

    def send_question_instruction(
        self,
        question_pattern: str,
        stage: str = "normal",
        panel_member: Optional[str] = None,
        panel_details: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Send reasoning direction (question_pattern) to Agora Conversational AI LLM
        to generate the actual conversational question.
        """
        return self.service.generate_natural_question(
            question_pattern=question_pattern,
            stage=stage,
            panel_member=panel_member,
            panel_details=panel_details,
        )

    def speak_message(
        self,
        interview_id: str,
        message: str,
        panel_member: Optional[str] = None,
        member_details: Optional[Dict[str, Any]] = None,
        is_opening_question: bool = False,
    ) -> Dict[str, Any]:
        """
        Deliver spoken question or message using selected panel member voice.
        Triggers question_started event when speech delivery begins.
        """
        return self.service.speak_message(
            interview_id=interview_id,
            message=message,
            panel_member=panel_member,
            member_details=member_details,
            is_opening_question=is_opening_question,
        )

    async def synthesize_audio(
        self,
        text: str,
        panel_member: Optional[str] = None,
        gender: Optional[str] = None,
        member_details: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """Synthesize neural speech audio bytes for the interviewer persona."""
        return await self.service.synthesize_audio(
            text, panel_member=panel_member, gender=gender, member_details=member_details
        )

    def on_event(self, event_type: AgoraEventType, handler: Callable[[AgoraEvent], None]) -> None:
        """Subscribe to a specific normalized Agora event."""
        self.service.emitter.on(event_type, handler)

    def on_any_event(self, handler: Callable[[AgoraEvent], None]) -> None:
        """Subscribe to all normalized Agora events."""
        self.service.emitter.on_any(handler)


# Global singleton instance for shared backend use
_global_adapter: Optional[AgoraInterviewAdapter] = None


def get_agora_adapter() -> AgoraInterviewAdapter:
    global _global_adapter
    if _global_adapter is None:
        _global_adapter = AgoraInterviewAdapter()
    return _global_adapter
