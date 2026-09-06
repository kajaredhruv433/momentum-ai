"""
events.py

Normalizes Agora events into internal application events.
Requirements 36:
At minimum:
- connected
- disconnected
- speech_started
- transcript_partial
- transcript_final
- speech_finished
- question_started
- question_finished
- error
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class AgoraEventType(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    SPEECH_STARTED = "speech_started"
    TRANSCRIPT_PARTIAL = "transcript_partial"
    TRANSCRIPT_FINAL = "transcript_final"
    SPEECH_FINISHED = "speech_finished"
    QUESTION_STARTED = "question_started"
    QUESTION_FINISHED = "question_finished"
    ERROR = "error"


@dataclass
class AgoraEvent:
    event_type: AgoraEventType
    interview_id: str
    timestamp: float = field(default_factory=time.time)
    data: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event": self.event_type.value,
            "interview_id": self.interview_id,
            "timestamp": self.timestamp,
            "data": self.data,
            "error": self.error_message,
        }


EventHandler = Callable[[AgoraEvent], None]


class AgoraEventEmitter:
    """Dispatches normalized Agora events to subscribed backend listeners."""

    def __init__(self) -> None:
        self._handlers: Dict[AgoraEventType, List[EventHandler]] = {
            t: [] for t in AgoraEventType
        }
        self._global_handlers: List[EventHandler] = []

    def on(self, event_type: AgoraEventType, handler: EventHandler) -> None:
        if handler not in self._handlers[event_type]:
            self._handlers[event_type].append(handler)

    def on_any(self, handler: EventHandler) -> None:
        if handler not in self._global_handlers:
            self._global_handlers.append(handler)

    def emit(self, event: AgoraEvent) -> None:
        for handler in self._handlers.get(event.event_type, []):
            try:
                handler(event)
            except Exception:
                pass

        for handler in self._global_handlers:
            try:
                handler(event)
            except Exception:
                pass
