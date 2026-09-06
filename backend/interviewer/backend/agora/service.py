"""
service.py

Central Agora Conversational AI Service.
Integrates Agora Agent Cloud, RTC token generation, STT, TTS, and LLM question generation.
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path
import warnings
from typing import Any, Callable, Dict, Optional
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

warnings.filterwarnings("ignore", message="Valid config keys have changed in V2:")

try:
    from agora_agent import Agent, Agora, Area, OpenAI, generate_rtc_token
except ImportError:
    Agent = Agora = Area = OpenAI = generate_rtc_token = None

from .events import AgoraEvent, AgoraEventEmitter, AgoraEventType
from .llm import AgoraLLM
from .stt import AgoraSTT
from .tts import AgoraTTS

logger = logging.getLogger(__name__)


class AgoraService:
    """
    Central service orchestrating Agora Conversational AI sessions, live RTC credentials,
    transcription, voice delivery, and event dispatch.
    """

    def __init__(self) -> None:
        self.app_id = os.getenv("AGORA_APP_ID", "").strip()
        self.app_certificate = os.getenv("AGORA_APP_CERTIFICATE", "").strip()
        self.agent_uid = os.getenv("AGORA_AGENT_UID", "9001").strip()
        self.preset = os.getenv("AGORA_VOICE_PRESET", "minimax_speech_2_6_turbo")

        self.emitter = AgoraEventEmitter()
        self.llm = AgoraLLM()
        self.tts = AgoraTTS()
        self.stt = AgoraSTT()

        self.sessions: Dict[str, Any] = {}
        self.channel_info: Dict[str, Dict[str, Any]] = {}

        # Wire internal STT callbacks to emitter
        self.stt.on_speech_started(lambda iid: self._emit(iid, AgoraEventType.SPEECH_STARTED))
        self.stt.on_transcript_partial(
            lambda iid, text: self._emit(iid, AgoraEventType.TRANSCRIPT_PARTIAL, {"text": text})
        )
        self.stt.on_transcript_final(
            lambda iid, text: self._emit(iid, AgoraEventType.TRANSCRIPT_FINAL, {"text": text})
        )
        self.stt.on_speech_finished(
            lambda iid, text: self._emit(iid, AgoraEventType.SPEECH_FINISHED, {"text": text})
        )

    def _emit(
        self,
        interview_id: str,
        event_type: AgoraEventType,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        event = AgoraEvent(
            event_type=event_type,
            interview_id=interview_id,
            data=data or {},
            error_message=error,
        )
        self.emitter.emit(event)

    @property
    def configured(self) -> bool:
        return bool(self.app_id and self.app_certificate and generate_rtc_token is not None)

    def create_channel_session(
        self,
        interview_id: str,
        panel: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Set up channel, generate dynamic RTC token for the candidate, and initialize
        Agora Conversational AI agent session if configured.
        """
        # Truncate clean channel name
        safe_id = re_clean = "".join(c for c in interview_id if c.isalnum())[:16]
        channel = f"echosphere-{safe_id}-{uuid.uuid4().hex[:6]}"
        user_uid = str(100000 + int(time.time() * 1000) % 899999)

        token = ""
        agent_id = None

        if self.configured:
            try:
                # Generate RTC token for the candidate to connect via microphone
                token = generate_rtc_token(
                    self.app_id,
                    self.app_certificate,
                    channel,
                    int(user_uid),
                )

                # Initialize Agora Agent Cloud session
                if Agora is not None and Agent is not None:
                    client = Agora(
                        area=Area.US,
                        app_id=self.app_id,
                        app_certificate=self.app_certificate,
                    )
                    agent = Agent(
                        client=client,
                        turn_detection={"language": "en-US"},
                    )
                    openai_model = os.getenv("AGORA_LLM_MODEL", "gpt-4o-mini")
                    if OpenAI is not None:
                        agent = agent.with_llm(OpenAI(model=openai_model))

                    session = agent.create_session(
                        channel=channel,
                        agent_uid=self.agent_uid,
                        remote_uids=[user_uid],
                        name=f"echosphere-{safe_id}",
                        preset=self.preset,
                        idle_timeout=1800,
                        expires_in=1800,
                    )
                    agent_id = session.start()
                    self.sessions[interview_id] = session
                    logger.info("Agora Agent session started: %s on channel %s", agent_id, channel)
                    self._emit(interview_id, AgoraEventType.CONNECTED, {"channel": channel, "agent_id": agent_id})
            except Exception as exc:
                logger.warning("Agora Agent Cloud session start warning (%s); continuing with client RTC token", exc)
                self._emit(interview_id, AgoraEventType.ERROR, {"error": str(exc)})

        info = {
            "app_id": self.app_id,
            "channel": channel,
            "token": token,
            "uid": user_uid,
            "agent_uid": self.agent_uid,
            "agent_id": agent_id,
            "configured": self.configured,
        }
        self.channel_info[interview_id] = info
        return info

    def generate_natural_question(
        self,
        question_pattern: str,
        stage: str = "normal",
        panel_member: Optional[str] = None,
        panel_details: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Agora LLM converts Groq question pattern into conversational question."""
        return self.llm.generate_question(
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
        Dispatch spoken message via Agora Conversational AI audio engine.
        Triggers question_started event when speech delivery begins.
        """
        options = self.tts.prepare_say_options(message, panel_member, member_details)

        # Notify question started
        if is_opening_question:
            self._emit(
                interview_id,
                AgoraEventType.QUESTION_STARTED,
                {"panel_member": panel_member, "message": message, "first_question": True},
            )
        else:
            self._emit(
                interview_id,
                AgoraEventType.QUESTION_STARTED,
                {"panel_member": panel_member, "message": message},
            )

        # Deliver to active Agora Agent session if running
        session = self.sessions.get(interview_id)
        if session and hasattr(session, "say"):
            try:
                session.say(message)
            except Exception as exc:
                logger.warning("Agora session.say() call warning: %s", exc)

        return {
            "delivered": True,
            "panel_member": panel_member,
            "voice": options["voice"],
            "message": message,
        }

    async def synthesize_audio(
        self,
        text: str,
        panel_member: Optional[str] = None,
        gender: Optional[str] = None,
        member_details: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """Stream neural speech audio bytes for the interviewer persona."""
        return await self.tts.synthesize(text, panel_member=panel_member, gender=gender, member_details=member_details)

    def notify_closing_finished(self, interview_id: str) -> None:
        """Triggered when Agora completes speaking the closing message."""
        self._emit(interview_id, AgoraEventType.SPEECH_FINISHED, {"closing": True})

    def disconnect(self, interview_id: str) -> None:
        """Tear down Agora agent session."""
        session = self.sessions.pop(interview_id, None)
        if session and hasattr(session, "stop"):
            try:
                session.stop()
            except Exception:
                pass
        self._emit(interview_id, AgoraEventType.DISCONNECTED)
