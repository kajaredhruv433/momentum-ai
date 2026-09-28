"""ElevenLabs realtime STT relay used by the browser microphone client."""
from __future__ import annotations

import asyncio
import json
import os
from urllib.parse import urlencode

import websockets
from fastapi import WebSocket


def _url() -> str:
    return "wss://api.elevenlabs.io/v1/speech-to-text/realtime?" + urlencode({
        "model_id": os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2_realtime"),
        "audio_format": "pcm_16000",
        "commit_strategy": "manual",
        "filter_background_audio": "true",
    })


async def relay_realtime_stt(client: WebSocket) -> None:
    """Relay PCM audio and transcript events without exposing the API key to browsers."""
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        await client.send_json({"type": "error", "message": "ELEVENLABS_API_KEY is not configured"})
        return
    async with websockets.connect(_url(), additional_headers={"xi-api-key": api_key}, max_size=None) as eleven:
        async def upstream() -> None:
            while True:
                event = await client.receive_json()
                if event.get("type") == "audio":
                    await eleven.send(json.dumps({"message_type": "input_audio_chunk", "audio_base_64": event.get("audio", ""), "sample_rate": 16000}))
                elif event.get("type") == "commit":
                    await eleven.send(json.dumps({"message_type": "input_audio_chunk", "audio_base_64": "", "commit": True}))
        async def downstream() -> None:
            async for raw in eleven:
                data = json.loads(raw)
                kind = data.get("message_type")
                if kind == "partial_transcript":
                    await client.send_json({"type": "partial", "text": data.get("text", "")})
                elif kind == "committed_transcript":
                    await client.send_json({"type": "final", "text": data.get("text", "")})
                elif kind == "error":
                    await client.send_json({"type": "error", "message": data.get("error", data)})
        tasks = [asyncio.create_task(upstream()), asyncio.create_task(downstream())]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
