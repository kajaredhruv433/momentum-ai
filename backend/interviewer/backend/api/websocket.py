"""
websocket.py

WebSocket connection manager for streaming real-time interview events to the frontend.
Requirement 45:
Dispatches all canonical interview events:
- interview_created
- interview_started
- agora_connecting
- agora_connected
- microphone_permission_required
- microphone_connected
- microphone_unavailable
- stage_changed
- panel_selected
- speaker_changed
- question_started
- question_finished
- candidate_speaking
- candidate_transcript
- candidate_answer
- timer_started
- timer_update
- decision_processing
- direction_selected
- question_pattern_created
- question_generated
- interview_concluding
- closing_started
- closing_finished
- report_generating
- report_ready
- error
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()


class WebSocketManager:
    """Manages active WebSocket connections keyed by interview_id."""

    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, interview_id: str, websocket: WebSocket) -> None:
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
        await websocket.accept()
        if interview_id not in self.active_connections:
            self.active_connections[interview_id] = set()
        self.active_connections[interview_id].add(websocket)
        logger.info("WebSocket client connected to interview %s", interview_id)

    def disconnect(self, interview_id: str, websocket: WebSocket) -> None:
        if interview_id in self.active_connections:
            self.active_connections[interview_id].discard(websocket)
            if not self.active_connections[interview_id]:
                del self.active_connections[interview_id]
        logger.info("WebSocket client disconnected from interview %s", interview_id)

    async def broadcast(self, interview_id: str, event: str, data: dict) -> None:
        """Broadcast a structured JSON event to all connected clients for the interview."""
        if interview_id not in self.active_connections:
            return

        payload = {
            "event": event,
            "interview_id": interview_id,
            "data": data,
        }
        message = json.dumps(payload, ensure_ascii=False, default=str)
        dead_connections: List[WebSocket] = []

        for connection in list(self.active_connections[interview_id]):
            try:
                await connection.send_text(message)
            except Exception as exc:
                logger.warning("Error sending WebSocket message: %s", exc)
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(interview_id, dead)

    def sync_broadcast(self, interview_id: str, event: str, data: dict) -> None:
        """Thread-safe / synchronous broadcast entrypoint."""
        loop = self.loop
        if not loop or loop.is_closed():
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(interview_id, event, data), loop)
            return

        # Fallback if no active loop is known
        try:
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            new_loop.run_until_complete(self.broadcast(interview_id, event, data))
            new_loop.close()
        except Exception as exc:
            logger.warning("Failed sync_broadcast fallback: %s", exc)


manager = WebSocketManager()


@router.websocket("/api/interviews/{interview_id}/events")
async def websocket_events_endpoint(websocket: WebSocket, interview_id: str):
    await manager.connect(interview_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            # Can receive client ping or candidate mic events
            try:
                data = json.loads(raw)
                event_name = data.get("event")
                if event_name == "ping":
                    await websocket.send_text(json.dumps({"event": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(interview_id, websocket)
    except Exception as exc:
        logger.warning("WebSocket error for interview %s: %s", interview_id, exc)
        manager.disconnect(interview_id, websocket)
