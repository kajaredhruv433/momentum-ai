"""
timer.py

Authoritative server-side timer for the Momentum AI Interview Platform.
Tracks interview start timestamp, base duration, extended duration, and elapsed time.
The frontend displays the timer, but the backend decides all stage transitions.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

try:
    from .state import EXTENDED, FINAL, NORMAL
except ImportError:
    from state import EXTENDED, FINAL, NORMAL


class InterviewTimer:
    """
    Server-authoritative timer.
    Starts ONLY when ElevenLabs speech-start event fires for the first interview question.
    """

    def __init__(
        self,
        base_time: int = 1800,
        extended_time: int = 2700,
        interview_start_time: Optional[float] = None,
    ) -> None:
        self.base_time = int(base_time)
        self.extended_time = int(extended_time)
        self.interview_start_time: Optional[float] = interview_start_time

    @property
    def is_started(self) -> bool:
        return self.interview_start_time is not None

    def start(self, timestamp: Optional[float] = None) -> float:
        """
        Start the timer. Idempotent: does not overwrite start time if already active.
        """
        if self.interview_start_time is None:
            self.interview_start_time = float(timestamp or time.time())
        return self.interview_start_time

    @property
    def elapsed_time(self) -> int:
        if self.interview_start_time is None:
            return 0
        return max(0, int(time.time() - self.interview_start_time))

    def determine_stage(self) -> str:
        """
        Authoritative stage evaluation according to exact transition rules:
        - NORMAL:   elapsed_time < base_time
        - EXTENDED: base_time <= elapsed_time < extended_time
        - FINAL:    elapsed_time >= extended_time
        """
        elapsed = self.elapsed_time
        if elapsed < self.base_time:
            return NORMAL
        if elapsed < self.extended_time:
            return EXTENDED
        return FINAL

    def to_dict(self) -> Dict[str, Any]:
        return {
            "interview_start_time": self.interview_start_time,
            "base_time": self.base_time,
            "extended_time": self.extended_time,
            "elapsed_time": self.elapsed_time,
            "is_started": self.is_started,
            "stage": self.determine_stage() if self.is_started else "STARTING",
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> InterviewTimer:
        return cls(
            base_time=data.get("base_time", 1800),
            extended_time=data.get("extended_time", 2700),
            interview_start_time=data.get("interview_start_time"),
        )
