"""ElevenLabs text-to-speech provider.  No interview logic belongs here."""
from __future__ import annotations

import os
from typing import Any, Mapping, Optional

import httpx


class ElevenLabsTTS:
    def __init__(self) -> None:
        self.api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        self.model_id = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
        self.default_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "hpp4J3VqNfWAUOO0d1Us")

    async def synthesize(
        self,
        text: str,
        member_details: Optional[Mapping[str, Any]] = None,
    ) -> bytes:
        api_key = self.api_key or os.getenv("ELEVENLABS_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("ELEVENLABS_API_KEY is missing from backend/.env")
        model_id = self.model_id or os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
        voice_id = (
            (member_details or {}).get("elevenlabs_voice_id")
            or (member_details or {}).get("voice_id")
            or (member_details or {}).get("voiceId")
            or self.default_voice_id
            or os.getenv("ELEVENLABS_VOICE_ID", "hpp4J3VqNfWAUOO0d1Us")
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
