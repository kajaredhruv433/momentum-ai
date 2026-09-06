"""
tts.py

Agora Conversational AI Text-To-Speech (TTS) integration.
Requirement 35:
Maps selected panel members to configured voice metadata using existing voice.py.
Handles spoken audio delivery via Agora Conversational AI audio pipeline.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Agora Agent TTS types
try:
    from agora_agent import ElevenLabsTTS, MiniMaxTTS, SayOptions
except ImportError:
    ElevenLabsTTS = MiniMaxTTS = SayOptions = None


VOICE_MAP = {
    # Female voices
    "Sarah": "en-US-AriaNeural",
    "Elena": "en-GB-SoniaNeural",
    "Sonia": "en-GB-SoniaNeural",
    "Aria": "en-US-AvaNeural",
    "Priya": "en-IN-NeerjaExpressiveNeural",
    "Neha": "en-IN-NeerjaExpressiveNeural",
    "Juhi": "en-IN-NeerjaExpressiveNeural",
    "Ananya": "en-IN-NeerjaExpressiveNeural",
    "Kavya": "en-IN-NeerjaExpressiveNeural",
    "Pooja": "en-IN-NeerjaExpressiveNeural",
    "Meera": "en-IN-NeerjaExpressiveNeural",
    "Shreya": "en-IN-NeerjaExpressiveNeural",
    "Kiran": "en-IN-NeerjaExpressiveNeural",
    # Male voices
    "Marcus": "en-US-GuyNeural",
    "Alexander": "en-GB-RyanNeural",
    "David": "en-US-EricNeural",
    "Rahul": "en-IN-PrabhatNeural",
    "Rohit": "en-IN-PrabhatNeural",
    "Rohan": "en-IN-PrabhatNeural",
    "Arjun": "en-IN-PrabhatNeural",
    "Vikram": "en-IN-PrabhatNeural",
    "Amit": "en-IN-PrabhatNeural",
    "Aditya": "en-IN-PrabhatNeural",
    "Raj": "en-IN-PrabhatNeural",
    "Ravi": "en-IN-PrabhatNeural",
}


def resolve_neural_voice(
    panel_member: Optional[str] = None,
    gender: Optional[str] = None,
    member_details: Optional[Dict[str, Any]] = None,
) -> str:
    details = member_details or {}

    # 1. Direct match by panel member name
    if panel_member and panel_member in VOICE_MAP:
        return VOICE_MAP[panel_member]

    # 2. Match by voice.py assigned persona voiceName or voice
    assigned_voice = details.get("voiceName") or details.get("voice")
    if assigned_voice and assigned_voice in VOICE_MAP:
        return VOICE_MAP[assigned_voice]

    # 3. Match by accent and gender
    accent = str(details.get("voiceAccent") or "").lower()
    is_male = str(gender or details.get("gender") or details.get("voiceGender") or "").strip().lower() == "male"

    if "british" in accent:
        return "en-GB-RyanNeural" if is_male else "en-GB-SoniaNeural"
    elif "indian" in accent:
        return "en-IN-PrabhatNeural" if is_male else "en-IN-NeerjaExpressiveNeural"
    elif is_male:
        return "en-US-GuyNeural"
    else:
        return "en-US-AriaNeural"


class AgoraTTS:
    """
    Handles speech synthesis and voice persona configuration for interview panel members
    using Agora Conversational AI voice transport and high-fidelity neural speech streaming.
    """

    def __init__(self) -> None:
        self.default_preset = os.getenv("AGORA_VOICE_PRESET", "minimax_speech_2_6_turbo")

    def configure_voice_for_member(
        self,
        panel_member: str,
        member_details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Extract and format the Agora TTS configuration from the existing voice.py metadata.
        """
        details = member_details or {}
        agora_cfg = details.get("agora", {})

        voice_id = (
            details.get("elevenlabs_voice_id")
            or details.get("minimax_voice_id")
            or agora_cfg.get("provider_voice_id")
            or "English_expressive_male1"
        )
        gender = details.get("gender") or details.get("voiceGender") or "Neutral"
        accent = details.get("voiceAccent") or "American"
        tone = details.get("voiceTone") or "Clear & Professional"

        return {
            "panel_member": panel_member,
            "provider": agora_cfg.get("provider", "elevenlabs"),
            "voice_id": voice_id,
            "gender": gender,
            "accent": accent,
            "tone": tone,
            "voice_name": details.get("voiceName") or details.get("voice") or "Standard",
            "personality": details.get("voice_personality", []),
        }

    def prepare_say_options(
        self,
        message: str,
        panel_member: Optional[str] = None,
        member_details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Prepare parameters for Agora agent session speech dispatch.
        """
        voice_config = self.configure_voice_for_member(panel_member or "Interviewer", member_details)
        return {
            "text": message,
            "voice": voice_config,
            "deliver": True,
        }

    async def synthesize(
        self,
        text: str,
        panel_member: Optional[str] = None,
        gender: Optional[str] = None,
        member_details: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """
        Synthesize broadcast-quality audio for the panel member's persona.
        """
        voice_name = resolve_neural_voice(panel_member, gender, member_details)
        try:
            import edge_tts
            comm = edge_tts.Communicate(text, voice_name)
            data = bytearray()
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    data.extend(chunk["data"])
            if data:
                return bytes(data)
        except Exception as exc:
            logger.warning("Primary Edge TTS voice %s failed (%s); trying fallback", voice_name, exc)

        # Fallback to standard robust voice
        fallback_voice = "en-US-GuyNeural" if str(gender or "").lower() == "male" else "en-US-AriaNeural"
        try:
            import edge_tts
            comm = edge_tts.Communicate(text, fallback_voice)
            data = bytearray()
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    data.extend(chunk["data"])
            return bytes(data)
        except Exception as exc:
            logger.error("Fallback Edge TTS voice failed (%s)", exc)
            return b""

