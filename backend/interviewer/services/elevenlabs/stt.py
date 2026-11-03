"""ElevenLabs realtime STT relay used by the browser microphone client."""
from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from urllib.parse import urlencode

import websockets
from dotenv import dotenv_values
from fastapi import WebSocket

logger = logging.getLogger(__name__)


def _api_key() -> str:
    """Pick up local backend/.env key rotations without a process restart."""
    file_key = str(dotenv_values(Path(__file__).resolve().parents[3] / ".env").get("ELEVENLABS_API_KEY") or "").strip()
    return file_key or os.getenv("ELEVENLABS_API_KEY", "").strip()


def _url() -> str:
    return "wss://api.elevenlabs.io/v1/speech-to-text/realtime?" + urlencode({
        "model_id": os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2_realtime"),
        "audio_format": "pcm_16000",
        "commit_strategy": "manual",
        "filter_background_audio": "true",
    })


async def relay_realtime_stt(client: WebSocket) -> None:
    """Relay PCM audio and transcript events without exposing the API key to browsers."""
    api_key = _api_key()
    if not api_key:
        await client.send_json({"type": "error", "message": "ELEVENLABS_API_KEY is not configured"})
        return
    logger.info("Opening ElevenLabs realtime STT session")
    try:
        eleven_context = websockets.connect(_url(), additional_headers={"xi-api-key": api_key}, max_size=None)
    except TypeError:
        # Compatibility with older websockets releases.
        eleven_context = websockets.connect(_url(), extra_headers={"xi-api-key": api_key}, max_size=None)
    async with eleven_context as eleven:
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
                    message = str(data.get("error", data))
                    await client.send_json({"type": "error", "message": message, "terminal": True})
                elif kind.endswith("Error") or kind in {"rate_limited", "scribeAuthError", "scribeQuotaExceededError", "scribeUnacceptedTermsError"}:
                    message = str(data.get("error", data.get("message", kind)))
                    terminal = kind not in {"scribeThrottledError", "scribeRateLimitedError", "rate_limited"}
                    await client.send_json({"type": "error", "message": f"ElevenLabs STT: {message}", "terminal": terminal})
        tasks = [asyncio.create_task(upstream()), asyncio.create_task(downstream())]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        terminal_message = None
        should_reconnect = False
        for task in done:
            error = task.exception()
            if error:
                close_reason = getattr(getattr(error, "rcvd", None), "reason", "") or ""
                if "insufficient_funds" in close_reason.lower():
                    terminal_message = "ElevenLabs account has insufficient funds. Add credits to restore speech recognition."
                    logger.error("Realtime STT unavailable: ElevenLabs account has insufficient funds")
                    break
                if close_reason:
                    message = f"ElevenLabs STT connection closed: {close_reason}"
                else:
                    message = f"Realtime speech recognition stopped ({type(error).__name__})"
                logger.error("Realtime STT relay stopped (%s)", type(error).__name__, exc_info=(type(error), error, error.__traceback__))
                try:
                    await client.send_json({"type": "error", "message": message, "terminal": True})
                except Exception:
                    pass
            else:
                # A clean end from either side still means this STT session is
                # over. Tell the browser so it can establish a fresh relay.
                should_reconnect = True
                try:
                    await client.send_json({"type": "error", "message": "Realtime speech recognition session ended; reconnecting"})
                except Exception:
                    pass
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        if terminal_message:
            try:
                await client.send_json({"type": "error", "message": terminal_message, "terminal": True})
                await client.close(code=1011, reason="ElevenLabs account requires credits")
            except Exception:
                pass
        elif should_reconnect:
            try:
                # The browser retries from onclose; without closing this socket
                # it receives the status message but never starts reconnection.
                await client.close(code=1012, reason="Realtime STT session ended")
            except Exception:
                pass
