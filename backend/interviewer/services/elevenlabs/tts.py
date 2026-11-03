"""ElevenLabs text-to-speech provider.  No interview logic belongs here."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Mapping, Optional

import httpx
from dotenv import dotenv_values


def _setting(name: str, default: str = "") -> str:
    """Read local .env updates without requiring a backend restart; OS env is fallback."""
    file_value = str(dotenv_values(Path(__file__).resolve().parents[3] / ".env").get(name) or "").strip()
    return file_value or os.getenv(name, default).strip()


class ElevenLabsTTS:
    def __init__(self) -> None:
        self.api_key = ""
        self.model_id = "eleven_flash_v2_5"
        self.default_voice_id = "hpp4J3VqNfWAUOO0d1Us"

    async def synthesize(
        self,
        text: str,
        member_details: Optional[Mapping[str, Any]] = None,
    ) -> bytes:
        api_key = _setting("ELEVENLABS_API_KEY")
        if not api_key:
            raise RuntimeError("ELEVENLABS_API_KEY is missing from backend/.env")
        model_id = _setting("ELEVENLABS_TTS_MODEL", self.model_id) or self.model_id
        voice_id = (
            (member_details or {}).get("elevenlabs_voice_id")
            or (member_details or {}).get("voice_id")
            or (member_details or {}).get("voiceId")
            or _setting("ELEVENLABS_VOICE_ID", self.default_voice_id)
            or "hpp4J3VqNfWAUOO0d1Us"
        )
        if not voice_id:
            raise RuntimeError("No ElevenLabs voice ID is configured for this speaker")
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
        }
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                params={"output_format": "mp3_44100_128"},
                headers={"xi-api-key": api_key, "Accept": "audio/mpeg"},
                json=payload,
            )
        response.raise_for_status()
        return response.content
